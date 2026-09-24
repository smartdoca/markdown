import { parse, postprocess, preprocess } from 'micromark'
import { gfm } from 'micromark-extension-gfm'
import { decodeString } from 'micromark-util-decode-string'

interface Point { offset?: number; line?: number }
interface AstNode {
  type: string; tagName?: string; value?: string
  properties?: Record<string, unknown>; children?: AstNode[]
  position?: { start?: Point; end?: Point }
}
export interface PreviewCharacter { from: number; to: number }
export interface PreviewTextRun { value: string; characters: PreviewCharacter[] }
export interface PreviewMapping { source: string; runs: Map<string, PreviewTextRun> }

/** Parser offsets, never a document/selection text search. UTF-16 matches DOM and Y.Text. */
export function createPreviewMapping(source: string) {
  const characters: Array<PreviewCharacter & { value: string }> = []
  let codeDepth = 0
  for (const [event, token] of postprocess(parse({ extensions: [gfm()] }).document().write(preprocess()(source, 'utf8', true)))) {
    if (token.type === 'codeText') codeDepth += event === 'enter' ? 1 : -1
    if (event !== 'enter') continue
    const from = token.start.offset, to = token.end.offset
    const raw = source.slice(from, to)
    if (['data', 'codeTextData', 'autolinkProtocol', 'autolinkEmail'].includes(token.type)) {
      for (let n = 0; n < raw.length; n++) characters.push({ from: from + n, to: from + n + 1, value: raw[n] === '\0' ? '\uFFFD' : raw[n] })
    } else if (token.type === 'characterEscape' || token.type === 'characterReference') {
      for (const value of decodeString(raw).split('')) characters.push({ from, to, value })
    } else if (token.type === 'lineEnding') {
      if (codeDepth) characters.push({ from, to, value: ' ' })
      else for (let n = 0; n < raw.length; n++) characters.push({ from: from + n, to: from + n + 1, value: raw[n] })
    }
  }
  characters.sort((a, b) => a.from - b.from)
  const mapping: PreviewMapping = { source, runs: new Map() }
  const byPosition = new Map<string, string>()
  const positionKey = (node: AstNode) => `${node.position?.start?.offset}:${node.position?.end?.offset}`
  const firstCharacter = (offset: number) => {
    let lo = 0, hi = characters.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (characters[mid].from < offset) lo = mid + 1; else hi = mid }
    return lo
  }
  // Wrap before rehypeRaw: its HTML parser can merge positioned text with synthetic newlines.
  const beforeRaw = () => (tree: AstNode) => {
    mapping.runs.clear(); byPosition.clear()
    const walk = (node: AstNode, blocked = false) => {
      blocked ||= node.tagName === 'pre' || (node.tagName === 'code' && Boolean(node.properties?.className))
      if (!node.children || blocked) return
      node.children = node.children.map(child => {
        if (child.type !== 'text') { walk(child, blocked); return child }
        const from = child.position?.start?.offset, to = child.position?.end?.offset
        if (from === undefined || to === undefined || !child.value) return child
        const units = []
        for (let i = firstCharacter(from); i < characters.length && characters[i].to <= to; i++) units.push(characters[i])
        // Reject transformations without an exact parser-backed projection. No approximate fallback.
        if (units.map(unit => unit.value).join('') !== child.value) return child
        const id = String(mapping.runs.size)
        mapping.runs.set(id, { value: child.value, characters: units.map(({ from, to }) => ({ from, to })) })
        byPosition.set(positionKey(child), id)
        return { type: 'element', tagName: 'span', properties: {}, position: child.position, children: [child] }
      })
    }
    walk(tree)
  }
  // Run AFTER sanitization. Only parser-generated wrappers receive a mapping attribute;
  // source HTML cannot forge it. Its tag position includes markup, unlike text run positions.
  const afterSanitize = () => (tree: AstNode) => {
    const walk = (node: AstNode) => {
      // Generated after sanitization, so source HTML cannot spoof these offsets.
      if (node.type === 'element' && node.position?.start?.line) {
        node.properties = { ...node.properties, dataExmdSourceLine: node.position.start.line,
          dataExmdSourceEndLine: node.position.end?.line ?? node.position.start.line }
      }
      const id = node.tagName === 'span' ? byPosition.get(positionKey(node)) : undefined
      if (id !== undefined && node.children?.length === 1 && node.children[0].type === 'text'
        && node.children[0].value === mapping.runs.get(id)?.value) {
        node.properties = { ...node.properties, dataExmdText: id }
      }
      node.children?.forEach(walk)
    }
    walk(tree)
  }
  return { mapping, beforeRaw, afterSanitize }
}

export function previewTextNodes(root: HTMLElement, mapping: PreviewMapping) {
  const result: Array<{ node: Text; run: PreviewTextRun }> = []
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement?.closest<HTMLElement>('[data-exmd-text]')
    const run = element && mapping.runs.get(element.dataset.exmdText!)
    if (run && node.nodeValue === run.value && root.contains(element)) result.push({ node: node as Text, run })
  }
  return result
}

export function capturePreviewRange(root: HTMLElement, mapping: PreviewMapping): { from: number; to: number; range: Range } | null {
  const selection = root.ownerDocument.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const mapped = new Map(previewTextNodes(root, mapping).map(item => [item.node, item.run]))
  let from: number | undefined, to: number | undefined
  const walker = root.ownerDocument.createTreeWalker(root, 4)
  for (let item = walker.nextNode(); item; item = walker.nextNode()) {
    if (!range.intersectsNode(item)) continue
    const start = item === range.startContainer ? range.startOffset : 0
    const end = item === range.endContainer ? range.endOffset : item.nodeValue!.length
    if (start >= end) continue
    const run = mapped.get(item as Text)
    if (!run) {
      if (item.nodeValue!.slice(start, end).trim()) return null
      continue // Layout-only newlines have no model character.
    }
    if (!run.characters[start] || !run.characters[end - 1]) return null
    from ??= run.characters[start].from
    to = run.characters[end - 1].to
  }
  // Atomic/generated content cannot silently become a range over unrelated neighbouring prose.
  for (const node of root.querySelectorAll('img,svg,.katex,pre')) if (range.intersectsNode(node)) return null
  return from !== undefined && to !== undefined && from < to ? { from, to, range: range.cloneRange() } : null
}

export function projectPreviewRange(root: HTMLElement, mapping: PreviewMapping, from: number, to: number): Range[] {
  const result: Range[] = []
  for (const { node, run } of previewTextNodes(root, mapping)) {
    let start = -1, end = -1
    run.characters.forEach((unit, index) => {
      if (unit.to > from && unit.from < to) { if (start < 0) start = index; end = index + 1 }
    })
    if (start < 0) continue
    const range = root.ownerDocument.createRange()
    range.setStart(node, start); range.setEnd(node, end)
    result.push(range)
  }
  return result
}

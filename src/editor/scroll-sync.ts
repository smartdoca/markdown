import type { EditorView } from '@codemirror/view'

export type ScrollPoint = { source: number; target: number }
export function projectScroll(points: ScrollPoint[], position: number): number {
  if (!points.length) return position
  if (position <= points[0].source) return points[0].target
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    if (position <= b.source) return a.target + (b.target - a.target) * (position - a.source) / Math.max(1, b.source - a.source)
  }
  return points[points.length - 1].target
}

/** UI-only mapping. No selection dispatch or shared-document writes. */
export function bindCenterScroll(view: () => EditorView | undefined, source: HTMLElement, preview: HTMLElement) {
  let frame = 0, pending: HTMLElement | null = null
  let follower: { node: HTMLElement; top: number } | null = null
  let key = '', points: ScrollPoint[] = []
  const measure = () => {
    const editor = view()
    if (!editor) return []
    const nextKey = [source.scrollHeight, preview.scrollHeight, source.clientWidth, preview.clientWidth, editor.state.doc.length].join(':')
    if (key === nextKey && points.length) return points
    key = nextKey
    const base = editor.documentTop - source.getBoundingClientRect().top + source.scrollTop
    const previewBase = preview.getBoundingClientRect().top - preview.scrollTop
    const entries: ScrollPoint[] = [{ source: 0, target: 0 }]
    const seen = new Set<number>()
    for (const node of preview.querySelectorAll<HTMLElement>('.markdown-body > [data-exmd-source-line]')) {
      const line = Math.max(1, Math.min(editor.state.doc.lines, Number(node.dataset.exmdSourceLine)))
      if (!Number.isFinite(line) || seen.has(line)) continue
      seen.add(line)
      entries.push({ source: base + editor.lineBlockAt(editor.state.doc.line(line).from).top, target: node.getBoundingClientRect().top - previewBase })
      const end = Number(node.dataset.exmdSourceEndLine) + 1
      if (end > line && end <= editor.state.doc.lines && !seen.has(end)) {
        entries.push({ source: base + editor.lineBlockAt(editor.state.doc.line(end).from).top, target: node.getBoundingClientRect().bottom - previewBase })
        seen.add(end)
      }
    }
    entries.push({ source: source.scrollHeight, target: preview.scrollHeight })
    // Keep both axes monotone, including adjacent/nested block boundaries.
    points = entries.sort((a,b) => a.source - b.source).filter((p,i,list) => !i || p.source > list[i-1].source)
    for (let i=1;i<points.length;i++) points[i].target = Math.max(points[i-1].target, points[i].target)
    return points
  }
  const synchronize = () => {
    frame = 0
    const from = pending; pending = null
    if (!from) return
    const to = from === source ? preview : source
    const max = Math.max(0, from.scrollHeight - from.clientHeight), targetMax = Math.max(0, to.scrollHeight - to.clientHeight)
    const map = measure()
    const projected = from === source ? map : map.map(p => ({ source:p.target, target:p.source })).filter((p,i,list) => !i || p.source > list[i-1].source)
    const next = from.scrollTop <= 1 ? 0 : from.scrollTop >= max-1 ? targetMax
      : Math.max(0, Math.min(targetMax, projectScroll(projected, from.scrollTop + from.clientHeight/2) - to.clientHeight/2))
    follower = { node: to, top: next }
    to.scrollTop = next
  }
  const scroll = (event: Event) => {
    const from = event.currentTarget as HTMLElement
    if (follower?.node === from && Math.abs(from.scrollTop - follower.top) < 1) { follower = null; return }
    pending = from
    if (!frame) frame = requestAnimationFrame(synchronize)
  }
  source.addEventListener('scroll', scroll, { passive:true })
  preview.addEventListener('scroll', scroll, { passive:true })
  return () => { cancelAnimationFrame(frame); source.removeEventListener('scroll',scroll); preview.removeEventListener('scroll',scroll) }
}

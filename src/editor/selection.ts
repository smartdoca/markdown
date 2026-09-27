import * as Y from 'yjs'

export interface SerializedRelativePosition { bytes: Uint8Array }
export interface MarkdownTextSelection {
  kind: 'text'
  anchor: SerializedRelativePosition
  focus: SerializedRelativePosition
}
export interface MarkdownTextAnchor {
  kind: 'markdown-text-range'
  start: SerializedRelativePosition
  end: SerializedRelativePosition
  /** Original character identities. Full deletion remains orphaned even if undo inserts replacement identities. */
  content?: Array<{ client: number; clock: number; length: number }>
}
export interface ResolvedTextRange { from: number; to: number }
export interface RemoteMarkdownSelection {
  sessionId: string
  userId: string
  name: string
  color: string
  /** Null removes an unfocused/departed session from the rendering snapshot. */
  selection: MarkdownTextSelection | null
}
export interface MarkdownCommentAnchor {
  id: string
  anchor: MarkdownTextAnchor
  resolved?: boolean
  deleted?: boolean
}

function serialize(position: Y.RelativePosition): SerializedRelativePosition {
  return { bytes: Y.encodeRelativePosition(position) }
}
function deserialize(position: SerializedRelativePosition): Y.RelativePosition {
  return Y.decodeRelativePosition(new Uint8Array(position.bytes))
}
function validIndex(text: Y.Text, index: number) {
  if (!Number.isInteger(index) || index < 0 || index > text.length) throw new RangeError('Invalid Markdown text position')
}
export function createMarkdownTextSelection(text: Y.Text, anchor: number, focus: number): MarkdownTextSelection {
  validIndex(text, anchor); validIndex(text, focus)
  return { kind: 'text', anchor: serialize(Y.createRelativePositionFromTypeIndex(text, anchor)),
    focus: serialize(Y.createRelativePositionFromTypeIndex(text, focus)) }
}
export function resolveMarkdownTextSelection(doc: Y.Doc, text: Y.Text, selection: MarkdownTextSelection): ResolvedTextRange | null {
  const points = resolveMarkdownSelectionPoints(doc, text, selection)
  return points ? { from: Math.min(points.anchor, points.focus), to: Math.max(points.anchor, points.focus) } : null
}
export function resolveMarkdownSelectionPoints(doc: Y.Doc, text: Y.Text, selection: MarkdownTextSelection): { anchor: number; focus: number } | null {
  try {
  if (selection.kind !== 'text') return null
  const anchor = Y.createAbsolutePositionFromRelativePosition(deserialize(selection.anchor), doc, false)
  const focus = Y.createAbsolutePositionFromRelativePosition(deserialize(selection.focus), doc, false)
  if (!anchor || !focus || anchor.type !== text || focus.type !== text) return null
  return { anchor: anchor.index, focus: focus.index }
  } catch { return null }
}
export function createMarkdownTextAnchor(text: Y.Text, from: number, to: number): MarkdownTextAnchor {
  validIndex(text, from); validIndex(text, to)
  if (from >= to) throw new RangeError('A comment anchor requires a nonempty forward range')
  return { kind: 'markdown-text-range',
    start: serialize(Y.createRelativePositionFromTypeIndex(text, from, 0)),
    end: serialize(Y.createRelativePositionFromTypeIndex(text, to, -1)),
    content: captureContentIdentity(text, from, to) }
}
export function resolveMarkdownTextAnchor(doc: Y.Doc, text: Y.Text, anchor: MarkdownTextAnchor): ResolvedTextRange | null {
  if (!anchor || anchor.kind !== 'markdown-text-range') return null
  if (!Array.isArray(anchor.content) || !anchor.content.length) return null
  if (anchor.content && (!Array.isArray(anchor.content) || anchor.content.some(span => !span
    || !Number.isSafeInteger(span.client) || span.client < 0 || !Number.isSafeInteger(span.clock) || span.clock < 0
    || !Number.isSafeInteger(span.length) || span.length <= 0))) return null
  if (anchor.content?.length) {
    const deleted = Y.createDeleteSetFromStructStore(doc.store)
    const allDeleted = anchor.content.every(span => {
      let clock = span.clock
      for (const range of deleted.clients.get(span.client) || []) {
        if (range.clock > clock) break
        if (range.clock + range.len > clock) clock = range.clock + range.len
        if (clock >= span.clock + span.length) return true
      }
      return false
    })
    if (allDeleted) return null
  }
  const points = resolveMarkdownSelectionPoints(doc, text, { kind: 'text', anchor: anchor.start, focus: anchor.end })
  // A fully removed range is orphaned, never render it as a comment on adjacent text.
  return points && points.anchor < points.focus ? { from: points.anchor, to: points.focus } : null
}

// Kept inside the codec boundary. Capture once, iterating Yjs structs rather than every character.
function captureContentIdentity(text: Y.Text, from: number, to: number): NonNullable<MarkdownTextAnchor['content']> {
  const doc = text.doc
  if (!doc) throw new Error('The text must belong to a Y.Doc')
  const spans: NonNullable<MarkdownTextAnchor['content']> = []
  for (const structs of doc.store.clients.values()) {
    for (const item of structs) {
      if (!(item instanceof Y.Item) || item.parent !== text || item.deleted || !item.countable) continue
      const position = Y.createAbsolutePositionFromRelativePosition(
        Y.createRelativePositionFromJSON({ item: item.id, assoc: 0 }), doc, false)
      if (!position) continue
      const start = Math.max(from, position.index), end = Math.min(to, position.index + item.length)
      if (start < end) spans.push({ client: item.id.client, clock: item.id.clock + start - position.index, length: end - start })
    }
  }
  return spans
}

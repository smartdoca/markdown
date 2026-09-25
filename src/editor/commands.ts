import type { EditorView } from '@codemirror/view'

export interface MarkdownCommand {
  id: string
  label: string
  titleKey: string
  prefix: string
  suffix?: string
  placeholderKey?: string
  block?: boolean
}

export interface MarkdownAction {
  label: string
  title: string
  prefix: string
  suffix?: string
  placeholder?: string
  block?: boolean
}

export const actions: MarkdownCommand[] = [
  { id: 'heading1', label: 'H1', titleKey: 'format.heading1', prefix: '# ', block: true },
  { id: 'heading2', label: 'H2', titleKey: 'format.heading2', prefix: '## ', block: true },
  { id: 'heading3', label: 'H3', titleKey: 'format.heading3', prefix: '### ', block: true },
  { id: 'heading4', label: 'H4', titleKey: 'format.heading4', prefix: '#### ', block: true },
  { id: 'heading5', label: 'H5', titleKey: 'format.heading5', prefix: '##### ', block: true },
  { id: 'bold', label: 'B', titleKey: 'format.bold', prefix: '**', suffix: '**', placeholderKey: 'format.boldPlaceholder' },
  { id: 'italic', label: 'I', titleKey: 'format.italic', prefix: '*', suffix: '*', placeholderKey: 'format.italicPlaceholder' },
  { id: 'strike', label: 'S', titleKey: 'format.strike', prefix: '~~', suffix: '~~', placeholderKey: 'format.strikePlaceholder' },
  { id: 'code', label: '</>', titleKey: 'format.inlineCode', prefix: '`', suffix: '`', placeholderKey: 'format.codePlaceholder' },
  { id: 'quote', label: '“', titleKey: 'format.quote', prefix: '> ', block: true },
  { id: 'bullet', label: '•', titleKey: 'format.bulletList', prefix: '- ', block: true },
  { id: 'ordered', label: '1.', titleKey: 'format.orderedList', prefix: '1. ', block: true },
  { id: 'task', label: '☑', titleKey: 'format.task', prefix: '- [ ] ', block: true },
  { id: 'link', label: '↗', titleKey: 'format.link', prefix: '[', suffix: '](https://)', placeholderKey: 'format.linkPlaceholder' },
]

export function applyMarkdownAction(view: EditorView, action: MarkdownAction) {
  const range = view.state.selection.main
  const selected = view.state.sliceDoc(range.from, range.to)
  if (action.block) {
    const line = view.state.doc.lineAt(range.from)
    const insert = action.prefix
    view.dispatch({ changes: { from: line.from, insert }, selection: { anchor: range.from + insert.length, head: range.to + insert.length } })
  } else {
    const content = selected || action.placeholder || ''
    const replacement = `${action.prefix}${content}${action.suffix || ''}`
    const start = range.from + action.prefix.length
    view.dispatch({ changes: { from: range.from, to: range.to, insert: replacement }, selection: { anchor: start, head: start + content.length } })
  }
  view.focus()
}

export function insertAtSelection(view: EditorView, value: string) {
  const range = view.state.selection.main
  view.dispatch({ changes: { from: range.from, to: range.to, insert: value }, selection: { anchor: range.from + value.length } })
  view.focus()
}

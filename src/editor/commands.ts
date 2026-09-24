import type { EditorView } from '@codemirror/view'

export interface MarkdownAction {
  label: string
  title: string
  prefix: string
  suffix?: string
  placeholder?: string
  block?: boolean
}

export const actions: MarkdownAction[] = [
  { label: 'H1', title: '一级标题', prefix: '# ', block: true },
  { label: 'H2', title: '二级标题', prefix: '## ', block: true },
  { label: 'H3', title: '三级标题', prefix: '### ', block: true },
  { label: 'H4', title: '四级标题', prefix: '#### ', block: true },
  { label: 'H5', title: '五级标题', prefix: '##### ', block: true },
  { label: 'B', title: '加粗', prefix: '**', suffix: '**', placeholder: '加粗文字' },
  { label: 'I', title: '斜体', prefix: '*', suffix: '*', placeholder: '斜体文字' },
  { label: 'S', title: '删除线', prefix: '~~', suffix: '~~', placeholder: '删除文字' },
  { label: '</>', title: '行内代码', prefix: '`', suffix: '`', placeholder: '代码' },
  { label: '“', title: '引用', prefix: '> ', block: true },
  { label: '•', title: '无序列表', prefix: '- ', block: true },
  { label: '1.', title: '有序列表', prefix: '1. ', block: true },
  { label: '☑', title: '待办事项', prefix: '- [ ] ', block: true },
  { label: '↗', title: '链接', prefix: '[', suffix: '](https://)', placeholder: '链接文字' },
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

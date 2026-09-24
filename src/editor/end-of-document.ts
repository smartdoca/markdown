import type { EditorView } from '@codemirror/view'

/** Handle only the unused space below the final visual line, not text or editor controls. */
export function focusDocumentEnd(view: EditorView, pane: HTMLElement, event: MouseEvent): boolean {
  if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false
  const target = event.target
  if (target !== pane && target !== view.dom.parentElement && target !== view.dom
    && target !== view.scrollDOM && target !== view.contentDOM) return false
  const bounds = pane.getBoundingClientRect()
  // Keep native scrollbars usable, including when the host scales the editor.
  const scaleX = bounds.width / pane.offsetWidth
  const scaleY = bounds.height / pane.offsetHeight
  if (event.clientX < bounds.left + pane.clientLeft * scaleX
    || event.clientX >= bounds.left + (pane.clientLeft + pane.clientWidth) * scaleX
    || event.clientY >= bounds.top + (pane.clientTop + pane.clientHeight) * scaleY) return false
  const end = view.state.doc.length
  const last = view.coordsAtPos(end)
  if (!last || event.clientY < last.bottom) return false
  view.dispatch({ selection: { anchor: end }, scrollIntoView: true })
  view.focus()
  return true
}

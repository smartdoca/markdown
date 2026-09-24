import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import type * as Y from 'yjs'
import { resolveMarkdownSelectionPoints, resolveMarkdownTextAnchor, type MarkdownCommentAnchor, type RemoteMarkdownSelection } from './selection'

export const setRemoteSelectionsEffect = StateEffect.define<RemoteMarkdownSelection[]>()
export const setCommentAnchorsEffect = StateEffect.define<MarkdownCommentAnchor[]>()
export const activateCommentAnchorEffect = StateEffect.define<string | null>()
export const refreshAnnotationsEffect = StateEffect.define<void>()
interface AnnotationState {
  remote: RemoteMarkdownSelection[]
  comments: MarkdownCommentAnchor[]
  active: string | null
}
const annotationState = StateField.define<AnnotationState>({
  create: () => ({ remote: [], comments: [], active: null }),
  update: (state, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setRemoteSelectionsEffect)) state = { ...state, remote: effect.value }
      if (effect.is(setCommentAnchorsEffect)) state = { ...state, comments: effect.value,
        active: effect.value.some(item => item.id === state.active && !item.resolved && !item.deleted) ? state.active : null }
      if (effect.is(activateCommentAnchorEffect)) state = { ...state, active: effect.value }
    }
    return state
  },
})

class RemoteCaret extends WidgetType {
  constructor(readonly sessionId: string, readonly name: string, readonly color: string) { super() }
  eq(other: RemoteCaret) { return this.sessionId === other.sessionId && this.name === other.name && this.color === other.color }
  toDOM() {
    const caret = document.createElement('span')
    caret.className = 'exmd-remote-caret'
    caret.dataset.sessionId = this.sessionId
    caret.style.setProperty('--exmd-selection-color', this.color)
    caret.setAttribute('aria-label', this.name + ' 的光标')
    const label = caret.appendChild(document.createElement('span'))
    label.className = 'exmd-remote-label'
    label.textContent = this.name
    return caret
  }
  ignoreEvent() { return true }
}

/** Comes after yCollab: resolve relative positions after local Y.Text projection, not before. */
export function createAnnotationsExtension(text: Y.Text, runtime: {
  showRemote(): boolean
  onAnchorClick(id: string): void
}) {
  const render = (view: EditorView): DecorationSet => {
    const doc = text.doc
    if (!doc) return Decoration.none
    const state = view.state.field(annotationState)
    const ranges = []
    if (runtime.showRemote()) {
      const sessions = new Map(state.remote.map(item => [item.sessionId, item]))
      for (const item of sessions.values()) {
        if (!item.selection) continue
        const points = resolveMarkdownSelectionPoints(doc, text, item.selection)
        if (!points) continue
        const color = /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : '#7357d8'
        const from = Math.min(points.anchor, points.focus), to = Math.max(points.anchor, points.focus)
        if (to > from) ranges.push(Decoration.mark({
          class: 'exmd-remote-selection', attributes: { 'data-session-id': item.sessionId,
            style: '--exmd-selection-color:' + color },
        }).range(from, to))
        ranges.push(Decoration.widget({ widget: new RemoteCaret(item.sessionId, item.name, color), side: 1 }).range(points.focus))
      }
    }
    for (const item of state.comments) {
      if (item.resolved || item.deleted) continue
      const range = resolveMarkdownTextAnchor(doc, text, item.anchor)
      if (!range) continue
      ranges.push(Decoration.mark({
        class: 'exmd-comment-anchor' + (item.id === state.active ? ' exmd-comment-active' : ''),
        attributes: { 'data-comment-id': item.id },
      }).range(range.from, range.to))
    }
    return Decoration.set(ranges, true)
  }
  return [
    annotationState,
    ViewPlugin.fromClass(class {
      decorations: DecorationSet
      composing = false
      frame = 0
      constructor(view: EditorView) { this.decorations = render(view) }
      update(update: ViewUpdate) {
        // Remote caret/anchor effects must not rebuild the composing DOM node.
        // This is particularly important after select-all deletes the final line.
        if (this.composing || update.view.composing) {
          this.decorations = this.decorations.map(update.changes)
          return
        }
        if (update.docChanged || update.viewportChanged || update.transactions.some(tr => tr.effects.length)) {
          this.decorations = render(update.view)
        }
      }
      destroy() { cancelAnimationFrame(this.frame) }
    }, {
      decorations: plugin => plugin.decorations,
      eventHandlers: {
        compositionstart() { cancelAnimationFrame(this.frame); this.composing = true },
        compositionend(_event, view) {
          cancelAnimationFrame(this.frame)
          this.frame = requestAnimationFrame(() => {
            this.composing = false
            view.dispatch({ effects: refreshAnnotationsEffect.of() })
          })
        },
      },
    }),
    EditorView.domEventHandlers({
      click: (event, view) => {
        const element = event.target instanceof Element ? event.target.closest('[data-comment-id]') : null
        let id = element?.getAttribute('data-comment-id')
        if (id && view.dom.contains(element)) {
          const state = view.state.field(annotationState)
          const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
          const ids = position === null ? [id] : [...new Set(state.comments.filter(item => {
            const range = !item.deleted && !item.resolved && text.doc && resolveMarkdownTextAnchor(text.doc, text, item.anchor)
            return range && position >= range.from && position < range.to
          }).map(item => item.id))]
          if (ids.length) id = ids[(ids.indexOf(state.active || '') + 1) % ids.length]
          view.dispatch({ effects: activateCommentAnchorEffect.of(id) })
          runtime.onAnchorClick(id)
        }
        return false
      },
    }),
  ]
}

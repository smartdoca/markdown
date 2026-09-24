import type * as Y from 'yjs'
import { capturePreviewRange, projectPreviewRange, type PreviewMapping } from './preview-mapping'
import { createMarkdownTextAnchor, resolveMarkdownTextAnchor, type MarkdownCommentAnchor, type MarkdownTextAnchor } from './selection'

/** Forward this prop when wrapping MarkdownPreview. Custom renderers must provide their own precise mapping. */
export interface MarkdownPreviewInteraction {
  attach(root: HTMLElement, mapping: PreviewMapping): () => void
}
export interface PreviewController extends MarkdownPreviewInteraction {
  capture(): MarkdownTextAnchor | null
  selectionRect(): DOMRect | null
  reveal(anchor: MarkdownTextAnchor): boolean
  setComments(comments: MarkdownCommentAnchor[]): void
  setActive(id: string | null): void
  clearSelection(): void
}

export function createPreviewController(text: Y.Text, runtime: {
  activate(): void
  isActive(): boolean
  selectionChanged(): void
  click(id: string): void
}): PreviewController {
  let root: HTMLElement | undefined, mapping: PreviewMapping | undefined
  let comments: MarkdownCommentAnchor[] = [], active: string | null = null
  let cached: MarkdownTextAnchor | null = null, restorePending = false
  let schedule = () => {}
  const ready = () => Boolean(root && mapping && mapping.source === text.toString())
  const capture = () => {
    if (!ready()) return null
    const selected = capturePreviewRange(root!, mapping!)
    return selected ? createMarkdownTextAnchor(text, selected.from, selected.to) : null
  }
  const ranges = (anchor: MarkdownTextAnchor) => {
    const range = text.doc && resolveMarkdownTextAnchor(text.doc, text, anchor)
    return ready() && range ? projectPreviewRange(root!, mapping!, range.from, range.to) : []
  }
  const controller: PreviewController = {
    capture,
    selectionRect: () => ready() ? capturePreviewRange(root!, mapping!)?.range.getBoundingClientRect() || null : null,
    clearSelection: () => { cached = null; restorePending = false },
    setComments: next => { comments = [...new Map(next.map(item => [item.id, item])).values()]; schedule() },
    setActive: id => { active = id; schedule() },
    reveal: anchor => {
      const projected = ranges(anchor)
      if (!projected.length) return false
      runtime.activate()
      projected[0].startContainer.parentElement?.scrollIntoView({ block: 'center', inline: 'nearest' })
      schedule()
      return true
    },
    attach: (element, nextMapping) => {
      root = element; mapping = nextMapping
      const document = root.ownerDocument, window = document.defaultView!
      // Overlays do not split/mutate selectable text, so active DOM ranges survive decoration updates.
      const layer = document.createElement('div')
      layer.className = 'exmd-preview-annotations'
      layer.setAttribute('aria-hidden', 'true')
      Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '4' })
      document.body.append(layer)
      let frame = 0
      let hitRects: Array<{ id: string; left: number; right: number; top: number; bottom: number }> = []
      const paint = () => {
        frame = 0; layer.replaceChildren(); hitRects = []
        if (!comments.length || !ready() || !element.getClientRects().length) return
        // Clip against every scrolling ancestor and sticky preview header. Geometry stays in viewport CSS pixels.
        let clip = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
        for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
          const style = window.getComputedStyle(parent)
          if (/(auto|scroll|hidden|clip)/.test(style.overflow + style.overflowX + style.overflowY)) {
            const box = parent.getBoundingClientRect()
            clip = { left: Math.max(clip.left, box.left), right: Math.min(clip.right, box.right),
              top: Math.max(clip.top, box.top), bottom: Math.min(clip.bottom, box.bottom) }
          }
          if (parent.classList.contains('preview-pane')) {
            const header = parent.querySelector('.pane-label')?.getBoundingClientRect()
            if (header) clip.top = Math.max(clip.top, header.bottom)
          }
        }
        for (const comment of comments) {
          if (comment.resolved || comment.deleted) continue
          for (const range of ranges(comment.anchor)) for (const rect of range.getClientRects()) {
            const left = Math.max(rect.left, clip.left), right = Math.min(rect.right, clip.right)
            const top = Math.max(rect.top, clip.top), bottom = Math.min(rect.bottom, clip.bottom)
            if (right <= left || bottom <= top) continue
            const mark = document.createElement('span')
            mark.dataset.commentId = comment.id
            mark.className = 'exmd-preview-comment' + (comment.id === active ? ' exmd-preview-comment-active' : '')
            Object.assign(mark.style, { position: 'absolute', left: left + 'px', top: top + 'px',
              width: right - left + 'px', height: bottom - top + 'px', boxSizing: 'border-box',
              borderBottom: '2px solid #d8a12c', background: comment.id === active ? '#ffd86666' : 'transparent' })
            layer.append(mark)
            hitRects.push({ id: comment.id, left, right, top, bottom })
          }
        }
      }
      schedule = () => { if (!frame) frame = window.requestAnimationFrame(paint) }
      const select = () => {
        const selection = document.getSelection()
        const inPreview = selection?.anchorNode && element.contains(selection.anchorNode)
        if (!inPreview && !runtime.isActive()) return
        if (!ready()) return // Old DOM projection must never be interpreted against new model offsets.
        if (inPreview) runtime.activate()
        if (runtime.isActive()) { cached = capture(); runtime.selectionChanged() }
      }
      const pointer = () => { runtime.activate(); cached = null; restorePending = false }
      const click = (event: MouseEvent) => {
        if (!ready() || !document.getSelection()?.isCollapsed) return
        const ids = [...new Set(hitRects.filter(rect => event.clientX >= rect.left && event.clientX <= rect.right
          && event.clientY >= rect.top && event.clientY <= rect.bottom).map(rect => rect.id))]
        if (!ids.length) return
        event.preventDefault() // A commented link opens its comment; do not navigate away.
        const id = ids[(ids.indexOf(active || '') + 1) % ids.length]
        runtime.click(id)
      }
      const changed = () => { restorePending = runtime.isActive() && Boolean(cached); schedule() }
      element.addEventListener('pointerdown', pointer)
      element.addEventListener('click', click)
      document.addEventListener('selectionchange', select)
      document.addEventListener('scroll', schedule, true)
      window.addEventListener('resize', schedule)
      window.visualViewport?.addEventListener('resize', schedule)
      window.visualViewport?.addEventListener('scroll', schedule)
      const observer = new ResizeObserver(schedule); observer.observe(element)
      const layout = new MutationObserver(schedule)
      for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
        layout.observe(parent, { attributes: true, attributeFilter: ['style', 'class'] })
      }
      document.fonts?.addEventListener('loadingdone', schedule)
      text.observe(changed)
      if (restorePending && cached && runtime.isActive()) {
        const projected = ranges(cached)
        if (projected.length) {
          const range = document.createRange(), last = projected[projected.length - 1]
          range.setStart(projected[0].startContainer, projected[0].startOffset)
          range.setEnd(last.endContainer, last.endOffset)
          const selection = document.getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
        } else { cached = null; document.getSelection()?.removeAllRanges() }
      }
      restorePending = false
      schedule()
      return () => {
        element.removeEventListener('pointerdown', pointer); element.removeEventListener('click', click)
        document.removeEventListener('selectionchange', select); document.removeEventListener('scroll', schedule, true)
        window.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('resize', schedule)
        window.visualViewport?.removeEventListener('scroll', schedule)
        observer.disconnect(); layout.disconnect(); document.fonts?.removeEventListener('loadingdone', schedule)
        text.unobserve(changed); window.cancelAnimationFrame(frame); layer.remove()
        root = undefined; mapping = undefined; schedule = () => {}
      }
    },
  }
  return controller
}

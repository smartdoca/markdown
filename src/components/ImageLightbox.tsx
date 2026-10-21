import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import { translate, type EditorMessages } from '../editor/i18n'
import type { MarkdownPreviewImage } from '../editor/image-preview'

interface ImageLightboxProps {
  images: readonly MarkdownPreviewImage[]
  index: number
  onClose(): void
  locale?: string
  messages?: EditorMessages
}

interface ImageView { scale: number; x: number; y: number }
interface ImageGesture {
  pointerId: number
  type: string
  startX: number
  startY: number
  view: ImageView
  moved: boolean
  backdrop: boolean
  singlePointer: boolean
}
const initialView = (): ImageView => ({ scale: 1, x: 0, y: 0 })

/** A view-only gallery. Resource authorization and URL resolution stay with the host. */
export function ImageLightbox({ images, index, onClose, locale, messages }: ImageLightboxProps) {
  const [active, setActive] = useState(index)
  const [view, setView] = useState(initialView)
  const [dragging, setDragging] = useState(false)
  const [failed, setFailed] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const gesture = useRef<ImageGesture | null>(null)
  const currentView = useRef(view)
  const live = useRef({ onClose, active, images })
  currentView.current = view
  live.current = { onClose, active, images }
  const image = images[active]
  const t = (key: string, values?: Record<string, string | number>) => translate(locale, key, values, messages)

  const move = (direction: number) => {
    setActive(current => Math.max(0, Math.min(images.length - 1, current + direction)))
  }
  const zoom = (factor: number) => setView(current => ({ ...current, scale: Math.max(.2, Math.min(8, current.scale * factor)) }))

  useEffect(() => {
    setActive(index)
  }, [index])
  useEffect(() => {
    gesture.current = null
    setDragging(false)
    setView(initialView())
    setFailed(false)
  }, [active, image?.src])
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        live.current.onClose()
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        event.stopPropagation()
        const direction = event.key === 'ArrowLeft' ? -1 : 1
        setActive(current => Math.max(0, Math.min(live.current.images.length - 1, current + direction)))
      } else if (event.key === 'Tab') {
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])
        const first = controls[0], last = controls.at(-1)
        if (!first || !last) { event.preventDefault(); return }
        const focused = document.activeElement
        if (event.shiftKey && (focused === first || focused === dialog.current)) {
          event.preventDefault(); last.focus()
        } else if (!event.shiftKey && (focused === last || focused === dialog.current)) {
          event.preventDefault(); first.focus()
        }
      }
    }
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.current?.contains(event.target)) dialog.current?.focus()
    }
    document.addEventListener('keydown', keys, true)
    document.addEventListener('focusin', containFocus)
    return () => {
      document.removeEventListener('keydown', keys, true)
      document.removeEventListener('focusin', containFocus)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      setView(current => ({ ...current, scale: Math.max(.2, Math.min(8, current.scale * Math.exp(-event.deltaY * .002))) }))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [])

  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current) { gesture.current.singlePointer = false; return }
    if (event.button !== 0) return
    event.preventDefault()
    gesture.current = {
      pointerId: event.pointerId, type: event.pointerType,
      startX: event.clientX, startY: event.clientY, view: currentView.current,
      moved: false, backdrop: event.target === event.currentTarget, singlePointer: true,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }
  const pan = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    const dx = event.clientX - current.startX, dy = event.clientY - current.startY
    if (Math.hypot(dx, dy) > 4) current.moved = true
    setView({ ...current.view, x: current.view.x + dx, y: current.view.y + dy })
  }
  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    gesture.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (cancelled) return
    const dx = event.clientX - current.startX, dy = event.clientY - current.startY
    if (current.type === 'touch' && current.singlePointer && current.view.scale === 1 && Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setView(initialView())
      move(dx < 0 ? 1 : -1)
    } else if (!current.moved && Math.hypot(dx, dy) <= 4 && current.backdrop) {
      onClose()
    }
  }

  if (!image) return null
  return createPortal(<div ref={dialog} className="exmd-image-lightbox" role="dialog" aria-modal="true"
    aria-label={t('image.preview')} tabIndex={-1}>
    <div className="exmd-image-lightbox-toolbar">
      <span className="exmd-image-lightbox-title">{image.title || image.alt || t(image.kind === 'mermaid' ? 'image.diagram' : 'image.image')}</span>
      <span className="exmd-image-lightbox-counter" aria-live="polite">{t('image.counter', { current: active + 1, total: images.length })}</span>
      <button type="button" aria-label={t('image.zoomOut')} title={t('image.zoomOut')} onClick={() => zoom(1 / 1.25)} disabled={view.scale <= .2}><ZoomOut /></button>
      <span className="exmd-image-lightbox-scale">{Math.round(view.scale * 100)}%</span>
      <button type="button" aria-label={t('image.zoomIn')} title={t('image.zoomIn')} onClick={() => zoom(1.25)} disabled={view.scale >= 8}><ZoomIn /></button>
      <button type="button" aria-label={t('image.reset')} title={t('image.reset')} onClick={() => setView(initialView())}><RotateCcw /></button>
      <button type="button" className="exmd-image-lightbox-close" aria-label={t('image.close')} title={t('image.close')} onClick={onClose}><X /></button>
    </div>
    <div ref={stage} className={`exmd-image-lightbox-stage${dragging ? ' is-dragging' : ''}`}
      onPointerDown={start} onPointerMove={pan} onPointerUp={event => finish(event)}
      onPointerCancel={event => finish(event, true)} onLostPointerCapture={() => { gesture.current = null; setDragging(false) }}>
      {image.src && !failed ? <img className="exmd-image-lightbox-image" src={image.src} alt={image.alt} draggable={false}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }} onError={() => setFailed(true)} />
        : <p className="exmd-image-lightbox-unavailable" role="status">{t('image.unavailable')}</p>}
    </div>
    {images.length > 1 && <>
      <button type="button" className="exmd-image-lightbox-previous" aria-label={t('image.previous')} title={t('image.previous')}
        onClick={() => move(-1)} disabled={active === 0}><ChevronLeft /></button>
      <button type="button" className="exmd-image-lightbox-next" aria-label={t('image.next')} title={t('image.next')}
        onClick={() => move(1)} disabled={active === images.length - 1}><ChevronRight /></button>
    </>}
    <p className="exmd-image-lightbox-hint">{t('image.hint')}</p>
  </div>, document.body)
}

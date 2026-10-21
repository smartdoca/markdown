/** A view-only media occurrence in the current Markdown document. */
export interface MarkdownPreviewImage {
  /** Source identity plus occurrence; stable across URL refreshes and unrelated text edits. Not a permanent anchor. */
  id: string
  kind: 'image' | 'mermaid'
  /** Original Markdown resource path. The host owns its authorization and URL resolution. */
  path?: string
  /** Currently resolved display URL, or generated Mermaid SVG data URL. Never persist it. */
  src?: string
  alt: string
  title?: string
  /** UTF-16 offsets in the displayed Markdown snapshot, when supplied by the parser. */
  source?: { from: number; to: number }
  width?: number
  height?: number
}

export interface MarkdownImagePreviewEvent {
  image: MarkdownPreviewImage
  /** All media occurrences in this preview, in document order, including unresolved images. */
  images: readonly MarkdownPreviewImage[]
  index: number
}

export function collectPreviewImages(root: HTMLElement) {
  const occurrences = new Map<string, number>()
  const elements: HTMLElement[] = []
  const images: MarkdownPreviewImage[] = []
  for (const element of root.querySelectorAll<HTMLElement>('[data-exmd-preview-kind]')) {
    const kind = element.dataset.exmdPreviewKind
    if (kind !== 'image' && kind !== 'mermaid') continue
    const key = element.dataset.exmdPreviewKey || ''
    const identity = `${kind}:${key.length}:${key}`
    const occurrence = occurrences.get(identity) || 0
    occurrences.set(identity, occurrence + 1)
    const image: MarkdownPreviewImage = {
      id: `${identity}:${occurrence}`, kind,
      alt: element.getAttribute('alt') || element.dataset.exmdPreviewAlt || '',
    }
    const title = element.getAttribute('title')
    if (title) image.title = title
    const from = element.dataset.exmdPreviewFrom, to = element.dataset.exmdPreviewTo
    if (from !== undefined && to !== undefined) image.source = { from: Number(from), to: Number(to) }
    if (kind === 'image') {
      const img = element as HTMLImageElement
      image.path = key
      image.src = img.getAttribute('src') || undefined
      if (img.naturalWidth) image.width = img.naturalWidth
      if (img.naturalHeight) image.height = img.naturalHeight
    } else {
      const svg = element.querySelector('svg')
      if (!svg) continue
      const Serializer = root.ownerDocument.defaultView?.XMLSerializer
      if (!Serializer) continue
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new Serializer().serializeToString(svg))}`
      if (svg.viewBox.baseVal.width) image.width = svg.viewBox.baseVal.width
      if (svg.viewBox.baseVal.height) image.height = svg.viewBox.baseVal.height
    }
    elements.push(element)
    images.push(image)
  }
  return { elements, images }
}

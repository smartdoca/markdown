import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ImgHTMLAttributes } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { MermaidDiagram } from './MermaidDiagram'
import { CodeBlock } from './CodeBlock'
import { createPreviewMapping } from '../editor/preview-mapping'
import { translate, type EditorMessages } from '../editor/i18n'
import type { MarkdownPreviewInteraction } from '../editor/preview-interaction'
import { collectPreviewImages, type MarkdownImagePreviewEvent } from '../editor/image-preview'
import { ImageLightbox } from './ImageLightbox'

const colorSchema = {
  ...defaultSchema,
  attributes: { ...defaultSchema.attributes, span: [...(defaultSchema.attributes?.span || []), 'dataColor'] },
}

const baseComponents: ComponentProps<typeof Markdown>['components'] = {
  a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
  span: ({ node, children, ...props }) => {
    const color = node?.properties?.dataColor
    const safeColor = typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined
    return <span {...props} style={safeColor ? { ...props.style, color: safeColor } : props.style}>{children}</span>
  },
  pre: ({ children, node }) => <div data-exmd-source-line={node?.position?.start.line} data-exmd-source-end-line={node?.position?.end.line}>{children}</div>,
}

export interface MarkdownPreviewProps {
  value: string
  resolveImageUrl?: (path: string) => string | Promise<string>
  /** When supplied, the host takes over preview and gallery navigation, including in readonly mode. */
  onImagePreview?: (event: MarkdownImagePreviewEvent) => void
  /** Forward unchanged from a custom Preview wrapper to retain precise selection/comment support. */
  interaction?: MarkdownPreviewInteraction
  locale?: string
  messages?: EditorMessages
}

export const MarkdownPreview = memo(function MarkdownPreview({ value, resolveImageUrl, onImagePreview, interaction, locale, messages }: MarkdownPreviewProps) {
  const root = useRef<HTMLElement>(null)
  const [opened, setOpened] = useState<MarkdownImagePreviewEvent | null>(null)
  useEffect(() => setOpened(null), [value, resolveImageUrl, onImagePreview])
  const isOpen = opened !== null
  useEffect(() => {
    const article = root.current
    if (!isOpen || !article) return
    const refresh = () => {
      const currentImages = new Map(collectPreviewImages(article).images.map(image => [image.id, image]))
      setOpened(current => {
        if (!current) return null
        const images = current.images.map(image => currentImages.get(image.id) || image)
        return { images, index: current.index, image: images[current.index] }
      })
    }
    const observer = new MutationObserver(refresh)
    observer.observe(article, { attributes: true, subtree: true, attributeFilter: ['src'] })
    article.addEventListener('load', refresh, true)
    return () => { observer.disconnect(); article.removeEventListener('load', refresh, true) }
  }, [isOpen])
  const openImage = useCallback((target: EventTarget | null) => {
    const article = root.current
    if (!article || !target || !(target as Element).closest) return false
    const element = (target as Element).closest<HTMLElement>('[data-exmd-preview-kind]')
    if (!element || !article.contains(element)) return false
    const { elements, images } = collectPreviewImages(article)
    const index = elements.indexOf(element)
    if (index < 0) return false
    const event = { image: images[index], images, index }
    if (onImagePreview) onImagePreview(event)
    else setOpened(event)
    return true
  }, [onImagePreview])
  const projection = useMemo(() => interaction ? createPreviewMapping(value) : null, [value, interaction])
  useLayoutEffect(() => {
    if (root.current && projection && interaction) return interaction.attach(root.current, projection.mapping)
  }, [projection, interaction])
  const components = useMemo<ComponentProps<typeof Markdown>['components']>(() => ({
    ...baseComponents,
    code: ({ className, children, ...props }) => {
      const match = /language-([\w-]+)/.exec(className || '')
      const code = String(children)
      if (match?.[1] === 'mermaid') return <div data-exmd-preview-kind="mermaid" data-exmd-preview-key={code}
        data-exmd-preview-from={props.node?.position?.start.offset} data-exmd-preview-to={props.node?.position?.end.offset}
        data-exmd-preview-alt={translate(locale, 'image.diagram', undefined, messages)} role="button" tabIndex={0}
        aria-label={translate(locale, 'image.open', { name: translate(locale, 'image.diagram', undefined, messages) }, messages)}>
        <MermaidDiagram code={code.replace(/\n$/, '')} locale={locale} messages={messages} /></div>
      if (match) return <CodeBlock code={code} language={match[1]} />
      return <code className={className} {...props}>{children}</code>
    },
    img: ({ node, alt, src, ...props }) => <ResolvedImage {...props} alt={alt || ''} path={src || ''} resolveUrl={resolveImageUrl}
      data-exmd-preview-kind="image" data-exmd-preview-key={src || ''}
      data-exmd-preview-from={node?.position?.start.offset} data-exmd-preview-to={node?.position?.end.offset}
      role="button" tabIndex={0} aria-label={translate(locale, 'image.open', { name: alt || translate(locale, 'image.image', undefined, messages) }, messages)} />,
  }), [resolveImageUrl, locale, messages])
  return <><article ref={root} className="markdown-body" onClick={event => {
    if (openImage(event.target)) { event.preventDefault(); event.stopPropagation() }
  }} onKeyDown={event => {
    if ((event.key === 'Enter' || event.key === ' ') && openImage(event.target)) {
      event.preventDefault(); event.stopPropagation()
    }
  }}>
    <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[
      ...(projection ? [projection.beforeRaw] : []),
      // No raw HTML can exist without '<'. Keep sanitization on both paths.
      ...(value.includes('<') ? [rehypeRaw] : []), [rehypeSanitize, colorSchema],
      ...(projection ? [projection.afterSanitize] : []), rehypeKatex,
    ]} components={components}>{value}</Markdown>
  </article>{opened && <ImageLightbox images={opened.images} index={opened.index} onClose={() => setOpened(null)} locale={locale} messages={messages} />}</>
})

function ResolvedImage({ path, resolveUrl, alt, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  path: string; resolveUrl?: (path: string) => string | Promise<string>
}) {
  const [resolved, setResolved] = useState<{ path: string; resolveUrl: typeof resolveUrl; src: string } | null>(null)
  const src = resolveUrl ? resolved?.path === path && resolved.resolveUrl === resolveUrl ? resolved.src : '' : path
  useEffect(() => {
    let active = true
    if (!resolveUrl) return
    Promise.resolve().then(() => resolveUrl(path)).then(src => { if (active) setResolved({ path, resolveUrl, src }) })
      .catch(() => { if (active) setResolved({ path, resolveUrl, src: '' }) })
    return () => { active = false }
  }, [path, resolveUrl])
  return <img {...props} src={src || undefined} alt={alt || ''} loading="lazy" />
}

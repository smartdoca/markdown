import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ImgHTMLAttributes } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { MermaidDiagram } from './MermaidDiagram'
import { CodeBlock } from './CodeBlock'
import { createPreviewMapping } from '../editor/preview-mapping'
import type { MarkdownPreviewInteraction } from '../editor/preview-interaction'

const colorSchema = {
  ...defaultSchema,
  attributes: { ...defaultSchema.attributes, span: [...(defaultSchema.attributes?.span || []), 'dataColor'] },
}

const baseComponents: ComponentProps<typeof Markdown>['components'] = {
  a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
  span: ({ node, children, ...props }) => {
    const color = node?.properties?.dataColor
    const safeColor = typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : undefined
    return <span {...props} style={safeColor ? { color: safeColor } : undefined}>{children}</span>
  },
  pre: ({ children, node }) => <div data-exmd-source-line={node?.position?.start.line} data-exmd-source-end-line={node?.position?.end.line}>{children}</div>,
  code: ({ className, children, ...props }) => {
    const match = /language-([\w-]+)/.exec(className || '')
    const code = String(children)
    if (match?.[1] === 'mermaid') return <MermaidDiagram code={code.replace(/\n$/, '')} />
    if (match) return <CodeBlock code={code} language={match[1]} />
    return <code className={className} {...props}>{children}</code>
  },
}

export interface MarkdownPreviewProps {
  value: string
  resolveImageUrl?: (path: string) => string | Promise<string>
  /** Forward unchanged from a custom Preview wrapper to retain precise selection/comment support. */
  interaction?: MarkdownPreviewInteraction
}

export const MarkdownPreview = memo(function MarkdownPreview({ value, resolveImageUrl, interaction }: MarkdownPreviewProps) {
  const root = useRef<HTMLElement>(null)
  const projection = useMemo(() => interaction ? createPreviewMapping(value) : null, [value, interaction])
  useLayoutEffect(() => {
    if (root.current && projection && interaction) return interaction.attach(root.current, projection.mapping)
  }, [projection, interaction])
  const components = useMemo<ComponentProps<typeof Markdown>['components']>(() => ({
    ...baseComponents,
    img: ({ alt, src, ...props }) => <ResolvedImage {...props} alt={alt || ''} path={src || ''} resolveUrl={resolveImageUrl} />,
  }), [resolveImageUrl])
  return <article ref={root} className="markdown-body">
    <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[
      ...(projection ? [projection.beforeRaw] : []),
      // No raw HTML can exist without '<'. Keep sanitization on both paths.
      ...(value.includes('<') ? [rehypeRaw] : []), [rehypeSanitize, colorSchema],
      ...(projection ? [projection.afterSanitize] : []), rehypeKatex,
    ]} components={components}>{value}</Markdown>
  </article>
})

function ResolvedImage({ path, resolveUrl, alt, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  path: string; resolveUrl?: (path: string) => string | Promise<string>
}) {
  const [src, setSrc] = useState(() => resolveUrl ? '' : path)
  useEffect(() => {
    let active = true
    if (!resolveUrl) { setSrc(path); return () => { active = false } }
    Promise.resolve(resolveUrl(path)).then(value => { if (active) setSrc(value) }).catch(() => { if (active) setSrc('') })
    return () => { active = false }
  }, [path, resolveUrl])
  return <img {...props} src={src || undefined} alt={alt || ''} loading="lazy" />
}

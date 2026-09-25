import { memo, useEffect, useId, useState } from 'react'
import { translate, type EditorMessages } from '../editor/i18n'

let initialized = false

export interface MermaidDiagramProps { code: string; locale?: string; messages?: EditorMessages }
export const MermaidDiagram = memo(function MermaidDiagram({ code, locale, messages }: MermaidDiagramProps) {
  const reactId = useId().replace(/:/g, '')
  const [svg, setSvg] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    const id = `mermaid-${reactId}-${Date.now()}`
    import('mermaid').then(({ default: mermaid }) => {
      if (!initialized) {
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', fontFamily: 'Inter, system-ui, sans-serif' })
        initialized = true
      }
      return mermaid.render(id, code)
    }).then(({ svg: result }) => { if (active) { setSvg(result); setFailed(false) } })
      .catch(() => { if (active) { setSvg(''); setFailed(true) } })
    return () => { active = false }
  }, [code, reactId])
  if (failed) return <div className="diagram-error">{translate(locale, 'diagram.syntaxError', undefined, messages)}</div>
  return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
})

import { memo, useEffect, useId, useState } from 'react'

let initialized = false

export interface MermaidDiagramProps { code: string }
export const MermaidDiagram = memo(function MermaidDiagram({ code }: MermaidDiagramProps) {
  const reactId = useId().replace(/:/g, '')
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const id = `mermaid-${reactId}-${Date.now()}`
    import('mermaid').then(({ default: mermaid }) => {
      if (!initialized) {
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', fontFamily: 'Inter, system-ui, sans-serif' })
        initialized = true
      }
      return mermaid.render(id, code)
    }).then(({ svg: result }) => { if (active) { setSvg(result); setError('') } })
      .catch(() => { if (active) { setSvg(''); setError('流程图语法有误，请检查 Mermaid 代码。') } })
    return () => { active = false }
  }, [code, reactId])
  if (error) return <div className="diagram-error">{error}</div>
  return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
})

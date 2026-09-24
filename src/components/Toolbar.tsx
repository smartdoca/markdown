import { ImagePlus, PanelLeft, PanelRight, Columns2, Redo2, Sigma, Undo2, Workflow } from 'lucide-react'
import { actions, type MarkdownAction } from '../editor/commands'
import type { ViewMode } from '../editor/types'
import type { ReactNode } from 'react'

export interface ToolbarProps {
  readOnly?: boolean
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void
  onAction: (action: MarkdownAction) => void
  onUndo: () => void
  onRedo: () => void
  onImage: () => void
  onDiagram: () => void
  onFormula: () => void
  onCodeBlock: (language: string) => void
  onColor: (color: string) => void
  /** Compatibility callback for custom toolbars. The built-in toolbar has no download button. */
  onDownload: () => void
  /** Host actions retain native selection and have permissions separate from readOnly. */
  hostActions?: ReactNode
}

export function Toolbar(props: ToolbarProps) {
  const disabled = props.readOnly
  return <div className="toolbar" role="toolbar" aria-label="Markdown 格式工具栏">
    <div className="tool-group history-tools">
      <button disabled={disabled} onClick={props.onUndo} title="撤销"><Undo2 /></button>
      <button disabled={disabled} onClick={props.onRedo} title="重做"><Redo2 /></button>
    </div>
    <div className="tool-divider" />
    <div className="tool-group format-tools">
      {actions.map(action => <button disabled={disabled} key={action.title} onClick={() => props.onAction(action)} title={action.title} className={action.label === 'I' ? 'italic' : ''}>{action.label}</button>)}
    </div>
    <div className="tool-divider" />
    <div className="tool-group rich-tools">
      <select disabled={disabled} defaultValue="" aria-label="插入代码块" title="插入代码块" onChange={event => { if (event.target.value) props.onCodeBlock(event.target.value); event.target.value = '' }}>
        <option value="" disabled>代码语言</option>
        <option value="typescript">TypeScript</option><option value="javascript">JavaScript</option><option value="tsx">TSX</option><option value="python">Python</option>
        <option value="java">Java</option><option value="go">Go</option><option value="rust">Rust</option><option value="cpp">C++</option><option value="csharp">C#</option>
        <option value="php">PHP</option><option value="ruby">Ruby</option><option value="swift">Swift</option><option value="kotlin">Kotlin</option><option value="bash">Shell</option>
        <option value="sql">SQL</option><option value="json">JSON</option><option value="yaml">YAML</option><option value="html">HTML</option><option value="css">CSS</option>
        <option value="graphql">GraphQL</option><option value="dockerfile">Dockerfile</option><option value="markdown">Markdown</option>
      </select>
      <label className="color-tool" title="文字颜色"><span>A</span><input disabled={disabled} type="color" defaultValue="#d14f4f" aria-label="文字颜色" onChange={event => props.onColor(event.target.value)} /></label>
    </div>
    <div className="tool-divider" />
    <div className="tool-group">
      <button disabled={disabled} onClick={props.onImage} title="上传图片"><ImagePlus /></button>
      <button disabled={disabled} onClick={props.onDiagram} title="插入流程图"><Workflow /></button>
      <button disabled={disabled} onClick={props.onFormula} title="插入数学公式"><Sigma /></button>
    </div>
    <div className="toolbar-spacer" />
    {props.hostActions}
    <div className="tool-group view-switcher">
      <button className={props.mode === 'edit' ? 'active' : ''} onClick={() => props.onModeChange('edit')} title="仅编辑"><PanelLeft /></button>
      <button className={props.mode === 'split' ? 'active' : ''} onClick={() => props.onModeChange('split')} title="分栏"><Columns2 /></button>
      <button className={props.mode === 'preview' ? 'active' : ''} onClick={() => props.onModeChange('preview')} title="仅预览"><PanelRight /></button>
    </div>
  </div>
}

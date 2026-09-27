import { ImagePlus, PanelLeft, PanelRight, Columns2, Redo2, Sigma, Undo2, Workflow } from 'lucide-react'
import { actions, type MarkdownAction, type MarkdownCommand } from '../editor/commands'
import { translate, type EditorMessages } from '../editor/i18n'
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
  /** Host actions retain native selection and have permissions separate from readOnly. */
  hostActions?: ReactNode
  /** `zh` or `en`. Omitted stays Chinese. Unknown codes display English. */
  locale?: string
  /** Replaces individual catalog entries. Other keys keep the built-in translation. */
  messages?: EditorMessages
}

function commandAction(command: MarkdownCommand, title: string, placeholder?: string): MarkdownAction {
  return { label: command.label, title, prefix: command.prefix, suffix: command.suffix, placeholder, block: command.block }
}

export function Toolbar(props: ToolbarProps) {
  const disabled = props.readOnly
  const t = (key: string) => translate(props.locale, key, undefined, props.messages)
  return <div className="toolbar" role="toolbar" aria-label={t('toolbar.label')}>
    <div className="tool-group history-tools">
      <button disabled={disabled} onClick={props.onUndo} title={t('toolbar.undo')}><Undo2 /></button>
      <button disabled={disabled} onClick={props.onRedo} title={t('toolbar.redo')}><Redo2 /></button>
    </div>
    <div className="tool-divider" />
    <div className="tool-group format-tools">
      {actions.map(action => {
        const title = t(action.titleKey)
        return <button disabled={disabled} key={action.id} onClick={() => props.onAction(commandAction(action, title, action.placeholderKey ? t(action.placeholderKey) : undefined))} title={title} className={action.label === 'I' ? 'italic' : ''}>{action.label}</button>
      })}
    </div>
    <div className="tool-divider" />
    <div className="tool-group rich-tools">
      <select disabled={disabled} defaultValue="" aria-label={t('toolbar.insertCode')} title={t('toolbar.insertCode')} onChange={event => { if (event.target.value) props.onCodeBlock(event.target.value); event.target.value = '' }}>
        <option value="" disabled>{t('toolbar.codeLanguage')}</option>
        <option value="typescript">TypeScript</option><option value="javascript">JavaScript</option><option value="tsx">TSX</option><option value="python">Python</option>
        <option value="java">Java</option><option value="go">Go</option><option value="rust">Rust</option><option value="cpp">C++</option><option value="csharp">C#</option>
        <option value="php">PHP</option><option value="ruby">Ruby</option><option value="swift">Swift</option><option value="kotlin">Kotlin</option><option value="bash">Shell</option>
        <option value="sql">SQL</option><option value="json">JSON</option><option value="yaml">YAML</option><option value="html">HTML</option><option value="css">CSS</option>
        <option value="graphql">GraphQL</option><option value="dockerfile">Dockerfile</option><option value="markdown">Markdown</option>
      </select>
      <label className="color-tool" title={t('toolbar.textColor')}><span>A</span><input disabled={disabled} type="color" defaultValue="#d14f4f" aria-label={t('toolbar.textColor')} onChange={event => props.onColor(event.target.value)} /></label>
    </div>
    <div className="tool-divider" />
    <div className="tool-group">
      <button disabled={disabled} onClick={props.onImage} title={t('toolbar.uploadImage')}><ImagePlus /></button>
      <button disabled={disabled} onClick={props.onDiagram} title={t('toolbar.insertDiagram')}><Workflow /></button>
      <button disabled={disabled} onClick={props.onFormula} title={t('toolbar.insertFormula')}><Sigma /></button>
    </div>
    <div className="toolbar-spacer" />
    {props.hostActions}
    <div className="tool-group view-switcher">
      <button className={props.mode === 'edit' ? 'active' : ''} onClick={() => props.onModeChange('edit')} title={t('toolbar.viewEdit')}><PanelLeft /></button>
      <button className={props.mode === 'split' ? 'active' : ''} onClick={() => props.onModeChange('split')} title={t('toolbar.viewSplit')}><Columns2 /></button>
      <button className={props.mode === 'preview' ? 'active' : ''} onClick={() => props.onModeChange('preview')} title={t('toolbar.viewPreview')}><PanelRight /></button>
    </div>
  </div>
}

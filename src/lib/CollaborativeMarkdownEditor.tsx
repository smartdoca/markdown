import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ComponentType } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { createPortal } from 'react-dom'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState, Prec } from '@codemirror/state'
import { yCollab, ySyncAnnotation } from 'y-codemirror.next'
import * as Y from 'yjs'
import { Check, CloudOff, LoaderCircle, TriangleAlert } from 'lucide-react'
import { MarkdownPreview } from '../components/MarkdownPreview'
import { Toolbar } from '../components/Toolbar'
import { HostActions } from '../components/HostActions'
import { createPreviewController } from '../editor/preview-interaction'
import { focusDocumentEnd } from '../editor/end-of-document'
import { usePreviewValue } from '../editor/use-preview-value'
import { bindCenterScroll } from '../editor/scroll-sync'
import { applyMarkdownAction, insertAtSelection, type MarkdownAction } from '../editor/commands'
import { useCollaboration } from '../editor/collaboration'
import { imageToDataUrl } from '../editor/upload'
import type { CollaborationSession, CollaborationUser, ConnectionState, ViewMode } from '../editor/types'
import type { ToolbarProps } from '../components/Toolbar'
import type { MarkdownPreviewProps } from '../components/MarkdownPreview'
import type { CollaborativeMarkdownEditorHandle, EditorMode, EditorResources, MarkdownFindMatch, MarkdownFindOptions,
  MarkdownActiveView, MarkdownSelectionAction, MarkdownSelectionActionContext } from '../editor/integration'
import { createMarkdownTextAnchor, createMarkdownTextSelection, resolveMarkdownTextAnchor,
  type MarkdownTextAnchor, type MarkdownCommentAnchor, type MarkdownTextSelection } from '../editor/selection'
import { activateCommentAnchorEffect, createAnnotationsExtension, refreshAnnotationsEffect,
  setCommentAnchorsEffect, setRemoteSelectionsEffect } from '../editor/annotations'
import { collaborationErrorText, editorLanguageTag, translate, type EditorMessages, type MessageValues } from '../editor/i18n'

export interface EditorHeaderProps { title: string; roomId: string; session: CollaborationSession; locale?: string; messages?: EditorMessages }
export interface EditorLoadingProps { state: ConnectionState; errorMessage?: string; locale?: string; messages?: EditorMessages }
export interface EditorFooterProps { readOnly: boolean; locale?: string; messages?: EditorMessages }
export interface CollaborativeMarkdownEditorComponents {
  Header?: ComponentType<EditorHeaderProps>
  Toolbar?: ComponentType<ToolbarProps>
  Preview?: ComponentType<MarkdownPreviewProps>
  Loading?: ComponentType<EditorLoadingProps>
  Footer?: ComponentType<EditorFooterProps>
}

export interface CollaborativeMarkdownEditorProps {
  /** Required by the built-in demo transport; optional with a host-managed collaboration session. */
  roomId?: string
  websocketUrl?: string
  /** Stable host-owned session. Supplying it disables the package WebSocket/IndexedDB transport. */
  collaboration?: CollaborationSession
  initialValue?: string
  user?: CollaborationUser
  uploadImage?: (file: File) => Promise<string>
  persistence?: boolean
  persistenceKey?: string
  defaultViewMode?: ViewMode
  title?: string
  className?: string
  height?: string | number
  syncScroll?: boolean
  /** Preview-only debounce; auto: 150ms for >=10k UTF-16 units or >=500 lines, otherwise 0. */
  previewDebounceMs?: number
  mode?: EditorMode
  /** Host-owned asset callbacks. Keep this object reference stable for the document session. */
  resources?: EditorResources
  onUploadProgress?: (percent: number) => void
  onChange?: (markdown: string) => void
  onConnectionChange?: (state: ConnectionState) => void
  /** Replace individual UI regions while retaining the built-in Yjs/editor lifecycle. */
  components?: CollaborativeMarkdownEditorComponents
  /** Host actions shown near a valid selection, or in the top toolbar as fallback. */
  selectionActions?: MarkdownSelectionAction[]
  /** Disable floating actions and always use the top toolbar. Defaults to true. */
  selectionToolbar?: boolean
  /** Additional actions always displayed in the top toolbar. */
  toolbarActions?: MarkdownSelectionAction[]
  /** `zh` or `en`. Omitted stays Chinese. Unknown codes display English. Switching it updates chrome only. */
  locale?: string
  /** Replaces individual catalog entries. Other keys keep the built-in translation. */
  messages?: EditorMessages
}

// A host-managed editor never instantiates the standalone hook (including its spare Y.Doc/Awareness).
export const CollaborativeMarkdownEditor = forwardRef<CollaborativeMarkdownEditorHandle, CollaborativeMarkdownEditorProps>(function Editor(props, ref) {
  if (props.collaboration) return <EditorSurface {...props} ref={ref} key={props.collaboration.doc.guid} />
  if (!props.roomId || !props.websocketUrl) throw new Error(translate(props.locale, 'editor.transportRequired', undefined, props.messages))
  return <StandaloneEditor {...props} ref={ref} key={props.roomId + ':' + props.websocketUrl} />
})
const StandaloneEditor = forwardRef<CollaborativeMarkdownEditorHandle, CollaborativeMarkdownEditorProps>(function Standalone(props, ref) {
  const session = useCollaboration({ roomId: props.roomId!, websocketUrl: props.websocketUrl!,
    initialValue: props.initialValue, user: props.user, persistence: props.persistence,
    persistenceKey: props.persistenceKey, readOnly: props.mode === 'readonly',
    locale: props.locale, messages: props.messages })
  return <EditorSurface {...props} collaboration={session} standalone ref={ref} />
})
const BASIC_SETUP = { lineNumbers: true, foldGutter: true, highlightActiveLine: true,
  highlightActiveLineGutter: true, history: false, historyKeymap: false }
const StableCodeMirror = memo(CodeMirror)

const EditorSurface = forwardRef<CollaborativeMarkdownEditorHandle, CollaborativeMarkdownEditorProps & { standalone?: boolean }>(function EditorSurface({ roomId, collaboration,
  uploadImage: uploadImageProp, defaultViewMode = 'split',
  title: titleProp, className = '', height = '100vh', syncScroll = true, previewDebounceMs, mode: editorMode = 'edit',
  resources, onUploadProgress, onChange, onConnectionChange, components = {}, standalone = false,
  selectionActions = [], selectionToolbar = true, toolbarActions = [], locale, messages,
}, ref) {
  const t = (key: string, values?: MessageValues) => translate(locale, key, values, messages)
  const uploadImage = uploadImageProp ?? ((file: File) => imageToDataUrl(file, { locale, messages }))
  const title = titleProp ?? t('document.title')
  const localeRef = useRef(locale)
  const messagesRef = useRef(messages)
  localeRef.current = locale
  messagesRef.current = messages
  const session = collaboration!
  const effectiveReadOnly = editorMode === 'readonly' || !session.ready || session.state === 'error'
  const resolvedRoomId = roomId || 'document'
  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const editorPaneRef = useRef<HTMLElement>(null)
  const previewPaneRef = useRef<HTMLElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ViewMode>(defaultViewMode)
  const [value, setValue] = useState(() => session.text.toString())
  const previewValue = usePreviewValue(value, mode !== 'edit', previewDebounceMs)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')
  const revisionRef = useRef(0)
  const initialEditorValueRef = useRef<string | undefined>(undefined)
  const uploadAbortRef = useRef<AbortController | undefined>(undefined)
  const selectionListenersRef = useRef(new Set<(selection: MarkdownTextSelection | null) => void>())
  const selectionTimerRef = useRef<number | undefined>(undefined)
  const anchorClickListenersRef = useRef(new Set<(id: string) => void>())
  const activeView = useRef<MarkdownActiveView>(defaultViewMode === 'preview' ? 'preview' : 'source')
  const commentsRef = useRef<MarkdownCommentAnchor[]>([])
  const activeCommentRef = useRef<string | null>(null)
  const [, setSelectionVersion] = useState(0)
  const refreshActions = useCallback(() => setSelectionVersion(version => version + 1), [])
  const actionsRefresh = useRef(refreshActions)
  const activateCommentRef = useRef<(id: string) => void>(() => {})
  const live = useRef({ readOnly: effectiveReadOnly, session, mode, standalone, onChange, mounted: true })
  live.current = { ...live.current, readOnly: effectiveReadOnly, session, mode, standalone, onChange }
  const preview = useMemo(() => createPreviewController(session.text, {
    activate: () => { activeView.current = 'preview' },
    isActive: () => activeView.current === 'preview' && live.current.mode !== 'edit',
    selectionChanged: () => actionsRefresh.current(),
    click: id => activateCommentRef.current(id),
  }), [session.text])
  const captureActiveAnchor = (): MarkdownTextAnchor | null => {
    if (live.current.mode === 'preview' || live.current.mode !== 'edit' && activeView.current === 'preview') return preview.capture()
    const current = editorRef.current?.view
    const range = current?.state.selection.main
    if (!range || range.empty) return null
    if (current?.state.doc.toString() !== session.text.toString()) return null
    return createMarkdownTextAnchor(session.text, range.from, range.to)
  }
  const setActiveComment = (id: string | null) => {
    activeCommentRef.current = id
    preview.setActive(id)
    editorRef.current?.view?.dispatch({ effects: activateCommentAnchorEffect.of(id) })
  }
  activateCommentRef.current = id => {
    setActiveComment(id)
    anchorClickListenersRef.current.forEach(listener => listener(id))
  }
  useEffect(() => onConnectionChange?.(session.state), [onConnectionChange, session.state])
  useEffect(() => {
    if (effectiveReadOnly) session.awareness.setLocalStateField('cursor', null)
  }, [effectiveReadOnly, session.awareness])
  const selectionExtension = useMemo(() => EditorView.updateListener.of(update => {
    if (update.focusChanged && update.view.hasFocus || update.selectionSet && !update.docChanged) {
      activeView.current = 'source'
      preview.clearSelection()
      actionsRefresh.current()
    }
    if (!update.selectionSet && !update.focusChanged) return
    window.clearTimeout(selectionTimerRef.current)
    selectionTimerRef.current = window.setTimeout(() => {
      const current = live.current
      const selection = current.mounted && !current.readOnly && current.mode !== 'preview'
        && current.session.state === 'ready' && update.view.hasFocus
        ? createMarkdownTextSelection(current.session.text, update.view.state.selection.main.anchor, update.view.state.selection.main.head)
        : null
      selectionListenersRef.current.forEach(listener => listener(selection))
    }, 120)
  }), [preview])
  useEffect(() => {
    if (!syncScroll || mode !== 'split') return
    const editorScroller = editorPaneRef.current
    const previewScroller = previewPaneRef.current
    if (!editorScroller || !previewScroller) return
    if (previewValue !== value) return // Never map old preview DOM to new source offsets.
    return bindCenterScroll(() => editorRef.current?.view, editorScroller, previewScroller)
  }, [mode, syncScroll, previewValue, value])
  useEffect(() => {
    const update = () => { revisionRef.current += 1; const next = session.text.toString(); setValue(next); live.current.onChange?.(next) }
    setValue(session.text.toString()); session.text.observe(update)
    return () => session.text.unobserve(update)
  }, [session.text])
  const binding = useMemo(() => yCollab(session.text, standalone ? session.awareness : null,
    { undoManager: session.undoManager }), [session.text, session.awareness, session.undoManager, standalone])
  const annotations = useMemo(() => createAnnotationsExtension(session.text, {
    showRemote: () => !live.current.readOnly && live.current.mode !== 'preview' && live.current.session.state === 'ready',
    onAnchorClick: id => activateCommentRef.current(id),
    cursorLabel: name => translate(localeRef.current, 'presence.cursor', { name }, messagesRef.current),
  }), [session.text])
  const guard = useMemo(() => EditorState.transactionFilter.of(tr =>
    tr.docChanged && live.current.readOnly && !tr.annotation(ySyncAnnotation) ? [] : tr), [])
  const undoKeys = useMemo(() => Prec.highest(keymap.of([
    { key: 'Mod-z', run: () => { if (!live.current.readOnly) live.current.session.undoManager.undo(); return true } },
    { key: 'Mod-Shift-z', run: () => { if (!live.current.readOnly) live.current.session.undoManager.redo(); return true } },
    { key: 'Mod-y', run: () => { if (!live.current.readOnly) live.current.session.undoManager.redo(); return true } },
  ])), [])
  const nativeHistory = useMemo(() => Prec.highest(EditorView.domEventHandlers({
    beforeinput: event => {
      if (event.inputType !== 'historyUndo' && event.inputType !== 'historyRedo') return false
      event.preventDefault()
      if (!live.current.readOnly) {
        if (event.inputType === 'historyUndo') live.current.session.undoManager.undo()
        else live.current.session.undoManager.redo()
      }
      return true
    },
  })), [])
  const extensions = useMemo(() => [EditorState.lineSeparator.of('\n'), markdown(), syntaxHighlighting(defaultHighlightStyle), EditorView.lineWrapping, nativeHistory,
    binding, annotations, guard, undoKeys, selectionExtension],
  [annotations, binding, guard, nativeHistory, selectionExtension, undoKeys])
  const view = () => editorRef.current?.view
  const cursorTemplate = t('presence.cursor', { name: ' ' })
  useEffect(() => { view()?.dispatch({ effects: refreshAnnotationsEffect.of() }) }, [cursorTemplate])
  useEffect(() => {
    if (mode === 'preview') activeView.current = 'preview'
    if (mode === 'edit') { activeView.current = 'source'; preview.clearSelection() }
    if (effectiveReadOnly) { uploadAbortRef.current?.abort(); setUploading(false) }
    if (effectiveReadOnly || mode === 'preview' || session.state !== 'ready') {
      window.clearTimeout(selectionTimerRef.current)
      view()?.dispatch({ effects: setRemoteSelectionsEffect.of([]) })
      selectionListenersRef.current.forEach(listener => listener(null))
    }
    view()?.dispatch({ effects: refreshAnnotationsEffect.of() })
    if (mode !== 'preview') view()?.requestMeasure()
  }, [effectiveReadOnly, mode, session.state])
  useEffect(() => {
    const element = previewPaneRef.current || editorPaneRef.current
    if (!element || (!selectionActions.length && !toolbarActions.length)) return
    const document = element.ownerDocument, window = document.defaultView!
    let frame = 0
    const refresh = () => { if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; refreshActions() }) }
    document.addEventListener('scroll', refresh, true); document.addEventListener('selectionchange', refresh)
    window.addEventListener('resize', refresh)
    window.visualViewport?.addEventListener('resize', refresh)
    return () => {
      document.removeEventListener('scroll', refresh, true); document.removeEventListener('selectionchange', refresh)
      window.removeEventListener('resize', refresh); window.visualViewport?.removeEventListener('resize', refresh)
      window.cancelAnimationFrame(frame)
    }
  }, [selectionActions.length, toolbarActions.length, refreshActions])
  const runAction = (action: MarkdownAction) => { const current = view(); if (current && !effectiveReadOnly) applyMarkdownAction(current, action) }
  const insertDiagram = () => { const current = view(); if (current) insertAtSelection(current, t('insert.diagram')) }
  const insertFormula = () => { const current = view(); if (current) insertAtSelection(current, '\n$$\nE = mc^2\n$$\n') }
  const insertCodeBlock = (language: string) => { const current = view(); if (current) insertAtSelection(current, `\n\`\`\`${language}\n${t('insert.codePlaceholder')}\n\`\`\`\n`) }
  const applyColor = (color: string) => {
    const current = view(); if (!current) return
    const range = current.state.selection.main
    const text = current.state.sliceDoc(range.from, range.to) || t('format.colorPlaceholder')
    insertAtSelection(current, `<span data-color="${color}">${text}</span>`)
  }
  const handleFile = useCallback(async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) { setNotice(translate(locale, 'notice.imageRequired', undefined, messages)); return }
    if (live.current.readOnly) { setNotice(translate(locale, 'notice.readOnly', undefined, messages)); return }
    const current = view(); if (!current) return
    const selection = current.state.selection.main
    const start = Y.createRelativePositionFromTypeIndex(session.text, selection.from)
    const end = Y.createRelativePositionFromTypeIndex(session.text, selection.to)
    uploadAbortRef.current?.abort()
    const controller = new AbortController(); uploadAbortRef.current = controller
    setUploading(true); setNotice('')
    try {
      const result = resources?.uploadImage
        ? await resources.uploadImage(file, { signal: controller.signal, onProgress: percent => onUploadProgress?.(percent) })
        : await uploadImage(file)
      if (controller.signal.aborted || live.current.readOnly || !live.current.mounted) return
      const path = typeof result === 'string' ? result : result.path
      const doc = session.text.doc
      const resolvedStart = doc && Y.createAbsolutePositionFromRelativePosition(start, doc)
      const resolvedEnd = doc && Y.createAbsolutePositionFromRelativePosition(end, doc)
      if (!resolvedStart || !resolvedEnd || resolvedStart.type !== session.text || resolvedEnd.type !== session.text) return
      const markdown = `![${file.name.replace(/\.[^.]+$/, '')}](${path})`
      current.dispatch({ changes: { from: resolvedStart.index, to: Math.max(resolvedStart.index, resolvedEnd.index), insert: markdown },
        selection: { anchor: resolvedStart.index + markdown.length } })
    }
    catch (error) { if (!controller.signal.aborted && live.current.mounted) setNotice(error instanceof Error ? error.message : translate(locale, 'notice.uploadFailed', undefined, messages)) }
    finally { if (live.current.mounted && uploadAbortRef.current === controller) {
      setUploading(false); if (fileRef.current) fileRef.current.value = ''
    } }
  }, [effectiveReadOnly, locale, messages, onUploadProgress, resources, session.text, uploadImage])
  useEffect(() => {
    live.current.mounted = true
    return () => {
      live.current.mounted = false
      uploadAbortRef.current?.abort(); window.clearTimeout(selectionTimerRef.current)
      selectionListenersRef.current.forEach(listener => listener(null))
    }
  }, [])
  useImperativeHandle(ref, () => createEditorHandle(view, session, () => live.current.readOnly || !live.current.mounted,
    revisionRef, selectionListenersRef.current, anchorClickListenersRef.current,
    () => { activeView.current = 'source'; if (live.current.mode === 'preview') setMode('split') }, {
      capture: captureActiveAnchor,
      render: anchors => {
        commentsRef.current = anchors; preview.setComments(anchors)
        view()?.dispatch({ effects: setCommentAnchorsEffect.of(anchors) })
        if (!anchors.some(item => item.id === activeCommentRef.current && !item.resolved && !item.deleted)) setActiveComment(null)
      },
      activate: setActiveComment,
      reveal: anchor => {
        if (live.current.mode === 'preview' || activeView.current === 'preview' && live.current.mode !== 'edit') return preview.reveal(anchor)
        const current = view(), range = resolveMarkdownTextAnchor(session.doc, session.text, anchor)
        if (!current || !range) return false
        current.dispatch({ selection: { anchor: range.from, head: range.to }, effects: EditorView.scrollIntoView(range.from, { y: 'center' }) })
        return true
      },
    }), [session.text, session.undoManager, preview])
  const Header = components.Header || DefaultEditorHeader
  const EditorToolbar = components.Toolbar || Toolbar
  const Preview = components.Preview || MarkdownPreview
  const Loading = components.Loading || DefaultEditorLoading
  const Footer = components.Footer || DefaultEditorFooter
  const captureAction = (): MarkdownSelectionActionContext => ({
    view: live.current.mode === 'preview' ? 'preview' : live.current.mode === 'edit' ? 'source' : activeView.current, anchor: captureActiveAnchor(),
  })
  const actionContext = captureAction()
  const currentView = view()
  let actionRect = actionContext.view === 'preview' ? preview.selectionRect() : null
  if (actionContext.anchor && actionContext.view === 'source' && currentView) {
    const position = currentView.coordsAtPos(currentView.state.selection.main.from)
    if (position) actionRect = new DOMRect(position.left, position.top, 0, position.bottom - position.top)
  }
  const floating = selectionToolbar && selectionActions.length > 0 && Boolean(actionContext.anchor && actionRect)
  const topActions = [...toolbarActions, ...(!floating ? selectionActions : [])]
  const hostActions = topActions.length ? <HostActions actions={topActions} context={actionContext} capture={captureAction} /> : undefined
  const portalDocument = editorPaneRef.current?.ownerDocument
  const onCreateEditor = useCallback((current: EditorView) => {
    current.dispatch({ effects: [setCommentAnchorsEffect.of(commentsRef.current), activateCommentAnchorEffect.of(activeCommentRef.current)] })
    refreshActions()
  }, [refreshActions])
  if (session.ready && initialEditorValueRef.current === undefined) initialEditorValueRef.current = session.text.toString()
  return <div className={`exmd-editor app-shell ${className}`} style={{ height }} lang={editorLanguageTag(locale)}>
    <Header title={title} roomId={resolvedRoomId} session={session} locale={locale} messages={messages} />
    <EditorToolbar hostActions={hostActions} readOnly={effectiveReadOnly} mode={mode} onModeChange={setMode} onAction={runAction} onUndo={() => { if (!live.current.readOnly) session.undoManager.undo() }} onRedo={() => { if (!live.current.readOnly) session.undoManager.redo() }} onImage={() => { if (!live.current.readOnly) fileRef.current?.click() }} onDiagram={insertDiagram} onFormula={insertFormula} onCodeBlock={insertCodeBlock} onColor={applyColor} locale={locale} messages={messages} />
    {floating && portalDocument && actionRect && createPortal(<div className="exmd-selection-toolbar" role="toolbar" aria-label={t('selection.toolbar')}
      style={{ position: 'fixed', left: Math.max(8, Math.min(actionRect.left, portalDocument.documentElement.clientWidth - 180)),
        top: Math.max(8, actionRect.top - 42), zIndex: 1000 }}>
      <HostActions actions={selectionActions} context={actionContext} capture={captureAction} />
    </div>, portalDocument.body)}
    <input ref={fileRef} hidden type="file" accept="image/*" onChange={event => void handleFile(event.target.files?.[0])} />
    {(uploading || notice) && <div className={notice ? 'notice error' : 'notice'}>{uploading ? t('notice.uploading') : notice}</div>}
    <main className={`workspace mode-${mode}`} onDragOver={event => { if (!effectiveReadOnly) event.preventDefault() }} onDrop={event => { if (effectiveReadOnly) return; const file = [...event.dataTransfer.files].find(item => item.type.startsWith('image/')); if (file) { event.preventDefault(); void handleFile(file) } }} onPaste={event => { if (effectiveReadOnly) return; const file = [...event.clipboardData.files].find(item => item.type.startsWith('image/')); if (file) { event.preventDefault(); void handleFile(file) } }}>
      <section ref={editorPaneRef} className="editor-pane" hidden={mode === 'preview'} onPointerDown={() => { activeView.current = 'source'; preview.clearSelection() }} onMouseDownCapture={event => {
        const current = editorRef.current?.view
        if (current && focusDocumentEnd(current, event.currentTarget, event.nativeEvent)) {
          event.preventDefault()
          event.stopPropagation()
        }
      }} aria-label={t('editor.pane')}><div className="pane-label"><span>MARKDOWN</span><span>{t('editor.characters', { count: value.length })}</span></div>{initialEditorValueRef.current !== undefined ? <StableCodeMirror ref={editorRef} onCreateEditor={onCreateEditor} value={initialEditorValueRef.current} extensions={extensions} editable={!effectiveReadOnly} readOnly={effectiveReadOnly} basicSetup={BASIC_SETUP} /> : <Loading state={session.state} errorMessage={session.error ? collaborationErrorText(session.error, locale, messages) : undefined} locale={locale} messages={messages} />}</section>
      {mode !== 'edit' && <section ref={previewPaneRef} className="preview-pane" aria-busy={previewValue !== value} onPointerDown={() => { activeView.current = 'preview' }} aria-label={t('preview.pane')}><div className="pane-label"><span>{t('preview.label')}</span><span>{previewValue !== value ? t('preview.updating') : syncScroll && mode === 'split' ? t('preview.syncScroll') : t('preview.live')}</span></div><Preview value={previewValue} resolveImageUrl={resources?.resolveUrl} interaction={preview} locale={locale} messages={messages} /></section>}
    </main>
    <Footer readOnly={effectiveReadOnly} locale={locale} messages={messages} />
  </div>
})

export function DefaultEditorHeader({ title, roomId, session, locale, messages }: EditorHeaderProps) {
  const t = (key: string, values?: MessageValues) => translate(locale, key, values, messages)
  const status = session.state === 'ready' ? <><Check /> {t('status.ready')}</> : session.state === 'error' ? <><TriangleAlert /> {t('status.error')}</> : session.state === 'disconnected' ? <><CloudOff /> {session.ready ? t('status.offlineEditing') : t('status.offline')}</> : <><LoaderCircle className="spin" /> {session.state === 'syncing' ? t('status.syncing') : t('status.loading')}</>
  const online = t('presence.online', { count: session.collaborators.length })
  return <header className="topbar"><div className="brand"><span className="brand-mark">墨</span><div><strong>{title}</strong><small>{t('header.room', { roomId })}</small></div></div><div className={`sync-state ${session.state}`}>{status}</div><div className="presence" aria-label={online}><div className="avatars">{session.collaborators.slice(0, 4).map(item => <span key={item.clientId} title={item.name} style={{ background: item.color }}>{item.name.slice(0, 1)}</span>)}</div><span>{online}</span></div></header>
}
export function DefaultEditorLoading({ errorMessage, locale, messages }: EditorLoadingProps) { return <div className="collaboration-loading">{errorMessage || translate(locale, 'loading.document', undefined, messages)}</div> }
export function DefaultEditorFooter({ readOnly, locale, messages }: EditorFooterProps) {
  const t = (key: string) => translate(locale, key, undefined, messages)
  return <footer><span>{t('footer.formats')}</span><span>{readOnly ? t('footer.readOnly') : t('footer.dropImages')}</span></footer>
}

function createEditorHandle(view: () => EditorView | undefined, session: CollaborationSession, isReadOnly: () => boolean,
  revision: { current: number }, selectionListeners: Set<(selection: MarkdownTextSelection | null) => void>,
  anchorClicks: Set<(id: string) => void>, showEditor: () => void, comments: {
    capture(): MarkdownTextAnchor | null
    render(anchors: MarkdownCommentAnchor[]): void
    activate(id: string | null): void
    reveal(anchor: MarkdownTextAnchor): boolean
  }): CollaborativeMarkdownEditorHandle {
  const find = (query: string, options: MarkdownFindOptions = {}) => findMatches(session.text.toString(), query, options, revision.current)
  return {
    focus: () => view()?.focus(),
    getMarkdown: () => session.text.toString(),
    replaceMarkdown: (markdown, options = {}) => {
      const current = view(); if (!current || isReadOnly()) return false
      const previous = session.text.toString()
      if (options.expectedMarkdown !== undefined && options.expectedMarkdown !== previous) return false
      if (current.state.doc.toString() !== previous) return false
      if (markdown === previous) return true
      session.undoManager.stopCapturing()
      current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: markdown }, selection: { anchor: 0 } })
      session.undoManager.stopCapturing()
      return true
    },
    getEditorView: view,
    insertText: text => {
      const current = view(); if (!current || isReadOnly()) return false
      insertAtSelection(current, text); return true
    },
    find,
    reveal: match => {
      const current = view(); if (!current || match.revision !== revision.current || match.from < 0 || match.to > current.state.doc.length) return false
      showEditor()
      current.dispatch({ selection: { anchor: match.from, head: match.to }, effects: EditorView.scrollIntoView(match.from, { y: 'center' }) })
      current.focus(); return true
    },
    replace: (match, text) => {
      const current = view(); if (!current || isReadOnly() || match.revision !== revision.current) return false
      if (current.state.sliceDoc(match.from, match.to) !== match.text) return false
      session.undoManager.stopCapturing()
      current.dispatch({ changes: { from: match.from, to: match.to, insert: text } })
      session.undoManager.stopCapturing(); return true
    },
    replaceAll: (query, text, options = {}) => {
      const current = view(); if (!current || isReadOnly()) return 0
      const matches = find(query, options); if (!matches.length) return 0
      session.undoManager.stopCapturing()
      current.dispatch({ changes: matches.map(match => ({ from: match.from, to: match.to, insert: text })) })
      session.undoManager.stopCapturing()
      return matches.length
    },
    undo: () => { if (isReadOnly() || !session.undoManager.canUndo()) return false; session.undoManager.undo(); return true },
    redo: () => { if (isReadOnly() || !session.undoManager.canRedo()) return false; session.undoManager.redo(); return true },
    queryFormatState: () => {
      const current = view(); const selection = current?.state.selection.main
      return { selection: { from: selection?.from || 0, to: selection?.to || 0 },
        canUndo: !isReadOnly() && session.undoManager.canUndo(), canRedo: !isReadOnly() && session.undoManager.canRedo() }
    },
    onSelectionChange: listener => { selectionListeners.add(listener); return () => selectionListeners.delete(listener) },
    renderRemoteSelections: selections => {
      const current = view(); if (!current || isReadOnly()) return
      current.dispatch({ effects: setRemoteSelectionsEffect.of(selections) })
    },
    clearRemoteSelections: () => { view()?.dispatch({ effects: setRemoteSelectionsEffect.of([]) }) },
    renderAnchors: comments.render,
    setActiveAnchor: comments.activate,
    clearAnchors: () => { comments.render([]); comments.activate(null) },
    onAnchorClick: listener => { anchorClicks.add(listener); return () => anchorClicks.delete(listener) },
    captureAnchor: comments.capture,
    resolveAnchor: anchor => resolveMarkdownTextAnchor(session.doc, session.text, anchor),
    revealAnchor: comments.reveal,
  }
}

function findMatches(source: string, query: string, options: MarkdownFindOptions, revision: number): MarkdownFindMatch[] {
  if (!query) return []
  const haystack = options.caseSensitive ? source : source.toLocaleLowerCase()
  const needle = options.caseSensitive ? query : query.toLocaleLowerCase()
  const matches: MarkdownFindMatch[] = []
  let from = 0
  while (from <= haystack.length - needle.length) {
    const index = haystack.indexOf(needle, from); if (index < 0) break
    const to = index + query.length
    matches.push({ id: `${revision}:${index}:${to}`, from: index, to, text: source.slice(index, to), revision })
    from = Math.max(to, index + 1)
  }
  return matches
}

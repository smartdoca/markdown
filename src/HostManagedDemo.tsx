import { useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { CollaborativeMarkdownEditor } from './lib/CollaborativeMarkdownEditor'
import { createHostMarkdownSession, observeLocalMarkdownUpdates, updateHostMarkdownSession } from './editor/host-session'
import { initializeMarkdownDocument } from './editor/protocol'
import type { CollaborationSession } from './editor/types'
import type { CollaborativeMarkdownEditorHandle, EditorResources, MarkdownSelectionAction } from './editor/integration'
import type { MarkdownCommentAnchor } from './editor/selection'

// This stands in for the server-authoritative bootstrap. It runs before the editor is mounted.
function createServerBaseline(): CollaborationSession {
  const doc = new Y.Doc()
  initializeMarkdownDocument(doc, '# Doca 宿主管理模式\n\nAlpha **Bravo** Charlie\n\n在源码或预览中选中文字，点击顶部“添加评论”。\n\n这个页面不会启动包内 WebSocket 或 IndexedDB。')
  return createHostMarkdownSession({ doc, epochId: 'demo-epoch', state: 'ready', ready: true, saveState: 'clean' })
}

export function HostManagedDemo({ readOnly = false }: { readOnly?: boolean }) {
  const [modeReadOnly, setModeReadOnly] = useState(readOnly)
  const [session, setSession] = useState(createServerBaseline)
  const [assets] = useState(() => new Map<string, string>())
  const editorRef = useRef<CollaborativeMarkdownEditorHandle>(null)
  const [comments, setComments] = useState<Array<MarkdownCommentAnchor & { body: string }>>([])
  const [activeComment, setActiveComment] = useState<string | null>(null)
  const actions = useMemo<MarkdownSelectionAction[]>(() => [{ id: 'comment', title: '添加评论',
    onClick: ({ anchor }) => {
      if (!anchor) return
      const id = crypto.randomUUID()
      setComments(current => [...current, { id, anchor, body: `示例评论 ${current.length + 1}` }])
      setActiveComment(id)
    },
  }], [])
  useEffect(() => { editorRef.current?.renderAnchors(comments) }, [comments])
  useEffect(() => { editorRef.current?.setActiveAnchor(activeComment) }, [activeComment, comments])
  useEffect(() => editorRef.current?.onAnchorClick(setActiveComment), [])
  const resources = useMemo<EditorResources>(() => ({
    uploadImage: async (file, { signal }) => {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, 350)
        signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Upload cancelled', 'AbortError')) }, { once: true })
      })
      const path = crypto.randomUUID()
      assets.set(path, URL.createObjectURL(file))
      return { path, name: file.name, size: file.size, mimeType: file.type }
    },
    resolveUrl: path => assets.get(path) || '',
    resolveDownloadUrl: path => assets.get(path) || '',
  }), [assets])

  useEffect(() => {
    const stop = observeLocalMarkdownUpdates(session, () => {
      // Doca would enqueue the original bytes, commit on the server, then apply the matching ACK.
      setSession(current => updateHostMarkdownSession(current, { state: 'ready', ready: true, saveState: 'saving' }))
      window.setTimeout(() => setSession(current => updateHostMarkdownSession(current,
        { state: 'ready', ready: true, saveState: 'clean' })), 80)
    })
    return stop
  }, [session.doc])

  useEffect(() => () => { assets.forEach(url => URL.revokeObjectURL(url)); session.dispose?.() }, [assets, session.doc])
  return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 240px' }}><div><button className="host-demo-permission" onClick={() => setModeReadOnly(value => !value)}>
    {modeReadOnly ? '切换为可编辑' : '切换为只读'}
  </button><CollaborativeMarkdownEditor ref={editorRef} roomId="doca-host-demo" collaboration={session}
    selectionActions={actions} selectionToolbar={false}
    mode={modeReadOnly ? 'readonly' : 'edit'} resources={resources} title="Doca Host Demo" /></div>
    <aside aria-label="宿主评论卡片" style={{ padding: 16, background: '#fffdf6', overflow: 'auto', height: '100vh' }}>
      <h3>宿主评论</h3><p>正文只读时仍可评论。此演示的评论仅存内存，不会发送网络请求。</p>
      <button onClick={() => setActiveComment(null)}>取消激活</button>
      {comments.filter(item => !item.deleted).map(item => <section key={item.id} style={{ padding: 10, marginTop: 12,
        border: '1px solid #e0d2a5', background: activeComment === item.id ? '#ffe5a1' : '#fff' }}>
        <button onClick={() => { setActiveComment(item.id); editorRef.current?.revealAnchor(item.anchor) }}>{item.body}</button>
        <button onClick={() => setComments(current => current.map(c => c.id === item.id ? { ...c, resolved: !c.resolved } : c))}>
          {item.resolved ? '重新打开' : '解决'}
        </button>
        <button onClick={() => setComments(current => current.filter(c => c.id !== item.id))}>移除</button>
      </section>)}
    </aside>
  </div>
}

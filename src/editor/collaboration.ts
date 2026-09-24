import { useEffect, useMemo, useState } from 'react'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebsocketProvider } from 'y-websocket'
import { Awareness } from 'y-protocols/awareness'
import type { CollaborationOptions, CollaborationSession, Collaborator, CollaborationUser, ConnectionState } from './types'
import { assertSupportedMarkdownDocument, getMarkdownText, initializeMarkdownDocument, readMarkdownMetadata } from './protocol'

const COLORS = ['#7357d8', '#d9547a', '#16866f', '#d57828', '#3676c8', '#8a5b3d']
export const DEFAULT_MARKDOWN = `# 一起写点什么

这是一个支持 **实时协作** 的 Markdown 文档。试试从另一个窗口打开相同链接。

## 快速开始

- 使用上方工具栏插入常用格式
- 拖入或粘贴图片
- 用 Mermaid 描述流程图

\`\`\`mermaid
flowchart LR
  A[想法] --> B{一起讨论}
  B --> C[写成文档]
  B --> D[继续迭代]
\`\`\`
`

function createIdentity(): CollaborationUser {
  const saved = localStorage.getItem('collab-markdown:user')
  if (saved) {
    try { return JSON.parse(saved) as { name: string; color: string } } catch { /* ignore invalid local data */ }
  }
  const identity = {
    name: `访客 ${Math.floor(100 + Math.random() * 900)}`,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }
  localStorage.setItem('collab-markdown:user', JSON.stringify(identity))
  return identity
}

export function useCollaboration(options: CollaborationOptions): CollaborationSession {
  const { roomId, websocketUrl, initialValue = '', user, persistence = true, persistenceKey, readOnly = false, enabled = true } = options
  const userName = user?.name
  const userColor = user?.color
  const userColorLight = user?.colorLight
  const resources = useMemo(() => {
    const doc = new Y.Doc()
    const text = getMarkdownText(doc)
    const awareness = new Awareness(doc)
    const undoManager = new Y.UndoManager(text)
    return { doc, text, awareness, undoManager }
  }, [roomId])
  const [state, setState] = useState<ConnectionState>('loading')
  const [ready, setReady] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [error, setError] = useState<CollaborationSession['error']>()

  useEffect(() => {
    if (!enabled) return () => {
      resources.undoManager.destroy()
      resources.doc.destroy()
    }
    const { doc, awareness, text } = resources
    const provider = new WebsocketProvider(websocketUrl, roomId, doc, { awareness })
    const indexeddb = persistence ? new IndexeddbPersistence(persistenceKey || `collab-markdown:${roomId}`, doc) : undefined
    if (!readOnly) awareness.setLocalStateField('user', userName && userColor
      ? { name: userName, color: userColor, colorLight: userColorLight }
      : createIdentity())
    else awareness.setLocalState(null)
    let localReady = !indexeddb
    let remoteReady = false
    let initialized = false
    const finishInitialization = () => {
      if (initialized || !localReady || !remoteReady) return
      try {
        assertSupportedMarkdownDocument(doc)
        initializeMarkdownDocument(doc, initialValue)
        initialized = true; setReady(true); setState('ready')
      } catch (cause) {
        setError({ code: 'SCHEMA_MISMATCH', message: cause instanceof Error ? cause.message : '文档格式不受支持', retryable: false, cause })
        setState('error')
      }
    }
    if (indexeddb) indexeddb.whenSynced.then(() => {
      localReady = true
      if (text.length > 0 || readMarkdownMetadata(doc).codec) { initialized = true; setReady(true) }
      finishInitialization()
    }).catch(cause => {
      setError({ code: 'INITIALIZATION_FAILED', message: '本地协同数据加载失败', retryable: true, cause }); setState('error')
    })
    const onSync = (synced: boolean) => {
      if (!synced) return
      remoteReady = true
      if (initialized) {
        try { assertSupportedMarkdownDocument(doc); setState('ready') }
        catch (cause) {
          setError({ code: 'SCHEMA_MISMATCH', message: cause instanceof Error ? cause.message : '文档格式不受支持', retryable: false, cause }); setState('error')
        }
      } else finishInitialization()
    }
    const onStatus = ({ status }: { status: string }) => setState(current => {
      if (status === 'connected') return current === 'ready' ? 'ready' : 'syncing'
      return current === 'error' ? current : 'disconnected'
    })
    const updateUsers = () => {
      const users: Collaborator[] = []
      provider.awareness.getStates().forEach((value, clientId) => {
        const user = value.user as { name?: string; color?: string } | undefined
        if (user) users.push({ clientId, name: user.name || '匿名', color: user.color || COLORS[0] })
      })
      setCollaborators(users)
    }
    provider.on('status', onStatus)
    provider.on('sync', onSync)
    provider.awareness.on('change', updateUsers)
    setState(provider.wsconnected ? 'syncing' : 'loading')
    updateUsers()
    return () => {
      provider.off('status', onStatus)
      provider.off('sync', onSync)
      provider.awareness.off('change', updateUsers)
      provider.destroy()
      indexeddb?.destroy()
      resources.undoManager.destroy()
      resources.doc.destroy()
    }
  }, [enabled, initialValue, persistence, persistenceKey, readOnly, resources, roomId, userColor, userColorLight, userName, websocketUrl])

  return { doc: resources.doc, text: resources.text, awareness: resources.awareness, undoManager: resources.undoManager,
    state, ready, saveState: 'unavailable', collaborators, error }
}

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CollaborativeMarkdownEditor,
  type CollaborationSession, type CollaborativeMarkdownEditorHandle,
  type EditorResources, type MarkdownCommentAnchor, type MarkdownSelectionAction,
} from 'exmd-collaborative-editor'
import 'exmd-collaborative-editor/style.css'

/** Runnable host-owned in-memory comment example. Supply your existing synchronized session. */
export function DocaComments({ session, canEdit, canComment, resources }: {
  session: CollaborationSession; canEdit: boolean; canComment: boolean; resources: EditorResources
}) {
  const ref = useRef<CollaborativeMarkdownEditorHandle>(null)
  const [comments, setComments] = useState<MarkdownCommentAnchor[]>([])
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => { ref.current?.renderAnchors(comments) }, [comments])
  useEffect(() => { ref.current?.setActiveAnchor(active) }, [active, comments])
  useEffect(() => ref.current?.onAnchorClick(setActive), [])
  const actions = useMemo<MarkdownSelectionAction[]>(() => [{
    id: 'comment', title: '添加评论', icon: '评', disabled: !canComment,
    onClick: ({ anchor }) => {
      if (!anchor) return
      const id = crypto.randomUUID()
      // Replace with Doca's own composer/storage callback; no SDK comment network.
      setComments(current => [...current, { id, anchor }]); setActive(id)
    },
  }], [canComment])
  return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 220px' }}>
    <CollaborativeMarkdownEditor ref={ref} collaboration={session} resources={resources}
      mode={canEdit ? 'edit' : 'readonly'} selectionActions={actions} selectionToolbar={false} />
    <aside aria-label="宿主评论卡片">
      <button onClick={() => setActive(null)}>取消激活</button>
      {comments.map((comment, index) => <section key={comment.id}>
        <button onClick={() => { setActive(comment.id); ref.current?.revealAnchor(comment.anchor) }}>
          评论 {index + 1}{active === comment.id ? '（激活）' : ''}
        </button>
        <button disabled={!canComment} onClick={() => setComments(current => current.map(item =>
          item.id === comment.id ? { ...item, resolved: !item.resolved } : item))}>
          {comment.resolved ? '重新打开' : '解决'}
        </button>
        <button disabled={!canComment} onClick={() => setComments(current => current.filter(item => item.id !== comment.id))}>删除</button>
      </section>)}
    </aside>
  </div>
}

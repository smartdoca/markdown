import { useRef, useState } from 'react'
import {
  CollaborativeMarkdownEditor, importMarkdownFile, exportMarkdownFile,
  type CollaborationSession, type CollaborativeMarkdownEditorHandle,
  type MarkdownImportResult, type MarkdownExportResult,
} from 'exmd-collaborative-editor'
import 'exmd-collaborative-editor/style.css'

/** Host-owned actions. Supply an existing synchronized session and Doca download/confirmation UI. */
export function DocaMarkdownFiles({ session, canEdit, onDownload, confirmImport }: {
  session: CollaborationSession
  canEdit: boolean
  onDownload: (file: MarkdownExportResult) => void | Promise<void>
  confirmImport: (result: Extract<MarkdownImportResult, { ok: true }>) => Promise<boolean>
}) {
  const ref = useRef<CollaborativeMarkdownEditorHandle>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function importFile(file: File) {
    const editor = ref.current
    if (!editor || !canEdit) return
    const expectedMarkdown = editor.getMarkdown()
    setBusy(true)
    try {
      const result = await importMarkdownFile(file, { maxBytes: 512 * 1024 })
      if (!result.ok) { setMessage(`${result.error.code}: ${result.error.message}`); return }
      if (!await confirmImport(result)) return
      // Reject document switches or intervening edits during decoding/confirmation.
      if (ref.current !== editor || !editor.replaceMarkdown(result.markdown, { expectedMarkdown })) {
        setMessage('文档已变化、尚未就绪或权限已撤销，请重新发起导入'); return
      }
      setMessage('已导入。' + result.warnings.map(item => item.message).join(' '))
    } catch (error) { setMessage(error instanceof Error ? error.message : '导入失败') }
    finally { setBusy(false) }
  }
  async function exportFile() {
    const editor = ref.current
    if (!editor) return
    try {
      const result = exportMarkdownFile(editor.getMarkdown(), { fileName: '文档.md' })
      setMessage(result.warnings.map(item => item.message).join(' '))
      await onDownload(result) // Doca owns Blob download; SDK opens no URL or network.
    } catch (error) { setMessage(error instanceof Error ? error.message : '导出失败') }
  }
  return <>
    <div aria-label="宿主文件操作">
      <label>导入 Markdown<input type="file" accept=".md,.markdown" disabled={!canEdit || !session.ready || busy}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importFile(file) }} /></label>
      <button disabled={!session.ready} onClick={() => void exportFile()}>导出 Markdown</button>
      <output aria-live="polite">{message}</output>
    </div>
    <CollaborativeMarkdownEditor ref={ref} collaboration={session} mode={canEdit ? 'edit' : 'readonly'} />
  </>
}

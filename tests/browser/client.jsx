import React, { createRef } from 'react'
import { createRoot } from 'react-dom/client'
import * as Y from 'yjs'
import {
  CollaborativeMarkdownEditor, createHostMarkdownSession, observeLocalMarkdownUpdates,
  applyRemoteMarkdownUpdate, updateHostMarkdownSession, createMarkdownTextSelection,
  createMarkdownTextAnchor, encodeMarkdownCheckpoint,
  importMarkdownFile, exportMarkdownFile,
} from 'exmd-collaborative-editor'
import 'exmd-collaborative-editor/style.css'

// Real host fixtures: no SDK provider or awareness channel. The runner delivers original bytes.
const root = createRoot(document.getElementById('root'))
let sockets = 0, dbOpens = 0, localWrites = 0
const NativeWebSocket = window.WebSocket
window.WebSocket = class extends NativeWebSocket { constructor(...args) { sockets++; super(...args) } }
const openDatabase = indexedDB.open.bind(indexedDB)
indexedDB.open = (...args) => { dbOpens++; return openDatabase(...args) }
const setItem = Storage.prototype.setItem
Storage.prototype.setItem = function (...args) { localWrites++; return setItem.apply(this, args) }
const editor = createRef()
const doc = new Y.Doc()
let session = createHostMarkdownSession({ doc, ready: false, state: 'loading', saveState: 'unavailable' })
let readonly = false
let initialValue = 'MUST NOT SEED'
let base = ''
let updates = [], changes = 0, clicked = [], localSelections = [], uploads = [], trace = []
let snapshotView
let snapshotHandle
let renderVersion = 0
let actionEvents = [], floatingActions = true, commentDisabled = false
let previewDebounceMs
const selectionActions = () => [{ id: 'comment', title: '添加区域评论', icon: '评', disabled: commentDisabled,
  onClick: context => {
    actionEvents.push(context)
    let output = document.getElementById('action-result')
    if (!output) { output = document.createElement('output'); output.id = 'action-result'; document.body.append(output) }
    const range = context.anchor && editor.current.resolveAnchor(context.anchor)
    output.textContent = JSON.stringify({ view: context.view, range,
      source: range && doc.getText('markdown').toString().slice(range.from, range.to) })
  } }]
const resources = {
  uploadImage: (file, context) => new Promise(resolve => uploads.push({ resolve, context })),
  resolveUrl: () => 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'),
}
const props = () => ({
  ref: editor, collaboration: session, mode: readonly ? 'readonly' : 'edit', initialValue,
  roomId: 'test-only', height: 540, resources, title: '资料 ' + renderVersion,
  defaultViewMode: new URLSearchParams(location.search).get('view') || 'split',
  onChange: () => { changes++ },
  selectionActions: selectionActions(), selectionToolbar: floatingActions,
  previewDebounceMs,
})
function render() { root.render(<CollaborativeMarkdownEditor {...props()} />) }
const stop = observeLocalMarkdownUpdates(session, ({ update, origin }) => {
  updates.push(Array.from(update))
  trace.push({ origin: origin?.constructor?.name, text: doc.getText('markdown').toString(), stack: new Error().stack })
})
window.fixture = {
  async bootstrap(value = '') {
    base = value
    const server = new Y.Doc()
    server.getText('markdown').insert(0, value)
    applyRemoteMarkdownUpdate(doc, Y.encodeStateAsUpdate(server))
    server.destroy()
    session = updateHostMarkdownSession(session, { ready: true, state: 'ready', saveState: 'clean' })
    render()
  },
  async load(bytes) {
    applyRemoteMarkdownUpdate(doc, new Uint8Array(bytes))
    session = updateHostMarkdownSession(session, { ready: true, state: 'ready', saveState: 'clean' })
    render()
  },
  editor: () => editor.current,
  view: () => editor.current?.getEditorView(),
  text: () => doc.getText('markdown').toString(),
  importFile: (source, name = 'document.md', options) => importMarkdownFile(new File([source], name), options),
  exportFile: () => exportMarkdownFile(editor.current.getMarkdown(), { fileName: '原文交换.md' }),
  takeUpdates: () => { const result = updates; updates = []; return result },
  count: () => ({ pending: updates.length, changes }),
  effects: () => ({ sockets, dbOpens, localWrites }),
  trace: () => trace,
  apply: bytes => applyRemoteMarkdownUpdate(doc, new Uint8Array(bytes)),
  checkpoint: () => Array.from(encodeMarkdownCheckpoint(doc)),
  select(from, to = from) { this.view().dispatch({ selection: { anchor: from, head: to } }) },
  insert(value) { return editor.current.insertText(value) },
  readonly(value) { readonly = value; render() },
  previewDelay(value) { previewDebounceMs = value; render() },
  status(state = 'ready', ready = true) {
    renderVersion++
    session = updateHostMarkdownSession(session, { ready, state, saveState: renderVersion % 2 ? 'saving' : 'clean' })
    render()
  },
  remember() { snapshotView = this.view(); snapshotHandle = editor.current },
  stable() { return snapshotView === this.view() && snapshotHandle === editor.current },
  remote(from, to = from, id = 'tab-remote', name = '同一账号') {
    return { sessionId: id, userId: 'same-account', name, color: id === 'second' ? '#16866f' : '#7357d8',
      selection: createMarkdownTextSelection(doc.getText('markdown'), from, to) }
  },
  comment(id, from, to) { return { id, anchor: createMarkdownTextAnchor(doc.getText('markdown'), from, to) } },
  startUpload() {
    const input = document.querySelector('input[type=file]')
    const transfer = new DataTransfer()
    transfer.items.add(new File(['svg'], 'fixture.svg', { type: 'image/svg+xml' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  },
  resolveUpload() { uploads.shift()?.resolve({ path: 'stable-asset-123' }) },
  aborted: () => uploads[0]?.context.signal.aborted,
  watch() {
    editor.current.onAnchorClick(id => clicked.push(id))
    editor.current.onSelectionChange(selection => localSelections.push(selection))
  },
  clicks: () => clicked,
  actionEvents: () => actionEvents,
  actionOptions(floating, disabled = false) { floatingActions = floating; commentDisabled = disabled; render() },
  selections: () => localSelections,
  dispose() { stop(); root.unmount(); session.dispose(); doc.destroy() },
}
render()

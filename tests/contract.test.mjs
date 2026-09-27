import test from 'node:test'
import assert from 'node:assert/strict'
const dependencies = process.env.EXMD_TEST_DEPENDENCIES_DIR
const Y = await import(dependencies ? dependencies + '/yjs/dist/yjs.mjs' : 'yjs')
const { Awareness } = await import(dependencies ? dependencies + '/y-protocols/awareness.js' : 'y-protocols/awareness')
const {
  MARKDOWN_HOST_CAPABILITIES, TRANSACTION_ORIGINS, applyRemoteMarkdownUpdate,
  createHostMarkdownSession, createMarkdownTextAnchor, createMarkdownTextSelection,
  initializeMarkdownDocument, observeLocalMarkdownUpdates, resolveMarkdownTextAnchor,
  resolveMarkdownTextSelection, updateHostMarkdownSession,
} = await import(process.env.EXMD_TEST_PACKAGE_ENTRY || '../dist/index.js')

function documentWith(value = '') {
  const doc = new Y.Doc()
  initializeMarkdownDocument(doc, value)
  return doc
}

function session(doc, state = 'ready') {
  return createHostMarkdownSession({ doc, state, ready: true, saveState: 'clean', epochId: 'epoch-test' })
}

test('host session uses the fixed markdown root and creates no transport or storage', () => {
  let sockets = 0
  const previous = globalThis.WebSocket
  globalThis.WebSocket = class { constructor() { sockets += 1 } }
  try {
    const doc = documentWith('hello')
    const current = session(doc)
    assert.equal(current.doc, doc)
    assert.equal(current.text, doc.getText('markdown'))
    assert.equal(MARKDOWN_HOST_CAPABILITIES.textRoot, 'markdown')
    assert.equal(MARKDOWN_HOST_CAPABILITIES.codec, 'markdown-ytext')
    assert.equal(MARKDOWN_HOST_CAPABILITIES.schemaVersion, 1)
    assert.equal(sockets, 0)
    current.dispose?.()
  } finally { globalThis.WebSocket = previous }
})

test('host session rejects an uninitialized document without writing it', () => {
  const doc = new Y.Doc()
  let writes = 0
  doc.on('update', () => { writes += 1 })
  assert.throws(
    () => createHostMarkdownSession({ doc, state: 'loading', ready: false, saveState: 'unavailable' }),
    /Unsupported codec/,
  )
  assert.equal(writes, 0)
})

test('status/save/profile snapshots retain all model instances', () => {
  const original = session(documentWith('stable'))
  const next = updateHostMarkdownSession(original, { state: 'disconnected', ready: true, saveState: 'dirty', collaborators: [] })
  assert.equal(next.doc, original.doc)
  assert.equal(next.text, original.text)
  assert.equal(next.awareness, original.awareness)
  assert.equal(next.undoManager, original.undoManager)
  original.dispose?.()
})

test('only local markdown content enters the host update subscription and remote does not echo', () => {
  const left = session(documentWith('A'))
  const rightDoc = new Y.Doc()
  applyRemoteMarkdownUpdate(rightDoc, Y.encodeStateAsUpdate(left.doc))
  const right = session(rightDoc)
  const leftPending = []
  const rightPending = []
  const stopLeft = observeLocalMarkdownUpdates(left, event => leftPending.push(event.update))
  const stopRight = observeLocalMarkdownUpdates(right, event => rightPending.push(event.update))

  left.text.insert(1, ' local')
  assert.equal(leftPending.length, 1)
  applyRemoteMarkdownUpdate(right.doc, leftPending[0])
  assert.equal(rightPending.length, 0)
  assert.equal(right.text.toString(), left.text.toString())

  left.doc.transact(() => left.text.insert(0, ''), TRANSACTION_ORIGINS.bootstrap)
  left.awareness.setLocalStateField('cursor', { anchor: 0, head: 1 })
  assert.equal(leftPending.length, 1)
  stopLeft(); stopRight(); left.dispose?.(); right.dispose?.()
})

test('concurrent edits converge and disconnected updates replay unchanged', () => {
  const seed = documentWith('base')
  const a = session(seed)
  const bDoc = new Y.Doc(); applyRemoteMarkdownUpdate(bDoc, Y.encodeStateAsUpdate(seed)); const b = session(bDoc)
  const aUpdates = []; const bUpdates = []
  const stopA = observeLocalMarkdownUpdates(a, event => aUpdates.push(event.update))
  const stopB = observeLocalMarkdownUpdates(b, event => bUpdates.push(event.update))
  a.text.insert(0, 'A-')
  b.text.insert(b.text.length, '-B')
  assert.equal(aUpdates.length, 1); assert.equal(bUpdates.length, 1)
  applyRemoteMarkdownUpdate(a.doc, bUpdates[0])
  applyRemoteMarkdownUpdate(b.doc, aUpdates[0])
  assert.equal(a.text.toString(), b.text.toString())
  assert.equal(aUpdates.length, 1); assert.equal(bUpdates.length, 1)
  stopA(); stopB(); a.dispose?.(); b.dispose?.()
})

test('a remote deletion and repeated sync never becomes a local pending update', () => {
  const source = session(documentWith('delete-me'))
  const targetDoc = new Y.Doc(); applyRemoteMarkdownUpdate(targetDoc, Y.encodeStateAsUpdate(source.doc)); const target = session(targetDoc)
  const pending = []; const stop = observeLocalMarkdownUpdates(target, event => pending.push(event.update))
  const deletion = []
  const capture = update => deletion.push(update)
  source.doc.on('update', capture)
  source.text.delete(0, source.text.length)
  source.doc.off('update', capture)
  applyRemoteMarkdownUpdate(target.doc, deletion[0])
  applyRemoteMarkdownUpdate(target.doc, deletion[0])
  assert.equal(target.text.toString(), '')
  assert.equal(pending.length, 0)
  stop(); source.dispose?.(); target.dispose?.()
})

test('relative selections and permanent anchors survive concurrent insertion', () => {
  const current = session(documentWith('hello world'))
  const selection = createMarkdownTextSelection(current.text, 6, 11)
  const anchor = createMarkdownTextAnchor(current.text, 6, 11)
  current.text.insert(0, 'prefix ')
  assert.deepEqual(resolveMarkdownTextSelection(current.doc, current.text, selection), { from: 13, to: 18 })
  assert.deepEqual(resolveMarkdownTextAnchor(current.doc, current.text, anchor), { from: 13, to: 18 })
  current.dispose?.()
})

test('the same account in two pages retains two distinct presence sessions', () => {
  const first = new Y.Doc(); const second = new Y.Doc()
  const a = new Awareness(first); const b = new Awareness(second)
  const user = { userId: 'same-account', name: 'Same User', color: '#7357d8' }
  a.setLocalStateField('user', user); b.setLocalStateField('user', user)
  assert.notEqual(a.clientID, b.clientID)
  assert.equal(a.getLocalState().user.userId, b.getLocalState().user.userId)
  a.destroy(); b.destroy(); first.destroy(); second.destroy()
})

test('undo uses the same Y.Text model transaction', () => {
  const current = session(documentWith('one'))
  current.text.insert(3, ' two')
  assert.equal(current.text.toString(), 'one two')
  current.undoManager.undo()
  assert.equal(current.text.toString(), 'one')
  current.dispose?.()
})

test('comment anchors exclude both boundaries, include internal edits and orphan after full deletion', () => {
  const current = session(documentWith('abc'))
  const anchor = createMarkdownTextAnchor(current.text, 0, 3)
  assert.equal(anchor.kind, 'markdown-text-range')
  current.text.insert(3, 'END')
  current.text.insert(0, 'START')
  assert.deepEqual(resolveMarkdownTextAnchor(current.doc, current.text, anchor), { from: 5, to: 8 })
  current.text.insert(6, 'inside')
  assert.deepEqual(resolveMarkdownTextAnchor(current.doc, current.text, anchor), { from: 5, to: 14 })
  current.undoManager.stopCapturing()
  current.text.delete(5, 9)
  assert.equal(resolveMarkdownTextAnchor(current.doc, current.text, anchor), null)
  current.undoManager.undo()
  assert.equal(current.text.toString(), 'STARTainsidebcEND')
  assert.equal(resolveMarkdownTextAnchor(current.doc, current.text, anchor), null)
  const restored = new Y.Doc()
  applyRemoteMarkdownUpdate(restored, Y.encodeStateAsUpdate(current.doc))
  assert.equal(resolveMarkdownTextAnchor(restored, restored.getText('markdown'), anchor), null)
  current.dispose(); restored.destroy()
})

test('malformed/collapsed anchors fail safely without writing the model', () => {
  const current = session(documentWith('abc'))
  assert.throws(() => createMarkdownTextAnchor(current.text, 2, 2), RangeError)
  assert.equal(resolveMarkdownTextAnchor(current.doc, current.text, null), null)
  const valid = createMarkdownTextAnchor(current.text, 0, 2)
  assert.equal(resolveMarkdownTextAnchor(current.doc, current.text, { ...valid, content: [null] }), null)
  assert.equal(resolveMarkdownTextAnchor(current.doc, current.text, { ...valid, content: undefined }), null)
  assert.equal(resolveMarkdownTextAnchor(current.doc, current.text, {
    kind: 'markdown-text-range', start: { bytes: [255] }, end: { bytes: [] },
  }), null)
  assert.equal(current.text.toString(), 'abc')
  current.dispose()
})

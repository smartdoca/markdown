import test from 'node:test'
import assert from 'node:assert/strict'
const dependencies = process.env.EXMD_TEST_DEPENDENCIES_DIR
const Y = await import(dependencies ? dependencies + '/yjs/dist/yjs.mjs' : 'yjs')
const { createHostMarkdownSession, initializeMarkdownDocument, observeLocalMarkdownUpdates } =
  await import(process.env.EXMD_TEST_PACKAGE_ENTRY || '../dist/index.js')

test('host-managed document remains content-idle for 60 seconds', { timeout: 65_000 }, async () => {
  const doc = new Y.Doc()
  initializeMarkdownDocument(doc, 'idle baseline')
  const session = createHostMarkdownSession({ doc, state: 'ready', ready: true, saveState: 'clean' })
  let updates = 0
  const stop = observeLocalMarkdownUpdates(session, () => { updates += 1 })
  session.awareness.setLocalStateField('cursor', { anchor: 0, head: 0 })
  await new Promise(resolve => setTimeout(resolve, 60_000))
  assert.equal(updates, 0)
  stop(); session.dispose?.()
})

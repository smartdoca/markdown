export async function runFileSuite({ client, assert, pause, until, sync, same, log }) {
  const a = await client('edit'), b = await client('edit')
  await a.api.bootstrap('# 原文'); await b.api.load(a.api.checkpoint())
  await until(() => a.api.view() && b.api.view(), 'editor not ready')
  a.api.remember(); b.api.remember()
  const large = '# 大文档😀\r\n' + '中文😀 **Markdown 原文**\r\n'.repeat(9000)
  const loaded = await a.api.importFile(large, '导入.MARKDOWN')
  assert(loaded.ok && loaded.markdown === large && loaded.lineEndings === 'crlf', 'large UTF-8 import failed')
  assert(a.api.count().pending === 0, 'parsing wrote the model')
  assert(a.api.editor().replaceMarkdown(loaded.markdown, { expectedMarkdown: '# 原文' }), 'import apply failed')
  assert(a.api.count().pending === 1, 'import should be one content update')
  sync(a, b); same(a, b)
  assert(!b.api.count().pending, 'remote import echoed')
  assert(a.api.stable() && b.api.stable(), 'import rebuilt views')
  log(`PASS large Markdown import (${loaded.byteLength} UTF-8 bytes), one transaction, two-page sync, stable view`)

  a.api.select(0, a.api.text().length)
  a.api.view().dispatch({ changes: { from: 0, to: a.api.text().length, insert: '' }, selection: { anchor: 0 }, userEvent: 'delete.selection' })
  sync(a, b); same(a, b)
  assert(a.api.text() === '', 'select-all deletion failed')
  assert(a.api.editor().undo(), 'delete undo failed'); sync(a, b); same(a, b)
  assert(a.api.text() === large, 'delete undo lost imported source')
  assert(a.api.editor().redo(), 'delete redo failed'); sync(a, b); same(a, b)
  assert(a.api.text() === '', 'delete redo failed')
  a.api.insert('删除后继续输入😀'); sync(a, b); same(a, b)
  assert(a.api.text() === '删除后继续输入😀', 'typing after deletion failed')
  assert(a.api.editor().undo(), 'typing undo failed'); sync(a, b); same(a, b)
  assert(a.api.text() === '', 'typing undo did not return to empty')
  a.api.editor().redo(); sync(a, b); same(a, b)
  log('PASS select-all deletion, continued typing, undo/redo and remote convergence')

  const beforeImport = a.api.text()
  const sample = '# 标题😀\r\n\r\n![图片](stable-id)\r\n[附件](/assets/private) [内部](#/r/uuid)\r\n**原文**\n'
  const imported = await a.api.importFile('\uFEFF' + sample)
  assert(imported.ok && imported.hadBom && imported.markdown === sample, 'BOM/mixed CRLF import failed')
  assert(a.api.editor().replaceMarkdown(imported.markdown), 'replace import failed')
  sync(a, b); same(a, b)
  a.api.editor().undo(); sync(a, b); same(a, b)
  assert(a.api.text() === beforeImport, 'import is not an isolated undo unit')
  a.api.editor().redo(); sync(a, b); same(a, b)
  log('PASS BOM / Chinese / emoji / mixed CRLF; whole import undo/redo')

  a.api.readonly(true); await pause(50)
  assert(!a.api.editor().replaceMarkdown('不允许'), 'readonly import allowed')
  const readonlyExport = await a.api.exportFile().blob.text()
  assert(readonlyExport === sample, 'readonly export altered source')
  a.api.readonly(false); await pause(50)
  const expected = a.api.text()
  b.api.select(0); b.api.insert('远端编辑\r\n'); sync(b, a)
  assert(!a.api.editor().replaceMarkdown('stale import', { expectedMarkdown: expected }), 'async import overwrote intervening remote edit')
  same(a, b)
  log('PASS readonly protection, readonly export and delayed-import conflict guard')

  const source = a.api.text(), beforeChanges = a.api.count().changes
  for (let n = 0; n < 5; n++) {
    const exported = a.api.exportFile()
    assert(await exported.blob.text() === source, 'export rewrote Markdown')
    const again = await a.api.importFile(exported.blob, exported.fileName)
    assert(again.ok && again.markdown === source, 'export/reimport roundtrip failed')
    assert(a.api.editor().replaceMarkdown(again.markdown), 'identical reimport rejected')
  }
  assert(a.api.count().pending === 0 && a.api.count().changes === beforeChanges && a.api.stable(), 'export/identical import wrote or remounted')
  assert(!a.dom.querySelector('.download-button'), 'built-in download button still visible')
  const c = await client('edit'); await c.api.load(a.api.checkpoint())
  await until(() => c.api.view(), 'reload view not ready')
  same(a, c)
  assert(await c.api.exportFile().blob.text() === source, 'checkpoint reload/export changed source')
  assert(Object.values(a.api.effects()).every(n => n === 0), 'exchange opened SDK transport/storage')
  log('PASS source export/reimport, checkpoint reload, zero export updates/remounts, no built-in download')

  for (const content of ['', '# 只有标题']) {
    const result = await a.api.importFile(content)
    assert(result.ok && a.api.editor().replaceMarkdown(result.markdown), 'empty/title import failed')
    sync(a, b); same(a, b)
  }
  const rejectedBefore = a.api.text()
  for (const [content, name, options, code] of [
    ['超限😀', 'over.md', { maxBytes: 2 }, 'FILE_TOO_LARGE'],
    [new Uint8Array([0xc3, 0x28]), 'bad.md', {}, 'INVALID_UTF8'],
    ['{}', 'bad.json', {}, 'UNSUPPORTED_EXTENSION'],
  ]) {
    const result = await a.api.importFile(content, name, options)
    assert(!result.ok && result.error.code === code, 'invalid file not rejected: ' + code)
  }
  assert(a.api.text() === rejectedBefore && a.api.count().pending === 0, 'failed parsing changed model')
  log('PASS empty/title-only files, oversize and malformed encoding leave model untouched')
  log('ALL MARKDOWN FILE EXCHANGE TESTS PASSED')
}

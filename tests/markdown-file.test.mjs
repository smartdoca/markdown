import test from 'node:test'
import assert from 'node:assert/strict'
const sdk = await import(process.env.EXMD_TEST_PACKAGE_ENTRY || '../dist/index.js')
const { importMarkdownFile, exportMarkdownFile, createMarkdownFile, MARKDOWN_FILE_MIME, DEFAULT_MARKDOWN_IMPORT_MAX_BYTES } = sdk

test('UTF-8 / Chinese / emoji / CRLF roundtrip retains exact source bytes', async () => {
  const markdown = '# 中文😀\r\n\r\n**原文** &amp; `代码`\r\n'
  const output = exportMarkdownFile(markdown, { fileName: '文档.markdown' })
  assert.equal(output.fileName, '文档.md')
  assert.equal(output.mimeType, MARKDOWN_FILE_MIME)
  assert.equal(output.blob.type, MARKDOWN_FILE_MIME)
  assert.deepEqual(new Uint8Array(await output.blob.arrayBuffer()), new TextEncoder().encode(markdown))
  const result = await importMarkdownFile(new File([output.blob], output.fileName))
  assert.equal(result.ok, true)
  assert.equal(result.markdown, markdown)
  assert.equal(result.lineEndings, 'crlf')
  assert.equal(result.encoding, 'utf-8')
})
test('BOM removed once, internal U+FEFF retained and reported', async () => {
  const result = await importMarkdownFile(new File([new Uint8Array([239,187,191]), '# 文\uFEFF本😀'], 'bom.MARKDOWN'))
  assert.equal(result.ok, true)
  assert.equal(result.hadBom, true)
  assert.equal(result.markdown, '# 文\uFEFF本😀')
  assert(result.warnings.some(w => w.code === 'UTF8_BOM_REMOVED'))
})
test('empty, BOM-only and heading-only files are valid', async () => {
  for (const [source, expected] of [['', ''], ['\uFEFF', ''], ['# 标题', '# 标题']]) {
    const result = await importMarkdownFile(new File([source], 'empty.md'))
    assert.equal(result.ok, true); assert.equal(result.markdown, expected)
    assert.equal(result.lineEndings, 'none')
  }
})
test('mixed line endings are reported but not normalized', async () => {
  const source = 'a\r\nb\nc\rd'
  const result = await importMarkdownFile(new File([source], 'mixed.md'))
  assert.equal(result.markdown, source)
  assert.equal(result.lineEndings, 'mixed')
  assert(result.warnings.some(w => w.code === 'MIXED_LINE_ENDINGS'))
})
test('malformed and truncated UTF-8 / UTF-16 are rejected without substitution', async () => {
  for (const bytes of [[0xc3,0x28], [0xf0,0x9f], [0xed,0xa0,0x80], [0xff,0xfe,0x41,0], [0xfe,0xff,0,0x41]]) {
    const result = await importMarkdownFile(new File([new Uint8Array(bytes)], 'broken.md'))
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'INVALID_UTF8')
    assert.equal('markdown' in result, false)
  }
  const legitimate = await importMarkdownFile(new File(['合法的替换字符 �'], 'valid.md'))
  assert.equal(legitimate.ok, true)
})
test('binary NUL is rejected, extension and byte limit are checked before reading', async () => {
  const binary = await importMarkdownFile(new File([new Uint8Array([65,0,66])], 'binary.md'))
  assert.equal(binary.error.code, 'BINARY_CONTENT')
  let reads = 0
  const file = { name: 'file.md', size: DEFAULT_MARKDOWN_IMPORT_MAX_BYTES + 1, arrayBuffer() { reads++; throw Error() } }
  assert.equal((await importMarkdownFile(file)).error.code, 'FILE_TOO_LARGE')
  assert.equal((await importMarkdownFile({ ...file, name: 'file.json' })).error.code, 'UNSUPPORTED_EXTENSION')
  assert.equal(reads, 0)
  assert.equal((await importMarkdownFile(new File(['😀'], 'emoji.md'), { maxBytes: 3 })).ok, false)
  assert.equal((await importMarkdownFile(new File(['😀'], 'emoji.md'), { maxBytes: 4 })).ok, true)
})
test('read errors and invalid limits are explicit', async () => {
  assert.equal((await importMarkdownFile({ name: 'test.md', size: 0, arrayBuffer() { throw Error('denied') } })).error.code, 'READ_FAILED')
  await assert.rejects(() => importMarkdownFile(new File([], 'test.md'), { maxBytes: -1 }), RangeError)
})
test('large document supported up to the configured limit', async () => {
  const source = '# 大文档😀\r\n' + '原文 **bold**\r\n'.repeat(50000)
  const output = exportMarkdownFile(source)
  assert(output.blob.size > DEFAULT_MARKDOWN_IMPORT_MAX_BYTES)
  const file = new File([output.blob], output.fileName)
  assert.equal((await importMarkdownFile(file)).error.code, 'FILE_TOO_LARGE')
  const result = await importMarkdownFile(file, { maxBytes: 2 * 1024 * 1024 })
  assert.equal(result.markdown, source)
})
test('assets, attachments, internal links and raw HTML stay untouched with explicit resource warning', async () => {
  const source = '![图](stable-uuid)\n[附件](/assets/private)\n[内部](#/r/uuid)\n![外部](https://example.test/a.png)\n<span>原文</span>'
  const output = exportMarkdownFile(source)
  assert.equal(await output.blob.text(), source)
  assert.equal(output.warnings[0].code, 'RESOURCE_REFERENCES_PRESERVED')
  const imported = await importMarkdownFile(new File([output.blob], output.fileName))
  assert.equal(imported.markdown, source)
  assert.equal(imported.warnings[0].code, 'RESOURCE_REFERENCES_PRESERVED')
})
test('export rejects lone surrogates instead of Blob silent replacement', () => {
  for (const invalid of ['\ud800', '\udfff', 'ok\ud800bad']) {
    assert.throws(() => exportMarkdownFile(invalid), TypeError)
    assert.throws(() => createMarkdownFile(invalid), TypeError)
  }
})
test('exchange never fetches resources or initiates downloads', async () => {
  const originalFetch = globalThis.fetch, originalURL = URL.createObjectURL
  globalThis.fetch = () => { throw Error('unexpected fetch') }
  URL.createObjectURL = () => { throw Error('unexpected download') }
  try {
    const out = exportMarkdownFile('![图](private-id)')
    assert.equal((await importMarkdownFile(new File([out.blob], out.fileName))).ok, true)
  } finally { globalThis.fetch = originalFetch; URL.createObjectURL = originalURL }
})

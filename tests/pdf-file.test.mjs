import test from 'node:test'
import assert from 'node:assert/strict'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'

const sdk = await import(process.env.EXMD_TEST_PACKAGE_ENTRY || '../dist/index.js')

test('Markdown to PDF to Markdown keeps readable headings, paragraphs, lists, tables and code', async () => {
  const source = '# Heading\n\nA **bold** paragraph with `code`.\n\n- one\n- two\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst answer = 42\n```'
  const output = await sdk.exportPdfFile(source, { fileName: 'roundtrip' })
  assert.equal(output.fileName, 'roundtrip.pdf')
  assert.equal(output.mimeType, 'application/pdf')
  assert.equal(output.blob.type, 'application/pdf')
  const imported = await sdk.importPdfFile(output.blob)
  assert.equal(imported.ok, true)
  assert.match(imported.markdown, /Heading/)
  assert.match(imported.markdown, /bold/)
  assert.match(imported.markdown, /answer = 42/)
  assert.equal(imported.resources.length, 0)
})

test('HTML comments do not swallow the following Markdown table', async () => {
  const source = '<!-- prettier-ignore -->\n| Name | Description |\n| --- | --- |\n| placement | bubble position |'
  const output = await sdk.exportPdfFile(source)
  const imported = await sdk.importPdfFile(output.blob)
  assert.match(imported.markdown, /Name/)
  assert.match(imported.markdown, /bubble position/)
  assert.doesNotMatch(imported.markdown, /prettier-ignore/)
})

test('fenced code info strings do not swallow following headings and tables', async () => {
  const source = '```tsx\n<Bubble />\n```\n\n```typescript | pure\ninterface SkillType {\n  value: string;\n}\n```\n\n### Sender Ref\n\n| Property | Type |\n| --- | --- |\n| inputElement | `HTMLTextAreaElement` |'
  const output = await sdk.exportPdfFile(source)
  const imported = await sdk.importPdfFile(output.blob)
  assert.match(imported.markdown, /Bubble/)
  assert.match(imported.markdown, /interface SkillType/)
  assert.match(imported.markdown, /Sender Ref/)
  assert.match(imported.markdown, /inputElement/)
  assert.match(imported.markdown, /HTMLTextAreaElement/)
  assert.doesNotMatch(imported.markdown, /```typescript \| pure/)
})

test('fenced code is syntax highlighted in the PDF', async () => {
  const output = await sdk.exportPdfFile('```typescript\ninterface SkillType { value: string; count: 42 }\n```')
  const document = await getDocument({ data: new Uint8Array(await output.blob.arrayBuffer()) }).promise
  const operators = await (await document.getPage(1)).getOperatorList()
  const colors = new Set(operators.fnArray.flatMap((operator, index) => operator === OPS.setFillRGBColor ? operators.argsArray[index] : []))
  assert(colors.has('#d73a49'), 'keyword color is present')
  assert(colors.has('#6f42c1'), 'type title color is present')
  assert(colors.has('#22883a'), 'attribute color is present')
  assert(colors.has('#e36209'), 'built-in type color is present')
})

test('image resolver is called in source order and embedded images roundtrip as resources', async () => {
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'))
  const calls = []
  const output = await sdk.exportPdfFile('![first](asset-a)\n\n![second](asset-b)', {
    resolveResource: async resource => { calls.push(resource); return { bytes: png } },
  })
  assert.deepEqual(calls.map(item => item.path), ['asset-a', 'asset-b'])
  const imported = await sdk.importPdfFile(output.blob)
  assert.equal(imported.resources.length, 2)
  assert.deepEqual(imported.resources.map(item => item.filename), ['page-1-image-1.png', 'page-1-image-2.png'])
  assert(imported.resources.every(item => item.bytes instanceof Uint8Array && item.mimeType === 'image/png'))
})

test('unsafe links are downgraded and export does not fetch resources', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error('unexpected network') }
  try {
    const output = await sdk.exportPdfFile('[safe](https://example.test/a) [unsafe](javascript:alert(1))')
    assert(output.warnings.some(item => item.code === 'UNSAFE_URL_SKIPPED'))
    const imported = await sdk.importPdfFile(output.blob)
    assert.match(imported.markdown, /safe/)
  } finally { globalThis.fetch = originalFetch }
})

test('invalid, oversized and cancelled imports have explicit error codes', async () => {
  await assert.rejects(() => sdk.importPdfFile(new Uint8Array([1, 2, 3]).buffer), error => error.code === 'INVALID_PDF')
  await assert.rejects(() => sdk.importPdfFile(new Uint8Array([1, 2, 3]).buffer, { maxBytes: 2 }), error => error.code === 'FILE_TOO_LARGE')
  const controller = new AbortController(); controller.abort()
  await assert.rejects(() => sdk.importPdfFile(new ArrayBuffer(0), { signal: controller.signal }), error => error.code === 'ABORTED')
})

test('export does not mutate the source and resource failures become warnings', async () => {
  const source = 'before\n\n![missing](private-id)\n\nafter'
  const output = await sdk.exportPdfFile(source, { resolveResource: async () => { throw new Error('denied') } })
  assert(output.warnings.some(item => item.code === 'RESOURCE_RESOLUTION_FAILED'))
  assert.equal(source, 'before\n\n![missing](private-id)\n\nafter')
})

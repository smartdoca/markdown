import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const requestedEntry = process.env.EXMD_TEST_PACKAGE_ENTRY
const esmEntry = requestedEntry
  ? requestedEntry.startsWith('file:') ? fileURLToPath(requestedEntry) : resolve(requestedEntry)
  : fileURLToPath(new URL('../dist/index.js', import.meta.url))

for (const format of ['esm', 'cjs']) {
  for (const firstAction of ['import', 'export']) {
    test(`${format} root keeps PDF runtimes cold until an explicit ${firstAction}`, () => {
      const entry = format === 'esm' ? pathToFileURL(esmEntry).href : resolve(dirname(esmEntry), 'index.cjs')
      const script = `
        import assert from 'node:assert/strict'
        import { createRequire, registerHooks } from 'node:module'
        const loaded = []
        const pdfModules = url => /[/\\\\](?:pdfjs-dist|pdf-lib)[/\\\\]|[/\\\\]@pdf-lib[/\\\\]fontkit[/\\\\]/u.test(url)
        const hooks = registerHooks({
          load(url, context, nextLoad) {
            if (pdfModules(url)) loaded.push(url)
            return nextLoad(url, context)
          },
        })
        const sdk = ${format === 'esm' ? `await import(${JSON.stringify(entry)})` : `createRequire(import.meta.url)(${JSON.stringify(entry)})`}
        assert.equal(typeof sdk.MarkdownPreview, 'object')
        assert.equal(typeof sdk.CollaborativeMarkdownEditor, 'object')
        assert.equal(typeof sdk.importPdfFile, 'function')
        assert.equal(typeof sdk.exportPdfFile, 'function')
        assert.deepEqual(loaded, [], 'cold root imported PDF dependencies')
        assert.equal(globalThis.pdfjsWorker, undefined, 'cold root initialized the PDF worker')
        const isPdfError = code => error => error instanceof sdk.PdfFileError && error.code === code
        if (${JSON.stringify(firstAction)} === 'import') {
          await assert.rejects(sdk.importPdfFile(new Uint8Array([1, 2, 3])), isPdfError('INVALID_PDF'))
        }
        const output = await sdk.exportPdfFile('# Lazy conversion\\n\\nThe PDF runtime is available on demand.', { fileName: 'lazy' })
        assert.equal(output.fileName, 'lazy.pdf')
        assert.equal(output.mimeType, sdk.PDF_FILE_MIME)
        const imported = await sdk.importPdfFile(output.blob)
        assert.match(imported.markdown, /Lazy conversion/u)
        assert(loaded.some(url => url.includes('/pdfjs-dist/legacy/build/pdf.mjs')), 'PDF.js did not load on demand')
        assert(loaded.some(url => url.includes('/pdfjs-dist/legacy/build/pdf.worker.mjs')), 'PDF worker did not load on demand')
        assert(loaded.some(url => url.includes('/pdf-lib/')), 'pdf-lib did not load on demand')
        assert(loaded.some(url => url.includes('/@pdf-lib/fontkit/')), 'fontkit did not load on demand')
        const controller = new AbortController()
        controller.abort()
        await assert.rejects(sdk.importPdfFile(new Uint8Array(0), { signal: controller.signal }), isPdfError('ABORTED'))
        await assert.rejects(sdk.importPdfFile(new Uint8Array([1, 2, 3]), { maxBytes: 2 }), isPdfError('FILE_TOO_LARGE'))
        const example = new sdk.PdfFileError('READ_FAILED', 'read failed', output)
        assert(example instanceof Error)
        assert.equal(example.name, 'PdfFileError')
        assert.equal(example.cause, output)
        hooks.deregister()
      `
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 30_000 })
      assert.equal(result.error, undefined)
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    })
  }
}

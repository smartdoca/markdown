import { getDocument, ImageKind, OPS, PasswordResponses } from 'pdfjs-dist/legacy/build/pdf.mjs'
// PDF.js otherwise needs a separately deployed worker URL in browser builds.
// Loading its worker module once installs `globalThis.pdfjsWorker`, which makes
// the library use the supported in-process worker fallback without a URL guess.
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import { PDFDocument, PDFPage, PDFString, StandardFonts, rgb, type PDFFont, type PDFImage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { highlightCode, type HighlightedCodeSegment } from './code-highlight'
import { bindTranslate, type EditorMessages, type Translate } from './i18n'

export const PDF_FILE_MIME = 'application/pdf' as const
export const DEFAULT_PDF_IMPORT_MAX_BYTES = 25 * 1024 * 1024
export const DEFAULT_PDF_IMPORT_MAX_PAGES = 100
export const DEFAULT_PDF_IMPORT_MAX_IMAGE_PIXELS = 40_000_000
export const DEFAULT_PDF_IMPORT_TIMEOUT_MS = 30_000

export type PdfFileWarningCode =
  | 'NO_TEXT_EXTRACTED'
  | 'COMPLEX_LAYOUT'
  | 'MULTI_COLUMN_LAYOUT'
  | 'COMPLEX_TABLE'
  | 'EXTERNAL_URL_SKIPPED'
  | 'UNSAFE_URL_SKIPPED'
  | 'IMAGE_EXTRACT_FAILED'
  | 'IMAGE_PIXEL_LIMIT'
  | 'RESOURCE_UNRESOLVED'
  | 'RESOURCE_RESOLUTION_FAILED'
  | 'FONT_FALLBACK'
  | 'MATH_DEGRADED'
  | 'UNSUPPORTED_CONTENT'

export interface PdfFileWarning {
  code: PdfFileWarningCode
  message: string
  page?: number
  path?: string
}

export type PdfFileErrorCode =
  | 'READ_FAILED'
  | 'FILE_TOO_LARGE'
  | 'PAGE_LIMIT_EXCEEDED'
  | 'IMAGE_PIXEL_LIMIT'
  | 'INVALID_PDF'
  | 'PASSWORD_REQUIRED'
  | 'ABORTED'
  | 'TIMEOUT'

export class PdfFileError extends Error {
  readonly code: PdfFileErrorCode
  readonly cause?: unknown

  constructor(code: PdfFileErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'PdfFileError'
    this.code = code
    this.cause = cause
  }
}

export interface PdfImportOptions {
  maxBytes?: number
  maxPages?: number
  maxImagePixels?: number
  timeoutMs?: number
  signal?: AbortSignal
  locale?: string
  messages?: EditorMessages
}

export interface PdfImportResource {
  key: string
  bytes: Uint8Array
  filename: string
  mimeType: string
  alt?: string
}

export interface PdfImportResult {
  ok: true
  markdown: string
  resources: PdfImportResource[]
  metadata?: { title?: string; author?: string }
  warnings: PdfFileWarning[]
}

export interface PdfExportOptions {
  fileName?: string
  signal?: AbortSignal
  resolveResource?: (resource: { path: string; alt?: string }) => Promise<{ bytes: Blob | Uint8Array }>
  /** Optional embedded TTF/OTF font. Supplying a CJK font preserves Chinese glyphs. */
  fontBytes?: Uint8Array | ArrayBuffer
  /** Whether to subset the embedded font. Disable for CJK fonts when the renderer has incomplete CMap support. */
  fontSubset?: boolean
  fontName?: string
  margin?: number | { top?: number; right?: number; bottom?: number; left?: number }
  pageSize?: [number, number]
  locale?: string
  messages?: EditorMessages
}

export interface PdfExportResult {
  blob: Blob
  fileName: string
  mimeType: typeof PDF_FILE_MIME
  warnings: PdfFileWarning[]
}

export type PdfFileInput = Blob | File | ArrayBuffer | ArrayBufferView

function checkSignal(signal: AbortSignal | undefined, t: Translate): void {
  if (signal?.aborted) throw new PdfFileError('ABORTED', t('pdf.aborted'))
}

function positiveLimit(value: number | undefined, fallback: number, name: string, t: Translate): number {
  const result = value ?? fallback
  if (!Number.isSafeInteger(result) || result <= 0) throw new RangeError(t('validation.positiveInteger', { name }))
  return result
}

function addWarning(warnings: PdfFileWarning[], warning: PdfFileWarning): void {
  if (!warnings.some(item => item.code === warning.code && item.page === warning.page && item.path === warning.path)) warnings.push(warning)
}

function isSafeLink(value: string): boolean {
  if (/^#/u.test(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
  } catch {
    return false
  }
}

function safePdfLink(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return isSafeLink(value) ? value : undefined
}

async function readPdfBytes(file: PdfFileInput, maxBytes: number, signal: AbortSignal | undefined, t: Translate): Promise<Uint8Array> {
  checkSignal(signal, t)
  try {
    const size = file instanceof ArrayBuffer || ArrayBuffer.isView(file) ? file.byteLength : file.size
    if (size > maxBytes) throw new PdfFileError('FILE_TOO_LARGE', t('pdf.fileTooLarge', { maxBytes }))
    const bytes = file instanceof ArrayBuffer
      ? new Uint8Array(file)
      : ArrayBuffer.isView(file)
        ? new Uint8Array(file.buffer, file.byteOffset, file.byteLength)
        : new Uint8Array(await file.arrayBuffer())
    checkSignal(signal, t)
    if (bytes.byteLength > maxBytes) throw new PdfFileError('FILE_TOO_LARGE', t('pdf.fileTooLarge', { maxBytes }))
    return bytes
  } catch (error) {
    if (error instanceof PdfFileError) throw error
    throw new PdfFileError('READ_FAILED', t('pdf.readFailed'), error)
  }
}

function bboxForTextItem(item: any): [number, number, number, number] {
  const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0]
  const x = Number(transform[4]) || 0
  const y = Number(transform[5]) || 0
  const width = Math.abs(Number(item.width) || 0)
  const height = Math.abs(Number(item.height) || Math.abs(Number(transform[3]) || 10))
  return [x, y - height * 0.25, x + width, y + height]
}

function overlaps(a: [number, number, number, number], b: number[]): boolean {
  const bx = Math.min(b[0], b[2]); const by = Math.min(b[1], b[3])
  const bw = Math.max(b[0], b[2]); const bh = Math.max(b[1], b[3])
  return a[0] <= bw && a[2] >= bx && a[1] <= bh && a[3] >= by
}

interface TextLine {
  y: number
  items: any[]
  text: string
}

function textLines(items: any[]): TextLine[] {
  const positioned = items
    .filter(item => typeof item.str === 'string' && item.str.length > 0)
    .map(item => ({ item, box: bboxForTextItem(item) }))
    .sort((a, b) => b.box[1] - a.box[1] || a.box[0] - b.box[0])
  const lines: TextLine[] = []
  for (const entry of positioned) {
    const center = (entry.box[1] + entry.box[3]) / 2
    const tolerance = Math.max(2, (entry.box[3] - entry.box[1]) * 0.65)
    let line = lines.find(candidate => Math.abs(candidate.y - center) <= tolerance)
    if (!line) { line = { y: center, items: [], text: '' }; lines.push(line) }
    line.items.push(entry.item)
  }
  for (const line of lines) {
    line.items.sort((a, b) => bboxForTextItem(a)[0] - bboxForTextItem(b)[0])
    line.text = line.items.map(item => item.str).join('').replace(/[ \t]+/gu, ' ').trim()
  }
  return lines.sort((a, b) => b.y - a.y)
}

function markdownLinkLabel(line: TextLine, rect: number[], url: string): void {
  const selected = line.items.filter(item => overlaps(bboxForTextItem(item), rect)).map(item => item.str).join('').trim()
  if (!selected) return
  const label = selected.replace(/[\[\]]/gu, '')
  const escaped = url.replace(/[()\\]/gu, '\\$&')
  const replacement = `[${label}](${escaped})`
  const index = line.text.indexOf(selected)
  if (index >= 0 && !line.text.includes(`](${escaped})`)) line.text = line.text.slice(0, index) + replacement + line.text.slice(index + selected.length)
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const result = new Uint8Array(12 + data.length)
  const view = new DataView(result.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) result[4 + i] = type.charCodeAt(i)
  result.set(data, 8)
  view.setUint32(8 + data.length, crc32(result.subarray(4, 8 + data.length)))
  return result
}

function zlibStored(bytes: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [new Uint8Array([0x78, 0x01])]
  let offset = 0
  while (offset < bytes.length || offset === 0) {
    const length = Math.min(65535, bytes.length - offset)
    const final = offset + length >= bytes.length
    const chunk = new Uint8Array(5 + length)
    chunk[0] = final ? 1 : 0
    chunk[1] = length & 255; chunk[2] = length >>> 8
    const inverse = (~length) & 0xffff
    chunk[3] = inverse & 255; chunk[4] = inverse >>> 8
    chunk.set(bytes.subarray(offset, offset + length), 5)
    chunks.push(chunk); offset += length
    if (final) break
  }
  let a = 1; let b = 0
  for (const byte of bytes) { a = (a + byte) % 65521; b = (b + a) % 65521 }
  chunks.push(new Uint8Array([(b >>> 8) & 255, b & 255, (a >>> 8) & 255, a & 255]))
  const result = new Uint8Array(chunks.reduce((sum, item) => sum + item.length, 0))
  let position = 0; for (const chunk of chunks) { result.set(chunk, position); position += chunk.length }
  return result
}

function imageToPng(image: any): Uint8Array | undefined {
  const width = Number(image?.width); const height = Number(image?.height)
  const sourceData = image?.data instanceof Uint8Array
    ? image.data
    : ArrayBuffer.isView(image?.data)
      ? new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength)
      : undefined
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || !sourceData) return undefined
  const channels = image.kind === ImageKind.GRAYSCALE_1BPP ? 1 : image.kind === ImageKind.RGB_24BPP ? 3 : 4
  if (channels === 1 && sourceData.length < width * height) return undefined
  if (channels > 1 && sourceData.length < width * height * channels) return undefined
  const scanlines = new Uint8Array(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    scanlines[y * (width * 4 + 1)] = 0
    for (let x = 0; x < width; x++) {
      const source = y * width * channels + x * channels
      const target = y * (width * 4 + 1) + 1 + x * 4
      const gray = sourceData[source]
      scanlines[target] = gray
      scanlines[target + 1] = channels === 1 ? gray : sourceData[source + 1]
      scanlines[target + 2] = channels === 1 ? gray : sourceData[source + 2]
      scanlines[target + 3] = channels === 4 ? sourceData[source + 3] : 255
    }
  }
  const header = new Uint8Array(13); new DataView(header.buffer).setUint32(0, width); new DataView(header.buffer).setUint32(4, height)
  header[8] = 8; header[9] = 6
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const idat = zlibStored(scanlines)
  const ihdr = pngChunk('IHDR', header)
  const data = pngChunk('IDAT', idat)
  const iend = pngChunk('IEND', new Uint8Array())
  const result = new Uint8Array(signature.length + ihdr.length + data.length + iend.length)
  let position = 0
  result.set(signature, position); position += signature.length
  result.set(ihdr, position); position += ihdr.length
  result.set(data, position); position += data.length
  result.set(iend, position)
  return result
}

async function createCanvasTarget(width: number, height: number): Promise<{ canvas: any; context: any } | undefined> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    return { canvas, context: canvas.getContext('2d') }
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    return { canvas, context: canvas.getContext('2d') }
  }
  try {
    // Keep the Node-only fallback out of browser/demo bundles. pdfjs-dist already
    // declares this package as an optional runtime dependency for Node.
    // Keep the specifier opaque to browser bundlers: this fallback is only
    // reachable in a Node runtime where neither OffscreenCanvas nor document exists.
    const nodeCanvasPackage = ['@napi-rs', 'canvas'].join('/')
    const canvasModule: any = await import(/* @vite-ignore */ nodeCanvasPackage)
    const canvas = canvasModule.createCanvas(width, height)
    return { canvas, context: canvas.getContext('2d') }
  } catch {
    return undefined
  }
}

function asError(error: unknown, fallback: PdfFileErrorCode, message: string, t: Translate): PdfFileError {
  if (error instanceof PdfFileError) return error
  const text = String((error as any)?.message || error || '')
  if (/password|encrypted|encryptedpdf/iu.test(text)) return new PdfFileError('PASSWORD_REQUIRED', t('pdf.passwordRequired'), error)
  const detail = text.replace(/\s+/gu, ' ').trim().slice(0, 180)
  return new PdfFileError(fallback, detail ? t('pdf.errorDetail', { message, detail }) : message, error)
}

/** Extracts local PDF content only. It never uses PDF URLs, fetch, Doca APIs or Yjs. */
export async function importPdfFile(file: PdfFileInput, options: PdfImportOptions = {}): Promise<PdfImportResult> {
  const t = bindTranslate(options.locale, options.messages)
  const maxBytes = positiveLimit(options.maxBytes, DEFAULT_PDF_IMPORT_MAX_BYTES, 'maxBytes', t)
  const maxPages = positiveLimit(options.maxPages, DEFAULT_PDF_IMPORT_MAX_PAGES, 'maxPages', t)
  const maxImagePixels = positiveLimit(options.maxImagePixels, DEFAULT_PDF_IMPORT_MAX_IMAGE_PIXELS, 'maxImagePixels', t)
  const timeoutMs = positiveLimit(options.timeoutMs, DEFAULT_PDF_IMPORT_TIMEOUT_MS, 'timeoutMs', t)
  const bytes = await readPdfBytes(file, maxBytes, options.signal, t)
  const warnings: PdfFileWarning[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let loadingTask: any
  let passwordError: PdfFileError | undefined
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PdfFileError('TIMEOUT', t('pdf.timeout', { timeoutMs }))), timeoutMs) })
    loadingTask = getDocument({ data: bytes, disableAutoFetch: true, disableStream: true, isOffscreenCanvasSupported: false, isImageDecoderSupported: false, useSystemFonts: false, verbosity: 0 })
    loadingTask.onPassword = (_callback: unknown, reason: number) => {
      if (reason === PasswordResponses.NEED_PASSWORD || reason === PasswordResponses.INCORRECT_PASSWORD) {
        passwordError = new PdfFileError('PASSWORD_REQUIRED', t('pdf.passwordRequired'))
        loadingTask.destroy().catch(() => {})
      }
    }
    const pdf: any = await pageWithTimeout<any>(loadingTask.promise, timeout, options.signal, t)
    if (pdf.numPages > maxPages) throw new PdfFileError('PAGE_LIMIT_EXCEEDED', t('pdf.pageLimit', { maxPages }))
    const markdownPages: string[] = []
    const resources: PdfImportResource[] = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      checkSignal(options.signal, t)
      const page: any = await pageWithTimeout(pdf.getPage(pageNumber), timeout, options.signal, t)
      const text: any = await pageWithTimeout<any>(page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false }), timeout, options.signal, t)
      const lines = textLines(text.items)
      const annotations: any[] = await pageWithTimeout<any[]>(page.getAnnotations({ intent: 'display' }), timeout, options.signal, t)
      for (const annotation of annotations) {
        const rawUrl = annotation.url ?? annotation.unsafeUrl
        const url = safePdfLink(rawUrl) ?? (typeof annotation.dest === 'string' && annotation.dest.startsWith('#') ? annotation.dest : undefined)
        if (!url) {
          if (rawUrl || annotation.dest) addWarning(warnings, { code: rawUrl ? 'UNSAFE_URL_SKIPPED' : 'EXTERNAL_URL_SKIPPED', message: t('pdf.unsafeLink'), page: pageNumber })
          continue
        }
        const line = lines.find(candidate => candidate.items.some(item => overlaps(bboxForTextItem(item), annotation.rect || [])))
        if (line) markdownLinkLabel(line, annotation.rect || [], url)
      }
      const pageText = lines.map(line => line.text).filter(Boolean)
      const xPositions = lines.flatMap(line => line.items.map(item => Math.round(bboxForTextItem(item)[0] / 12)))
      if (new Set(xPositions).size > 2 && lines.length > 4) addWarning(warnings, { code: 'MULTI_COLUMN_LAYOUT', message: t('pdf.multiColumn'), page: pageNumber })

      const pageImages: PdfImportResource[] = []
      try {
        const operatorList: any = await pageWithTimeout<any>(page.getOperatorList({ intent: 'display' }), timeout, options.signal, t)
        const imagePromises: Promise<void>[] = []
        let imageError: unknown
        let imageIndex = 0
        const storeImage = (image: any, currentImageIndex: number): void => {
          try {
            const width = Number(image?.width) || 0; const height = Number(image?.height) || 0
            if (width * height > maxImagePixels) throw new PdfFileError('IMAGE_PIXEL_LIMIT', t('pdf.imagePixelLimit', { maxImagePixels }))
            const png = imageToPng(image)
            if (!png) throw new Error(t('pdf.pngFailed'))
            pageImages.push({ key: `pdf-resource/${pageNumber}-${currentImageIndex}.png`, bytes: png, filename: `page-${pageNumber}-image-${currentImageIndex}.png`, mimeType: 'image/png' })
          } catch (error) {
            if (error instanceof PdfFileError) imageError = error
            addWarning(warnings, { code: 'IMAGE_EXTRACT_FAILED', message: t('pdf.imageSkipped'), page: pageNumber })
          }
        }
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i]
          const args = operatorList.argsArray[i]
          const imageOp = fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject
          if (!imageOp || !args?.[0]) continue
          imageIndex++; const currentImageIndex = imageIndex
          if (typeof args[0] === 'string') {
            const id = args[0]
            imagePromises.push(new Promise<void>(resolve => {
              page.objs.get(id, (image: any) => { storeImage(image, currentImageIndex); resolve() })
            }))
          } else {
            storeImage(args[0], currentImageIndex)
          }
        }
        if (imagePromises.length) {
          const viewport = page.getViewport({ scale: 1 })
          const renderTarget = await createCanvasTarget(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)))
          if (renderTarget?.context) {
            await page.render({ canvasContext: renderTarget.context, canvas: renderTarget.canvas, viewport, annotationMode: 0 }).promise
            await Promise.all(imagePromises)
            if (imageError) throw imageError
          } else {
            addWarning(warnings, { code: 'IMAGE_EXTRACT_FAILED', message: t('pdf.canvasUnavailable'), page: pageNumber })
          }
        }
        if (imageError) throw imageError
      } catch (error) {
        if (error instanceof PdfFileError) throw error
        addWarning(warnings, { code: 'IMAGE_EXTRACT_FAILED', message: t('pdf.imageParseFailed'), page: pageNumber })
      }
      pageImages.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
      resources.push(...pageImages)
      if (!pageText.length && !pageImages.length) addWarning(warnings, { code: 'NO_TEXT_EXTRACTED', message: t('pdf.noTextPage'), page: pageNumber })
      if (pageImages.length) {
        if (pageText.length) pageText.push('')
        for (const image of pageImages) pageText.push(`![${image.alt || t('pdf.imageAlt')}](${image.key})`)
      }
      markdownPages.push(pageText.join('\n'))
      if (pageText.some(line => line.includes('|'))) addWarning(warnings, { code: 'COMPLEX_TABLE', message: t('pdf.complexTableImport'), page: pageNumber })
      page.cleanup?.()
    }
    const metadata = await pdf.getMetadata().catch(() => undefined)
    const info = metadata?.info || {}
    const resultMetadata = info.Title || info.Author ? { title: info.Title || undefined, author: info.Author || undefined } : undefined
    if (!markdownPages.some(Boolean)) addWarning(warnings, { code: 'NO_TEXT_EXTRACTED', message: t('pdf.noText') })
    await pdf.destroy()
    return { ok: true, markdown: markdownPages.join('\n\n'), resources, metadata: resultMetadata, warnings }
  } catch (error) {
    try { await loadingTask?.destroy?.() } catch { /* best effort */ }
    if (passwordError) throw passwordError
    throw asError(error, 'INVALID_PDF', t('pdf.invalid'), t)
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function pageWithTimeout<T>(promise: Promise<T>, timeout: Promise<never>, signal: AbortSignal | undefined, t: Translate): Promise<T> {
  checkSignal(signal, t)
  if (!signal) return Promise.race([promise, timeout])
  let onAbort: (() => void) | undefined
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new PdfFileError('ABORTED', t('pdf.aborted')))
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try { return await Promise.race([promise, timeout, aborted]) }
  finally { if (onAbort) signal.removeEventListener('abort', onAbort) }
}

async function withAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined, t: Translate): Promise<T> {
  checkSignal(signal, t)
  if (!signal) return promise
  let onAbort: (() => void) | undefined
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new PdfFileError('ABORTED', t('pdf.aborted')))
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try { return await Promise.race([promise, aborted]) }
  finally { if (onAbort) signal.removeEventListener('abort', onAbort) }
}

type InlineToken = { kind: 'text' | 'bold' | 'italic' | 'strike' | 'code' | 'link' | 'image' | 'math'; text: string; href?: string; alt?: string; path?: string }

function inlineTokens(source: string, warnings: PdfFileWarning[], t: Translate): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern = /(!?)\[([^\]]*)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)|(`+)([\s\S]*?)\5|(\*\*|__)([\s\S]*?)\7|(~~)([\s\S]*?)\9|(\*|_)([^\n]*?)\11|(\$\$?)([^$]+)\12/gu
  let last = 0
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > last) tokens.push({ kind: 'text', text: source.slice(last, index) })
    if (match[1] === '!') tokens.push({ kind: 'image', text: match[2], alt: match[2], path: match[3] })
    else if (match[2] !== undefined) {
      const href = match[3]
      if (isSafeLink(href)) tokens.push({ kind: 'link', text: match[2], href })
      else { tokens.push({ kind: 'text', text: match[2] }); warnings.push({ code: 'UNSAFE_URL_SKIPPED', message: t('pdf.unsafeLinkText'), path: href }) }
    } else if (match[6] !== undefined) tokens.push({ kind: 'code', text: match[6] })
    else if (match[8] !== undefined) tokens.push({ kind: 'bold', text: match[8] })
    else if (match[10] !== undefined) tokens.push({ kind: 'strike', text: match[10] })
    else if (match[12] !== undefined) tokens.push({ kind: 'italic', text: match[12] })
    else if (match[14] !== undefined) { tokens.push({ kind: 'math', text: match[14] }); addWarning(warnings, { code: 'MATH_DEGRADED', message: t('pdf.mathDegraded') }) }
    last = index + match[0].length
  }
  if (last < source.length) tokens.push({ kind: 'text', text: source.slice(last) })
  const unescape = (value: string) => value.replace(/\\([\\`*{}\[\]()#+.!_>|~-])/gu, '$1')
  for (const token of tokens) token.text = unescape(token.text)
  return tokens.length ? tokens : [{ kind: 'text', text: unescape(source) }]
}

interface Block { kind: 'heading' | 'paragraph' | 'list' | 'code' | 'table' | 'image' | 'rule' | 'quote'; level?: number; ordered?: boolean; items?: string[]; rows?: string[][]; text?: string; path?: string; alt?: string; language?: string }

function parseBlocks(markdown: string, warnings: PdfFileWarning[], t: Translate): Block[] {
  const lines = markdown.replace(/<!--([\s\S]*?)-->/gu, '').replace(/\r\n?/gu, '\n').split('\n')
  const blocks: Block[] = []
  const isTableHeader = (index: number) => {
    const value = lines[index]
    return Boolean(value?.includes('|') && lines[index + 1] && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/u.test(lines[index + 1]))
  }
  const isBlockStart = (index: number) => {
    const value = lines[index]
    return Boolean(value && (isTableHeader(index) || /^\s*(```+|~~~+)/u.test(value) || /^\s{0,3}#{1,6}\s+/u.test(value) || /^\s*(---+|\*\*\*+|___+)\s*$/u.test(value) || /^\s*!\[[^\]]*\]\(/u.test(value) || /^\s*([-+*]|\d+[.)])\s+/u.test(value) || /^\s*>\s?/u.test(value)))
  }
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const fence = line.match(/^\s*(```+|~~~+)[ \t]*(.*?)\s*$/u)
    if (fence) {
      const body: string[] = []; const marker = fence[1]; i++
      while (i < lines.length && !new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`, 'u').test(lines[i])) body.push(lines[i++])
      if (i < lines.length) i++
      const language = fence[2]?.trim().split(/\s+|\|/u)[0] || undefined
      blocks.push({ kind: 'code', text: body.join('\n'), language }); continue
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/u)
    if (heading) { blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] }); i++; continue }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/u.test(line)) { blocks.push({ kind: 'rule' }); i++; continue }
    const image = line.match(/^\s*!\[([^\]]*)\]\(([^\s)]+)(?:\s+["']([^"']*)["'])?\)\s*$/u)
    if (image) { blocks.push({ kind: 'image', alt: image[1], path: image[2] }); i++; continue }
    const list = line.match(/^\s*([-+*]|\d+[.)])\s+(.+)$/u)
    if (list) {
      const ordered = /^\d/u.test(list[1]); const items: string[] = []
      while (i < lines.length) { const item = lines[i].match(/^\s*([-+*]|\d+[.)])\s+(.+)$/u); if (!item || /^\d/u.test(item[1]) !== ordered) break; items.push(item[2]); i++ }
      blocks.push({ kind: 'list', ordered, items }); continue
    }
    if (isTableHeader(i)) {
      const rows: string[][] = []
      const splitRow = (value: string) => {
        const body = value.trim().replace(/^\||\|$/gu, '')
        const cells: string[] = []; let cell = ''; let escaped = false; let codeTicks = 0
        for (const char of body) {
          if (escaped) { cell += char; escaped = false; continue }
          if (char === '\\') { escaped = true; cell += char; continue }
          if (char === '`') { codeTicks = codeTicks ? 0 : 1; cell += char; continue }
          if (char === '|' && !codeTicks) { cells.push(cell.trim()); cell = ''; continue }
          cell += char
        }
        if (escaped) cell += '\\'
        cells.push(cell.trim())
        return cells.map(item => item.replace(/\\\|/gu, '|'))
      }
      rows.push(splitRow(line)); i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) { rows.push(splitRow(lines[i++])); }
      blocks.push({ kind: 'table', rows }); continue
    }
    if (/^\s*>\s?/u.test(line)) { const quote: string[] = []; while (i < lines.length && /^\s*>\s?/u.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/u, '')); blocks.push({ kind: 'quote', text: quote.join('\n') }); continue }
    const paragraph: string[] = [line.trim()]; i++
    while (i < lines.length && lines[i].trim() && !isBlockStart(i)) paragraph.push(lines[i++].trim())
    blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
  }
  if (blocks.some(block => block.kind === 'table')) addWarning(warnings, { code: 'COMPLEX_TABLE', message: t('pdf.complexTableExport') })
  return blocks
}

function asBytes(value: Blob | Uint8Array): Promise<Uint8Array> {
  return value instanceof Uint8Array ? Promise.resolve(value) : value.arrayBuffer().then(buffer => new Uint8Array(buffer))
}

function normalizeFileName(value: string | undefined): string {
  const name = (value || 'document.pdf').trim() || 'document.pdf'
  return /\.pdf$/iu.test(name) ? name : `${name}.pdf`
}

function margins(value: PdfExportOptions['margin']): { top: number; right: number; bottom: number; left: number } {
  if (typeof value === 'number') return { top: value, right: value, bottom: value, left: value }
  return { top: value?.top ?? 56.7, right: value?.right ?? 56.7, bottom: value?.bottom ?? 56.7, left: value?.left ?? 56.7 }
}

function fontForToken(token: InlineToken, fonts: Record<string, PDFFont>): PDFFont {
  if (token.kind === 'code') return fonts.code
  if (token.kind === 'bold') return fonts.bold
  if (token.kind === 'italic') return fonts.italic
  if (token.kind === 'strike') return fonts.normal
  return fonts.normal
}

function safeText(text: string, font: PDFFont, size: number, warnings: PdfFileWarning[], t: Translate): string {
  try { font.widthOfTextAtSize(text, size); return text }
  catch {
    addWarning(warnings, { code: 'FONT_FALLBACK', message: t('pdf.fontFallback') })
    return Array.from(text, char => { try { font.widthOfTextAtSize(char, size); return char } catch { return '?' } }).join('')
  }
}

async function embedResource(pdf: PDFDocument, bytes: Uint8Array, mimeType: string, filename: string): Promise<PDFImage | undefined> {
  const isJpeg = mimeType === 'image/jpeg' || mimeType === 'image/jpg' || /\.jpe?g$/iu.test(filename) || (bytes[0] === 0xff && bytes[1] === 0xd8)
  try { return isJpeg ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes) }
  catch { return undefined }
}

/** Generates a PDF from Markdown without mounting or reading the editor DOM. */
export async function exportPdfFile(markdown: string, options: PdfExportOptions = {}): Promise<PdfExportResult> {
  const t = bindTranslate(options.locale, options.messages)
  if (typeof markdown !== 'string') throw new TypeError(t('validation.markdownString'))
  checkSignal(options.signal, t)
  const warnings: PdfFileWarning[] = []
  const pdf = await PDFDocument.create()
  const pageSize = options.pageSize || [595.28, 841.89]
  const padding = margins(options.margin)
  if ([...pageSize, padding.top, padding.right, padding.bottom, padding.left].some(value => !Number.isFinite(value) || value <= 0)) throw new RangeError(t('pdf.pageGeometry'))
  const fonts: Record<string, PDFFont> = {}
  if (options.fontBytes) {
    pdf.registerFontkit(fontkit)
    const bytes = options.fontBytes instanceof ArrayBuffer ? new Uint8Array(options.fontBytes) : options.fontBytes
    const embedded = await pdf.embedFont(bytes, { subset: options.fontSubset ?? true })
    fonts.normal = fonts.bold = fonts.italic = fonts.code = embedded
  } else {
    fonts.normal = await pdf.embedFont(StandardFonts.Helvetica)
    fonts.bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    fonts.italic = await pdf.embedFont(StandardFonts.HelveticaOblique)
    fonts.code = await pdf.embedFont(StandardFonts.Courier)
    if (/[^\u0000-\u00ff]/u.test(markdown)) addWarning(warnings, { code: 'FONT_FALLBACK', message: t('pdf.fontFallbackCjk') })
  }
  const blocks = parseBlocks(markdown, warnings, t)
  let page: PDFPage = pdf.addPage(pageSize)
  let y = pageSize[1] - padding.top
  const width = pageSize[0] - padding.left - padding.right
  const lineHeight = (size: number) => size * 1.45
  const ensureSpace = (height: number) => { if (y - height < padding.bottom) { page = pdf.addPage(pageSize); y = pageSize[1] - padding.top } }
  const drawTextLine = (text: string, size: number, font = fonts.normal, indent = 0, color = rgb(0, 0, 0)) => {
    const value = safeText(text, font, size, warnings, t)
    ensureSpace(lineHeight(size)); page.drawText(value, { x: padding.left + indent, y: y - size, size, font, color }); y -= lineHeight(size)
  }
  const drawWrapped = (tokens: InlineToken[], size: number, indent = 0) => {
    let x = padding.left + indent; let first = true
    const maxX = pageSize[0] - padding.right
    const drawToken = (token: InlineToken, value: string) => {
      const font = fontForToken(token, fonts); const text = safeText(value, font, size, warnings, t); const tokenWidth = font.widthOfTextAtSize(text, size)
      if (x + tokenWidth > maxX && x > padding.left + indent) { y -= lineHeight(size); ensureSpace(lineHeight(size)); x = padding.left + indent }
      page.drawText(text, { x, y: y - size, size, font, color: token.kind === 'link' ? rgb(0.05, 0.25, 0.7) : rgb(0, 0, 0) })
      if (token.kind === 'link' && token.href) {
        const annotation = page.doc.context.obj({
          Type: 'Annot', Subtype: 'Link', Rect: [x, y - size * 0.15, x + tokenWidth, y + size * 1.05],
          Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(token.href) },
        })
        page.node.addAnnot(page.doc.context.register(annotation))
      }
      if (token.kind === 'strike') page.drawLine({ start: { x, y: y - size * 0.45 }, end: { x: x + tokenWidth, y: y - size * 0.45 }, thickness: 0.7, color: rgb(0, 0, 0) })
      x += tokenWidth
    }
    for (const token of tokens) {
      checkSignal(options.signal, t)
      if (token.kind === 'image') { drawToken({ kind: 'text', text: token.alt || 'image' }, `[${token.alt || 'image'}]`); continue }
      const parts = token.text.split(/(\s+)/u)
      for (const part of parts) { if (!part) continue; drawToken(token, part) }
      first = false
    }
    if (!first || tokens.length) y -= lineHeight(size)
  }
  const wrapTableCell = (tokens: InlineToken[], size: number, maxWidth: number): InlineToken[][] => {
    const lines: InlineToken[][] = [[]]
    let lineWidth = 0
    const newLine = () => { lines.push([]); lineWidth = 0 }
    for (const token of tokens) {
      const parts = token.text.split(/(\s+)/u).filter(Boolean)
      for (const part of parts) {
        if (/^\s+$/u.test(part)) {
          if (lines.at(-1)?.length) {
            const space = ' '
            const font = fontForToken(token, fonts); const spaceWidth = font.widthOfTextAtSize(space, size)
            if (lineWidth + spaceWidth <= maxWidth) { lines.at(-1)!.push({ ...token, text: space }); lineWidth += spaceWidth }
          }
          continue
        }
        let remaining = part
        while (remaining) {
          const font = fontForToken(token, fonts)
          const fullText = safeText(remaining, font, size, warnings, t)
          const fullWidth = font.widthOfTextAtSize(fullText, size)
          if (lineWidth > 0 && lineWidth + fullWidth > maxWidth) { newLine(); continue }
          if (fullWidth <= maxWidth || Array.from(remaining).length === 1) {
            lines.at(-1)!.push({ ...token, text: remaining }); lineWidth += fullWidth; remaining = ''; continue
          }
          let chunk = ''; let chunkWidth = 0
          for (const char of Array.from(remaining)) {
            const charWidth = font.widthOfTextAtSize(safeText(char, font, size, warnings, t), size)
            if (chunk && chunkWidth + charWidth > maxWidth) break
            chunk += char; chunkWidth += charWidth
          }
          if (!chunk) chunk = Array.from(remaining)[0]
          lines.at(-1)!.push({ ...token, text: chunk }); lineWidth += chunkWidth || font.widthOfTextAtSize(chunk, size); remaining = remaining.slice(chunk.length)
          if (remaining) newLine()
        }
      }
    }
    return lines.filter(line => line.length)
  }
  const drawTableLine = (tokens: InlineToken[], size: number, x: number, baseline: number) => {
    for (const token of tokens) {
      const font = fontForToken(token, fonts); const text = safeText(token.text, font, size, warnings, t); const tokenWidth = font.widthOfTextAtSize(text, size)
      page.drawText(text, { x, y: baseline, size, font, color: token.kind === 'link' ? rgb(0.05, 0.25, 0.7) : rgb(0, 0, 0) })
      if (token.kind === 'link' && token.href) {
        const annotation = page.doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x, baseline - size * 0.15, x + tokenWidth, baseline + size * 1.05], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(token.href) } })
        page.node.addAnnot(page.doc.context.register(annotation))
      }
      x += tokenWidth
    }
  }
  const codeColor = (scope?: string) => {
    if (!scope) return rgb(0.15, 0.17, 0.2)
    if (scope.startsWith('comment') || scope.startsWith('quote')) return rgb(0.416, 0.451, 0.49)
    if (scope.startsWith('keyword') || scope.startsWith('selector-tag') || scope.startsWith('subst')) return rgb(0.843, 0.227, 0.286)
    if (scope.startsWith('string') || scope.startsWith('doctag') || scope.startsWith('regexp')) return rgb(0.012, 0.184, 0.384)
    if (scope.startsWith('title') || scope.startsWith('section') || scope.startsWith('selector-id')) return rgb(0.435, 0.259, 0.757)
    if (scope.startsWith('number') || scope.startsWith('literal') || scope.startsWith('variable') || scope.startsWith('symbol') || scope.startsWith('bullet')) return rgb(0, 0.361, 0.773)
    if (scope.startsWith('type') || scope.startsWith('class') || scope.startsWith('built_in')) return rgb(0.89, 0.384, 0.035)
    if (scope.startsWith('attr') || scope.startsWith('attribute') || scope.startsWith('name')) return rgb(0.133, 0.533, 0.227)
    if (scope.startsWith('meta')) return rgb(0.451, 0.361, 0.059)
    return rgb(0.15, 0.17, 0.2)
  }
  const wrapCodeLine = (runs: HighlightedCodeSegment[], font: PDFFont, size: number, maxWidth: number): HighlightedCodeSegment[][] => {
    if (!runs.length) return [[{ text: ' ' }]]
    const lines: HighlightedCodeSegment[][] = [[]]; let lineWidth = 0
    const append = (text: string, scope?: string) => {
      const line = lines.at(-1)!; const last = line.at(-1)
      if (last && last.scope === scope) last.text += text
      else line.push({ text, scope })
    }
    for (const run of runs) for (const char of Array.from(run.text)) {
      const charWidth = font.widthOfTextAtSize(safeText(char, font, size, warnings, t), size)
      if (lineWidth > 0 && lineWidth + charWidth > maxWidth) { lines.push([]); lineWidth = 0 }
      append(char, run.scope); lineWidth += charWidth
    }
    return lines
  }
  const drawCodeBlock = (block: Block) => {
    const size = 8.5; const blockPadding = 8; const codeLineHeight = 12; const background = rgb(0.965, 0.968, 0.972); const accent = rgb(0.78, 0.8, 0.84)
    const drawBackgroundLine = (runs: HighlightedCodeSegment[]) => {
      ensureSpace(codeLineHeight)
      page.drawRectangle({ x: padding.left, y: y - codeLineHeight, width, height: codeLineHeight, color: background })
      page.drawRectangle({ x: padding.left, y: y - codeLineHeight, width: 2, height: codeLineHeight, color: accent })
      let x = padding.left + blockPadding
      for (const run of runs) {
        const text = safeText(run.text, fonts.code, size, warnings, t)
        page.drawText(text, { x, y: y - 9.5, size, font: fonts.code, color: codeColor(run.scope) })
        x += fonts.code.widthOfTextAtSize(text, size)
      }
      y -= codeLineHeight
    }
    ensureSpace(codeLineHeight)
    page.drawRectangle({ x: padding.left, y: y - codeLineHeight, width, height: codeLineHeight, color: background })
    page.drawRectangle({ x: padding.left, y: y - codeLineHeight, width: 2, height: codeLineHeight, color: accent })
    if (block.language) page.drawText(safeText(block.language, fonts.code, 7, warnings, t), { x: padding.left + blockPadding, y: y - 8.5, size: 7, font: fonts.code, color: rgb(0.38, 0.4, 0.45) })
    y -= codeLineHeight
    const available = width - blockPadding * 2
    const highlighted = highlightCode(block.text || '', block.language)
    for (const sourceLine of highlighted.lines) for (const visualLine of wrapCodeLine(sourceLine, fonts.code, size, available)) drawBackgroundLine(visualLine)
    ensureSpace(6)
    page.drawRectangle({ x: padding.left, y: y - 6, width, height: 6, color: background })
    page.drawRectangle({ x: padding.left, y: y - 6, width: 2, height: 6, color: accent })
    y -= 12
  }
  for (const block of blocks) {
    checkSignal(options.signal, t)
    if (block.kind === 'rule') { ensureSpace(12); page.drawLine({ start: { x: padding.left, y: y - 6 }, end: { x: pageSize[0] - padding.right, y: y - 6 }, thickness: 1, color: rgb(0.65, 0.65, 0.65) }); y -= 18; continue }
    if (block.kind === 'heading') { const size = [0, 24, 20, 16, 14, 12, 11][block.level || 1]; drawWrapped(inlineTokens(block.text || '', warnings, t), size); y -= 5; continue }
    if (block.kind === 'code') { drawCodeBlock(block); continue }
    if (block.kind === 'list') { for (let index = 0; index < (block.items || []).length; index++) { const bullet = block.ordered ? `${index + 1}. ` : '• '; drawWrapped([{ kind: 'text', text: bullet }, ...inlineTokens(block.items![index], warnings, t)], 11, 12) } y -= 4; continue }
    if (block.kind === 'quote') { drawWrapped(inlineTokens(block.text || '', warnings, t), 11, 14); y -= 4; continue }
    if (block.kind === 'table') {
      const rows = block.rows || []; const columnCount = Math.max(0, ...rows.map(row => row.length)); const tableFontSize = 9; const cellPadding = 5
      if (rows.length && columnCount) {
        const naturalWidths = Array.from({ length: columnCount }, (_, column) => {
          const widest = Math.max(...rows.map(row => {
            const text = row[column] || ''; return inlineTokens(text, warnings, t).reduce((sum, token) => sum + fontForToken(token, fonts).widthOfTextAtSize(safeText(token.text, fontForToken(token, fonts), tableFontSize, warnings, t), tableFontSize), 0)
          }), 24)
          return Math.min(260, widest + cellPadding * 2)
        })
        const naturalTotal = naturalWidths.reduce((sum, value) => sum + value, 0)
        const widths = naturalTotal > width
          ? naturalWidths.map(value => value * width / naturalTotal)
          : naturalWidths.map(value => value + (width - naturalTotal) / columnCount)
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex]
          const cellLines = Array.from({ length: columnCount }, (_, column) => wrapTableCell(inlineTokens(row[column] || '', warnings, t), tableFontSize, Math.max(20, widths[column] - cellPadding * 2)))
          const rowHeight = Math.max(1, ...cellLines.map(lines => lines.length)) * 12 + cellPadding * 2
          ensureSpace(rowHeight)
          let x = padding.left
          for (let column = 0; column < columnCount; column++) {
            const cellWidth = widths[column]; const cellColor = rowIndex === 0 ? rgb(0.95, 0.95, 0.94) : rgb(1, 1, 1)
            page.drawRectangle({ x, y: y - rowHeight, width: cellWidth, height: rowHeight, color: cellColor, borderColor: rgb(0.78, 0.78, 0.76), borderWidth: 0.5 })
            const lines = cellLines[column]
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) drawTableLine(lines[lineIndex], tableFontSize, x + cellPadding, y - cellPadding - tableFontSize - lineIndex * 12)
            x += cellWidth
          }
          y -= rowHeight
        }
      }
      y -= 4; continue
    }
    if (block.kind === 'image') {
      if (!options.resolveResource) { addWarning(warnings, { code: 'RESOURCE_UNRESOLVED', message: t('pdf.imageUnresolved'), path: block.path }); drawTextLine(`[${block.alt || 'image'}]`, 11); continue }
      try {
        const resolved = await withAbort(options.resolveResource({ path: block.path || '', alt: block.alt }), options.signal, t)
        checkSignal(options.signal, t)
        const bytes = await asBytes(resolved.bytes)
        const image = await embedResource(pdf, bytes, '', block.path || '')
        if (!image) throw new Error('unsupported image')
        const dimensions = image.scaleToFit(width, 240); ensureSpace(dimensions.height + 10); page.drawImage(image, { x: padding.left, y: y - dimensions.height, width: dimensions.width, height: dimensions.height }); y -= dimensions.height + 10
      } catch (error) {
        addWarning(warnings, { code: 'RESOURCE_RESOLUTION_FAILED', message: t('pdf.imageFailed'), path: block.path }); drawTextLine(`[${block.alt || 'image'}]`, 11)
        if (error instanceof PdfFileError) throw error
      }
      continue
    }
    const inline = inlineTokens(block.text || '', warnings, t)
    const inlineImages: PDFImage[] = []
    // Inline images are resolved in source order even when represented as a readable fallback.
    for (const token of inline) if (token.kind === 'image') {
      if (!options.resolveResource) { addWarning(warnings, { code: 'RESOURCE_UNRESOLVED', message: t('pdf.inlineImageUnresolved'), path: token.path }); continue }
      try {
        const resolved = await withAbort(options.resolveResource({ path: token.path || '', alt: token.alt }), options.signal, t); checkSignal(options.signal, t)
        const image = await embedResource(pdf, await asBytes(resolved.bytes), '', token.path || '')
        if (image) inlineImages.push(image)
        else addWarning(warnings, { code: 'RESOURCE_RESOLUTION_FAILED', message: t('pdf.inlineImageUnsupported'), path: token.path })
      } catch (error) {
        if (error instanceof PdfFileError) throw error
        addWarning(warnings, { code: 'RESOURCE_RESOLUTION_FAILED', message: t('pdf.inlineImageFailed'), path: token.path })
      }
    }
    drawWrapped(inline, 11)
    for (const image of inlineImages) {
      const dimensions = image.scaleToFit(Math.min(width, 180), 100); ensureSpace(dimensions.height + 8)
      page.drawImage(image, { x: padding.left, y: y - dimensions.height, width: dimensions.width, height: dimensions.height }); y -= dimensions.height + 8
    }
    y -= 4
  }
  pdf.setTitle('Markdown PDF')
  const bytes = await pdf.save()
  const outputBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return { blob: new Blob([outputBuffer], { type: PDF_FILE_MIME }), fileName: normalizeFileName(options.fileName), mimeType: PDF_FILE_MIME, warnings }
}

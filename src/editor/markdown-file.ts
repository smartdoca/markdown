import { createMarkdownFile } from './upload'
import { translate, type EditorMessages } from './i18n'

export const MARKDOWN_FILE_MIME = 'text/markdown;charset=utf-8'
export const DEFAULT_MARKDOWN_IMPORT_MAX_BYTES = 512 * 1024
export interface MarkdownFileWarning {
  code: 'UTF8_BOM_REMOVED' | 'MIXED_LINE_ENDINGS' | 'RESOURCE_REFERENCES_PRESERVED'
  message: string
}
export interface MarkdownImportOptions { maxBytes?: number; locale?: string; messages?: EditorMessages }
export type MarkdownLineEndings = 'none' | 'lf' | 'crlf' | 'cr' | 'mixed'
export type MarkdownImportErrorCode = 'UNSUPPORTED_EXTENSION' | 'FILE_TOO_LARGE' | 'INVALID_UTF8' | 'BINARY_CONTENT' | 'READ_FAILED'
export type MarkdownImportResult = {
  ok: true
  markdown: string
  fileName: string
  byteLength: number
  encoding: 'utf-8'
  hadBom: boolean
  lineEndings: MarkdownLineEndings
  warnings: MarkdownFileWarning[]
} | {
  ok: false
  error: { code: MarkdownImportErrorCode; message: string }
  warnings: MarkdownFileWarning[]
}
export interface MarkdownExportResult {
  blob: Blob
  fileName: string
  mimeType: typeof MARKDOWN_FILE_MIME
  warnings: MarkdownFileWarning[]
}
export interface MarkdownExportOptions { fileName?: string; locale?: string; messages?: EditorMessages }

function resourceWarning(locale?: string, messages?: EditorMessages): MarkdownFileWarning {
  return { code: 'RESOURCE_REFERENCES_PRESERVED', message: translate(locale, 'markdown.resourcePreserved', undefined, messages) }
}
function lineEndings(markdown: string): MarkdownLineEndings {
  const kinds = new Set<MarkdownLineEndings>()
  for (const match of markdown.matchAll(/\r\n|\r|\n/g)) kinds.add(match[0] === '\r\n' ? 'crlf' : match[0] === '\r' ? 'cr' : 'lf')
  return kinds.size > 1 ? 'mixed' : kinds.values().next().value || 'none'
}

/** Strict UTF-8 file parsing only. Never writes a model, fetches assets or initializes a document. */
export async function importMarkdownFile(file: File, options: MarkdownImportOptions = {}): Promise<MarkdownImportResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MARKDOWN_IMPORT_MAX_BYTES
  const t = (key: string, values?: Record<string, string | number>) => translate(options.locale, key, values, options.messages)
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError(t('validation.nonNegativeInteger', { name: 'maxBytes' }))
  const fail = (code: MarkdownImportErrorCode, message: string): MarkdownImportResult => ({ ok: false, error: { code, message }, warnings: [] })
  if (!/\.(md|markdown)$/i.test(file.name)) return fail('UNSUPPORTED_EXTENSION', t('markdown.unsupportedExtension'))
  if (file.size > maxBytes) return fail('FILE_TOO_LARGE', t('markdown.fileTooLarge', { maxBytes }))
  let bytes: Uint8Array
  try { bytes = new Uint8Array(await file.arrayBuffer()) }
  catch { return fail('READ_FAILED', t('markdown.readFailed')) }
  if (bytes.byteLength > maxBytes) return fail('FILE_TOO_LARGE', t('markdown.fileTooLarge', { maxBytes }))
  let markdown: string
  const hadBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  try {
    // Preserve U+FEFF in the actual content, remove only the single file-signature BOM.
    markdown = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(hadBom ? bytes.subarray(3) : bytes)
  } catch { return fail('INVALID_UTF8', t('markdown.invalidUtf8')) }
  if (markdown.includes('\0')) return fail('BINARY_CONTENT', t('markdown.binary'))
  const endings = lineEndings(markdown)
  const warnings = [resourceWarning(options.locale, options.messages)]
  if (hadBom) warnings.unshift({ code: 'UTF8_BOM_REMOVED', message: t('markdown.bomRemoved') })
  if (endings === 'mixed') warnings.push({ code: 'MIXED_LINE_ENDINGS', message: t('markdown.mixedLineEndings') })
  return { ok: true, markdown, fileName: file.name, byteLength: bytes.byteLength, encoding: 'utf-8', hadBom, lineEndings: endings, warnings }
}

/** Snapshot raw source using getMarkdown(), then pass it here. Does not trigger a download. */
export function exportMarkdownFile(markdown: string, options: MarkdownExportOptions = {}): MarkdownExportResult {
  const file = createMarkdownFile(markdown, { fileName: options.fileName, mimeType: MARKDOWN_FILE_MIME, locale: options.locale, messages: options.messages })
  return { blob: file, fileName: file.name, mimeType: MARKDOWN_FILE_MIME, warnings: [resourceWarning(options.locale, options.messages)] }
}

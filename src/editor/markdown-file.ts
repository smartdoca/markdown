import { createMarkdownFile } from './upload'

export const MARKDOWN_FILE_MIME = 'text/markdown;charset=utf-8'
export const DEFAULT_MARKDOWN_IMPORT_MAX_BYTES = 512 * 1024
export interface MarkdownFileWarning {
  code: 'UTF8_BOM_REMOVED' | 'MIXED_LINE_ENDINGS' | 'RESOURCE_REFERENCES_PRESERVED'
  message: string
}
export interface MarkdownImportOptions { maxBytes?: number }
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
export interface MarkdownExportOptions { fileName?: string }

function resourceWarning(): MarkdownFileWarning {
  return { code: 'RESOURCE_REFERENCES_PRESERVED', message: '仅交换 Markdown 原文；图片、附件和内部链接的 ID/path/地址原样保留，未读取资源或验证授权，平台内部资源离开平台不保证可访问。' }
}
function lineEndings(markdown: string): MarkdownLineEndings {
  const kinds = new Set<MarkdownLineEndings>()
  for (const match of markdown.matchAll(/\r\n|\r|\n/g)) kinds.add(match[0] === '\r\n' ? 'crlf' : match[0] === '\r' ? 'cr' : 'lf')
  return kinds.size > 1 ? 'mixed' : kinds.values().next().value || 'none'
}

/** Strict UTF-8 file parsing only. Never writes a model, fetches assets or initializes a document. */
export async function importMarkdownFile(file: File, options: MarkdownImportOptions = {}): Promise<MarkdownImportResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MARKDOWN_IMPORT_MAX_BYTES
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError('maxBytes 必须为非负安全整数')
  const fail = (code: MarkdownImportErrorCode, message: string): MarkdownImportResult => ({ ok: false, error: { code, message }, warnings: [] })
  if (!/\.(md|markdown)$/i.test(file.name)) return fail('UNSUPPORTED_EXTENSION', '只支持 .md 和 .markdown 文件')
  if (file.size > maxBytes) return fail('FILE_TOO_LARGE', `文件超过 ${maxBytes} 字节限制`)
  let bytes: Uint8Array
  try { bytes = new Uint8Array(await file.arrayBuffer()) }
  catch { return fail('READ_FAILED', '无法读取 Markdown 文件') }
  if (bytes.byteLength > maxBytes) return fail('FILE_TOO_LARGE', `文件超过 ${maxBytes} 字节限制`)
  let markdown: string
  const hadBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  try {
    // Preserve U+FEFF in the actual content, remove only the single file-signature BOM.
    markdown = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(hadBom ? bytes.subarray(3) : bytes)
  } catch { return fail('INVALID_UTF8', '文件不是有效 UTF-8；请先转换编码，未替换任何损坏字符') }
  if (markdown.includes('\0')) return fail('BINARY_CONTENT', '文件包含 NUL 字符，可能是二进制或不受支持的 UTF-16/UTF-32 编码')
  const endings = lineEndings(markdown)
  const warnings = [resourceWarning()]
  if (hadBom) warnings.unshift({ code: 'UTF8_BOM_REMOVED', message: '已移除文件开头的 UTF-8 BOM；正文内的 U+FEFF 保留' })
  if (endings === 'mixed') warnings.push({ code: 'MIXED_LINE_ENDINGS', message: '文件混用了换行格式；原样保留，未统一换行' })
  return { ok: true, markdown, fileName: file.name, byteLength: bytes.byteLength, encoding: 'utf-8', hadBom, lineEndings: endings, warnings }
}

/** Snapshot raw source using getMarkdown(), then pass it here. Does not trigger a download. */
export function exportMarkdownFile(markdown: string, options: MarkdownExportOptions = {}): MarkdownExportResult {
  const file = createMarkdownFile(markdown, { fileName: options.fileName, mimeType: MARKDOWN_FILE_MIME })
  return { blob: file, fileName: file.name, mimeType: MARKDOWN_FILE_MIME, warnings: [resourceWarning()] }
}

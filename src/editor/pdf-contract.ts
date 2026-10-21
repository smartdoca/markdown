import type { EditorMessages } from './i18n'

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


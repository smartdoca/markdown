import type { PdfFileInput, PdfImportOptions, PdfImportResult, PdfExportOptions, PdfExportResult } from './pdf-contract'

export { PdfFileError, PDF_FILE_MIME, DEFAULT_PDF_IMPORT_MAX_BYTES, DEFAULT_PDF_IMPORT_MAX_PAGES,
  DEFAULT_PDF_IMPORT_MAX_IMAGE_PIXELS, DEFAULT_PDF_IMPORT_TIMEOUT_MS } from './pdf-contract'
export type { PdfFileInput, PdfImportOptions, PdfImportResult, PdfImportResource, PdfExportOptions,
  PdfExportResult, PdfFileWarning, PdfFileWarningCode, PdfFileErrorCode } from './pdf-contract'

/** Extracts local PDF content only. PDF runtimes load on the first explicit conversion. */
export async function importPdfFile(file: PdfFileInput, options: PdfImportOptions = {}): Promise<PdfImportResult> {
  const pdf = await import('./pdf-file-impl')
  return pdf.importPdfFile(file, options)
}

/** Generates a PDF from Markdown without mounting or reading the editor DOM. */
export async function exportPdfFile(markdown: string, options: PdfExportOptions = {}): Promise<PdfExportResult> {
  const pdf = await import('./pdf-file-impl')
  return pdf.exportPdfFile(markdown, options)
}

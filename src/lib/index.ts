import '../styles.css'

export { CollaborativeMarkdownEditor, DefaultEditorHeader, DefaultEditorLoading, DefaultEditorFooter } from './CollaborativeMarkdownEditor'
export type { CollaborativeMarkdownEditorProps, CollaborativeMarkdownEditorComponents,
  EditorHeaderProps, EditorLoadingProps, EditorFooterProps } from './CollaborativeMarkdownEditor'
export { MarkdownPreview } from '../components/MarkdownPreview'
export type { MarkdownPreviewProps } from '../components/MarkdownPreview'
export type { MarkdownPreviewInteraction } from '../editor/preview-interaction'
export { Toolbar } from '../components/Toolbar'
export type { ToolbarProps } from '../components/Toolbar'
export { CodeBlock } from '../components/CodeBlock'
export type { CodeBlockProps } from '../components/CodeBlock'
export { MermaidDiagram } from '../components/MermaidDiagram'
export type { MermaidDiagramProps } from '../components/MermaidDiagram'
export { useCollaboration, DEFAULT_MARKDOWN } from '../editor/collaboration'
export { COLLABORATION_PROTOCOL_VERSION, MARKDOWN_CODEC, MARKDOWN_SCHEMA_VERSION,
  TRANSACTION_ORIGINS, getMarkdownText, readMarkdownMetadata, initializeMarkdownDocument,
  assertSupportedMarkdownDocument, encodeMarkdownCheckpoint } from '../editor/protocol'
export { uploadImageToEndpoint, imageToDataUrl, createMarkdownFile, downloadMarkdown } from '../editor/upload'
export type { UploadImageOptions, DownloadMarkdownOptions } from '../editor/upload'
export { importMarkdownFile, exportMarkdownFile, MARKDOWN_FILE_MIME, DEFAULT_MARKDOWN_IMPORT_MAX_BYTES } from '../editor/markdown-file'
export type { MarkdownImportOptions, MarkdownImportResult, MarkdownImportErrorCode, MarkdownLineEndings,
  MarkdownExportOptions, MarkdownExportResult, MarkdownFileWarning } from '../editor/markdown-file'
export { importPdfFile, exportPdfFile, PdfFileError, PDF_FILE_MIME,
  DEFAULT_PDF_IMPORT_MAX_BYTES, DEFAULT_PDF_IMPORT_MAX_PAGES,
  DEFAULT_PDF_IMPORT_MAX_IMAGE_PIXELS, DEFAULT_PDF_IMPORT_TIMEOUT_MS } from '../editor/pdf-file'
export type { PdfFileInput, PdfImportOptions, PdfImportResult, PdfImportResource, PdfExportOptions,
  PdfExportResult, PdfFileWarning, PdfFileWarningCode, PdfFileErrorCode } from '../editor/pdf-file'
export type { EditorMode, EditorAsset, EditorUploadContext, EditorResources, MarkdownFindOptions,
  MarkdownFindMatch, MarkdownFormatState, CollaborativeMarkdownEditorHandle,
  MarkdownActiveView, MarkdownSelectionAction, MarkdownSelectionActionContext } from '../editor/integration'
export { createHostMarkdownSession, updateHostMarkdownSession, observeLocalMarkdownUpdates,
  applyRemoteMarkdownUpdate, MARKDOWN_HOST_CAPABILITIES } from '../editor/host-session'
export type { HostMarkdownSessionOptions, LocalMarkdownUpdate } from '../editor/host-session'
export { createMarkdownTextSelection, resolveMarkdownTextSelection,
  createMarkdownTextAnchor, resolveMarkdownTextAnchor } from '../editor/selection'
export type { SerializedRelativePosition, MarkdownTextSelection, MarkdownTextAnchor,
  ResolvedTextRange, RemoteMarkdownSelection, MarkdownCommentAnchor } from '../editor/selection'
export type { CollaborationOptions, CollaborationSession, CollaborationUser, Collaborator,
  CollaborationError, CollaborationErrorCode, ConnectionState, SaveState, ViewMode } from '../editor/types'
export { translate, resolveEditorLocale, editorLanguageTag } from '../editor/i18n'
export type { EditorMessages, MessageValues } from '../editor/i18n'

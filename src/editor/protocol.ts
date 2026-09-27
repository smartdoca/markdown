import * as Y from 'yjs'

export const COLLABORATION_PROTOCOL_VERSION = 1
export const MARKDOWN_CODEC = 'markdown-ytext'
export const MARKDOWN_SCHEMA_VERSION = 1
export const MARKDOWN_TEXT_KEY = 'markdown'
export const MARKDOWN_META_KEY = 'exmd:meta'

export const TRANSACTION_ORIGINS = {
  bootstrap: Symbol('exmd.bootstrap'), remote: Symbol('exmd.remote'),
} as const

export interface MarkdownDocumentMetadata { codec: typeof MARKDOWN_CODEC; schemaVersion: typeof MARKDOWN_SCHEMA_VERSION }
export function getMarkdownText(doc: Y.Doc): Y.Text { return doc.getText(MARKDOWN_TEXT_KEY) }
export function readMarkdownMetadata(doc: Y.Doc): Partial<MarkdownDocumentMetadata> {
  const meta = doc.getMap<string | number>(MARKDOWN_META_KEY)
  return { codec: meta.get('codec') as MarkdownDocumentMetadata['codec'] | undefined,
    schemaVersion: meta.get('schemaVersion') as MarkdownDocumentMetadata['schemaVersion'] | undefined }
}
export function initializeMarkdownDocument(doc: Y.Doc, initialValue: string): void {
  const text = getMarkdownText(doc); const meta = doc.getMap<string | number>(MARKDOWN_META_KEY)
  doc.transact(() => {
    if (text.length === 0 && initialValue) text.insert(0, initialValue)
    if (!meta.has('codec')) meta.set('codec', MARKDOWN_CODEC)
    if (!meta.has('schemaVersion')) meta.set('schemaVersion', MARKDOWN_SCHEMA_VERSION)
  }, TRANSACTION_ORIGINS.bootstrap)
}
export function assertSupportedMarkdownDocument(doc: Y.Doc): void {
  const metadata = readMarkdownMetadata(doc)
  if (metadata.codec !== MARKDOWN_CODEC) throw new Error(`Unsupported codec: ${metadata.codec}`)
  if (metadata.schemaVersion !== MARKDOWN_SCHEMA_VERSION) throw new Error(`Unsupported schema version: ${metadata.schemaVersion}`)
}
export function encodeMarkdownCheckpoint(doc: Y.Doc): Uint8Array { return Y.encodeStateAsUpdate(doc) }

import type { EditorView } from '@codemirror/view'
import type { ReactNode } from 'react'
import type { MarkdownCommentAnchor, MarkdownTextAnchor, MarkdownTextSelection, RemoteMarkdownSelection, ResolvedTextRange } from './selection'

export type EditorMode = 'edit' | 'readonly'
export type MarkdownActiveView = 'source' | 'preview'
export interface MarkdownSelectionActionContext {
  view: MarkdownActiveView
  anchor: MarkdownTextAnchor | null
}
export interface MarkdownSelectionAction {
  id: string
  icon?: ReactNode
  title: string
  /** Host comment permission, independent of document edit permission. */
  disabled?: boolean
  /** Defaults to true. Set false for explicit document-level actions. */
  requiresSelection?: boolean
  onClick(context: MarkdownSelectionActionContext): void
}

export interface EditorAsset {
  /** Stable host-owned asset identifier or path. Do not return a temporary signed URL here. */
  path: string
  name?: string
  size?: number
  mimeType?: string
  width?: number
  height?: number
}

export interface EditorUploadContext { signal: AbortSignal; onProgress: (percent: number) => void }
export interface EditorResources {
  uploadImage?: (file: File, context: EditorUploadContext) => Promise<EditorAsset | string>
  resolveUrl?: (path: string) => string | Promise<string>
  resolveDownloadUrl?: (path: string) => string | Promise<string>
}

export interface MarkdownFindOptions { caseSensitive?: boolean }
export interface MarkdownFindMatch { id: string; from: number; to: number; text: string; revision: number }
export interface MarkdownFormatState {
  selection: { from: number; to: number }
  canUndo: boolean
  canRedo: boolean
}

export interface CollaborativeMarkdownEditorHandle {
  focus(): void
  getMarkdown(): string
  /** Explicit whole-source edit; one undoable transaction, not an initialization/sync API. */
  replaceMarkdown(markdown: string, options?: { expectedMarkdown?: string }): boolean
  getEditorView(): EditorView | undefined
  insertText(text: string): boolean
  find(query: string, options?: MarkdownFindOptions): MarkdownFindMatch[]
  reveal(match: MarkdownFindMatch): boolean
  replace(match: MarkdownFindMatch, text: string): boolean
  replaceAll(query: string, text: string, options?: MarkdownFindOptions): number
  undo(): boolean
  redo(): boolean
  queryFormatState(): MarkdownFormatState
  onSelectionChange(listener: (selection: MarkdownTextSelection | null) => void): () => void
  renderRemoteSelections(selections: RemoteMarkdownSelection[]): void
  clearRemoteSelections(): void
  captureAnchor(): MarkdownTextAnchor | null
  resolveAnchor(anchor: MarkdownTextAnchor): ResolvedTextRange | null
  revealAnchor(anchor: MarkdownTextAnchor): boolean
  /** Full comment snapshot. Missing, resolved, deleted or orphaned ranges are not drawn. */
  renderAnchors(anchors: MarkdownCommentAnchor[]): void
  setActiveAnchor(id: string | null): void
  clearAnchors(): void
  onAnchorClick(listener: (id: string) => void): () => void
}

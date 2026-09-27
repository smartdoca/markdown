import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import type { CollaborationError, CollaborationSession, Collaborator, ConnectionState, SaveState } from './types'
import { COLLABORATION_PROTOCOL_VERSION, MARKDOWN_CODEC, MARKDOWN_SCHEMA_VERSION,
  TRANSACTION_ORIGINS, assertSupportedMarkdownDocument, getMarkdownText } from './protocol'

export interface HostMarkdownSessionOptions {
  doc: Y.Doc
  awareness?: Awareness
  undoManager?: Y.UndoManager
  state: ConnectionState
  saveState: SaveState
  ready: boolean
  collaborators?: Collaborator[]
  error?: CollaborationError
  epochId?: string
}

/** Creates no transport/storage. A helper-owned Awareness has its standard expiry timer; dispose it at session end. */
export function createHostMarkdownSession(options: HostMarkdownSessionOptions): CollaborationSession {
  assertSupportedMarkdownDocument(options.doc)
  const text = getMarkdownText(options.doc)
  const ownsAwareness = !options.awareness
  const ownsUndoManager = !options.undoManager
  const awareness = options.awareness || new Awareness(options.doc)
  const undoManager = options.undoManager || new Y.UndoManager(text)
  return {
    doc: options.doc,
    text,
    awareness,
    undoManager,
    state: options.state,
    saveState: options.saveState,
    ready: options.ready,
    collaborators: options.collaborators || [],
    error: options.error,
    epochId: options.epochId,
    dispose: () => { if (ownsUndoManager) undoManager.destroy(); if (ownsAwareness) awareness.destroy() },
  }
}

/** Returns a new status snapshot while retaining the exact Y.Doc, Y.Text, awareness and undo instances. */
export function updateHostMarkdownSession(session: CollaborationSession,
  state: Pick<CollaborationSession, 'state' | 'ready' | 'saveState'> & Partial<Pick<CollaborationSession, 'collaborators' | 'error' | 'epochId'>>): CollaborationSession {
  return { ...session, ...state }
}

export interface LocalMarkdownUpdate {
  update: Uint8Array
  origin: unknown
  transaction: Y.Transaction
}

/** Only editor-local正文 transactions pass this filter; bootstrap and remote apply do not. */
export function observeLocalMarkdownUpdates(session: Pick<CollaborationSession, 'doc' | 'text'>,
  listener: (event: LocalMarkdownUpdate) => void): () => void {
  const handle = (update: Uint8Array, origin: unknown, _doc: Y.Doc, transaction: Y.Transaction) => {
    const changesMarkdown = Array.from(transaction.changedParentTypes.keys()).some(type => Object.is(type, session.text))
    if (!transaction.local || origin === TRANSACTION_ORIGINS.bootstrap || origin === TRANSACTION_ORIGINS.remote || !changesMarkdown) return
    listener({ update, origin, transaction })
  }
  session.doc.on('update', handle)
  return () => session.doc.off('update', handle)
}

export function applyRemoteMarkdownUpdate(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update, TRANSACTION_ORIGINS.remote)
}

export const MARKDOWN_HOST_CAPABILITIES = Object.freeze({
  protocolVersion: COLLABORATION_PROTOCOL_VERSION,
  codec: MARKDOWN_CODEC,
  schemaVersion: MARKDOWN_SCHEMA_VERSION,
  textRoot: 'markdown',
  find: { literal: true, caseSensitive: true, regex: false },
  permanentTextAnchors: true,
  remoteCarets: true,
  commentDecorations: true,
  previewTextAnchors: true,
  previewCommentDecorations: true,
  hostSelectionActions: true,
  anchorKind: 'markdown-text-range',
  anchorBoundary: 'exclude-both',
})

export type ViewMode = 'edit' | 'split' | 'preview'

export type ConnectionState = 'loading' | 'syncing' | 'ready' | 'disconnected' | 'error'
export type SaveState = 'unavailable' | 'clean' | 'dirty' | 'saving' | 'error'

export interface Collaborator {
  clientId: number
  name: string
  color: string
}

export interface CollaborationUser { name: string; color: string; colorLight?: string }
export interface CollaborationOptions {
  roomId: string
  websocketUrl: string
  initialValue?: string
  user?: CollaborationUser
  persistence?: boolean
  persistenceKey?: string
  /** Read-only clients do not publish cursor or selection presence. */
  readOnly?: boolean
  /** Disable the built-in transport when a host-managed session is injected. */
  enabled?: boolean
}

export interface CollaborationSession {
  doc: import('yjs').Doc
  text: import('yjs').Text
  awareness: import('y-protocols/awareness').Awareness
  undoManager: import('yjs').UndoManager
  state: ConnectionState
  ready: boolean
  /** The demo transport has no durable ACK, so its save state is unavailable. */
  saveState: SaveState
  collaborators: Collaborator[]
  error?: CollaborationError
  epochId?: string
  /** Disposes only helper-owned awareness/undo resources; never the host Y.Doc. */
  dispose?: () => void
}

export type CollaborationErrorCode = 'AUTH_FAILED' | 'NETWORK_ERROR' | 'INITIALIZATION_FAILED'
  | 'PROTOCOL_MISMATCH' | 'SCHEMA_MISMATCH' | 'EPOCH_MISMATCH'
export interface CollaborationError { code: CollaborationErrorCode; message: string; retryable: boolean; cause?: unknown }

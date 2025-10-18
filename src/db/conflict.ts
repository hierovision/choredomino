/**
 * Conflict Resolution for Sync
 * Handles concurrent updates using last-write-wins strategy
 */
import type { AnyDocument } from './operations'

/**
 * Resolve conflict between local and remote documents
 * Uses last-write-wins strategy based on modified timestamp
 * 
 * @param local - Local document version
 * @param remote - Remote document version  
 * @returns The winning document (most recent modification)
 */
export function resolveConflict<T extends AnyDocument>(
  local: T,
  remote: T
): { winner: T; source: 'local' | 'remote' | 'merged' } {
  // If IDs don't match, this is an error
  if (local.id !== remote.id) {
    throw new Error(`Cannot resolve conflict: ID mismatch (${local.id} vs ${remote.id})`)
  }

  // Last-write-wins: Compare modified timestamps
  if (local.modified > remote.modified) {
    return { winner: local, source: 'local' }
  } else if (remote.modified > local.modified) {
    return { winner: remote, source: 'remote' }
  }

  // Timestamps are equal - merge with preference to remote
  // This handles race conditions where updates happen at the exact same millisecond
  return {
    winner: {
      ...local,
      ...remote,
      // Keep the most recent updatedAt
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
      // Use remote's modified to break tie
      modified: remote.modified
    } as T,
    source: 'merged'
  }
}

/**
 * Check if a document has been modified locally since last sync
 */
export function hasLocalChanges(
  doc: AnyDocument,
  lastSyncTimestamp: number
): boolean {
  return doc.modified > lastSyncTimestamp
}

/**
 * Check if a document should be synced
 * (not deleted and has been modified since last sync)
 */
export function shouldSync(
  doc: AnyDocument,
  lastSyncTimestamp: number
): boolean {
  return !doc.isDeleted && doc.modified > lastSyncTimestamp
}

/**
 * Merge arrays of documents, resolving conflicts
 * Used when pulling multiple documents from server
 */
export function mergeDocuments<T extends AnyDocument>(
  local: T[],
  remote: T[]
): T[] {
  const merged = new Map<string, T>()

  // Add all local documents
  for (const doc of local) {
    merged.set(doc.id, doc)
  }

  // Resolve conflicts with remote documents
  for (const remoteDoc of remote) {
    const localDoc = merged.get(remoteDoc.id)
    
    if (!localDoc) {
      // No local version, use remote
      merged.set(remoteDoc.id, remoteDoc)
    } else {
      // Conflict - resolve
      const { winner } = resolveConflict(localDoc, remoteDoc)
      merged.set(winner.id, winner)
    }
  }

  return Array.from(merged.values())
}

/**
 * Create a conflict report for debugging
 */
export interface ConflictReport {
  documentId: string
  localModified: number
  remoteModified: number
  winner: 'local' | 'remote' | 'merged'
  timeDifference: number
}

export function createConflictReport<T extends AnyDocument>(
  local: T,
  remote: T,
  resolution: ReturnType<typeof resolveConflict>
): ConflictReport {
  return {
    documentId: local.id,
    localModified: local.modified,
    remoteModified: remote.modified,
    winner: resolution.source,
    timeDifference: Math.abs(local.modified - remote.modified)
  }
}

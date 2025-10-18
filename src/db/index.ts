/**
 * IndexedDB + Supabase Database Layer
 * Local-first database with real-time bidirectional sync
 */
import { initIndexedDB, closeDB, deleteDB } from './indexeddb'
import { startAllSync, stopAllSync, setupNetworkListeners, getSyncStatus as getStatus, forceSyncAll as forceSync } from './sync'
import type { ChoreDB } from './indexeddb'

// Export database operations for external use
export * from './operations'
export * from './schemas'
export * from './conflict'
export type { ChoreDB } from './indexeddb'

let dbPromise: Promise<ChoreDB> | null = null
let syncInitialized = false

/**
 * Initialize the IndexedDB database
 * Sets up persistent local storage with IndexedDB
 */
export async function initDatabase(): Promise<ChoreDB> {
  // Return existing database if already initialized
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = (async () => {
    if (import.meta.env.DEV) {
      console.log('[DB] Initializing IndexedDB...')
    }

    // Initialize IndexedDB with all collections
    const db = await initIndexedDB()

    if (import.meta.env.DEV) {
      console.log('[DB] IndexedDB ready with persistent storage')
    }

    // Start syncing with Supabase if available
    if (!syncInitialized) {
      await startAllSync()
      setupNetworkListeners()
      syncInitialized = true
    }

    return db
  })()

  return dbPromise
}

/**
 * Get the database instance
 * Initializes if not already done
 */
export async function getDatabase(): Promise<ChoreDB> {
  if (!dbPromise) {
    return initDatabase()
  }
  return dbPromise
}

/**
 * Close the database and stop sync
 * Useful for cleanup
 */
export async function closeDatabase(): Promise<void> {
  if (syncInitialized) {
    await stopAllSync()
    syncInitialized = false
  }
  
  await closeDB()
  dbPromise = null
  
  if (import.meta.env.DEV) {
    console.log('[DB] Database closed')
  }
}

/**
 * Destroy the database completely
 * Useful for testing or full reset
 */
export async function destroyDatabase(): Promise<void> {
  await closeDatabase()
  await deleteDB()
  
  if (import.meta.env.DEV) {
    console.log('[DB] Database destroyed')
  }
}

/**
 * Get current sync status
 */
export function getSyncStatus() {
  return getStatus()
}

/**
 * Force sync all collections immediately
 */
export async function forceSyncAll() {
  return forceSync()
}

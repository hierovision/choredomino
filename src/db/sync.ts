/**
 * Supabase Real-time Sync Layer
 * Bidirectional sync between IndexedDB and Supabase with conflict resolution
 */
import { getSupabaseClient, isSupabaseAvailable } from './supabase'
import { getDB } from './indexeddb'
import { bulkUpsert, getModifiedSince, upsert, getById } from './operations'
import { resolveConflict, createConflictReport } from './conflict'
import type { CollectionName, AnyDocument } from './operations'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Sync state tracking
interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  lastSync: number
  channels: Map<string, RealtimeChannel>
  pendingWrites: Map<string, PendingWrite[]>
}

interface PendingWrite {
  collection: CollectionName
  document: AnyDocument
  operation: 'insert' | 'update' | 'delete'
  timestamp: number
}

const syncState: SyncState = {
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSync: 0,
  channels: new Map(),
  pendingWrites: new Map()
}

/**
 * Start syncing a collection with Supabase
 */
export async function startCollectionSync(collection: CollectionName): Promise<void> {
  if (!isSupabaseAvailable()) {
    if (import.meta.env.DEV) {
      console.warn(`[Sync] Supabase not available, skipping sync for ${collection}`)
    }
    return
  }

  const supabase = getSupabaseClient()
  if (!supabase) return

  if (import.meta.env.DEV) {
    console.log(`[Sync] Starting sync for ${collection}...`)
  }

  // 1. Initial pull from Supabase
  await pullCollection(collection)

  // 2. Set up real-time subscription
  const channel = supabase
    .channel(`${collection}-changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: collection
      },
      async (payload) => {
        if (import.meta.env.DEV) {
          console.log(`[Sync] Received ${payload.eventType} for ${collection}:`, (payload.new as any)?.id || (payload.old as any)?.id)
        }
        await handleRealtimeChange(collection, payload)
      }
    )
    .subscribe((status) => {
      if (import.meta.env.DEV && status !== 'SUBSCRIBED') {
        console.log(`[Sync] ${collection} subscription status:`, status)
      }
    })

  syncState.channels.set(collection, channel)
}

/**
 * Pull all data from Supabase for a collection
 */
async function pullCollection(collection: CollectionName): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) return

  try {
    // Get last sync timestamp
    const db = await getDB()
    const syncMeta = await db.get('_sync_meta', collection)
    const lastPull = syncMeta?.lastPullTimestamp || 0

    // Pull new/updated records since last sync
    // Note: Supabase uses _modified, we map to modified in IndexedDB
    const { data, error } = await supabase
      .from(collection)
      .select('*')
      .gt('_modified', lastPull)
      .order('_modified', { ascending: true })

    if (error) {
      // Table doesn't exist yet - this is expected for new deployments
      if (error.code === 'PGRST205' || error.code === '42703' || error.code === '42P01') {
        if (import.meta.env.DEV) {
          console.warn(`[Sync] Table ${collection} not found in Supabase (run Phase 1 schema)`)
        }
        return
      }
      console.error(`[Sync] Error pulling ${collection}:`, error)
      return
    }

    if (data && data.length > 0) {
      // Map _modified to modified, _deleted to isDeleted for IndexedDB
      const mappedData = data.map((row: any) => ({
        ...row,
        modified: row._modified,
        isDeleted: row._deleted,
        _modified: undefined,
        _deleted: undefined
      }))
      
      // Bulk upsert into IndexedDB
      await bulkUpsert(collection, mappedData as any[])
      
      if (import.meta.env.DEV) {
        console.log(`[Sync] Pulled ${data.length} records for ${collection}`)
      }

      // Update sync metadata
      const now = Date.now()
      await db.put('_sync_meta', {
        collection,
        lastPullTimestamp: now,
        lastPushTimestamp: syncMeta?.lastPushTimestamp || now
      })
    }
  } catch (err) {
    console.error(`[Sync] Pull error for ${collection}:`, err)
  }
}

/**
 * Push local changes to Supabase
 */
export async function pushLocalChanges(collection: CollectionName): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase || !syncState.isOnline) {
    return
  }

  try {
    // Get last push timestamp
    const db = await getDB()
    const syncMeta = await db.get('_sync_meta', collection)
    const lastPush = syncMeta?.lastPushTimestamp || 0

    // Get documents modified since last push
    const modifiedDocs = await getModifiedSince<AnyDocument>(collection, lastPush)

    if (modifiedDocs.length === 0) {
      return
    }

    // Filter out deleted documents
    const docsToUpsert = modifiedDocs.filter(doc => !doc.isDeleted)
    const docsToDelete = modifiedDocs.filter(doc => doc.isDeleted)

    // Map modified/isDeleted to _modified/_deleted for Supabase
    const mappedDocsToUpsert = docsToUpsert.map(doc => ({
      ...doc,
      _modified: doc.modified,
      _deleted: doc.isDeleted || false,
      modified: undefined,
      isDeleted: undefined
    }))

    // Upsert non-deleted documents
    if (mappedDocsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from(collection)
        .upsert(mappedDocsToUpsert)

      if (upsertError) {
        // Table doesn't exist - skip silently
        if (upsertError.code === 'PGRST205' || upsertError.code === '42703' || upsertError.code === '42P01') {
          return
        }
        console.error(`[Sync] Error upserting ${collection}:`, upsertError)
        return
      }
      
      if (import.meta.env.DEV) {
        console.log(`[Sync] Pushed ${mappedDocsToUpsert.length} upserts for ${collection}`)
      }
    }

    // Delete soft-deleted documents
    if (docsToDelete.length > 0) {
      const ids = docsToDelete.map(doc => doc.id)
      const { error: deleteError } = await supabase
        .from(collection)
        .delete()
        .in('id', ids)

      if (deleteError) {
        // Table doesn't exist - skip silently
        if (deleteError.code === 'PGRST205' || deleteError.code === '42703' || deleteError.code === '42P01') {
          return
        }
        console.error(`[Sync] Error deleting ${collection}:`, deleteError)
        return
      }
      
      if (import.meta.env.DEV) {
        console.log(`[Sync] Pushed ${docsToDelete.length} deletes for ${collection}`)
      }
    }

    // Update sync metadata
    const now = Date.now()
    await db.put('_sync_meta', {
      collection,
      lastPullTimestamp: syncMeta?.lastPullTimestamp || now,
      lastPushTimestamp: now
    })
  } catch (err) {
    console.error(`[Sync] Push error for ${collection}:`, err)
  }
}

/**
 * Handle real-time change from Supabase with conflict resolution
 */
async function handleRealtimeChange(
  collection: CollectionName,
  payload: any
): Promise<void> {
  try {
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      const remoteDoc = payload.new
      if (!remoteDoc) return

      // Map _modified/_deleted to modified/isDeleted
      const mappedRemoteDoc = {
        ...remoteDoc,
        modified: remoteDoc._modified,
        isDeleted: remoteDoc._deleted,
        _modified: undefined,
        _deleted: undefined
      }

      // Check if we have a local version
      const localDoc = await getById(collection, mappedRemoteDoc.id)

      if (!localDoc) {
        // No local version, just insert remote
        await upsert(collection, mappedRemoteDoc)
      } else {
        // Conflict - resolve using last-write-wins
        const resolution = resolveConflict(localDoc, mappedRemoteDoc)
        
        if (import.meta.env.DEV && resolution.source !== 'remote') {
          const report = createConflictReport(localDoc, mappedRemoteDoc, resolution)
          console.log(`[Sync] Conflict resolved for ${collection}:`, report)
        }

        await upsert(collection, resolution.winner)
      }
    } else if (payload.eventType === 'DELETE') {
      // Remote delete
      const doc = payload.old
      if (doc) {
        await upsert(collection, {
          ...doc,
          modified: doc._modified,
          isDeleted: true,
          _modified: undefined,
          _deleted: undefined
        })
      }
    }
  } catch (err) {
    console.error(`[Sync] Error handling realtime change for ${collection}:`, err)
  }
}

/**
 * Start syncing all collections
 */
export async function startAllSync(): Promise<void> {
  if (!isSupabaseAvailable()) {
    console.warn('[Sync] Supabase not available, running in local-only mode')
    return
  }

  const collections: CollectionName[] = [
    'households',
    'users',
    'chores',
    'completions',
    'rewards',
    'reward_redemptions',
    'point_adjustments',
    'notification_preferences'
  ]

  // Start syncing each collection in parallel
  await Promise.all(collections.map(col => startCollectionSync(col)))

  // Push any pending local changes
  await Promise.all(collections.map(col => pushLocalChanges(col)))

  if (import.meta.env.DEV) {
    console.log('[Sync] All collections synced and subscribed to realtime updates')
  }
  syncState.lastSync = Date.now()
}

/**
 * Stop all sync subscriptions
 */
export async function stopAllSync(): Promise<void> {
  const supabase = getSupabaseClient()
  if (!supabase) return

  if (import.meta.env.DEV) {
    console.log('[Sync] Stopping all sync subscriptions...')
  }

  for (const [collection, channel] of syncState.channels.entries()) {
    await supabase.removeChannel(channel)
    if (import.meta.env.DEV) {
      console.log(`[Sync] Stopped sync for ${collection}`)
    }
  }

  syncState.channels.clear()
}

/**
 * Force sync all collections now
 */
export async function forceSyncAll(): Promise<void> {
  if (!syncState.isOnline) {
    console.log('[Sync] Cannot force sync - offline')
    return
  }

  syncState.isSyncing = true
  
  try {
    await startAllSync()
  } finally {
    syncState.isSyncing = false
  }
}

/**
 * Setup online/offline event listeners
 */
export function setupNetworkListeners(): void {
  window.addEventListener('online', async () => {
    if (import.meta.env.DEV) {
      console.log('[Sync] Network online - syncing...')
    }
    syncState.isOnline = true
    await forceSyncAll()
  })

  window.addEventListener('offline', () => {
    if (import.meta.env.DEV) {
      console.log('[Sync] Network offline - local-only mode')
    }
    syncState.isOnline = false
  })
}

/**
 * Get current sync status
 */
export function getSyncStatus() {
  return {
    isOnline: syncState.isOnline,
    isSyncing: syncState.isSyncing,
    lastSync: syncState.lastSync,
    activeChannels: Array.from(syncState.channels.keys())
  }
}

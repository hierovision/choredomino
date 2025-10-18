/**
 * CRUD Operations for IndexedDB
 * Provides RxDB-like API for data operations
 */
import { getDB } from './indexeddb'
import type {
  HouseholdDocument,
  UserDocument,
  ChoreDocument,
  CompletionDocument,
  RewardDocument,
  RewardRedemptionDocument
} from './schemas'

// Type for all document types
export type AnyDocument =
  | HouseholdDocument
  | UserDocument
  | ChoreDocument
  | CompletionDocument
  | RewardDocument
  | RewardRedemptionDocument

// Type for collection names
export type CollectionName =
  | 'households'
  | 'users'
  | 'chores'
  | 'completions'
  | 'rewards'
  | 'reward_redemptions'

/**
 * Insert a document into a collection
 */
export async function insert<T extends AnyDocument>(
  collection: CollectionName,
  document: T
): Promise<T> {
  const db = await getDB()
  
  // Set timestamps
  const now = Date.now()
  const doc = {
    ...document,
    createdAt: document.createdAt || now,
    updatedAt: now,
    modified: now
  }

  await db.put(collection as any, doc as any)
  
  return doc
}

/**
 * Update a document (upsert)
 */
export async function upsert<T extends AnyDocument>(
  collection: CollectionName,
  document: T
): Promise<T> {
  const db = await getDB()
  
  const now = Date.now()
  const doc = {
    ...document,
    updatedAt: now,
    modified: now
  }

  await db.put(collection as any, doc as any)
  
  return doc
}

/**
 * Bulk upsert multiple documents
 */
export async function bulkUpsert<T extends AnyDocument>(
  collection: CollectionName,
  documents: T[]
): Promise<T[]> {
  const db = await getDB()
  const tx = db.transaction(collection, 'readwrite')
  const store = tx.objectStore(collection)

  const now = Date.now()
  const docs = documents.map(doc => ({
    ...doc,
    updatedAt: now,
    modified: now
  }))

  await Promise.all(docs.map(doc => store.put(doc as any)))
  await tx.done

  return docs
}

/**
 * Get a document by ID
 */
export async function getById<T extends AnyDocument>(
  collection: CollectionName,
  id: string
): Promise<T | undefined> {
  const db = await getDB()
  return db.get(collection as any, id) as Promise<T | undefined>
}

/**
 * Get all documents in a collection
 */
export async function getAll<T extends AnyDocument>(
  collection: CollectionName
): Promise<T[]> {
  const db = await getDB()
  return db.getAll(collection as any) as Promise<T[]>
}

/**
 * Find documents by index
 */
export async function findByIndex<T extends AnyDocument>(
  collection: CollectionName,
  indexName: string,
  query: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  const db = await getDB()
  // @ts-expect-error - Dynamic index access not well-typed in idb
  return db.getAllFromIndex(collection, indexName, query) as Promise<T[]>
}

/**
 * Delete a document (soft delete by default)
 */
export async function remove(
  collection: CollectionName,
  id: string,
  hard = false
): Promise<void> {
  const db = await getDB()
  
  if (hard) {
    await db.delete(collection as any, id)
  } else {
    // Soft delete - just mark as deleted
    const doc = await db.get(collection as any, id)
    if (doc) {
      const now = Date.now()
      await db.put(collection as any, {
        ...doc,
        isDeleted: true,
        updatedAt: now,
        modified: now
      } as any)
    }
  }
}

/**
 * Query with filter function
 */
export async function query<T extends AnyDocument>(
  collection: CollectionName,
  filter: (doc: T) => boolean
): Promise<T[]> {
  const all = await getAll<T>(collection)
  return all.filter(filter)
}

/**
 * Count documents in a collection
 */
export async function count(collection: CollectionName): Promise<number> {
  const db = await getDB()
  return db.count(collection as any)
}

/**
 * Get documents modified after a timestamp
 */
export async function getModifiedSince<T extends AnyDocument>(
  collection: CollectionName,
  timestamp: number
): Promise<T[]> {
  const db = await getDB()
  const range = IDBKeyRange.lowerBound(timestamp, true)
  // @ts-ignore - Dynamic index access not well-typed in idb
  return db.getAllFromIndex(collection, 'by-modified', range) as Promise<T[]>
}

/**
 * Clear all documents in a collection
 */
export async function clear(collection: CollectionName): Promise<void> {
  const db = await getDB()
  await db.clear(collection as any)
}

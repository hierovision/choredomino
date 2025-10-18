/**
 * RxDB Database Initialization
 * Sets up the local-first database with Supabase sync
 * NOTE: Using memory storage for now due to Dexie/Vite compatibility issues
 * For production, consider: https://rxdb.info/rx-storage-indexeddb.html (premium)
 * Validation disabled due to Ajv/Vite ESM compatibility issues
 */
import { createRxDatabase, addRxPlugin } from 'rxdb/plugins/core'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory'
import type { RxDatabase } from 'rxdb'

import {
  householdSchema,
  userSchema,
  choreSchema,
  completionSchema,
  rewardSchema,
  rewardRedemptionSchema
} from './schemas'

// Add dev-mode plugin in development
if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin)
}

// Type for our complete database
export type ChoreDb = RxDatabase<{
  households: any
  users: any
  chores: any
  completions: any
  rewards: any
  reward_redemptions: any
}>

let dbPromise: Promise<ChoreDb> | null = null

/**
 * Initialize the RxDB database
 * Creates collections and sets up schemas
 */
export async function initDatabase(): Promise<ChoreDb> {
  // Return existing database if already initialized
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = (async () => {
    console.log('[RxDB] Creating database...')

    // Create the database with Memory storage (non-persistent for now)
    // TODO: Switch to premium IndexedDB storage for production
    // NOTE: Schema validation disabled due to Ajv/Vite ESM issues
    const db = await createRxDatabase<ChoreDb>({
      name: 'choredomino',
      storage: getRxStorageMemory(),
      multiInstance: true, // Support multiple tabs
      eventReduce: true, // Optimize event handling
      ignoreDuplicate: true
    })

    console.log('[RxDB] Adding collections...')

    // Add all collections
    await db.addCollections({
      households: {
        schema: householdSchema
      },
      users: {
        schema: userSchema
      },
      chores: {
        schema: choreSchema
      },
      completions: {
        schema: completionSchema
      },
      rewards: {
        schema: rewardSchema
      },
      reward_redemptions: {
        schema: rewardRedemptionSchema
      }
    })

    console.log('[RxDB] Database ready!')

    return db
  })()

  return dbPromise
}

/**
 * Get the database instance
 * Initializes if not already done
 */
export async function getDatabase(): Promise<ChoreDb> {
  return initDatabase()
}

/**
 * Close the database connection
 * Call this when the app is closing
 */
export async function closeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    await db.destroy()
    dbPromise = null
    console.log('[RxDB] Database closed')
  }
}

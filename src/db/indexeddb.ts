/**
 * IndexedDB Database Layer
 * Persistent local storage using native IndexedDB via idb wrapper
 */
import { openDB, type IDBPDatabase, type DBSchema } from 'idb'

// Import type definitions from schemas
import type {
  HouseholdDocument,
  UserDocument,
  ChoreDocument,
  CompletionDocument,
  RewardDocument,
  RewardRedemptionDocument,
  PointAdjustmentDocument,
  NotificationPreferenceDocument
} from './schemas'

/**
 * Database schema for IndexedDB
 */
interface ChoreDBSchema extends DBSchema {
  households: {
    key: string
    value: HouseholdDocument
    indexes: {
      'by-updatedAt': number
      'by-createdBy': string
      'by-modified': number
    }
  }
  users: {
    key: string
    value: UserDocument
    indexes: {
      'by-householdId': string
      'by-updatedAt': number
      'by-modified': number
      'by-householdId-role': [string, string]
    }
  }
  chores: {
    key: string
    value: ChoreDocument
    indexes: {
      'by-householdId': string
      'by-updatedAt': number
      'by-assignedTo': string
      'by-isActive': number // 1 for true, 0 for false
      'by-modified': number
      'by-householdId-isActive': [string, number]
      'by-householdId-assignedTo': [string, string]
    }
  }
  completions: {
    key: string
    value: CompletionDocument
    indexes: {
      'by-householdId': string
      'by-choreId': string
      'by-completedBy': string
      'by-status': string
      'by-updatedAt': number
      'by-modified': number
      'by-householdId-status': [string, string]
      'by-choreId-completedAt': [string, number]
    }
  }
  rewards: {
    key: string
    value: RewardDocument
    indexes: {
      'by-householdId': string
      'by-updatedAt': number
      'by-isActive': number
      'by-modified': number
      'by-householdId-isActive': [string, number]
    }
  }
  reward_redemptions: {
    key: string
    value: RewardRedemptionDocument
    indexes: {
      'by-householdId': string
      'by-redeemedBy': string
      'by-status': string
      'by-updatedAt': number
      'by-modified': number
      'by-householdId-status': [string, string]
    }
  }
  point_adjustments: {
    key: string
    value: PointAdjustmentDocument
    indexes: {
      'by-householdId': string
      'by-userId': string
      'by-adjustedBy': string
      'by-createdAt': number
      'by-modified': number
    }
  }
  notification_preferences: {
    key: string
    value: NotificationPreferenceDocument
    indexes: {
      'by-userId': string
      'by-householdId': string
      'by-modified': number
    }
  }
  // Sync metadata store for tracking last sync timestamps
  _sync_meta: {
    key: string // collection name
    value: {
      collection: string
      lastPullTimestamp: number
      lastPushTimestamp: number
    }
  }
}

const DB_NAME = 'choredomino'
const DB_VERSION = 2 // Bumped for new schema changes

let dbInstance: IDBPDatabase<ChoreDBSchema> | null = null

/**
 * Initialize IndexedDB with schemas
 */
export async function initIndexedDB(): Promise<IDBPDatabase<ChoreDBSchema>> {
  if (dbInstance) {
    return dbInstance
  }

  dbInstance = await openDB<ChoreDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      if (import.meta.env.DEV) {
        console.log(`[IndexedDB] Upgrading from version ${oldVersion} to ${newVersion}`)
      }

      // Version 1: Initial schema
      if (oldVersion < 1) {
        // Create households store
        if (!db.objectStoreNames.contains('households')) {
          const householdsStore = db.createObjectStore('households', { keyPath: 'id' })
          householdsStore.createIndex('by-updatedAt', 'updatedAt')
          householdsStore.createIndex('by-createdBy', 'createdBy')
          householdsStore.createIndex('by-modified', 'modified')
        }

        // Create users store
        if (!db.objectStoreNames.contains('users')) {
          const usersStore = db.createObjectStore('users', { keyPath: 'id' })
          usersStore.createIndex('by-householdId', 'householdId')
          usersStore.createIndex('by-updatedAt', 'updatedAt')
          usersStore.createIndex('by-modified', 'modified')
          usersStore.createIndex('by-householdId-role', ['householdId', 'role'])
        }

        // Create chores store
        if (!db.objectStoreNames.contains('chores')) {
          const choresStore = db.createObjectStore('chores', { keyPath: 'id' })
          choresStore.createIndex('by-householdId', 'householdId')
          choresStore.createIndex('by-updatedAt', 'updatedAt')
          choresStore.createIndex('by-assignedTo', 'assignedTo')
          choresStore.createIndex('by-isActive', 'isActive')
          choresStore.createIndex('by-modified', 'modified')
          choresStore.createIndex('by-householdId-isActive', ['householdId', 'isActive'])
          choresStore.createIndex('by-householdId-assignedTo', ['householdId', 'assignedTo'])
        }

      // Create completions store
      if (!db.objectStoreNames.contains('completions')) {
        const completionsStore = db.createObjectStore('completions', { keyPath: 'id' })
        completionsStore.createIndex('by-householdId', 'householdId')
        completionsStore.createIndex('by-choreId', 'choreId')
        completionsStore.createIndex('by-completedBy', 'completedBy')
        completionsStore.createIndex('by-status', 'status')
        completionsStore.createIndex('by-updatedAt', 'updatedAt')
        completionsStore.createIndex('by-modified', 'modified')
        completionsStore.createIndex('by-householdId-status', ['householdId', 'status'])
        completionsStore.createIndex('by-choreId-completedAt', ['choreId', 'completedAt'])
      }

      // Create rewards store
      if (!db.objectStoreNames.contains('rewards')) {
        const rewardsStore = db.createObjectStore('rewards', { keyPath: 'id' })
        rewardsStore.createIndex('by-householdId', 'householdId')
        rewardsStore.createIndex('by-updatedAt', 'updatedAt')
        rewardsStore.createIndex('by-isActive', 'isActive')
        rewardsStore.createIndex('by-modified', 'modified')
        rewardsStore.createIndex('by-householdId-isActive', ['householdId', 'isActive'])
      }

      // Create reward_redemptions store
      if (!db.objectStoreNames.contains('reward_redemptions')) {
        const redemptionsStore = db.createObjectStore('reward_redemptions', { keyPath: 'id' })
        redemptionsStore.createIndex('by-householdId', 'householdId')
        redemptionsStore.createIndex('by-redeemedBy', 'redeemedBy')
        redemptionsStore.createIndex('by-status', 'status')
        redemptionsStore.createIndex('by-updatedAt', 'updatedAt')
        redemptionsStore.createIndex('by-modified', 'modified')
        redemptionsStore.createIndex('by-householdId-status', ['householdId', 'status'])
      }

      // Create sync metadata store
      if (!db.objectStoreNames.contains('_sync_meta')) {
        db.createObjectStore('_sync_meta', { keyPath: 'collection' })
      }
      }

      // Version 2: Add new stores for requirements
      if (oldVersion < 2) {
        if (import.meta.env.DEV) {
          console.log('[IndexedDB] Applying v2 migration: Adding point_adjustments and notification_preferences')
        }

        // Create point_adjustments store
        if (!db.objectStoreNames.contains('point_adjustments')) {
          const adjustmentsStore = db.createObjectStore('point_adjustments', { keyPath: 'id' })
          adjustmentsStore.createIndex('by-householdId', 'householdId')
          adjustmentsStore.createIndex('by-userId', 'userId')
          adjustmentsStore.createIndex('by-adjustedBy', 'adjustedBy')
          adjustmentsStore.createIndex('by-createdAt', 'createdAt')
          adjustmentsStore.createIndex('by-modified', 'modified')
        }

        // Create notification_preferences store
        if (!db.objectStoreNames.contains('notification_preferences')) {
          const prefsStore = db.createObjectStore('notification_preferences', { keyPath: 'id' })
          prefsStore.createIndex('by-userId', 'userId')
          prefsStore.createIndex('by-householdId', 'householdId')
          prefsStore.createIndex('by-modified', 'modified')
        }
      }
    }
  })

  return dbInstance
}

/**
 * Get the database instance
 */
export async function getDB(): Promise<IDBPDatabase<ChoreDBSchema>> {
  if (!dbInstance) {
    return initIndexedDB()
  }
  return dbInstance
}

/**
 * Close the database connection
 */
export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

/**
 * Delete the entire database (for testing/reset)
 */
export async function deleteDB(): Promise<void> {
  await closeDB()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// Type aliases for easier imports
export type ChoreDB = IDBPDatabase<ChoreDBSchema>
export type { ChoreDBSchema }

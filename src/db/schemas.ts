/**
 * TypeScript Document Interfaces
 * These define the shape of documents in IndexedDB and Supabase
 */

/**
 * Household Document
 * Represents a living space with multiple members
 */
export interface HouseholdDocument {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  createdBy: string
  settings: {
    timezone: string
    currency: string
    pointsPerChore: number
  }
  modified: number
  isDeleted?: boolean
}

// Legacy RxDB schema - kept for reference but not used
export const householdSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    name: {
      type: 'string',
      maxLength: 200
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    updatedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    createdBy: {
      type: 'string',
      maxLength: 100
    },
    settings: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string'
        },
        currency: {
          type: 'string',
          maxLength: 10
        },
        pointsPerChore: {
          type: 'number'
        }
      },
      required: ['timezone', 'currency', 'pointsPerChore']
    },
    modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    isDeleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'name', 'createdAt', 'updatedAt', 'createdBy', 'settings', 'modified'],
  indexes: ['updatedAt', 'createdBy', 'modified']
}

/**
 * User Schema
 * Represents a member of a household
 */
export interface UserDocument {
  id: string
  householdId: string
  name: string
  email?: string
  avatarUrl?: string
  role: 'admin' | 'member' | 'child'
  points: number
  createdAt: number
  updatedAt: number
  modified: number
  isDeleted?: boolean
}

export const userSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    householdId: {
      type: 'string',
      maxLength: 100,
      ref: 'households'
    },
    name: {
      type: 'string',
      maxLength: 200
    },
    email: {
      type: 'string',
      maxLength: 200
    },
    avatarUrl: {
      type: 'string',
      maxLength: 500
    },
    role: {
      type: 'string',
      enum: ['admin', 'member', 'child'],
      maxLength: 10
    },
    points: {
      type: 'number',
      minimum: 0,
      default: 0
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    updatedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    isDeleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'householdId', 'name', 'role', 'points', 'createdAt', 'updatedAt', 'modified'],
  indexes: ['householdId', 'updatedAt', 'modified', ['householdId', 'role']]
}

/**
 * Chore Schema
 * Represents a task that needs to be completed
 */
export interface ChoreDocument {
  id: string
  householdId: string
  name: string
  description?: string
  points: number
  frequency: 'once' | 'daily' | 'weekly' | 'monthly'
  assignedTo?: string
  category?: string
  dueDate?: number
  isActive: boolean
  createdAt: number
  updatedAt: number
  createdBy: string
  modified: number
  isDeleted?: boolean
}

export const choreSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    householdId: {
      type: 'string',
      maxLength: 100,
      ref: 'households'
    },
    name: {
      type: 'string',
      maxLength: 300
    },
    description: {
      type: 'string',
      maxLength: 1000
    },
    points: {
      type: 'number',
      minimum: 0,
      default: 1
    },
    frequency: {
      type: 'string',
      enum: ['once', 'daily', 'weekly', 'monthly']
    },
    assignedTo: {
      type: 'string',
      maxLength: 100,
      ref: 'users'
    },
    category: {
      type: 'string',
      maxLength: 100
    },
    dueDate: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    isActive: {
      type: 'boolean',
      default: true
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    updatedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    createdBy: {
      type: 'string',
      maxLength: 100,
      ref: 'users'
    },
    modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    isDeleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'householdId', 'name', 'points', 'frequency', 'isActive', 'createdAt', 'updatedAt', 'createdBy', 'modified'],
  indexes: ['householdId', 'updatedAt', 'assignedTo', 'isActive', 'modified', ['householdId', 'isActive'], ['householdId', 'assignedTo']]
}

/**
 * Completion Schema
 * Represents a completed (or pending) chore
 */
export interface CompletionDocument {
  id: string
  choreId: string
  householdId: string
  completedBy: string
  completedAt: number
  status: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
  approvedAt?: number
  rejectionReason?: string
  notes?: string
  photoUrl?: string
  pointsAwarded: number
  createdAt: number
  updatedAt: number
  modified: number
  isDeleted?: boolean
}

export const completionSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    choreId: {
      type: 'string',
      maxLength: 100,
      ref: 'chores'
    },
    householdId: {
      type: 'string',
      maxLength: 100,
      ref: 'households'
    },
    completedBy: {
      type: 'string',
      maxLength: 100,
      ref: 'users'
    },
    completedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    status: {
      type: 'string',
      enum: ['pending', 'approved', 'rejected'],
      maxLength: 20
    },
    approvedBy: {
      type: 'string',
      maxLength: 100,
      ref: 'users'
    },
    approvedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    rejectionReason: {
      type: 'string',
      maxLength: 500
    },
    notes: {
      type: 'string',
      maxLength: 1000
    },
    photoUrl: {
      type: 'string',
      maxLength: 500
    },
    pointsAwarded: {
      type: 'number',
      minimum: 0
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    updatedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    isDeleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'choreId', 'householdId', 'completedBy', 'completedAt', 'status', 'pointsAwarded', 'createdAt', 'updatedAt', 'modified'],
  indexes: ['householdId', 'choreId', 'completedBy', 'status', 'updatedAt', 'modified', ['householdId', 'status'], ['choreId', 'completedAt']]
}

/**
 * Reward Schema
 * Represents rewards that can be earned with points
 */
export interface RewardDocument {
  id: string
  householdId: string
  name: string
  description?: string
  pointsCost: number
  isActive: boolean
  isShared: boolean // true for family rewards, false for individual
  category?: string
  imageUrl?: string
  createdAt: number
  updatedAt: number
  createdBy: string
  modified: number
  isDeleted?: boolean
}

export const rewardSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    householdId: {
      type: 'string',
      maxLength: 100,
      ref: 'households'
    },
    name: {
      type: 'string',
      maxLength: 300
    },
    description: {
      type: 'string',
      maxLength: 1000
    },
    pointsCost: {
      type: 'number',
      minimum: 0
    },
    isActive: {
      type: 'boolean',
      default: true
    },
    isShared: {
      type: 'boolean',
      default: false
    },
    category: {
      type: 'string',
      maxLength: 100
    },
    imageUrl: {
      type: 'string',
      maxLength: 500
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    updatedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    createdBy: {
      type: 'string',
      maxLength: 100,
      ref: 'users'
    },
    modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    isDeleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'householdId', 'name', 'pointsCost', 'isActive', 'isShared', 'createdAt', 'updatedAt', 'createdBy', 'modified'],
  indexes: ['householdId', 'updatedAt', 'isActive', 'modified', ['householdId', 'isActive']]
}

/**
 * Reward Redemption Schema
 * Tracks when rewards are claimed
 */
export interface RewardRedemptionDocument {
  id: string
  rewardId: string
  householdId: string
  redeemedBy: string
  redeemedAt: number
  status: 'pending' | 'fulfilled' | 'cancelled'
  fulfilledBy?: string
  fulfilledAt?: number
  pointsSpent: number
  notes?: string
  createdAt: number
  updatedAt: number
  modified: number
  isDeleted?: boolean
}

export const rewardRedemptionSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100
    },
    rewardId: {
      type: 'string',
      maxLength: 100,
      ref: 'rewards'
    },
    householdId: {
      type: 'string',
      maxLength: 100,
      ref: 'households'
    },
    redeemedBy: {
      type: 'string',
      maxLength: 100,
      ref: 'users'
    },
    redeemedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    status: {
      type: 'string',
      enum: ['pending', 'fulfilled', 'cancelled'],
      maxLength: 20
    },
    fulfilledBy: {
      type: 'string',
      maxLength: 100,
      ref: 'users'
    },
    fulfilledAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    pointsSpent: {
      type: 'number',
      minimum: 0
    },
    notes: {
      type: 'string',
      maxLength: 1000
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    updatedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    isDeleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'rewardId', 'householdId', 'redeemedBy', 'redeemedAt', 'status', 'pointsSpent', 'createdAt', 'updatedAt', 'modified'],
  indexes: ['householdId', 'redeemedBy', 'status', 'updatedAt', 'modified', ['householdId', 'status']]
}

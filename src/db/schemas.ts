import { RxJsonSchema } from 'rxdb'

/**
 * Household Schema
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
  _modified: number // Required for Supabase replication
  _deleted?: boolean // Soft delete flag for Supabase sync
}

export const householdSchema: RxJsonSchema<HouseholdDocument> = {
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
    _modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    _deleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'name', 'createdAt', 'updatedAt', 'createdBy', 'settings', '_modified'],
  indexes: ['updatedAt', 'createdBy', '_modified']
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
  _modified: number
  _deleted?: boolean
}

export const userSchema: RxJsonSchema<UserDocument> = {
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
      enum: ['admin', 'member', 'child']
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
    _modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    _deleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'householdId', 'name', 'role', 'points', 'createdAt', 'updatedAt', '_modified'],
  indexes: ['householdId', 'updatedAt', '_modified', ['householdId', 'role']]
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
  _modified: number
  _deleted?: boolean
}

export const choreSchema: RxJsonSchema<ChoreDocument> = {
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
    _modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    _deleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'householdId', 'name', 'points', 'frequency', 'isActive', 'createdAt', 'updatedAt', 'createdBy', '_modified'],
  indexes: ['householdId', 'updatedAt', 'assignedTo', 'isActive', '_modified', ['householdId', 'isActive'], ['householdId', 'assignedTo']]
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
  _modified: number
  _deleted?: boolean
}

export const completionSchema: RxJsonSchema<CompletionDocument> = {
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
      enum: ['pending', 'approved', 'rejected']
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
    _modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    _deleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'choreId', 'householdId', 'completedBy', 'completedAt', 'status', 'pointsAwarded', 'createdAt', 'updatedAt', '_modified'],
  indexes: ['householdId', 'choreId', 'completedBy', 'status', 'updatedAt', '_modified', ['householdId', 'status'], ['choreId', 'completedAt']]
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
  _modified: number
  _deleted?: boolean
}

export const rewardSchema: RxJsonSchema<RewardDocument> = {
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
    _modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    _deleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'householdId', 'name', 'pointsCost', 'isActive', 'isShared', 'createdAt', 'updatedAt', 'createdBy', '_modified'],
  indexes: ['householdId', 'updatedAt', 'isActive', '_modified', ['householdId', 'isActive']]
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
  _modified: number
  _deleted?: boolean
}

export const rewardRedemptionSchema: RxJsonSchema<RewardRedemptionDocument> = {
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
      enum: ['pending', 'fulfilled', 'cancelled']
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
    _modified: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1
    },
    _deleted: {
      type: 'boolean'
    }
  },
  required: ['id', 'rewardId', 'householdId', 'redeemedBy', 'redeemedAt', 'status', 'pointsSpent', 'createdAt', 'updatedAt', '_modified'],
  indexes: ['householdId', 'redeemedBy', 'status', 'updatedAt', '_modified', ['householdId', 'status']]
}

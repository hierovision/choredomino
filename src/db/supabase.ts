/**
 * Supabase Client Configuration
 * Handles connection to Supabase backend for sync
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Environment variables not set. Sync will be disabled.')
}

let supabaseInstance: SupabaseClient | null = null

/**
 * Get or create Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
    console.log('[Supabase] Client initialized')
  }

  return supabaseInstance
}

/**
 * Check if Supabase is configured and available
 */
export function isSupabaseAvailable(): boolean {
  return !!(supabaseUrl && supabaseAnonKey)
}

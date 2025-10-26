import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '../db/supabase'

export const useAuthStore = defineStore('auth', () => {
  const supabase = getSupabaseClient()
  
  // State
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  // Computed
  const isAuthenticated = computed(() => !!user.value)
  const userEmail = computed(() => user.value?.email ?? null)

  // Initialize auth state
  async function initialize() {
    if (!supabase) {
      loading.value = false
      return
    }

    try {
      // Get current session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      session.value = currentSession
      user.value = currentSession?.user ?? null

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, newSession) => {
        session.value = newSession
        user.value = newSession?.user ?? null
      })
    } catch (err) {
      console.error('Failed to initialize auth:', err)
      error.value = 'Failed to initialize authentication'
    } finally {
      loading.value = false
    }
  }

  // Sign up with email and password
  async function signUp(email: string, password: string, fullName?: string) {
    if (!supabase) {
      error.value = 'Supabase is not configured'
      return { error: new Error('Supabase is not configured') }
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (signUpError) {
        error.value = signUpError.message
        return { error: signUpError }
      }

      return { data, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed'
      error.value = message
      return { error: new Error(message) }
    } finally {
      loading.value = false
    }
  }

  // Sign in with email and password
  async function signIn(email: string, password: string) {
    if (!supabase) {
      error.value = 'Supabase is not configured'
      return { error: new Error('Supabase is not configured') }
    }

    loading.value = true
    error.value = null

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) {
        error.value = signInError.message
        return { error: signInError }
      }

      return { data, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      error.value = message
      return { error: new Error(message) }
    } finally {
      loading.value = false
    }
  }

  // Sign out
  async function signOut() {
    if (!supabase) {
      return
    }

    loading.value = true
    error.value = null

    try {
      const { error: signOutError } = await supabase.auth.signOut()
      
      if (signOutError) {
        error.value = signOutError.message
        return { error: signOutError }
      }

      user.value = null
      session.value = null
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed'
      error.value = message
      return { error: new Error(message) }
    } finally {
      loading.value = false
    }
  }

  // Reset password request
  async function resetPassword(email: string) {
    if (!supabase) {
      error.value = 'Supabase is not configured'
      return { error: new Error('Supabase is not configured') }
    }

    loading.value = true
    error.value = null

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      if (resetError) {
        error.value = resetError.message
        return { error: resetError }
      }

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Password reset failed'
      error.value = message
      return { error: new Error(message) }
    } finally {
      loading.value = false
    }
  }

  // Clear error
  function clearError() {
    error.value = null
  }

  return {
    // State
    user,
    session,
    loading,
    error,
    // Computed
    isAuthenticated,
    userEmail,
    // Actions
    initialize,
    signUp,
    signIn,
    signOut,
    resetPassword,
    clearError
  }
})

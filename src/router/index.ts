import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/auth',
    name: 'auth',
    component: () => import('../views/AuthView.vue'),
    meta: { title: 'Login', requiresAuth: false }
  },
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: 'Home', requiresAuth: true }
  },
  {
    path: '/household',
    name: 'household',
    component: () => import('../views/HouseholdView.vue'),
    meta: { title: 'Household', requiresAuth: true, requiresHousehold: true }
  },
  {
    path: '/chores',
    name: 'chores',
    component: () => import('../views/ChoresView.vue'),
    meta: { title: 'Chores', requiresAuth: true, requiresHousehold: true }
  },
  {
    path: '/rewards',
    name: 'rewards',
    component: () => import('../views/RewardsView.vue'),
    meta: { title: 'Rewards', requiresAuth: true, requiresHousehold: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { title: 'Profile', requiresAuth: true, requiresHousehold: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Navigation guard for authentication
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()
  
  // Wait for auth initialization if still loading
  if (authStore.loading) {
    await authStore.initialize()
  }

  const requiresAuth = to.meta.requiresAuth !== false // Default to true
  const isAuthRoute = to.name === 'auth'

  // Redirect to auth if not authenticated and route requires auth
  if (requiresAuth && !authStore.isAuthenticated) {
    if (!isAuthRoute) {
      next({ name: 'auth' })
    } else {
      next()
    }
    return
  }

  // Redirect to home if authenticated and trying to access auth page
  if (isAuthRoute && authStore.isAuthenticated) {
    next({ name: 'home' })
    return
  }

  // TODO: Check if household is set in store for requiresHousehold routes
  // For now, allow authenticated routes
  next()
})

export default router


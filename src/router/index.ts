import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: 'Home' }
  },
  {
    path: '/household',
    name: 'household',
    component: () => import('../views/HouseholdView.vue'),
    meta: { title: 'Household', requiresHousehold: true }
  },
  {
    path: '/chores',
    name: 'chores',
    component: () => import('../views/ChoresView.vue'),
    meta: { title: 'Chores', requiresHousehold: true }
  },
  {
    path: '/rewards',
    name: 'rewards',
    component: () => import('../views/RewardsView.vue'),
    meta: { title: 'Rewards', requiresHousehold: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { title: 'Profile', requiresHousehold: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Navigation guard for household requirement
router.beforeEach((_to, _from, next) => {
  // TODO: Check if household is set in store
  // For now, allow all routes
  next()
})

export default router

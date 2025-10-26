<template>
  <v-app>
    <v-app-bar v-if="authStore.isAuthenticated" app color="primary" dark>
      <v-app-bar-title>
        <v-icon class="mr-2">mdi-home-heart</v-icon>
        Chore Domino
      </v-app-bar-title>
      
      <v-spacer></v-spacer>

      <v-chip v-if="authStore.userEmail" class="mr-2" variant="outlined">
        {{ authStore.userEmail }}
      </v-chip>
      
      <v-btn icon @click="toggleTheme">
        <v-icon>mdi-theme-light-dark</v-icon>
      </v-btn>

      <v-btn icon @click="handleLogout">
        <v-icon>mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>

    <v-navigation-drawer v-if="authStore.isAuthenticated" app v-model="drawer">
      <v-list>
        <v-list-item
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
        ></v-list-item>

        <v-divider class="my-2"></v-divider>

        <v-list-item
          prepend-icon="mdi-logout"
          title="Logout"
          @click="handleLogout"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
    
    <v-bottom-navigation v-if="authStore.isAuthenticated" app v-model="currentRoute" grow>
      <v-btn
        v-for="item in navigation"
        :key="item.to"
        :value="item.to"
        @click="$router.push(item.to)"
      >
        <v-icon>{{ item.icon }}</v-icon>
        <span>{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import { useAuthStore } from './stores/auth'

const theme = useTheme()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const drawer = ref(false)

const navigation = [
  { title: 'Home', icon: 'mdi-home', to: '/' },
  { title: 'Chores', icon: 'mdi-broom', to: '/chores' },
  { title: 'Rewards', icon: 'mdi-gift', to: '/rewards' },
  { title: 'Profile', icon: 'mdi-account', to: '/profile' }
]

const currentRoute = computed(() => route.path)

const toggleTheme = () => {
  theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
}

async function handleLogout() {
  await authStore.signOut()
  router.push('/auth')
}

// Initialize auth on app mount
onMounted(() => {
  authStore.initialize()
})
</script>


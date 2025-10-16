<template>
  <v-app>
    <v-app-bar app color="primary" dark>
      <v-app-bar-title>
        <v-icon class="mr-2">mdi-home-heart</v-icon>
        Chore Domino
      </v-app-bar-title>
      
      <v-spacer></v-spacer>
      
      <v-btn icon @click="toggleTheme">
        <v-icon>mdi-theme-light-dark</v-icon>
      </v-btn>
    </v-app-bar>

    <v-navigation-drawer app v-model="drawer">
      <v-list>
        <v-list-item
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <router-view />
    </v-main>
    
    <v-bottom-navigation app v-model="currentRoute" grow>
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
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useTheme } from 'vuetify'

const theme = useTheme()
const route = useRoute()
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
</script>

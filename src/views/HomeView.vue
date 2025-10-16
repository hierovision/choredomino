<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h3 mb-4">Welcome to Chore Domino</h1>
        <p class="text-h6">
          A free, lightweight PWA for household chore management through gamification.
        </p>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon class="mr-2">mdi-database</v-icon>
            Database Status
          </v-card-title>
          <v-card-text>
            <p>Local Database: <strong>{{ dbStatus }}</strong></p>
            <p>Sync: <strong>{{ syncStatus }}</strong></p>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>
            <v-icon class="mr-2">mdi-home-group</v-icon>
            Quick Start
          </v-card-title>
          <v-card-text>
            <v-btn block color="primary" class="mb-2" @click="createHousehold">
              Create New Household
            </v-btn>
            <v-btn block variant="outlined" @click="joinHousehold">
              Join Existing Household
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { initDatabase } from '../db'
import { isSupabaseAvailable } from '../db/supabase'

const dbStatus = ref('Initializing...')
const syncStatus = ref('Checking...')

onMounted(async () => {
  try {
    await initDatabase()
    dbStatus.value = 'Connected'
    syncStatus.value = isSupabaseAvailable() ? 'Available' : 'Local Only'
  } catch (error) {
    dbStatus.value = 'Error'
    console.error(error)
  }
})

const createHousehold = () => {
  // TODO: Navigate to household creation
  console.log('Create household')
}

const joinHousehold = () => {
  // TODO: Navigate to join household
  console.log('Join household')
}
</script>

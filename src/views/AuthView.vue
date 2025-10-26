<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card elevation="12">
          <v-card-title class="text-h5 text-center pa-6">
            <v-icon size="48" color="primary" class="mb-2">mdi-broom</v-icon>
            <div>Chore Domino</div>
          </v-card-title>

          <v-tabs v-model="tab" grow>
            <v-tab value="login">Login</v-tab>
            <v-tab value="signup">Sign Up</v-tab>
          </v-tabs>

          <v-window v-model="tab">
            <!-- Login Tab -->
            <v-window-item value="login">
              <v-card-text>
                <v-form ref="loginForm" @submit.prevent="handleLogin">
                  <v-text-field
                    v-model="loginEmail"
                    label="Email"
                    type="email"
                    prepend-icon="mdi-email"
                    :rules="emailRules"
                    :disabled="authStore.loading"
                    required
                  />

                  <v-text-field
                    v-model="loginPassword"
                    label="Password"
                    :type="showLoginPassword ? 'text' : 'password'"
                    prepend-icon="mdi-lock"
                    :append-icon="showLoginPassword ? 'mdi-eye' : 'mdi-eye-off'"
                    :rules="passwordRules"
                    :disabled="authStore.loading"
                    @click:append="showLoginPassword = !showLoginPassword"
                    required
                  />

                  <v-btn
                    type="submit"
                    color="primary"
                    block
                    size="large"
                    class="mt-4"
                    :loading="authStore.loading"
                  >
                    Login
                  </v-btn>

                  <div class="text-center mt-4">
                    <v-btn
                      variant="text"
                      size="small"
                      @click="showResetDialog = true"
                    >
                      Forgot Password?
                    </v-btn>
                  </div>
                </v-form>
              </v-card-text>
            </v-window-item>

            <!-- Sign Up Tab -->
            <v-window-item value="signup">
              <v-card-text>
                <v-form ref="signupForm" @submit.prevent="handleSignup">
                  <v-text-field
                    v-model="signupName"
                    label="Full Name"
                    prepend-icon="mdi-account"
                    :disabled="authStore.loading"
                  />

                  <v-text-field
                    v-model="signupEmail"
                    label="Email"
                    type="email"
                    prepend-icon="mdi-email"
                    :rules="emailRules"
                    :disabled="authStore.loading"
                    required
                  />

                  <v-text-field
                    v-model="signupPassword"
                    label="Password"
                    :type="showSignupPassword ? 'text' : 'password'"
                    prepend-icon="mdi-lock"
                    :append-icon="showSignupPassword ? 'mdi-eye' : 'mdi-eye-off'"
                    :rules="passwordRules"
                    :disabled="authStore.loading"
                    @click:append="showSignupPassword = !showSignupPassword"
                    required
                  />

                  <v-text-field
                    v-model="signupPasswordConfirm"
                    label="Confirm Password"
                    :type="showSignupPasswordConfirm ? 'text' : 'password'"
                    prepend-icon="mdi-lock-check"
                    :append-icon="showSignupPasswordConfirm ? 'mdi-eye' : 'mdi-eye-off'"
                    :rules="[...passwordRules, passwordMatchRule]"
                    :disabled="authStore.loading"
                    @click:append="showSignupPasswordConfirm = !showSignupPasswordConfirm"
                    required
                  />

                  <v-btn
                    type="submit"
                    color="primary"
                    block
                    size="large"
                    class="mt-4"
                    :loading="authStore.loading"
                  >
                    Sign Up
                  </v-btn>
                </v-form>
              </v-card-text>
            </v-window-item>
          </v-window>

          <v-alert
            v-if="authStore.error"
            type="error"
            variant="tonal"
            class="ma-4"
            closable
            @click:close="authStore.clearError()"
          >
            {{ authStore.error }}
          </v-alert>

          <v-alert
            v-if="successMessage"
            type="success"
            variant="tonal"
            class="ma-4"
            closable
            @click:close="successMessage = ''"
          >
            {{ successMessage }}
          </v-alert>
        </v-card>
      </v-col>
    </v-row>

    <!-- Password Reset Dialog -->
    <v-dialog v-model="showResetDialog" max-width="500">
      <v-card>
        <v-card-title>Reset Password</v-card-title>
        <v-card-text>
          <v-form ref="resetForm" @submit.prevent="handleResetPassword">
            <v-text-field
              v-model="resetEmail"
              label="Email"
              type="email"
              prepend-icon="mdi-email"
              :rules="emailRules"
              :disabled="authStore.loading"
              required
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showResetDialog = false"
            :disabled="authStore.loading"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="handleResetPassword"
            :loading="authStore.loading"
          >
            Send Reset Link
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// Tab state
const tab = ref('login')

// Login form
const loginForm = ref()
const loginEmail = ref('')
const loginPassword = ref('')
const showLoginPassword = ref(false)

// Signup form
const signupForm = ref()
const signupName = ref('')
const signupEmail = ref('')
const signupPassword = ref('')
const signupPasswordConfirm = ref('')
const showSignupPassword = ref(false)
const showSignupPasswordConfirm = ref(false)

// Reset password
const showResetDialog = ref(false)
const resetForm = ref()
const resetEmail = ref('')

// Success message
const successMessage = ref('')

// Validation rules
const emailRules = [
  (v: string) => !!v || 'Email is required',
  (v: string) => /.+@.+\..+/.test(v) || 'Email must be valid'
]

const passwordRules = [
  (v: string) => !!v || 'Password is required',
  (v: string) => v.length >= 6 || 'Password must be at least 6 characters'
]

const passwordMatchRule = (v: string) => 
  v === signupPassword.value || 'Passwords must match'

// Handle login
async function handleLogin() {
  const { valid } = await loginForm.value.validate()
  if (!valid) return

  const { error } = await authStore.signIn(loginEmail.value, loginPassword.value)
  
  if (!error) {
    router.push('/')
  }
}

// Handle signup
async function handleSignup() {
  const { valid } = await signupForm.value.validate()
  if (!valid) return

  const { error } = await authStore.signUp(
    signupEmail.value,
    signupPassword.value,
    signupName.value || undefined
  )
  
  if (!error) {
    successMessage.value = 'Sign up successful! Please check your email to verify your account.'
    // Reset form
    signupName.value = ''
    signupEmail.value = ''
    signupPassword.value = ''
    signupPasswordConfirm.value = ''
    signupForm.value.reset()
  }
}

// Handle password reset
async function handleResetPassword() {
  const { valid } = await resetForm.value.validate()
  if (!valid) return

  const { error } = await authStore.resetPassword(resetEmail.value)
  
  if (!error) {
    showResetDialog.value = false
    successMessage.value = 'Password reset email sent! Please check your inbox.'
    resetEmail.value = ''
  }
}
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>

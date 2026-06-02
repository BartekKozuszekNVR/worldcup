<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await authStore.login(username.value, password.value)
    router.push('/')
  } catch (e: any) {
    error.value = e?.message || t('auth.loginError')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <q-card-section>
    <div class="text-h6 q-mb-md">{{ t('auth.login') }}</div>
    <q-form @submit.prevent="onSubmit" class="column">
      <q-input
        v-model="username"
        :label="t('auth.username')"
        outlined
        dense
        :rules="[(v: string) => !!v || t('validation.required')]"
      />
      <q-input
        v-model="password"
        :label="t('auth.password')"
        type="password"
        outlined
        dense
        :rules="[(v: string) => !!v || t('validation.required')]"
      />
      <q-banner v-if="error" class="text-white bg-negative q-mt-sm" rounded dense>
        {{ error }}
      </q-banner>
      <q-btn
        type="submit"
        color="primary"
        :label="t('auth.login')"
        :loading="loading"
        class="full-width q-mt-md"
      />
    </q-form>
    <div class="row items-center q-my-md">
      <q-separator class="col" />
      <div class="text-caption text-grey q-mx-sm">{{ t('auth.or') }}</div>
      <q-separator class="col" />
    </div>
    <div>
      <q-btn
        :label="t('auth.registerButton')"
        color="primary"
        class="full-width"
        to="/register"
      />
      <div class="text-center">
        <div class="text-caption text-grey q-mt-sm">{{ t('auth.forgotPassword') }}</div>
      </div>
    </div>
  </q-card-section>
</template>

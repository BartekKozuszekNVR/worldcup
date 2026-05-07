<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useLeaderboardStore } from '../stores/leaderboard'
import PointsSummary from '../components/PointsSummary.vue'
import ThemeSelector from '../components/ThemeSelector.vue'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const leaderboardStore = useLeaderboardStore()
const fileInput = ref<HTMLInputElement>()
const selectedUserId = ref<number | null>(null)

const initials = computed(() =>
  (authStore.user?.username ?? '').slice(0, 2).toUpperCase()
)

const memberSince = computed(() => {
  if (!authStore.user?.createdAt) return ''
  return new Date(authStore.user.createdAt).toLocaleDateString()
})

const myEntry = computed(() =>
  leaderboardStore.entries.find(e => e.userId === authStore.user?.id)
)

const userOptions = computed(() =>
  authStore.userList.map(u => ({ label: u.username, value: u.id }))
)

function triggerUpload() {
  fileInput.value?.click()
}

function handleFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    const base64 = reader.result as string
    await authStore.updateAvatar(base64)
  }
  reader.readAsDataURL(file)
}

async function switchToUser(userId: number) {
  await authStore.switchUser(userId)
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

onMounted(async () => {
  await leaderboardStore.loadLeaderboard()
  if (authStore.isAdmin) {
    await authStore.loadUsers()
  }
})
</script>

<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">{{ t('profile.title') }}</div>

    <!-- Avatar -->
    <q-card class="q-mb-md">
      <q-card-section class="text-center">
        <q-avatar size="100px" class="q-mb-md">
          <img v-if="authStore.user?.avatarUrl" :src="authStore.user.avatarUrl" />
          <span v-else class="text-h4">{{ initials }}</span>
        </q-avatar>
        <div class="text-h6">{{ authStore.user?.username }}</div>
        <div class="text-caption">{{ t('profile.memberSince') }}: {{ memberSince }}</div>
        <q-btn flat color="primary" :label="t('profile.uploadAvatar')" class="q-mt-sm" @click="triggerUpload" />
        <input ref="fileInput" type="file" accept="image/*" hidden @change="handleFile" />
      </q-card-section>
    </q-card>

    <!-- Stats -->
    <PointsSummary
      v-if="myEntry"
      :total-points="myEntry.totalPoints"
      :match-points="myEntry.matchPoints"
      :bonus-points="myEntry.bonusPoints"
      class="q-mb-md"
    />

    <!-- Theme -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6 q-mb-sm">{{ t('profile.theme') }}</div>
        <ThemeSelector />
      </q-card-section>
    </q-card>

    <!-- Admin section -->
    <q-card v-if="authStore.isAdmin" class="q-mb-md">
      <q-card-section>
        <div class="text-h6 q-mb-sm">{{ t('profile.switchUser') }}</div>
        <q-select
          v-model="selectedUserId"
          :options="userOptions"
          emit-value
          map-options
          outlined
          dense
          :label="t('profile.switchUser')"
          @update:model-value="switchToUser"
        />
      </q-card-section>
    </q-card>

    <!-- Logout -->
    <q-btn color="negative" :label="t('app.logout')" @click="handleLogout" class="full-width" />
  </q-page>
</template>

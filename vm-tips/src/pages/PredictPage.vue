<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { usePredictionsStore } from '../stores/predictions'
import { useAuthStore } from '../stores/auth'
import { useAppStore } from '../stores/app'
import { useGroupSimulation } from '../composables/useGroupSimulation'
import { useKnockoutAdvancers } from '../composables/useKnockoutAdvancers'
import { useBracketSimulation } from '../composables/useBracketSimulation'
import { GROUPS } from '../data/groupMatches'
import type { SimulatedTeam, KnockoutPrediction } from '../types'
import { apiFetch } from '../composables/useApi'
import GroupCard from '../components/GroupCard.vue'
import ThirdPlaceTiebreaker from '../components/ThirdPlaceTiebreaker.vue'
import KnockoutPredictionsPanel from '../components/KnockoutPredictionsPanel.vue'

const { t } = useI18n()
const $q = useQuasar()
const store = usePredictionsStore()
const authStore = useAuthStore()
const appStore = useAppStore()

const saving = ref(false)
const loading = ref(false)
const selectedUserId = ref<number | null>(null)
const otherPredictions = ref<Record<string, { homeScore: number | null; awayScore: number | null }> | null>(null)
const otherKnockoutPredictions = ref<Record<string, KnockoutPrediction> | null>(null)
const otherOverrides = ref<Record<string, number> | null>(null)
const otherTopScorer = ref<string | null>(null)

const userOptions = computed(() => {
  if (authStore.isAdmin) {
    return authStore.userList.map(u => ({ label: u.username, value: u.id }))
  }
  return authStore.publicUserList.map(u => ({ label: u.username, value: u.id }))
})

const currentUsername = computed(() => {
  if (!selectedUserId.value) {
    return authStore.user?.username ?? ''
  }
  if (authStore.isAdmin) {
    return authStore.userList.find(u => u.id === selectedUserId.value)?.username ?? ''
  }
  return authStore.publicUserList.find(u => u.id === selectedUserId.value)?.username ?? ''
})

const isViewingOtherUser = computed(() =>
  selectedUserId.value && selectedUserId.value !== authStore.user?.id
)

// Active data — switches between current user and selected user
const activePredictions = computed(() =>
  otherPredictions.value ?? store.predictions
)
const activeKnockoutPredictions = computed(() =>
  otherKnockoutPredictions.value ?? store.knockoutPredictions
)
const activeOverrides = computed(() =>
  otherOverrides.value ?? store.tiebreakerOverrides
)
const activeTopScorer = computed(() =>
  isViewingOtherUser.value ? otherTopScorer.value : store.topScorer
)

async function loadUserPredictions(userId: number | null) {
  if (!userId || userId === authStore.user?.id) {
    // Reset to current user's predictions
    otherPredictions.value = null
    otherKnockoutPredictions.value = null
    otherOverrides.value = null
    otherTopScorer.value = null
    return
  }

  try {
    loading.value = true
    const data = await apiFetch<{
      predictions: Record<string, { homeScore: number | null; awayScore: number | null }>
      knockoutPredictions: Record<string, KnockoutPrediction>
      thirdPlaceOverrides: Record<string, number>
      topScorer: string | null
    }>(`/api/predictions/user/${userId}`)
    otherPredictions.value = data.predictions ?? {}
    otherKnockoutPredictions.value = data.knockoutPredictions ?? {}
    otherOverrides.value = data.thirdPlaceOverrides ?? {}
    otherTopScorer.value = data.topScorer ?? null
  } catch (e: any) {
    otherPredictions.value = null
    otherKnockoutPredictions.value = null
    otherOverrides.value = null
    otherTopScorer.value = null
    $q.notify({ type: 'warning', message: e.message || t('predict.loadError') })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  store.loadPredictions()
  if (authStore.isAdmin) {
    await authStore.loadUsers()
  } else {
    await authStore.loadPublicUsers()
  }
  // Initialize with current user
  selectedUserId.value = authStore.user?.id ?? null
})

// Build group standings for all groups
const groupStandingsMap = computed<Record<string, SimulatedTeam[]>>(() => {
  const result: Record<string, SimulatedTeam[]> = {}
  for (const group of GROUPS) {
    const { standings } = useGroupSimulation(() => activePredictions.value, group)
    result[group] = standings.value
  }
  return result
})

// Check if all group matches are filled
const allGroupsFilled = computed(() => {
  for (const group of GROUPS) {
    const s = groupStandingsMap.value[group]
    if (!s || s.some(t => t.played < 3)) return false
  }
  return true
})

// Third place / knockout logic
const knockoutResult = useKnockoutAdvancers(
  () => groupStandingsMap.value,
  () => activeOverrides.value
)

const { bracket } = useBracketSimulation(
  () => groupStandingsMap.value,
  () => activeOverrides.value,
  () => activeKnockoutPredictions.value
)

// Check whether all third-place tiebreakers have been resolved
const allTiesResolved = computed(() => {
  const ties = knockoutResult.value.tieGroups
  if (ties.length === 0) return true
  return ties.every(tie =>
    tie.teams.every(team => activeOverrides.value[team.code] !== undefined)
  )
})

function updatePrediction(matchId: string, field: 'homeScore' | 'awayScore', value: number | null) {
  const current = store.predictions[matchId] ?? { homeScore: null, awayScore: null }
  store.predictions[matchId] = { ...current, [field]: value }
}

function updateKnockoutPrediction(matchId: string, field: string, value: any) {
  const current = store.knockoutPredictions[matchId] ?? {
    matchId,
    homeTeam: '',
    awayTeam: '',
    homeScore: null,
    awayScore: null,
    penaltyWinner: null,
  }
  store.knockoutPredictions[matchId] = { ...current, [field]: value }
}

async function save() {
  saving.value = true
  try {
    await store.savePredictions()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5">{{ t('predictions.title') }}</div>
      <q-space />
      <q-select
        v-model="selectedUserId"
        :options="userOptions"
        :label="t('predict.viewAs')"
        emit-value
        map-options
        dense
        outlined
        bg-color="white"
        color="primary"
        style="min-width: 200px"
        @update:model-value="loadUserPredictions"
      />
    </div>

    <q-banner :class="`bg-secondary ${appStore.secondaryIsLight ? 'text-black' : 'text-white'} q-mb-md`" rounded>
      <template #avatar><q-icon name="lock" /></template>
      {{ t('predictions.deadlineWarning') }}
    </q-banner>

    <q-inner-loading :showing="loading" />

    <template v-if="!loading">
      <!-- Predictions section header with username -->
      <div v-if="isViewingOtherUser" class="text-subtitle1 text-weight-bold q-mb-md">
        {{ t('predict.predictionsFor') }} <span class="text-primary">{{ currentUsername }}</span>
      </div>

      <!-- Group cards -->
      <q-card flat bordered class="q-mb-md">
      <q-list>
        <q-expansion-item
          v-for="group in GROUPS"
          :key="group"
          :label="`${t('predictions.group')} ${group}`"
          header-class="text-weight-bold text-h6 q-my-md bg-primary-light"
          default-opened
          dense
        >
          <GroupCard
            :group="group"
            :predictions="activePredictions"
            @update:prediction="!isViewingOtherUser ? updatePrediction($event.matchId, $event.field, $event.value) : null"
          />
        </q-expansion-item>
      </q-list>

      <!-- Third place tiebreaker -->
      <template v-if="allGroupsFilled && knockoutResult.tieGroups.length > 0">
        <q-separator class="q-my-lg" />
        <ThirdPlaceTiebreaker
          :ties="knockoutResult.tieGroups"
          :overrides="activeOverrides"
          @update:overrides="!isViewingOtherUser ? store.tiebreakerOverrides = $event : null"
        />
      </template>

      <!-- Knockout bracket -->
      <template v-if="allGroupsFilled && allTiesResolved">
        <KnockoutPredictionsPanel
          :bracket="bracket"
          :predictions="activeKnockoutPredictions"
          @update:prediction="!isViewingOtherUser ? updateKnockoutPrediction($event.matchId, $event.field, $event.value) : null"
        />
      </template>
      <template v-else-if="allGroupsFilled && !allTiesResolved">
        <q-separator class="q-my-lg" />
        <q-banner class="bg-secondary text-white q-mx-md q-mb-sm" rounded>
          <template #avatar><q-icon name="lock" /></template>
          {{ t('predictions.knockoutLockedByTiebreaker') }}
        </q-banner>
      </template>
      </q-card>

      <!-- Top Goal Scorer prediction -->
      <q-card flat bordered class="q-mt-md" style="margin-bottom: 80px;">
        <q-card-section>
          <div class="text-h6">
            <q-icon name="sports_soccer" class="q-mr-sm" />
            {{ t('predictions.topScorer') }}
          </div>
          <p class="text-caption text-grey-7 q-mb-md">{{ t('predictions.topScorerHint') }}</p>

          <!-- When viewing own predictions - editable input -->
          <template v-if="!isViewingOtherUser">
            <q-input
              v-model="store.topScorer"
              outlined
              dense
              :placeholder="t('predictions.topScorerPlaceholder')"
              clearable
            >
              <template #prepend>
                <q-icon name="person" />
              </template>
            </q-input>
          </template>

          <!-- When viewing other users' predictions - read-only display -->
          <template v-else>
            <div class="q-pa-md bg-grey-2 rounded-borders">
              <div class="text-body1">
                <q-icon name="person" class="q-mr-sm" />
                <span v-if="activeTopScorer">{{ activeTopScorer }}</span>
                <span v-else class="text-grey-5">{{ t('advancing.noTopScorer') }}</span>
              </div>
            </div>
          </template>
        </q-card-section>
      </q-card>
    </template>

    <!-- Floating save button -->
    <q-page-sticky position="bottom-right" :offset="[18, 18]" style="z-index: 9999">
      <q-btn
        fab
        icon="save"
        color="primary"
        :loading="saving"
        :disable="isViewingOtherUser"
        :label="t('predictions.save')"
        @click="save"
      />
    </q-page-sticky>
  </q-page>
</template>

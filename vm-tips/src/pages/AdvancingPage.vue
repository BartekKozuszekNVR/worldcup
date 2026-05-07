<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { usePredictionsStore } from '../stores/predictions'
import { useAuthStore } from '../stores/auth'
import { useGroupSimulation } from '../composables/useGroupSimulation'
import { useKnockoutAdvancers } from '../composables/useKnockoutAdvancers'
import { useBracketSimulation } from '../composables/useBracketSimulation'
import { GROUPS } from '../data/groupMatches'
import { teams } from '../data/teams'
import { isTournamentLocked } from '../../shared/constants'
import type { SimulatedTeam } from '../types'
import { apiFetch } from '../composables/useApi'

const { t } = useI18n()
const $q = useQuasar()
const predictionsStore = usePredictionsStore()
const authStore = useAuthStore()

const loading = ref(false)
const selectedUserId = ref<number | null>(null)
const otherPredictions = ref<Record<string, { homeScore: number | null; awayScore: number | null }> | null>(null)

const tournamentStarted = computed(() => isTournamentLocked())

const userOptions = computed(() => {
  if (authStore.isAdmin) {
    return authStore.userList.map(u => ({ label: u.username, value: u.id }))
  }
  return authStore.publicUserList.map(u => ({ label: u.username, value: u.id }))
})

const canViewOthers = computed(() => authStore.isAdmin || tournamentStarted.value)

const activePredictions = computed(() =>
  otherPredictions.value ?? predictionsStore.predictions
)

// Build group standings for all 12 groups
const allGroupStandings = computed<Record<string, SimulatedTeam[]>>(() => {
  const result: Record<string, SimulatedTeam[]> = {}
  for (const group of GROUPS) {
    const { standings } = useGroupSimulation(() => activePredictions.value, group)
    result[group] = standings.value
  }
  return result
})

const advancers = computed(() => {
  const knockoutResult = useKnockoutAdvancers(() => allGroupStandings.value)
  return knockoutResult.value
})

const { bracket } = useBracketSimulation(() => allGroupStandings.value)

const champion = computed(() => {
  const finalMatch = bracket.value.find(m => m.id.startsWith('F'))
  if (!finalMatch) return null
  // Find knockout prediction for final
  const kp = predictionsStore.knockoutPredictions
  for (const key of Object.keys(kp)) {
    if (key.startsWith('F') || key === 'final') {
      const pred = kp[key]
      if (pred.homeScore !== null && pred.awayScore !== null) {
        if (pred.homeScore > pred.awayScore) return pred.homeTeam
        if (pred.awayScore > pred.homeScore) return pred.awayTeam
        return pred.penaltyWinner ?? null
      }
    }
  }
  return null
})

function getGroupAdvancers(group: string): SimulatedTeam[] {
  return advancers.value.groupAdvancers[group]?.slice(0, 2) ?? []
}

function getTeamName(code: string): string {
  return teams.find(t => t.code === code)?.name ?? code
}

async function loadUserPredictions(userId: number | null) {
  if (!userId) {
    otherPredictions.value = null
    return
  }
  try {
    loading.value = true
    const data = await apiFetch<{
      predictions: Record<string, { homeScore: number | null; awayScore: number | null }>
    }>(`/api/predictions/user/${userId}`)
    otherPredictions.value = data.predictions
  } catch (e: any) {
    otherPredictions.value = null
    $q.notify({ type: 'warning', message: e.message || t('advancing.loadError') })
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await predictionsStore.loadPredictions()
  if (authStore.isAdmin) {
    await authStore.loadUsers()
  } else if (tournamentStarted.value) {
    await authStore.loadPublicUsers()
  }
})
</script>

<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5">{{ t('advancing.title') }}</div>
      <q-space />
      <div>
        <q-select
          v-model="selectedUserId"
          :options="userOptions"
          :label="t('advancing.viewAs')"
          emit-value
          map-options
          dense
          outlined
          bg-color="white"
          color="primary"
          :disable="!canViewOthers"
          style="min-width: 200px"
          @update:model-value="loadUserPredictions"
        />
        <q-tooltip v-if="!canViewOthers">
          {{ t('advancing.lockedTooltip') }}
        </q-tooltip>
      </div>
    </div>

    <q-inner-loading :showing="loading" />

    <!-- Group Winners & Runners-up -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">{{ t('advancing.groupWinners') }}</div>
      </q-card-section>
      <q-card-section>
        <div class="row q-gutter-sm">
          <div v-for="group in GROUPS" :key="group" class="col-6 col-sm-4 col-md-3 col-lg-2">
            <q-card flat bordered class="q-pa-sm">
              <div class="text-subtitle2 text-center">{{ t('predictions.group') }} {{ group }}</div>
              <div v-for="(team, i) in getGroupAdvancers(group)" :key="team.code" class="row items-center q-mt-xs">
                <q-avatar size="20px" class="q-mr-xs">
                  <img :src="`https://flagcdn.com/w40/${team.code.toLowerCase()}.png`" :alt="team.code" />
                </q-avatar>
                <span class="text-caption">{{ i === 0 ? '1.' : '2.' }} {{ getTeamName(team.code) }}</span>
              </div>
            </q-card>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Best Third-Place -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">{{ t('advancing.bestThird') }}</div>
      </q-card-section>
      <q-card-section>
        <div class="row q-gutter-sm">
          <q-chip
            v-for="team in advancers.qualifyingThirds"
            :key="team.code"
            color="primary"
            text-color="white"
          >
            <q-avatar size="20px" class="q-mr-xs">
              <img :src="`https://flagcdn.com/w40/${team.code.toLowerCase()}.png`" :alt="team.code" />
            </q-avatar>
            {{ getTeamName(team.code) }} ({{ team.points }} {{ t('standings.points') }})
          </q-chip>
        </div>
      </q-card-section>
    </q-card>

    <!-- Knockout bracket summary -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">{{ t('advancing.knockout') }}</div>
      </q-card-section>
      <q-card-section>
        <div class="row q-gutter-sm">
          <div v-for="match in bracket" :key="match.id" class="col-12 col-sm-6 col-md-4">
            <q-card flat bordered class="q-pa-xs">
              <div class="text-caption text-grey">{{ match.id }}</div>
              <div class="row items-center justify-between">
                <span>{{ match.homeTeam ? getTeamName(match.homeTeam) : '?' }}</span>
                <span class="text-bold">vs</span>
                <span>{{ match.awayTeam ? getTeamName(match.awayTeam) : '?' }}</span>
              </div>
            </q-card>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Champion -->
    <q-card v-if="champion" class="q-mb-md bg-primary text-white">
      <q-card-section class="text-center">
        <q-icon name="emoji_events" size="lg" />
        <div class="text-h5 q-mt-sm">{{ t('advancing.champion') }}</div>
        <div class="text-h4">{{ getTeamName(champion) }}</div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

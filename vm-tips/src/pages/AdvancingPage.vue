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
import type { SimulatedTeam, KnockoutPrediction } from '../types'
import { apiFetch } from '../composables/useApi'
import TeamFlag from '../components/TeamFlag.vue'

const { t } = useI18n()
const $q = useQuasar()
const predictionsStore = usePredictionsStore()
const authStore = useAuthStore()

const loading = ref(false)
const selectedUserId = ref<number | null>(null)
const otherPredictions = ref<Record<string, { homeScore: number | null; awayScore: number | null }> | null>(null)
const otherKnockoutPredictions = ref<Record<string, KnockoutPrediction> | null>(null)
const otherOverrides = ref<Record<string, number> | null>(null)
const otherTopScorer = ref<string | null>(null)

const tournamentStarted = computed(() => isTournamentLocked())

const userOptions = computed(() => {
  if (authStore.isAdmin) {
    return authStore.userList.map(u => ({ label: u.username, value: u.id }))
  }
  return authStore.publicUserList.map(u => ({ label: u.username, value: u.id }))
})

const canViewOthers = computed(() => authStore.isAdmin || tournamentStarted.value)

// Active data — switches between current user and selected user
const activePredictions = computed(() =>
  otherPredictions.value ?? predictionsStore.predictions
)
const activeKnockoutPredictions = computed(() =>
  otherKnockoutPredictions.value ?? predictionsStore.knockoutPredictions
)
const activeOverrides = computed(() =>
  otherOverrides.value ?? predictionsStore.tiebreakerOverrides
)
const activeTopScorer = computed(() =>
  selectedUserId.value ? otherTopScorer.value : predictionsStore.topScorer
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
  const knockoutResult = useKnockoutAdvancers(
    () => allGroupStandings.value,
    () => activeOverrides.value
  )
  return knockoutResult.value
})

const { bracket } = useBracketSimulation(
  () => allGroupStandings.value,
  () => activeOverrides.value,
  () => activeKnockoutPredictions.value
)

const champion = computed(() => {
  const finalMatch = bracket.value.find(m => m.id === 'FINAL')
  if (!finalMatch) return null
  const pred = activeKnockoutPredictions.value['FINAL']
  if (!pred || pred.homeScore === null || pred.awayScore === null) return null
  if (pred.homeScore > pred.awayScore) return finalMatch.homeTeam
  if (pred.awayScore > pred.homeScore) return finalMatch.awayTeam
  return pred.penaltyWinner ?? null
})

function getGroupAdvancers(group: string): SimulatedTeam[] {
  return advancers.value.groupAdvancers[group]?.slice(0, 2) ?? []
}

function getTeamName(code: string): string {
  return teams.find(t => t.code === code)?.name ?? code
}

const stages = [
  { key: 'r32', label: 'Round of 32', prefix: 'R32-' },
  { key: 'r16', label: 'Round of 16', prefix: 'R16-' },
  { key: 'qf', label: 'Quarter-finals', prefix: 'QF-' },
  { key: 'sf', label: 'Semi-finals', prefix: 'SF-' },
  { key: 'third', label: 'Third place', prefix: 'THIRD' },
  { key: 'final', label: 'Final', prefix: 'FINAL' },
]

function matchesForStage(prefix: string) {
  if (prefix === 'THIRD' || prefix === 'FINAL') {
    return bracket.value.filter(m => m.id === prefix)
  }
  return bracket.value.filter(m => m.id.startsWith(prefix))
}

function getMatchPrediction(matchId: string) {
  return activeKnockoutPredictions.value[matchId] ?? null
}

function getMatchWinner(matchId: string, homeTeam: string | null, awayTeam: string | null): string | null {
  const pred = getMatchPrediction(matchId)
  if (!pred || pred.homeScore === null || pred.awayScore === null) return null
  if (!homeTeam || !awayTeam) return null
  if (pred.homeScore > pred.awayScore) return homeTeam
  if (pred.awayScore > pred.homeScore) return awayTeam
  return pred.penaltyWinner ?? null
}

async function loadUserPredictions(userId: number | null) {
  if (!userId) {
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

      <q-card-section
        v-for="stage in stages"
        :key="stage.key"
        class="q-pt-none"
      >
        <div class="text-subtitle1 text-weight-bold q-mb-sm">{{ stage.label }}</div>

        <q-card
          v-for="match in matchesForStage(stage.prefix)"
          :key="match.id"
          flat
          bordered
          class="q-mb-sm"
        >
          <q-card-section class="q-py-sm q-px-md">
            <div class="row items-center no-wrap">
              <!-- Home team -->
              <div class="row items-center no-wrap col">
                <TeamFlag :code="match.homeTeam ?? 'UN'" size="22px" />
                <span
                  class="team-name q-ml-xs text-caption"
                  :class="{ 'text-weight-bold': getMatchWinner(match.id, match.homeTeam, match.awayTeam) === match.homeTeam }"
                >
                  {{ match.homeTeam ? getTeamName(match.homeTeam) : '?' }}
                </span>
              </div>

              <!-- Score -->
              <div class="text-center q-mx-sm" style="min-width: 50px">
                <template v-if="getMatchPrediction(match.id)?.homeScore !== null && getMatchPrediction(match.id)?.homeScore !== undefined">
                  <span class="text-weight-bold">
                    {{ getMatchPrediction(match.id)?.homeScore }} - {{ getMatchPrediction(match.id)?.awayScore }}
                  </span>
                </template>
                <template v-else>
                  <span class="text-grey-5">vs</span>
                </template>
              </div>

              <!-- Away team -->
              <div class="row items-center no-wrap col justify-end">
                <span
                  class="team-name q-mr-xs text-caption"
                  :class="{ 'text-weight-bold': getMatchWinner(match.id, match.homeTeam, match.awayTeam) === match.awayTeam }"
                >
                  {{ match.awayTeam ? getTeamName(match.awayTeam) : '?' }}
                </span>
                <TeamFlag :code="match.awayTeam ?? 'UN'" size="22px" />
              </div>
            </div>

            <!-- Penalty indicator -->
            <div
              v-if="getMatchPrediction(match.id)?.homeScore !== null && getMatchPrediction(match.id)?.homeScore === getMatchPrediction(match.id)?.awayScore && getMatchPrediction(match.id)?.penaltyWinner"
              class="text-center q-mt-xs"
            >
              <q-chip dense size="sm" color="orange" text-color="white">
                {{ t('predictions.penaltyWinner') }}: {{ getTeamName(getMatchPrediction(match.id)!.penaltyWinner!) }}
              </q-chip>
            </div>
          </q-card-section>
        </q-card>

        <q-separator v-if="stage.key !== 'final'" class="q-mt-md" />
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

    <!-- Top Scorer Prediction -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="row items-center">
          <q-icon name="sports_soccer" size="sm" class="q-mr-sm" />
          <div class="text-h6">{{ t('advancing.topScorer') }}</div>
        </div>
        <div class="text-body1 q-mt-sm">
          {{ activeTopScorer || t('advancing.noTopScorer') }}
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<style scoped>
.team-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  display: block;
}
</style>

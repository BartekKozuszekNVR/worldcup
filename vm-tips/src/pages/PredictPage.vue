<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePredictionsStore } from '../stores/predictions'
import { useAppStore } from '../stores/app'
import { useGroupSimulation } from '../composables/useGroupSimulation'
import { useKnockoutAdvancers } from '../composables/useKnockoutAdvancers'
import { useBracketSimulation } from '../composables/useBracketSimulation'
import { GROUPS } from '../data/groupMatches'
import type { SimulatedTeam } from '../types'
import GroupCard from '../components/GroupCard.vue'
import ThirdPlaceTiebreaker from '../components/ThirdPlaceTiebreaker.vue'
import KnockoutPredictionsPanel from '../components/KnockoutPredictionsPanel.vue'

const { t } = useI18n()
const store = usePredictionsStore()
const appStore = useAppStore()

const saving = ref(false)

onMounted(() => {
  store.loadPredictions()
})

// Build group standings for all groups
const groupStandingsMap = computed<Record<string, SimulatedTeam[]>>(() => {
  const result: Record<string, SimulatedTeam[]> = {}
  for (const group of GROUPS) {
    const { standings } = useGroupSimulation(() => store.predictions, group)
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
  () => store.tiebreakerOverrides
)

const { bracket } = useBracketSimulation(
  () => groupStandingsMap.value,
  () => store.tiebreakerOverrides,
  () => store.knockoutPredictions
)

// Check whether all third-place tiebreakers have been resolved
const allTiesResolved = computed(() => {
  const ties = knockoutResult.value.tieGroups
  if (ties.length === 0) return true
  return ties.every(tie =>
    tie.teams.every(team => store.tiebreakerOverrides[team.code] !== undefined)
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
    <div class="text-h5 q-mb-md">{{ t('predictions.title') }}</div>

    <q-banner :class="`bg-secondary ${appStore.secondaryIsLight ? 'text-black' : 'text-white'} q-mb-md`" rounded>
      <template #avatar><q-icon name="lock" /></template>
      {{ t('predictions.deadlineWarning') }}
    </q-banner>

    <q-inner-loading :showing="store.loading" />

    <template v-if="!store.loading">
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
            :predictions="store.predictions"
            @update:prediction="updatePrediction"
          />
        </q-expansion-item>
      </q-list>

      <!-- Third place tiebreaker -->
      <template v-if="allGroupsFilled && knockoutResult.tieGroups.length > 0">
        <q-separator class="q-my-lg" />
        <ThirdPlaceTiebreaker
          :ties="knockoutResult.tieGroups"
          :overrides="store.tiebreakerOverrides"
          @update:overrides="store.tiebreakerOverrides = $event"
        />
      </template>

      <!-- Knockout bracket -->
      <template v-if="allGroupsFilled && allTiesResolved">
        <KnockoutPredictionsPanel
          :bracket="bracket"
          :predictions="store.knockoutPredictions"
          @update:prediction="updateKnockoutPrediction"
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
        :label="t('predictions.save')"
        @click="save"
      />
    </q-page-sticky>
  </q-page>
</template>

<script setup lang="ts">
import type { BracketMatch } from '../composables/useBracketSimulation'
import type { KnockoutPrediction } from '../types'
import KnockoutMatchCard from './KnockoutMatchCard.vue'
import { useI18n } from "vue-i18n";

const { t } = useI18n()

const props = defineProps<{
  bracket: BracketMatch[]
  predictions: Record<string, KnockoutPrediction>
  locked?: boolean
}>()

const emit = defineEmits<{
  'update:prediction': [matchId: string, field: string, value: any]
}>()

interface Stage {
  key: string
  label: string
  prefix: string
}

const stages: Stage[] = [
  { key: 'r32', label: t('results.stageR32'), prefix: 'R32-' },
  { key: 'r16', label: t('results.stageR16'), prefix: 'R16-' },
  { key: 'qf', label: t('results.stageQF'), prefix: 'QF-' },
  { key: 'sf', label: t('results.stageSF'), prefix: 'SF-' },
  { key: 'third', label: t('results.stageThird'), prefix: 'THIRD' },
  { key: 'final', label: t('results.stageFinal'), prefix: 'FINAL' },
]

function matchesForStage(prefix: string): BracketMatch[] {
  if (prefix === 'THIRD' || prefix === 'FINAL') {
    return props.bracket.filter(m => m.id === prefix)
  }
  return props.bracket.filter(m => m.id.startsWith(prefix))
}

function stageComplete(prefix: string): boolean {
  const matches = matchesForStage(prefix)
  return matches.every(m => {
    const pred = props.predictions[m.id]
    if (!pred) return false
    if (pred.homeScore === null || pred.awayScore === null) return false
    if (pred.homeScore === pred.awayScore && !pred.penaltyWinner) return false
    return true
  })
}

function isStageUnlocked(stageIndex: number): boolean {
  if (stageIndex === 0) return true
  // Previous stage must be complete
  return stageComplete(stages[stageIndex - 1].prefix)
}
</script>

<template>
  <q-card flat bordered class="q-mb-md">
    <q-card-section>
      <div class="text-h6">{{ $t('predictions.knockout') }}</div>
      <q-banner rounded class="bg-blue-1 text-blue-9 q-mt-sm">
        <template #avatar>
          <q-icon name="public" color="blue-7" />
        </template>
        {{ $t('predictions.knockoutBracketBanner') }}
        <template #action>
          <q-btn
            flat
            dense
            color="blue-7"
            label="FIFA.com"
            icon-right="open_in_new"
            type="a"
            href="https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/knockout-stage-match-schedule-bracket"
            target="_blank"
            rel="noopener"
          />
        </template>
      </q-banner>
    </q-card-section>

    <q-card-section
      v-for="(stage, idx) in stages"
      :key="stage.key"
      class="q-pt-none"
    >
      <div class="text-subtitle1 text-weight-bold q-mb-sm">{{ stage.label }}</div>

      <template v-if="isStageUnlocked(idx)">
        <KnockoutMatchCard
          v-for="match in matchesForStage(stage.prefix)"
          :key="match.id"
          :match-id="match.id"
          :home-team="match.homeTeam"
          :away-team="match.awayTeam"
          :home-score="predictions[match.id]?.homeScore ?? null"
          :away-score="predictions[match.id]?.awayScore ?? null"
          :penalty-winner="predictions[match.id]?.penaltyWinner ?? null"
          :disabled="locked"
          @update:home-score="emit('update:prediction', match.id, 'homeScore', $event)"
          @update:away-score="emit('update:prediction', match.id, 'awayScore', $event)"
          @update:penalty-winner="emit('update:prediction', match.id, 'penaltyWinner', $event)"
        />
      </template>

      <q-banner v-else class="bg-primary-light text-grey-7" rounded>
        <q-icon name="lock" class="q-mr-sm" />
        {{ $t('predictions.stageLockedHint') }}
      </q-banner>

      <q-separator v-if="idx < stages.length - 1" class="q-mt-md" />
    </q-card-section>
  </q-card>
</template>

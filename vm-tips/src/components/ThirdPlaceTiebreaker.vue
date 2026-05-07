<script setup lang="ts">
import { computed } from 'vue'
import type { TieGroup } from '../types'
import TeamFlag from './TeamFlag.vue'

const props = defineProps<{
  ties: TieGroup[]
  overrides: Record<string, number>
  locked?: boolean
}>()

const emit = defineEmits<{
  'update:overrides': [overrides: Record<string, number>]
}>()

const allResolved = computed(() => {
  if (props.ties.length === 0) return true
  for (const tie of props.ties) {
    for (const team of tie.teams) {
      if (props.overrides[team.code] === undefined) return false
    }
  }
  return true
})

function availableRanks(tie: TieGroup, currentTeamCode: string): number[] {
  const used = new Set(
    tie.teams
      .filter(t => t.code !== currentTeamCode && props.overrides[t.code] !== undefined)
      .map(t => props.overrides[t.code])
  )
  const ranks: number[] = []
  for (let r = tie.startRank; r <= tie.endRank; r++) {
    if (!used.has(r)) ranks.push(r)
  }
  return ranks
}

function setRank(teamCode: string, rank: number | null) {
  const newOverrides = { ...props.overrides }
  if (rank === null) {
    delete newOverrides[teamCode]
  } else {
    newOverrides[teamCode] = rank
  }
  emit('update:overrides', newOverrides)
}
</script>

<template>
  <q-card flat bordered class="q-mb-md">
    <q-card-section>
      <div class="text-h6">{{ $t('predictions.thirdPlaceTiebreaker') }}</div>
      <div class="text-caption text-grey-7 q-mt-xs">
        {{ $t('predictions.tiebreakerHelp') }}
      </div>
    </q-card-section>

    <q-banner v-if="!allResolved" class="bg-warning text-white q-mx-md q-mb-sm" rounded>
      <template #avatar><q-icon name="warning" /></template>
      {{ $t('predictions.tiebreakerWarning') }}
    </q-banner>

    <q-card-section v-for="tie in ties" :key="tie.startRank" class="q-pt-none">
      <div class="text-subtitle2 q-mb-sm">
        {{ $t('predictions.tiebreakerPositions', { start: tie.startRank, end: tie.endRank }) }}
      </div>

      <div
        v-for="team in tie.teams"
        :key="team.code"
        class="row items-center q-py-xs q-px-sm rounded-borders q-mb-xs"
        :class="{
          'bg-green-1': overrides[team.code] !== undefined && overrides[team.code] <= 8,
          'bg-grey-2': overrides[team.code] !== undefined && overrides[team.code] > 8,
        }"
      >
        <TeamFlag :code="team.code" size="20px" />
        <span class="q-ml-sm text-weight-medium col">{{ team.code }}</span>
        <span class="text-caption q-mr-sm">
          {{ team.points }}pts / {{ team.goalDiff }}GD / {{ team.goalsFor }}GF
        </span>
        <q-select
          :model-value="overrides[team.code] ?? null"
          :options="availableRanks(tie, team.code)"
          dense
          outlined
          emit-value
          map-options
          clearable
          style="width: 70px"
          :disable="locked"
          @update:model-value="setRank(team.code, $event)"
        />
      </div>
    </q-card-section>

    <q-expansion-item :label="$t('predictions.tiebreakerCriteriaTitle')" dense class="q-mx-md q-mb-sm">
      <q-card-section class="text-caption text-grey-8">
        <ol class="q-pl-md q-my-none">
          <li>{{ $t('predictions.criterion1') }}</li>
          <li>{{ $t('predictions.criterion2') }}</li>
          <li>{{ $t('predictions.criterion3') }}</li>
          <li>{{ $t('predictions.criterion4') }}</li>
        </ol>
      </q-card-section>
    </q-expansion-item>
  </q-card>
</template>

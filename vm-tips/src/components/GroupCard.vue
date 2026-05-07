<script setup lang="ts">
import { useGroupSimulation } from '../composables/useGroupSimulation'
import { groupMatches } from '../data/groupMatches'
import ScoreInput from './ScoreInput.vue'
import GroupStandingsTable from './GroupStandingsTable.vue'

const props = defineProps<{
  group: string
  predictions: Record<string, { homeScore: number | null; awayScore: number | null }>
}>()

const emit = defineEmits<{
  'update:prediction': [matchId: string, field: 'homeScore' | 'awayScore', value: number | null]
}>()

const { standings } = useGroupSimulation(() => props.predictions, props.group)

const matches = groupMatches[props.group] ?? []
</script>

<template>
  <q-card-section>
    <ScoreInput
      v-for="match in matches"
      :key="match.id"
      :match-id="match.id"
      :home-team="match.home"
      :away-team="match.away"
      :home-score="predictions[match.id]?.homeScore ?? null"
      :away-score="predictions[match.id]?.awayScore ?? null"
      @update:home-score="emit('update:prediction', match.id, 'homeScore', $event)"
      @update:away-score="emit('update:prediction', match.id, 'awayScore', $event)"
    />
  </q-card-section>
  <q-separator />
  <q-card-section class="q-pt-sm">
    <GroupStandingsTable :standings="standings" :group="group" />
  </q-card-section>
</template>

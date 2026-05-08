<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { teams } from '../data/teams'
import TeamFlag from './TeamFlag.vue'

const { locale } = useI18n()

const props = defineProps<{
  matchId: string
  homeTeam: string | null
  awayTeam: string | null
  homeScore: number | null
  awayScore: number | null
  penaltyWinner: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:homeScore': [value: number | null]
  'update:awayScore': [value: number | null]
  'update:penaltyWinner': [value: string | null]
}>()

function teamName(code: string | null): string {
  if (!code) return 'TBD'
  const team = teams.find(t => t.code === code)
  if (!team) return code
  return locale.value === 'sv' ? team.name : team.nameEn
}

function parseScore(val: string | number | null): number | null {
  if (val === null || val === '' || val === undefined) return null
  const n = Number(val)
  return isNaN(n) ? null : Math.max(0, Math.min(20, n))
}

const isDraw = () =>
  props.homeScore !== null && props.awayScore !== null && props.homeScore === props.awayScore
</script>

<template>
  <q-card flat bordered class="q-mb-sm knockout-match">
    <q-card-section class="q-py-sm q-px-md">
      <div class="row items-center no-wrap">
        <!-- Home team -->
        <div class="row items-center no-wrap col">
          <TeamFlag :code="homeTeam ?? 'UN'" size="22px" />
          <span class="q-ml-xs text-weight-medium text-caption">
            {{ teamName(homeTeam) }}
          </span>
        </div>

        <!-- Scores -->
        <q-input
          :model-value="homeScore"
          type="number"
          dense
          outlined
          input-class="text-center"
          style="width: 50px"
          :min="0"
          :max="20"
          :disable="disabled || !homeTeam || !awayTeam"
          @update:model-value="emit('update:homeScore', parseScore($event))"
        />

        <span class="q-mx-xs text-grey-6 text-weight-bold">–</span>

        <q-input
          :model-value="awayScore"
          type="number"
          dense
          outlined
          input-class="text-center"
          style="width: 50px"
          :min="0"
          :max="20"
          :disable="disabled || !homeTeam || !awayTeam"
          @update:model-value="emit('update:awayScore', parseScore($event))"
        />

        <!-- Away team -->
        <div class="row items-center no-wrap col justify-end">
          <span class="q-mr-xs text-weight-medium text-caption">
            {{ teamName(awayTeam) }}
          </span>
          <TeamFlag :code="awayTeam ?? 'UN'" size="22px" />
        </div>
      </div>

      <!-- Penalty winner -->
      <div v-if="isDraw()" class="q-mt-sm text-center">
        <div class="text-caption text-grey-7 q-mb-xs">{{ $t('predictions.penaltyWinner') }}</div>
        <q-btn-toggle
          :model-value="penaltyWinner"
          :options="[
            { label: teamName(homeTeam), value: homeTeam },
            { label: teamName(awayTeam), value: awayTeam },
          ]"
          dense
          no-caps
          rounded
          toggle-color="primary"
          :disable="disabled"
          @update:model-value="emit('update:penaltyWinner', $event)"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.knockout-match :deep(.q-field__native) {
  text-align: center;
  -moz-appearance: textfield;
}
.knockout-match :deep(.q-field__native)::-webkit-inner-spin-button,
.knockout-match :deep(.q-field__native)::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>

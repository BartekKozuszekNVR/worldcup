<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { teams } from '../data/teams'
import TeamFlag from './TeamFlag.vue'

defineProps<{
  matchId: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:homeScore': [value: number | null]
  'update:awayScore': [value: number | null]
}>()

const { locale } = useI18n()

function teamName(code: string): string {
  const team = teams.find(t => t.code === code)
  if (!team) return code
  return locale.value === 'sv' ? team.name : team.nameEn
}

function parseScore(val: string | number | null): number | null {
  if (val === null || val === '' || val === undefined) return null
  const n = Number(val)
  return isNaN(n) ? null : Math.max(0, Math.min(20, n))
}
</script>

<template>
  <div class="score-input row items-center no-wrap q-py-xs">
    <!-- Home team -->
    <div class="col team-side team-home">
      <!-- Mobile: stacked -->
      <div class="mobile-layout column">
        <div class="">
          <TeamFlag :code="homeTeam" size="20px" />
        </div>
        <span class="team-name text-weight-medium text-caption">{{ teamName(homeTeam) }}</span>
      </div>
      <!-- Desktop: inline -->
      <div class="desktop-layout row items-center no-wrap">
        <TeamFlag :code="homeTeam" size="20px" />
        <span class="team-name text-weight-medium text-caption q-ml-xs">{{ teamName(homeTeam) }}</span>
      </div>
    </div>

    <!-- Score inputs -->
    <q-input
      :model-value="homeScore"
      type="number"
      dense
      outlined
      input-class="text-center"
      style="width: 52px"
      :min="0"
      :max="20"
      :disable="disabled"
      @update:model-value="emit('update:homeScore', parseScore($event))"
    />

    <span class="q-mx-sm text-grey-6 text-weight-bold">–</span>

    <q-input
      :model-value="awayScore"
      type="number"
      dense
      outlined
      input-class="text-center"
      style="width: 52px"
      :min="0"
      :max="20"
      :disable="disabled"
      @update:model-value="emit('update:awayScore', parseScore($event))"
    />

    <!-- Away team -->
    <div class="col team-side team-away q-pl-md">
      <!-- Mobile: stacked -->
      <div class="mobile-layout column">
        <div class="">
          <TeamFlag :code="awayTeam" size="20px" />
        </div>
        <span class="team-name text-weight-medium text-caption">{{ teamName(awayTeam) }}</span>
      </div>
      <!-- Desktop: inline -->
      <div class="desktop-layout row items-center no-wrap justify-end">
        <span class="team-name text-weight-medium text-caption q-mr-xs">{{ teamName(awayTeam) }}</span>
        <TeamFlag :code="awayTeam" size="20px" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.score-input :deep(.q-field__native) {
  text-align: center;
  -moz-appearance: textfield;
}
.score-input :deep(.q-field__native)::-webkit-inner-spin-button,
.score-input :deep(.q-field__native)::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.team-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  display: block;
}

/* Mobile: show stacked, hide inline */
.mobile-layout {
  display: flex;
}
.desktop-layout {
  display: none;
}

/* Desktop (>=600px): show inline, hide stacked */
@media (min-width: 600px) {
  .mobile-layout {
    display: none;
  }
  .desktop-layout {
    display: flex;
  }
}
</style>

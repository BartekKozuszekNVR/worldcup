<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const pointsColumns = computed(() => [
  { name: 'type', label: t('help.pointType'), field: 'type', align: 'left' as const },
  { name: 'points', label: t('help.points'), field: 'points', align: 'center' as const },
  { name: 'desc', label: t('help.description'), field: 'desc', align: 'left' as const },
])

const pointsRows = computed(() => [
  { type: t('help.exact'), points: 5, desc: t('help.exactDesc') },
  { type: t('help.result'), points: 3, desc: t('help.resultDesc') },
  { type: t('help.half'), points: 1.5, desc: t('help.halfDesc') },
  { type: t('help.outcome'), points: 1, desc: t('help.outcomeDesc') },
])

const multiplierColumns = computed(() => [
  { name: 'stage', label: t('help.stage'), field: 'stage', align: 'left' as const },
  { name: 'multiplier', label: t('help.multiplier'), field: 'multiplier', align: 'center' as const },
  { name: 'example', label: t('help.examplePoints'), field: 'example', align: 'center' as const },
])

const multiplierRows = computed(() => [
  { stage: t('help.groupStage'), multiplier: '1×', example: t('help.groupExample') },
  { stage: t('help.roundOf32'), multiplier: '1.5×', example: t('help.r32Example') },
  { stage: t('help.roundOf16'), multiplier: '2×', example: t('help.r16Example') },
  { stage: t('help.quarterFinals'), multiplier: '2.5×', example: t('help.qfExample') },
  { stage: t('help.semiFinals'), multiplier: '3×', example: t('help.sfExample') },
  { stage: t('help.thirdPlaceMatch'), multiplier: '2×', example: t('help.thirdExample') },
  { stage: t('help.final'), multiplier: '4×', example: t('help.finalExample') },
])

const bonusColumns = computed(() => [
  { name: 'category', label: t('help.category'), field: 'category', align: 'left' as const },
  { name: 'perTeam', label: t('help.perTeam'), field: 'perTeam', align: 'center' as const },
  { name: 'teams', label: t('help.teams'), field: 'teams', align: 'center' as const },
  { name: 'max', label: t('help.maxPoints'), field: 'max', align: 'center' as const },
])

const bonusRows = computed(() => [
  { category: t('help.bonusGroupWinner'), perTeam: 5, teams: 12, max: 60 },
  { category: t('help.bonusGroupRunner'), perTeam: 3, teams: 12, max: 36 },
  { category: t('help.bonusThirdPlace'), perTeam: 2, teams: 8, max: 16 },
  { category: t('help.bonusSemifinalist'), perTeam: 10, teams: 4, max: 40 },
  { category: t('help.bonusFinalist'), perTeam: 15, teams: 2, max: 30 },
  { category: t('help.bonusChampion'), perTeam: 25, teams: 1, max: 25 },
])

const maxBonus = computed(() =>
  bonusRows.value.reduce((sum, row) => sum + row.max, 0)
)
</script>

<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">{{ t('help.title') }}</div>

    <!-- Scoring system -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">{{ t('help.scoring') }}</div>
        <p class="q-mt-sm">{{ t('help.scoringDesc') }}</p>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-table
          flat
          bordered
          dense
          :rows="pointsRows"
          :columns="pointsColumns"
          row-key="type"
          hide-pagination
          :pagination="{ rowsPerPage: 0 }"
        />
      </q-card-section>
    </q-card>

    <!-- Stage multipliers -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">{{ t('help.multipliers') }}</div>
        <p class="q-mt-sm">{{ t('help.multipliersDesc') }}</p>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-table
          flat
          bordered
          dense
          :rows="multiplierRows"
          :columns="multiplierColumns"
          row-key="stage"
          hide-pagination
          :pagination="{ rowsPerPage: 0 }"
        />
      </q-card-section>
    </q-card>

    <!-- Bonus points -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">{{ t('help.bonus') }}</div>
        <p class="q-mt-sm">{{ t('help.bonusDesc') }}</p>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-table
          flat
          bordered
          dense
          :rows="bonusRows"
          :columns="bonusColumns"
          row-key="category"
          hide-pagination
          :pagination="{ rowsPerPage: 0 }"
        />
        <div class="text-caption text-weight-bold q-mt-sm">
          {{ t('help.maxBonusLabel') }}: {{ maxBonus }}
        </div>
      </q-card-section>
    </q-card>

    <!-- Formula -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">{{ t('help.formulaTitle') }}</div>
        <div class="text-body1 text-weight-medium q-mt-sm q-pa-sm bg-primary-light" style="border-radius: 4px; font-family: monospace;">
          {{ t('help.formula') }}
        </div>
      </q-card-section>
    </q-card>

    <!-- Calculation examples -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">{{ t('help.examples') }}</div>
      </q-card-section>

      <!-- Example 1 -->
      <q-card-section class="q-pt-none">
        <div class="text-subtitle2 text-weight-bold">{{ t('help.example1Title') }}</div>
        <div class="q-mt-xs">{{ t('help.example1Match') }}</div>
        <div>{{ t('help.example1Tip') }}</div>
        <div class="text-weight-medium text-positive q-mt-xs">{{ t('help.example1Calc') }}</div>
      </q-card-section>

      <q-separator />

      <!-- Example 2 -->
      <q-card-section>
        <div class="text-subtitle2 text-weight-bold">{{ t('help.example2Title') }}</div>
        <div class="q-mt-xs">{{ t('help.example2Match') }}</div>
        <div>{{ t('help.example2Tip') }}</div>
        <div class="text-weight-medium text-positive q-mt-xs">{{ t('help.example2Calc') }}</div>
        <div class="text-caption text-grey-7 q-mt-xs">{{ t('help.example2Note') }}</div>
      </q-card-section>

      <q-separator />

      <!-- Example 3 -->
      <q-card-section>
        <div class="text-subtitle2 text-weight-bold">{{ t('help.example3Title') }}</div>
        <div class="q-mt-xs">{{ t('help.example3Match') }}</div>
        <div>{{ t('help.example3Tip') }}</div>
        <div class="text-weight-medium text-positive q-mt-xs">{{ t('help.example3Calc') }}</div>
      </q-card-section>
    </q-card>

    <!-- Tournament format -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">{{ t('help.format') }}</div>
        <p class="q-mt-sm">{{ t('help.formatDesc') }}</p>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="text-subtitle2 text-weight-bold">{{ t('help.groupStageTitle') }}</div>
        <p class="q-mt-xs">{{ t('help.groupStageDesc') }}</p>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="text-subtitle2 text-weight-bold">{{ t('help.groupAdvanceTitle') }}</div>
        <p class="q-mt-xs">{{ t('help.groupAdvanceDesc') }}</p>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="text-subtitle2 text-weight-bold">{{ t('help.thirdPlace') }}</div>
        <p class="q-mt-xs">{{ t('help.thirdPlaceDesc') }}</p>
        <ol class="q-mt-sm q-pl-md">
          <li>{{ t('help.thirdPlaceCriteria1') }}</li>
          <li>{{ t('help.thirdPlaceCriteria2') }}</li>
          <li>{{ t('help.thirdPlaceCriteria3') }}</li>
          <li>{{ t('help.thirdPlaceCriteria4') }}</li>
          <li>{{ t('help.thirdPlaceCriteria5') }}</li>
        </ol>
        <p class="text-caption text-grey-7 q-mt-sm">{{ t('help.thirdPlaceNote') }}</p>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="text-subtitle2 text-weight-bold">{{ t('help.knockoutTitle') }}</div>
        <p class="q-mt-xs">{{ t('help.knockoutDesc') }}</p>
      </q-card-section>
    </q-card>
  </q-page>
</template>

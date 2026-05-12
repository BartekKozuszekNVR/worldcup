<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScoresStore } from '../stores/scores'
import { usePredictionsStore } from '../stores/predictions'
import { teams } from '../data/teams'
import TeamFlag from '../components/TeamFlag.vue'
import PointsSummary from '../components/PointsSummary.vue'

const { t, locale } = useI18n()
const scoresStore = useScoresStore()
const predictionsStore = usePredictionsStore()

function teamName(code: string | null | undefined): string {
  if (!code) return '?'
  const team = teams.find(t => t.code === code)
  if (!team) return code
  return locale.value === 'sv' ? team.name : team.nameEn
}

function stageName(stage: string): string {
  switch (stage) {
    case 'group': return t('results.stageGroup')
    case 'r32': return t('results.stageR32')
    case 'r16': return t('results.stageR16')
    case 'qf': return t('results.stageQF')
    case 'sf': return t('results.stageSF')
    case 'third': return t('results.stageThird')
    case 'final': return t('results.stageFinal')
    default: return stage
  }
}

const bonusCategories = computed(() => {
  const bd = scoresStore.bonusData
  return Object.entries(bd).map(([key, val]) => ({
    key,
    label: key,
    points: val,
  }))
})

const matchResults = computed(() => {
  return scoresStore.results.map(r => {
    const pred = predictionsStore.predictions[r.matchId]
    const scoreInfo = scoresStore.userPoints.scores[r.matchId]
    return {
      matchId: r.matchId,
      homeTeam: r.homeTeam ?? null,
      awayTeam: r.awayTeam ?? null,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      stage: r.stage,
      predHome: pred?.homeScore,
      predAway: pred?.awayScore,
      pointType: scoreInfo?.type ?? 'miss',
      points: scoreInfo?.points ?? 0,
    }
  })
})

function pointTypeColor(type: string): string {
  switch (type) {
    case 'exact': return 'positive'
    case 'result': return 'primary'
    case 'correctResult': return 'primary'
    case 'half': return 'secondary'
    case 'halfScore': return 'secondary'
    case 'outcome': return 'accent'
    default: return 'grey'
  }
}

function pointTypeLabel(type: string): string {
  switch (type) {
    case 'exact': return t('results.pointExact')
    case 'result':
    case 'correctResult': return t('results.pointResult')
    case 'half':
    case 'halfScore': return t('results.pointHalf')
    case 'outcome': return t('results.pointOutcome')
    default: return t('results.pointMiss')
  }
}

onMounted(async () => {
  await Promise.all([
    scoresStore.loadResults(),
    predictionsStore.loadPredictions(),
  ])
})
</script>

<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5">{{ t('results.title') }}</div>
      <q-space />
      <q-btn flat icon="refresh" :loading="scoresStore.loading" @click="scoresStore.loadResults()" />
    </div>

    <q-inner-loading :showing="scoresStore.loading" />

    <!-- Points summary -->
    <PointsSummary
      :total-points="scoresStore.userPoints.totalPoints"
      :match-points="scoresStore.userPoints.matchPoints"
      :bonus-points="scoresStore.userPoints.bonusPoints"
      class="q-mb-lg"
    />

    <!-- Bonus breakdown -->
    <q-card class="q-mb-md" v-if="bonusCategories.length">
      <q-card-section>
        <div class="text-h6">{{ t('results.bonusBreakdown') }}</div>
      </q-card-section>
      <q-card-section>
        <div class="row q-gutter-sm">
          <q-chip
            v-for="cat in bonusCategories"
            :key="cat.key"
            color="accent"
            text-color="white"
          >
            {{ cat.label }}: {{ cat.points }}
          </q-chip>
        </div>
      </q-card-section>
    </q-card>

    <!-- Top Scorer prediction result -->
    <q-card class="q-mb-md" v-if="scoresStore.topScorerInfo.prediction">
      <q-card-section>
        <div class="row items-center">
          <q-icon name="sports_soccer" size="sm" class="q-mr-sm" />
          <div class="text-h6">{{ t('results.topScorer') }}</div>
        </div>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <div class="row items-center q-mb-sm">
          <span class="text-body1 q-mr-sm">{{ t('results.predicted') }}: <strong>{{ scoresStore.topScorerInfo.prediction }}</strong></span>
          <q-chip
            v-if="scoresStore.topScorerInfo.actualTopScorers.length > 0"
            :color="scoresStore.topScorerInfo.isCorrect ? 'positive' : 'negative'"
            text-color="white"
            dense
            size="sm"
          >
            {{ scoresStore.topScorerInfo.isCorrect ? t('results.topScorerCorrect') : t('results.topScorerWrong') }}
            ({{ scoresStore.topScorerInfo.points }}p)
          </q-chip>
          <q-chip v-else color="grey" text-color="white" dense size="sm">
            {{ t('results.topScorerPending') }}
          </q-chip>
        </div>
        <div v-if="scoresStore.topScorerInfo.actualTopScorers.length > 0" class="text-caption text-grey-7">
          {{ t('results.actualTopScorers') }}: {{ scoresStore.topScorerInfo.actualTopScorers.join(', ') }}
        </div>
      </q-card-section>
    </q-card>

    <!-- Match results -->
    <div class="text-h6 q-mb-sm">{{ t('results.matchResults') }}</div>

    <div v-if="!scoresStore.loading && matchResults.length === 0" class="text-grey-6 text-center q-pa-lg">
      {{ t('results.noResults') }}
    </div>

    <div class="result-cards">
      <q-card
        v-for="result in matchResults"
        :key="result.matchId"
        flat
        bordered
        class="result-card q-mb-sm"
      >
        <q-card-section class="q-py-sm q-px-md">
          <!-- Header: match ID + stage + points chip -->
          <div class="row items-center q-mb-xs">
            <span class="text-caption text-grey-7 text-weight-medium">{{ result.matchId }}</span>
            <span class="text-caption text-grey-5 q-ml-xs">&middot; {{ stageName(result.stage) }}</span>
            <q-space />
            <q-chip
              :color="pointTypeColor(result.pointType)"
              text-color="white"
              dense
              size="sm"
            >
              {{ pointTypeLabel(result.pointType) }} ({{ result.points }}p)
            </q-chip>
          </div>

          <!-- Actual result: flags + team names + scores -->
          <div class="row items-center no-wrap actual-row q-py-xs">
            <!-- Home team -->
            <div class="col row items-center no-wrap">
              <TeamFlag :code="result.homeTeam ?? 'UN'" size="24px" />
              <span class="team-name text-weight-medium q-ml-sm">{{ teamName(result.homeTeam) }}</span>
            </div>

            <!-- Scores -->
            <div class="score-display row items-center no-wrap">
              <span class="text-h6 text-weight-bold">{{ result.homeScore }}</span>
              <span class="q-mx-xs text-grey-5 text-weight-bold">–</span>
              <span class="text-h6 text-weight-bold">{{ result.awayScore }}</span>
            </div>

            <!-- Away team -->
            <div class="col row items-center no-wrap justify-end">
              <span class="team-name text-weight-medium q-mr-sm">{{ teamName(result.awayTeam) }}</span>
              <TeamFlag :code="result.awayTeam ?? 'UN'" size="24px" />
            </div>
          </div>

          <!-- Prediction row -->
          <div class="row items-center no-wrap prediction-row q-pt-xs">
            <div class="col">
              <span class="text-caption text-grey-6">{{ t('results.predicted') }}</span>
            </div>
            <div class="score-display row items-center no-wrap">
              <span class="text-body2 text-grey-8">{{ result.predHome ?? '-' }}</span>
              <span class="q-mx-xs text-grey-5">–</span>
              <span class="text-body2 text-grey-8">{{ result.predAway ?? '-' }}</span>
            </div>
            <div class="col"></div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<style scoped>
.result-card {
  border-radius: 8px;
}

.actual-row {
  min-height: 40px;
}

.score-display {
  min-width: 70px;
  justify-content: center;
}

.prediction-row {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  margin-top: 4px;
  padding-top: 6px;
}

.team-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  font-size: 0.85rem;
}

@media (min-width: 600px) {
  .team-name {
    max-width: 180px;
    font-size: 0.9rem;
  }
}
</style>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth'
import { useScoresStore } from '../stores/scores'
import { groupMatches, GROUPS } from '../data/groupMatches'
import { teams } from '../data/teams'
import {
  roundOf32Rules,
  roundOf16Rules,
  quarterFinalRules,
  semiFinalRules,
  finalRule,
} from '../data/bracketRules'
import { thirdPlaceCombinations } from '../data/thirdPlaceCombinations'
import ScoreInput from '../components/ScoreInput.vue'
import type { AuthUser, MatchStage } from '../types'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()
const scoresStore = useScoresStore()

const tab = ref('users')

// --- Team helpers ---
const teamsByCode = Object.fromEntries(teams.map(t => [t.code, t]))

function teamName(code: string): string {
  return teamsByCode[code]?.name ?? code
}

function teamOption(code: string) {
  return { label: teamName(code), value: code }
}

const teamOptions = teams.map(t => ({ label: t.name, value: t.code }))

function groupTeamOptions(group: string) {
  return teams
    .filter(t => t.group === group)
    .map(t => ({ label: t.name, value: t.code }))
}

// --- Match results (unchanged) ---
const allMatches = Object.entries(groupMatches).flatMap(([, matches]) =>
  matches.map(m => ({ ...m }))
)

const resultInputs = reactive<Record<string, { homeScore: number | null; awayScore: number | null }>>(
  Object.fromEntries(allMatches.map(m => [m.id, { homeScore: null, awayScore: null }]))
)

// --- Progress data ---
const progressData = reactive<Record<string, string>>({})

// --- Knockout match scores ---
const knockoutMatchIds = [
  ...roundOf32Rules.map(r => r.id),
  ...roundOf16Rules.map(r => r.id),
  ...quarterFinalRules.map(r => r.id),
  ...semiFinalRules.map(r => r.id),
  'FINAL',
]

const knockoutScores = reactive<Record<string, { homeScore: number | null; awayScore: number | null }>>(
  Object.fromEntries(knockoutMatchIds.map(id => [id, { homeScore: null, awayScore: null }]))
)

// --- Group standings computation from match results ---
interface TeamStanding {
  code: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
}

const groupStandings = computed(() => {
  const standings: Record<string, TeamStanding[]> = {}

  for (const group of GROUPS) {
    const groupTeams = teams.filter(t => t.group === group)
    const teamMap: Record<string, TeamStanding> = {}

    for (const team of groupTeams) {
      teamMap[team.code] = {
        code: team.code,
        played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, gd: 0, points: 0,
      }
    }

    // Process results for this group's matches
    const groupMatchList = groupMatches[group] || []
    for (const match of groupMatchList) {
      const result = scoresStore.results.find(r => r.matchId === match.id)
      if (!result || result.homeScore === null || result.awayScore === null) continue

      const home = teamMap[match.home]
      const away = teamMap[match.away]
      if (!home || !away) continue

      home.played++
      away.played++
      home.gf += result.homeScore
      home.ga += result.awayScore
      away.gf += result.awayScore
      away.ga += result.homeScore

      if (result.homeScore > result.awayScore) {
        home.won++; home.points += 3
        away.lost++
      } else if (result.homeScore < result.awayScore) {
        away.won++; away.points += 3
        home.lost++
      } else {
        home.drawn++; home.points += 1
        away.drawn++; away.points += 1
      }
    }

    // Compute GD and sort
    const sorted = Object.values(teamMap)
      .map(t => ({ ...t, gd: t.gf - t.ga }))
      .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf)

    standings[group] = sorted
  }

  return standings
})

// Check if a group has all 6 matches completed
function isGroupComplete(group: string): boolean {
  const groupMatchList = groupMatches[group] || []
  return groupMatchList.every(match =>
    scoresStore.results.some(r => r.matchId === match.id && r.homeScore !== null && r.awayScore !== null)
  )
}

// Auto-fill group winners/runners when standings are computed
watch(
  () => scoresStore.results.length,
  () => {
    for (const group of GROUPS) {
      if (!isGroupComplete(group)) continue
      const standing = groupStandings.value[group]
      if (!standing || standing.length < 2) continue
      // Only auto-fill if not already manually set
      if (!progressData[`group${group}_winner`]) {
        progressData[`group${group}_winner`] = standing[0].code
      }
      if (!progressData[`group${group}_runner`]) {
        progressData[`group${group}_runner`] = standing[1].code
      }
    }
  },
  { immediate: true }
)

// --- Third-place combination lookup ---
const thirdPlaceGroupMap = computed(() => {
  // Map: group letter → team code (from bestThird selections)
  const map: Record<string, string> = {}
  for (let i = 1; i <= 8; i++) {
    const code = progressData[`bestThird_${i}`]
    if (code) {
      const team = teamsByCode[code]
      if (team) {
        map[team.group] = code
      }
    }
  }
  return map
})

const thirdPlaceCombination = computed(() => {
  const qualifyingGroups = Object.keys(thirdPlaceGroupMap.value).sort()
  if (qualifyingGroups.length !== 8) return null
  return thirdPlaceCombinations.find(
    c => c.groups.join(',') === qualifyingGroups.join(',')
  ) ?? null
})

// --- Resolve a bracket reference to a team code ---
function resolveR32Team(ref: string): string | null {
  if (ref.startsWith('3rd_')) {
    const slot = ref.replace('3rd_', '') as keyof NonNullable<typeof thirdPlaceCombination.value>['assignments']
    const combo = thirdPlaceCombination.value
    if (!combo) return null
    const sourceGroup = combo.assignments[slot]
    if (!sourceGroup) return null
    return thirdPlaceGroupMap.value[sourceGroup] ?? null
  }
  if (ref.startsWith('1')) {
    const group = ref.slice(1)
    return progressData[`group${group}_winner`] || null
  }
  if (ref.startsWith('2')) {
    const group = ref.slice(1)
    return progressData[`group${group}_runner`] || null
  }
  return null
}

// --- Bracket options (computed) ---
const r32Options = computed(() => {
  return roundOf32Rules.map((rule, idx) => {
    const home = resolveR32Team(rule.home)
    const away = resolveR32Team(rule.away)
    const options = [home, away].filter(Boolean).map(code => teamOption(code!))
    return { matchNum: idx + 1, id: rule.id, home, away, options }
  })
})

function resolveWinnerRef(ref: string): string | null {
  // 'W-R32-1' → progressData['r32_1_winner']
  const m = ref.match(/^W-(R32|R16|QF|SF)-(\d+)$/)
  if (!m) return null
  const [, round, num] = m
  const key = `${round.toLowerCase()}_${num}_winner`
  return progressData[key] || null
}

const r16Options = computed(() => {
  return roundOf16Rules.map((rule, idx) => {
    const home = resolveWinnerRef(rule.home)
    const away = resolveWinnerRef(rule.away)
    const options = [home, away].filter(Boolean).map(code => teamOption(code!))
    return { matchNum: idx + 1, id: rule.id, home, away, options }
  })
})

const qfOptions = computed(() => {
  return quarterFinalRules.map((rule, idx) => {
    const home = resolveWinnerRef(rule.home)
    const away = resolveWinnerRef(rule.away)
    const options = [home, away].filter(Boolean).map(code => teamOption(code!))
    return { matchNum: idx + 1, id: rule.id, home, away, options }
  })
})

const sfOptions = computed(() => {
  return semiFinalRules.map((rule, idx) => {
    const home = resolveWinnerRef(rule.home)
    const away = resolveWinnerRef(rule.away)
    const options = [home, away].filter(Boolean).map(code => teamOption(code!))
    return { matchNum: idx + 1, id: rule.id, home, away, options }
  })
})

const finalOptions = computed(() => {
  const home = resolveWinnerRef(finalRule.home)
  const away = resolveWinnerRef(finalRule.away)
  const options = [home, away].filter(Boolean).map(code => teamOption(code!))
  return { home, away, options }
})

// --- Cascading invalidation ---
// When upstream changes, clear invalid downstream selections
watch(
  () => GROUPS.map(g => `${progressData[`group${g}_winner`]}|${progressData[`group${g}_runner`]}`).join(','),
  () => {
    // Validate R32 selections
    for (let i = 0; i < roundOf32Rules.length; i++) {
      const key = `r32_${i + 1}_winner`
      const val = progressData[key]
      if (val) {
        const match = r32Options.value[i]
        if (!match.options.some(o => o.value === val)) {
          delete progressData[key]
        }
      }
    }
  }
)

watch(
  () => Array.from({ length: 8 }, (_, i) => progressData[`bestThird_${i + 1}`]).join(','),
  () => {
    // Third-place changes can invalidate R32 selections that use 3rd_X slots
    for (let i = 0; i < roundOf32Rules.length; i++) {
      const rule = roundOf32Rules[i]
      if (rule.home.startsWith('3rd_') || rule.away.startsWith('3rd_')) {
        const key = `r32_${i + 1}_winner`
        const val = progressData[key]
        if (val) {
          const match = r32Options.value[i]
          if (!match.options.some(o => o.value === val)) {
            delete progressData[key]
          }
        }
      }
    }
  }
)

watch(
  () => Array.from({ length: 16 }, (_, i) => progressData[`r32_${i + 1}_winner`]).join(','),
  () => {
    for (let i = 0; i < roundOf16Rules.length; i++) {
      const key = `r16_${i + 1}_winner`
      const val = progressData[key]
      if (val) {
        const match = r16Options.value[i]
        if (!match.options.some(o => o.value === val)) {
          delete progressData[key]
        }
      }
    }
  }
)

watch(
  () => Array.from({ length: 8 }, (_, i) => progressData[`r16_${i + 1}_winner`]).join(','),
  () => {
    for (let i = 0; i < quarterFinalRules.length; i++) {
      const key = `qf_${i + 1}_winner`
      const val = progressData[key]
      if (val) {
        const match = qfOptions.value[i]
        if (!match.options.some(o => o.value === val)) {
          delete progressData[key]
        }
      }
    }
  }
)

watch(
  () => Array.from({ length: 4 }, (_, i) => progressData[`qf_${i + 1}_winner`]).join(','),
  () => {
    for (let i = 0; i < semiFinalRules.length; i++) {
      const key = `sf_${i + 1}_winner`
      const val = progressData[key]
      if (val) {
        const match = sfOptions.value[i]
        if (!match.options.some(o => o.value === val)) {
          delete progressData[key]
        }
      }
    }
  }
)

watch(
  () => `${progressData['sf_1_winner']}|${progressData['sf_2_winner']}`,
  () => {
    const val = progressData['champion']
    if (val) {
      if (!finalOptions.value.options.some(o => o.value === val)) {
        delete progressData['champion']
      }
    }
  }
)

// --- User management ---
function showResetPassword(user: AuthUser) {
  $q.dialog({
    title: t('admin.resetPassword'),
    message: `${t('admin.resetPasswordFor')} ${user.username}?`,
    prompt: { model: '', type: 'text', label: t('admin.newPassword') },
    cancel: true,
  }).onOk(async (password: string) => {
    await authStore.resetUserPassword(user.id, password)
    $q.notify({ type: 'positive', message: t('admin.passwordReset') })
  })
}

function showResetPredictions(user: AuthUser) {
  $q.dialog({
    title: t('admin.resetPredictions'),
    message: `${t('admin.resetPredictionsFor')} ${user.username}?`,
    cancel: true,
  }).onOk(async () => {
    await authStore.resetPredictions(user.id)
    $q.notify({ type: 'positive', message: t('admin.predictionsReset') })
  })
}

function showDeleteUser(user: AuthUser) {
  $q.dialog({
    title: t('common.delete'),
    message: `${t('admin.deleteUserConfirm')} ${user.username}?`,
    cancel: true,
  }).onOk(async () => {
    await authStore.deleteUser(user.id)
    $q.notify({ type: 'positive', message: t('admin.userDeleted') })
  })
}

// --- Match result saving ---
async function saveMatchResult(match: { id: string; home: string; away: string }) {
  const input = resultInputs[match.id]
  if (input.homeScore === null || input.awayScore === null) return
  const stage: MatchStage = 'group'
  await scoresStore.saveResult({
    matchId: match.id,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    stage,
    homeTeam: match.home,
    awayTeam: match.away,
  })
  $q.notify({ type: 'positive', message: `${match.id} ${t('admin.saved')}` })
}

function confirmClearResults() {
  $q.dialog({
    title: t('admin.clearAll'),
    message: t('admin.clearResultsConfirm'),
    cancel: true,
  }).onOk(async () => {
    await scoresStore.clearAllResults()
    Object.values(resultInputs).forEach(v => { v.homeScore = null; v.awayScore = null })
    $q.notify({ type: 'positive', message: t('admin.cleared') })
  })
}

async function populateTestResults() {
  $q.loading.show({ message: 'Generating test data...' })
  try {
    for (const match of allMatches) {
      const homeScore = Math.floor(Math.random() * 4)
      const awayScore = Math.floor(Math.random() * 4)
      resultInputs[match.id].homeScore = homeScore
      resultInputs[match.id].awayScore = awayScore
      await scoresStore.saveResult({
        matchId: match.id,
        homeScore,
        awayScore,
        stage: 'group' as MatchStage,
        homeTeam: match.home,
        awayTeam: match.away,
      })
    }
    $q.notify({ type: 'positive', message: `${allMatches.length} test results saved` })
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to save test data' })
  } finally {
    $q.loading.hide()
  }
}

// --- Progress saving ---
function getKnockoutStage(matchId: string): MatchStage {
  if (matchId.startsWith('R32')) return 'r32'
  if (matchId.startsWith('R16')) return 'r16'
  if (matchId.startsWith('QF')) return 'qf'
  if (matchId.startsWith('SF')) return 'sf'
  if (matchId === 'FINAL') return 'final'
  return 'group'
}

function getKnockoutMatchTeams(matchId: string): { home: string | null; away: string | null } {
  // Find the computed options for this match to get home/away teams
  if (matchId.startsWith('R32-')) {
    const idx = parseInt(matchId.replace('R32-', '')) - 1
    const match = r32Options.value[idx]
    return { home: match?.home ?? null, away: match?.away ?? null }
  }
  if (matchId.startsWith('R16-')) {
    const idx = parseInt(matchId.replace('R16-', '')) - 1
    const match = r16Options.value[idx]
    return { home: match?.home ?? null, away: match?.away ?? null }
  }
  if (matchId.startsWith('QF-')) {
    const idx = parseInt(matchId.replace('QF-', '')) - 1
    const match = qfOptions.value[idx]
    return { home: match?.home ?? null, away: match?.away ?? null }
  }
  if (matchId.startsWith('SF-')) {
    const idx = parseInt(matchId.replace('SF-', '')) - 1
    const match = sfOptions.value[idx]
    return { home: match?.home ?? null, away: match?.away ?? null }
  }
  if (matchId === 'FINAL') {
    return { home: finalOptions.value.home, away: finalOptions.value.away }
  }
  return { home: null, away: null }
}

async function saveAllProgress() {
  $q.loading.show({ message: 'Saving...' })
  try {
    // Build the save payload with derived scoring keys
    const payload: Record<string, string> = { ...progressData }

    // Derive semifinalists from QF winners
    for (let i = 1; i <= 4; i++) {
      const qfWinner = progressData[`qf_${i}_winner`]
      if (qfWinner) {
        payload[`semifinalist_${i}`] = qfWinner
      }
    }
    // Derive finalists from SF winners
    for (let i = 1; i <= 2; i++) {
      const sfWinner = progressData[`sf_${i}_winner`]
      if (sfWinner) {
        payload[`finalist_${i}`] = sfWinner
      }
    }

    // Save progress data
    await scoresStore.saveProgress(payload)

    // Save knockout match results (scores)
    for (const matchId of knockoutMatchIds) {
      const scores = knockoutScores[matchId]
      if (scores.homeScore === null || scores.awayScore === null) continue
      const { home, away } = getKnockoutMatchTeams(matchId)
      if (!home || !away) continue
      await scoresStore.saveResult({
        matchId,
        homeScore: scores.homeScore,
        awayScore: scores.awayScore,
        stage: getKnockoutStage(matchId),
        homeTeam: home,
        awayTeam: away,
      })
    }

    $q.notify({ type: 'positive', message: t('admin.saved') })
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to save' })
  } finally {
    $q.loading.hide()
  }
}

function confirmClearProgress() {
  $q.dialog({
    title: t('admin.clearAll'),
    message: t('admin.clearProgressConfirm'),
    cancel: true,
  }).onOk(async () => {
    await scoresStore.clearProgress()
    Object.keys(progressData).forEach(k => delete progressData[k])
    $q.notify({ type: 'positive', message: t('admin.cleared') })
  })
}

// --- Lifecycle ---
onMounted(async () => {
  await authStore.loadUsers()
  await scoresStore.loadAdminResults()
  // Populate resultInputs from existing results (group matches)
  for (const r of scoresStore.results) {
    if (resultInputs[r.matchId]) {
      resultInputs[r.matchId].homeScore = r.homeScore
      resultInputs[r.matchId].awayScore = r.awayScore
    }
    // Populate knockout scores from existing results
    if (knockoutScores[r.matchId]) {
      knockoutScores[r.matchId].homeScore = r.homeScore
      knockoutScores[r.matchId].awayScore = r.awayScore
    }
  }
  // Populate progress data from saved state
  Object.assign(progressData, scoresStore.bonusData)
})
</script>

<template>
  <q-page padding>
    <div class="text-h5 q-mb-md">{{ t('app.admin') }}</div>

    <q-tabs v-model="tab" align="left" active-color="primary" indicator-color="primary" outside-arrows mobile-arrows>
      <q-tab name="users" :label="t('admin.users')" />
      <q-tab name="results" :label="t('admin.matchResults')" />
      <q-tab name="progress" :label="t('admin.progress')" />
    </q-tabs>

    <q-separator />

    <q-tab-panels v-model="tab" animated>
      <!-- Users tab -->
      <q-tab-panel name="users">
        <q-list separator>
          <q-item v-for="user in authStore.userList" :key="user.id">
            <q-item-section>
              <q-item-label>{{ user.username }}</q-item-label>
              <q-item-label caption>{{ t('admin.created') }}: {{ new Date(user.createdAt).toLocaleDateString() }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-btn flat dense icon="lock_reset" @click="showResetPassword(user)" />
                <q-btn flat dense icon="restart_alt" @click="showResetPredictions(user)" />
                <q-btn flat dense icon="delete" color="negative" @click="showDeleteUser(user)" />
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-tab-panel>

      <!-- Match Results tab -->
      <q-tab-panel name="results">
        <div class="row items-center q-gutter-sm q-mb-md">
          <q-btn color="negative" :label="t('admin.clearAll')" @click="confirmClearResults" />
          <q-btn color="orange" label="Testdata" icon="science" @click="populateTestResults" />
        </div>
        <div v-for="match in allMatches" :key="match.id" class="admin-match-row">
          <div class="text-caption text-grey q-mb-xs">{{ match.id }}</div>
          <div class="row items-center no-wrap">
            <ScoreInput
              :match-id="match.id"
              :home-team="match.home"
              :away-team="match.away"
              :home-score="resultInputs[match.id].homeScore"
              :away-score="resultInputs[match.id].awayScore"
              class="col"
              @update:home-score="resultInputs[match.id].homeScore = $event"
              @update:away-score="resultInputs[match.id].awayScore = $event"
            />
            <q-btn dense flat icon="save" color="primary" class="q-ml-sm" @click="saveMatchResult(match)" />
          </div>
          <q-separator class="q-mt-sm" />
        </div>
      </q-tab-panel>

      <!-- Progress tab -->
      <q-tab-panel name="progress">
        <!-- Group Results -->
        <div class="text-h6 q-mb-sm">{{ t('admin.groupResults') }}</div>
        <div class="row q-gutter-sm q-mb-lg">
          <div v-for="group in GROUPS" :key="group" class="col-6 col-sm-4 col-md-3">
            <div class="text-subtitle2 q-mb-xs">{{ group }}</div>
            <div v-if="groupStandings[group]?.length" class="q-mb-xs">
              <div v-for="(team, idx) in groupStandings[group]" :key="team.code" class="text-caption" :class="{ 'text-bold': idx < 2 }">
                {{ idx + 1 }}. {{ teamName(team.code) }} ({{ team.points }}p, {{ team.gd > 0 ? '+' : '' }}{{ team.gd }})
              </div>
            </div>
            <q-select
              v-model="progressData[`group${group}_winner`]"
              :options="groupTeamOptions(group)"
              emit-value
              map-options
              dense
              outlined
              clearable
              :label="t('admin.winner')"
            />
            <q-select
              v-model="progressData[`group${group}_runner`]"
              :options="groupTeamOptions(group)"
              emit-value
              map-options
              dense
              outlined
              clearable
              :label="t('admin.runnerUp')"
              class="q-mt-xs"
            />
          </div>
        </div>

        <!-- Best Third Place -->
        <div class="text-h6 q-mb-sm">{{ t('admin.bestThird') }}</div>
        <div class="row q-gutter-sm q-mb-lg">
          <q-select
            v-for="i in 8"
            :key="i"
            v-model="progressData[`bestThird_${i}`]"
            :options="teamOptions"
            emit-value
            map-options
            dense
            outlined
            clearable
            :label="`#${i}`"
            style="min-width: 140px"
          />
        </div>

        <!-- Round of 32 -->
        <div class="text-h6 q-mb-sm">{{ t('admin.knockoutProgress') }} - R32</div>
        <div class="q-mb-lg">
          <div v-for="match in r32Options" :key="match.id" class="row items-center q-mb-sm">
            <div class="col-auto text-caption text-grey" style="width: 55px">{{ match.id }}</div>
            <div class="col-auto text-body2" style="min-width: 100px">
              {{ match.home ? teamName(match.home) : 'TBD' }}
            </div>
            <q-input
              v-model.number="knockoutScores[match.id].homeScore"
              type="number"
              dense
              outlined
              style="width: 50px"
              class="q-mx-xs"
              :disable="!match.home || !match.away"
            />
            <span class="text-caption q-mx-xs">-</span>
            <q-input
              v-model.number="knockoutScores[match.id].awayScore"
              type="number"
              dense
              outlined
              style="width: 50px"
              class="q-mx-xs"
              :disable="!match.home || !match.away"
            />
            <div class="col-auto text-body2" style="min-width: 100px">
              {{ match.away ? teamName(match.away) : 'TBD' }}
            </div>
            <q-icon name="arrow_right" class="q-mx-xs" />
            <q-select
              v-model="progressData[`r32_${match.matchNum}_winner`]"
              :options="match.options"
              :disable="match.options.length < 2"
              emit-value
              map-options
              dense
              outlined
              clearable
              label="Winner"
              style="min-width: 140px"
            />
          </div>
        </div>

        <!-- Round of 16 -->
        <div class="text-h6 q-mb-sm">{{ t('admin.knockoutProgress') }} - R16</div>
        <div class="q-mb-lg">
          <div v-for="match in r16Options" :key="match.id" class="row items-center q-mb-sm">
            <div class="col-auto text-caption text-grey" style="width: 55px">{{ match.id }}</div>
            <div class="col-auto text-body2" style="min-width: 100px">
              {{ match.home ? teamName(match.home) : 'TBD' }}
            </div>
            <q-input
              v-model.number="knockoutScores[match.id].homeScore"
              type="number"
              dense
              outlined
              style="width: 50px"
              class="q-mx-xs"
              :disable="!match.home || !match.away"
            />
            <span class="text-caption q-mx-xs">-</span>
            <q-input
              v-model.number="knockoutScores[match.id].awayScore"
              type="number"
              dense
              outlined
              style="width: 50px"
              class="q-mx-xs"
              :disable="!match.home || !match.away"
            />
            <div class="col-auto text-body2" style="min-width: 100px">
              {{ match.away ? teamName(match.away) : 'TBD' }}
            </div>
            <q-icon name="arrow_right" class="q-mx-xs" />
            <q-select
              v-model="progressData[`r16_${match.matchNum}_winner`]"
              :options="match.options"
              :disable="match.options.length < 2"
              emit-value
              map-options
              dense
              outlined
              clearable
              label="Winner"
              style="min-width: 140px"
            />
          </div>
        </div>

        <!-- Quarter-Finals -->
        <div class="text-h6 q-mb-sm">{{ t('admin.knockoutProgress') }} - QF</div>
        <div class="q-mb-lg">
          <div v-for="match in qfOptions" :key="match.id" class="row items-center q-mb-sm">
            <div class="col-auto text-caption text-grey" style="width: 55px">{{ match.id }}</div>
            <div class="col-auto text-body2" style="min-width: 100px">
              {{ match.home ? teamName(match.home) : 'TBD' }}
            </div>
            <q-input
              v-model.number="knockoutScores[match.id].homeScore"
              type="number"
              dense
              outlined
              style="width: 50px"
              class="q-mx-xs"
              :disable="!match.home || !match.away"
            />
            <span class="text-caption q-mx-xs">-</span>
            <q-input
              v-model.number="knockoutScores[match.id].awayScore"
              type="number"
              dense
              outlined
              style="width: 50px"
              class="q-mx-xs"
              :disable="!match.home || !match.away"
            />
            <div class="col-auto text-body2" style="min-width: 100px">
              {{ match.away ? teamName(match.away) : 'TBD' }}
            </div>
            <q-icon name="arrow_right" class="q-mx-xs" />
            <q-select
              v-model="progressData[`qf_${match.matchNum}_winner`]"
              :options="match.options"
              :disable="match.options.length < 2"
              emit-value
              map-options
              dense
              outlined
              clearable
              label="Winner"
              style="min-width: 140px"
            />
          </div>
        </div>

        <!-- Semi-Finals -->
        <div class="text-h6 q-mb-sm">{{ t('admin.knockoutProgress') }} - SF</div>
        <div class="q-mb-lg">
          <div v-for="match in sfOptions" :key="match.id" class="row items-center q-mb-sm">
            <div class="col-auto text-caption text-grey" style="width: 55px">{{ match.id }}</div>
            <div class="col-auto text-body2" style="min-width: 100px">
              {{ match.home ? teamName(match.home) : 'TBD' }}
            </div>
            <q-input
              v-model.number="knockoutScores[match.id].homeScore"
              type="number"
              dense
              outlined
              style="width: 50px"
              class="q-mx-xs"
              :disable="!match.home || !match.away"
            />
            <span class="text-caption q-mx-xs">-</span>
            <q-input
              v-model.number="knockoutScores[match.id].awayScore"
              type="number"
              dense
              outlined
              style="width: 50px"
              class="q-mx-xs"
              :disable="!match.home || !match.away"
            />
            <div class="col-auto text-body2" style="min-width: 100px">
              {{ match.away ? teamName(match.away) : 'TBD' }}
            </div>
            <q-icon name="arrow_right" class="q-mx-xs" />
            <q-select
              v-model="progressData[`sf_${match.matchNum}_winner`]"
              :options="match.options"
              :disable="match.options.length < 2"
              emit-value
              map-options
              dense
              outlined
              clearable
              label="Winner"
              style="min-width: 140px"
            />
          </div>
        </div>

        <!-- Final -->
        <div class="text-h6 q-mb-sm">{{ t('admin.knockoutProgress') }} - Final</div>
        <div class="q-mb-lg">
          <div class="row items-center q-mb-sm">
            <div class="col-auto text-caption text-grey" style="width: 55px">FINAL</div>
            <div class="col-auto text-body2" style="min-width: 100px">
              {{ finalOptions.home ? teamName(finalOptions.home) : 'TBD' }}
            </div>
            <q-input
              v-model.number="knockoutScores['FINAL'].homeScore"
              type="number"
              dense
              outlined
              style="width: 50px"
              class="q-mx-xs"
              :disable="!finalOptions.home || !finalOptions.away"
            />
            <span class="text-caption q-mx-xs">-</span>
            <q-input
              v-model.number="knockoutScores['FINAL'].awayScore"
              type="number"
              dense
              outlined
              style="width: 50px"
              class="q-mx-xs"
              :disable="!finalOptions.home || !finalOptions.away"
            />
            <div class="col-auto text-body2" style="min-width: 100px">
              {{ finalOptions.away ? teamName(finalOptions.away) : 'TBD' }}
            </div>
            <q-icon name="arrow_right" class="q-mx-xs" />
            <q-select
              v-model="progressData['champion']"
              :options="finalOptions.options"
              :disable="finalOptions.options.length < 2"
              emit-value
              map-options
              dense
              outlined
              clearable
              label="Champion"
              style="min-width: 140px"
            />
          </div>
        </div>

        <!-- Derived info display -->
        <div v-if="progressData['qf_1_winner'] || progressData['sf_1_winner'] || progressData['champion']" class="q-mb-lg">
          <q-banner rounded class="bg-blue-1">
            <div class="text-subtitle2 q-mb-xs">Auto-derived scoring keys:</div>
            <div v-if="progressData['qf_1_winner']" class="text-caption">
              Semifinalists: {{ [1,2,3,4].map(i => progressData[`qf_${i}_winner`]).filter(Boolean).map(c => teamName(c!)).join(', ') }}
            </div>
            <div v-if="progressData['sf_1_winner']" class="text-caption">
              Finalists: {{ [1,2].map(i => progressData[`sf_${i}_winner`]).filter(Boolean).map(c => teamName(c!)).join(', ') }}
            </div>
            <div v-if="progressData['champion']" class="text-caption">
              Champion: {{ teamName(progressData['champion']) }}
            </div>
          </q-banner>
        </div>

        <!-- Save / Clear buttons -->
        <div class="row q-gutter-sm">
          <q-btn color="primary" :label="t('common.save')" @click="saveAllProgress" />
          <q-btn color="negative" :label="t('admin.clearAll')" @click="confirmClearProgress" />
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

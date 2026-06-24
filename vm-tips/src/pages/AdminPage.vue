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
} from '../../shared/bracketRules'
import { thirdPlaceCombinations } from '../../shared/thirdPlaceCombinations'
import { sortGroupStandings } from '../../shared/groupSorting'
import ScoreInput from '../components/ScoreInput.vue'
import TeamFlag from '../components/TeamFlag.vue'
import { apiFetch } from '../composables/useApi'
import type { AuthUser, MatchStage } from '../types'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()
const scoresStore = useScoresStore()

const tab = ref('users')

// --- Top scorer management ---
interface TopScorerEntry {
  userId: number
  username: string
  playerName: string | null
  isCorrect: boolean
}

const topScorerEntries = ref<TopScorerEntry[]>([])
const topScorerLoading = ref(false)

async function loadTopScorerPredictions() {
  try {
    topScorerLoading.value = true
    const data = await apiFetch<{ predictions: TopScorerEntry[] }>('/api/admin/top-scorers')
    topScorerEntries.value = data.predictions ?? []
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to load top scorer predictions' })
  } finally {
    topScorerLoading.value = false
  }
}

async function saveTopScorerAwards() {
  try {
    $q.loading.show({ message: 'Saving...' })
    const awards = topScorerEntries.value.map(e => ({
      userId: e.userId,
      isCorrect: e.isCorrect,
    }))
    await apiFetch('/api/admin/top-scorers', {
      method: 'POST',
      body: { awards },
    })
    $q.notify({ type: 'positive', message: t('admin.saved') })
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to save' })
  } finally {
    $q.loading.hide()
  }
}

function addTopScorerToProgress() {
  // Find next available index
  let idx = 1
  while (progressData[`topScorer_${idx}`]) idx++
  progressData[`topScorer_${idx}`] = ''
}

function removeTopScorerFromProgress(key: string) {
  delete progressData[key]
}

const topScorerProgressKeys = computed(() => {
  return Object.keys(progressData)
    .filter(k => k.startsWith('topScorer_'))
    .sort()
})

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
  'THIRD',
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
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
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
        goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
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
      home.goalsFor += result.homeScore
      home.goalsAgainst += result.awayScore
      away.goalsFor += result.awayScore
      away.goalsAgainst += result.homeScore

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

    // Compute GD for each team
    for (const team of Object.values(teamMap)) {
      team.goalDiff = team.goalsFor - team.goalsAgainst
    }

    // Build predictions map for FIFA-compliant head-to-head tiebreaker
    const predMap: Record<string, { homeScore: number | null; awayScore: number | null }> = {}
    for (const match of groupMatchList) {
      const result = scoresStore.results.find(r => r.matchId === match.id)
      predMap[match.id] = {
        homeScore: result?.homeScore ?? null,
        awayScore: result?.awayScore ?? null,
      }
    }

    // Sort using the same FIFA-compliant function as the server
    standings[group] = sortGroupStandings(Object.values(teamMap), groupMatchList, predMap)
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

function resolveLoserRef(ref: string): string | null {
  // 'L-SF-1' → loser of SF-1 is whichever QF winner didn't win SF-1
  const m = ref.match(/^L-(SF)-(\d+)$/)
  if (!m) return null
  const [, , numStr] = m
  const num = parseInt(numStr)
  const sfWinner = progressData[`sf_${num}_winner`]
  if (!sfWinner) return null
  const qf1 = progressData[`qf_${2 * num - 1}_winner`]
  const qf2 = progressData[`qf_${2 * num}_winner`]
  if (!qf1 || !qf2) return null
  return sfWinner === qf1 ? qf2 : qf1
}

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

function confirmDeleteMatchResult(match: { id: string }) {
  $q.dialog({
    title: 'Delete result',
    message: `Clear result for ${match.id}?`,
    cancel: true,
  }).onOk(async () => {
    await scoresStore.deleteResult(match.id)
    resultInputs[match.id].homeScore = null
    resultInputs[match.id].awayScore = null
    $q.notify({ type: 'positive', message: `${match.id} deleted` })
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
  if (matchId === 'THIRD') return 'third'
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
  if (matchId === 'THIRD') {
    const home = resolveLoserRef('L-SF-1')
    const away = resolveLoserRef('L-SF-2')
    return { home, away }
  }
  if (matchId === 'FINAL') {
    return { home: finalOptions.value.home, away: finalOptions.value.away }
  }
  return { home: null, away: null }
}

function getBracketWinner(matchId: string, progress: Record<string, string>): string | undefined {
  let key: string
  if (matchId.startsWith('R32-')) key = `r32_${matchId.replace('R32-', '')}_winner`
  else if (matchId.startsWith('R16-')) key = `r16_${matchId.replace('R16-', '')}_winner`
  else if (matchId.startsWith('QF-')) key = `qf_${matchId.replace('QF-', '')}_winner`
  else if (matchId.startsWith('SF-')) key = `sf_${matchId.replace('SF-', '')}_winner`
  else if (matchId === 'FINAL') key = 'champion'
  else return undefined
  return progress[key] || undefined
}

async function saveGroupProgress(group: string) {
  const payload: Record<string, string> = {}
  const winner = progressData[`group${group}_winner`]
  const runner = progressData[`group${group}_runner`]
  if (winner) payload[`group${group}_winner`] = winner
  if (runner) payload[`group${group}_runner`] = runner
  if (!Object.keys(payload).length) return

  $q.loading.show({ message: 'Saving...' })
  try {
    await scoresStore.saveProgress(payload)
    $q.notify({ type: 'positive', message: `Group ${group} saved` })
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to save' })
  } finally {
    $q.loading.hide()
  }
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
      // For draws, derive penalty winner from bracket progress
      let penaltyWinner: string | null | undefined
      if (scores.homeScore === scores.awayScore) {
        penaltyWinner = getBracketWinner(matchId, progressData)
      }
      await scoresStore.saveResult({
        matchId,
        homeScore: scores.homeScore,
        awayScore: scores.awayScore,
        stage: getKnockoutStage(matchId),
        homeTeam: home,
        awayTeam: away,
        penaltyWinner,
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
  // Load top scorer predictions
  await loadTopScorerPredictions()
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
                <q-btn disable flat dense icon="restart_alt" @click="showResetPredictions(user)" />
                <q-btn disable flat dense icon="delete" color="negative" @click="showDeleteUser(user)" />
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-tab-panel>

      <!-- Match Results tab -->
      <q-tab-panel name="results">
        <div class="row items-center q-gutter-sm q-mb-md">
          <q-btn disable color="negative" :label="t('admin.clearAll')" @click="confirmClearResults" />
          <q-btn disable color="orange" label="Testdata" icon="science" @click="populateTestResults" />
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
            <q-btn dense flat icon="delete" color="negative" class="q-ml-xs" @click="confirmDeleteMatchResult(match)" />
          </div>
          <q-separator class="q-mt-sm" />
        </div>
      </q-tab-panel>

      <!-- Progress tab -->
      <q-tab-panel name="progress">
        <!-- Diagnostic card -->
        <q-card flat bordered class="q-mb-md bg-grey-1">
          <q-card-section class="q-py-sm">
            <div class="text-subtitle2 q-mb-sm">Prerequisite Status</div>
            <div class="row q-gutter-md">
              <div class="col-12 col-sm-6">
                <div class="text-caption text-weight-medium q-mb-xs">Group Winners &amp; Runners</div>
                <div v-for="group in GROUPS" :key="group" class="row items-center q-mt-xs">
                  <span class="text-caption text-grey" style="min-width: 28px">{{ group }}</span>
                  <q-icon v-if="progressData[`group${group}_winner`]" name="check_circle" size="16px" color="positive" class="q-mr-xs" />
                  <q-icon v-else name="cancel" size="16px" color="negative" class="q-mr-xs" />
                  <TeamFlag v-if="progressData[`group${group}_winner`]" :code="progressData[`group${group}_winner`]" size="14px" class="q-mr-xs" />
                  <q-icon name="arrow_forward" size="14px" class="q-mr-xs text-grey" />
                  <q-icon v-if="progressData[`group${group}_runner`]" name="check_circle" size="16px" color="positive" class="q-mr-xs" />
                  <q-icon v-else name="cancel" size="16px" color="negative" class="q-mr-xs" />
                  <TeamFlag v-if="progressData[`group${group}_runner`]" :code="progressData[`group${group}_runner`]" size="14px" />
                </div>
              </div>
              <div class="col-12 col-sm-6">
                <div class="text-caption text-weight-medium q-mb-xs">Third-Place Teams</div>
                <div class="row items-center q-mt-xs">
                  <span class="text-caption">Selected: {{ Object.keys(thirdPlaceGroupMap).length }}/8</span>
                  <q-icon v-if="Object.keys(thirdPlaceGroupMap).length === 8" name="check_circle" size="16px" color="positive" class="q-ml-xs" />
                  <q-icon v-else name="cancel" size="16px" color="negative" class="q-ml-xs" />
                </div>
                <div v-if="thirdPlaceCombination" class="row items-center q-mt-xs">
                  <q-icon name="check_circle" size="16px" color="positive" class="q-mr-xs" />
                  <span class="text-caption text-positive">Combination found — R32 teams will resolve</span>
                </div>
                <div v-else-if="Object.keys(thirdPlaceGroupMap).length === 8" class="row items-center q-mt-xs">
                  <q-icon name="warning" size="16px" color="warning" class="q-mr-xs" />
                  <span class="text-caption text-orange">8 teams selected but no matching combination — check for duplicate groups</span>
                </div>
                <div v-else class="row items-center q-mt-xs">
                  <q-icon name="info" size="16px" color="info" class="q-mr-xs" />
                  <span class="text-caption text-grey">Select 8 teams from different groups</span>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Group Results -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ t('admin.groupResults') }}</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="row q-gutter-sm">
              <div v-for="group in GROUPS" :key="group" class="col-12 col-sm-4 col-md-3 col-lg-2">
                <q-card flat bordered class="q-pa-sm">
                  <div class="text-subtitle2 text-center">{{ t('predictions.group') }} {{ group }}</div>
                  <div v-if="groupStandings[group]?.length" class="q-mb-xs">
                    <div v-for="(team, idx) in groupStandings[group]" :key="team.code" class="row items-center q-mt-xs" :class="{ 'text-weight-bold': idx < 2 }">
                      <TeamFlag :code="team.code" size="14px" class="q-mr-xs" />
                      <span class="text-caption">{{ idx + 1 }}. {{ teamName(team.code) }} ({{ team.points }}p)</span>
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
                    class="q-mt-sm"
                  >
                    <template #option="scope">
                      <q-item v-bind="scope.itemProps">
                        <q-item-section avatar>
                          <TeamFlag :code="scope.opt.value" size="20px" />
                        </q-item-section>
                        <q-item-section>{{ scope.opt.label }}</q-item-section>
                      </q-item>
                    </template>
                    <template #selected-item="scope">
                      <div class="row items-center no-wrap q-gutter-xs">
                        <TeamFlag :code="scope.opt.value" size="16px" />
                        <span>{{ scope.opt.label }}</span>
                      </div>
                    </template>
                  </q-select>
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
                  >
                    <template #option="scope">
                      <q-item v-bind="scope.itemProps">
                        <q-item-section avatar>
                          <TeamFlag :code="scope.opt.value" size="20px" />
                        </q-item-section>
                        <q-item-section>{{ scope.opt.label }}</q-item-section>
                      </q-item>
                    </template>
                    <template #selected-item="scope">
                      <div class="row items-center no-wrap q-gutter-xs">
                        <TeamFlag :code="scope.opt.value" size="16px" />
                        <span>{{ scope.opt.label }}</span>
                      </div>
                    </template>
                  </q-select>
                  <div class="row justify-end q-mt-xs">
                    <q-btn dense flat icon="save" color="primary" size="sm" @click="saveGroupProgress(group)" />
                  </div>
                </q-card>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Best Third Place -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ t('admin.bestThird') }}</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="row q-gutter-sm">
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
              >
                <template #option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section avatar>
                      <TeamFlag :code="scope.opt.value" size="20px" />
                    </q-item-section>
                    <q-item-section>{{ scope.opt.label }}</q-item-section>
                  </q-item>
                </template>
                <template #selected-item="scope">
                  <div class="row items-center no-wrap q-gutter-xs">
                    <TeamFlag :code="scope.opt.value" size="16px" />
                    <span>{{ scope.opt.label }}</span>
                  </div>
                </template>
              </q-select>
            </div>
          </q-card-section>
        </q-card>

        <!-- Round of 32 -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ t('admin.knockoutProgress') }} - R32</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div v-for="match in r32Options" :key="match.id" class="row q-mb-sm q-pa-sm items-center" style="border: 1px solid rgba(0,0,0,0.08); border-radius: 4px;">
              <div class="col-12 col-sm-auto text-caption text-grey q-py-xs" style="min-width: 55px">{{ match.id }}</div>
              <div class="col-12 col-sm">
                <ScoreInput
                  :match-id="match.id"
                  :home-team="match.home ?? 'UN'"
                  :away-team="match.away ?? 'UN'"
                  :home-score="knockoutScores[match.id].homeScore"
                  :away-score="knockoutScores[match.id].awayScore"
                  :disabled="!match.home || !match.away"
                  @update:home-score="knockoutScores[match.id].homeScore = $event"
                  @update:away-score="knockoutScores[match.id].awayScore = $event"
                />
              </div>
              <div class="col-12 col-sm-auto row items-center no-wrap q-gutter-xs q-pt-xs q-pt-sm-none">
                <q-icon name="arrow_forward" />
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
                  style="min-width: 130px"
                >
                  <template #option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section avatar>
                        <TeamFlag :code="scope.opt.value" size="20px" />
                      </q-item-section>
                      <q-item-section>{{ scope.opt.label }}</q-item-section>
                    </q-item>
                  </template>
                  <template #selected-item="scope">
                    <div class="row items-center no-wrap q-gutter-xs">
                      <TeamFlag :code="scope.opt.value" size="16px" />
                      <span>{{ scope.opt.label }}</span>
                    </div>
                  </template>
                </q-select>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Round of 16 -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ t('admin.knockoutProgress') }} - R16</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div v-for="match in r16Options" :key="match.id" class="row q-mb-sm q-pa-sm items-center" style="border: 1px solid rgba(0,0,0,0.08); border-radius: 4px;">
              <div class="col-12 col-sm-auto text-caption text-grey q-py-xs" style="min-width: 55px">{{ match.id }}</div>
              <div class="col-12 col-sm">
                <ScoreInput
                  :match-id="match.id"
                  :home-team="match.home ?? 'UN'"
                  :away-team="match.away ?? 'UN'"
                  :home-score="knockoutScores[match.id].homeScore"
                  :away-score="knockoutScores[match.id].awayScore"
                  :disabled="!match.home || !match.away"
                  @update:home-score="knockoutScores[match.id].homeScore = $event"
                  @update:away-score="knockoutScores[match.id].awayScore = $event"
                />
              </div>
              <div class="col-12 col-sm-auto row items-center no-wrap q-gutter-xs q-pt-xs q-pt-sm-none">
                <q-icon name="arrow_forward" />
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
                  style="min-width: 130px"
                >
                  <template #option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section avatar>
                        <TeamFlag :code="scope.opt.value" size="20px" />
                      </q-item-section>
                      <q-item-section>{{ scope.opt.label }}</q-item-section>
                    </q-item>
                  </template>
                  <template #selected-item="scope">
                    <div class="row items-center no-wrap q-gutter-xs">
                      <TeamFlag :code="scope.opt.value" size="16px" />
                      <span>{{ scope.opt.label }}</span>
                    </div>
                  </template>
                </q-select>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Quarter-Finals -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ t('admin.knockoutProgress') }} - QF</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div v-for="match in qfOptions" :key="match.id" class="row q-mb-sm q-pa-sm items-center" style="border: 1px solid rgba(0,0,0,0.08); border-radius: 4px;">
              <div class="col-12 col-sm-auto text-caption text-grey q-py-xs" style="min-width: 55px">{{ match.id }}</div>
              <div class="col-12 col-sm">
                <ScoreInput
                  :match-id="match.id"
                  :home-team="match.home ?? 'UN'"
                  :away-team="match.away ?? 'UN'"
                  :home-score="knockoutScores[match.id].homeScore"
                  :away-score="knockoutScores[match.id].awayScore"
                  :disabled="!match.home || !match.away"
                  @update:home-score="knockoutScores[match.id].homeScore = $event"
                  @update:away-score="knockoutScores[match.id].awayScore = $event"
                />
              </div>
              <div class="col-12 col-sm-auto row items-center no-wrap q-gutter-xs q-pt-xs q-pt-sm-none">
                <q-icon name="arrow_forward" />
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
                  style="min-width: 130px"
                >
                  <template #option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section avatar>
                        <TeamFlag :code="scope.opt.value" size="20px" />
                      </q-item-section>
                      <q-item-section>{{ scope.opt.label }}</q-item-section>
                    </q-item>
                  </template>
                  <template #selected-item="scope">
                    <div class="row items-center no-wrap q-gutter-xs">
                      <TeamFlag :code="scope.opt.value" size="16px" />
                      <span>{{ scope.opt.label }}</span>
                    </div>
                  </template>
                </q-select>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Semi-Finals -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ t('admin.knockoutProgress') }} - SF</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div v-for="match in sfOptions" :key="match.id" class="row q-mb-sm q-pa-sm items-center" style="border: 1px solid rgba(0,0,0,0.08); border-radius: 4px;">
              <div class="col-12 col-sm-auto text-caption text-grey q-py-xs" style="min-width: 55px">{{ match.id }}</div>
              <div class="col-12 col-sm">
                <ScoreInput
                  :match-id="match.id"
                  :home-team="match.home ?? 'UN'"
                  :away-team="match.away ?? 'UN'"
                  :home-score="knockoutScores[match.id].homeScore"
                  :away-score="knockoutScores[match.id].awayScore"
                  :disabled="!match.home || !match.away"
                  @update:home-score="knockoutScores[match.id].homeScore = $event"
                  @update:away-score="knockoutScores[match.id].awayScore = $event"
                />
              </div>
              <div class="col-12 col-sm-auto row items-center no-wrap q-gutter-xs q-pt-xs q-pt-sm-none">
                <q-icon name="arrow_forward" />
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
                  style="min-width: 130px"
                >
                  <template #option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section avatar>
                        <TeamFlag :code="scope.opt.value" size="20px" />
                      </q-item-section>
                      <q-item-section>{{ scope.opt.label }}</q-item-section>
                    </q-item>
                  </template>
                  <template #selected-item="scope">
                    <div class="row items-center no-wrap q-gutter-xs">
                      <TeamFlag :code="scope.opt.value" size="16px" />
                      <span>{{ scope.opt.label }}</span>
                    </div>
                  </template>
                </q-select>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Third-place match -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ t('admin.knockoutProgress') }} - {{ t('help.thirdPlaceMatch') }}</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="row q-mb-sm q-pa-sm items-center" style="border: 1px solid rgba(0,0,0,0.08); border-radius: 4px;">
              <div class="col-12 col-sm-auto text-caption text-grey q-py-xs" style="min-width: 55px">THIRD</div>
              <div class="col-12 col-sm">
                <ScoreInput
                  match-id="THIRD"
                  :home-team="resolveLoserRef('L-SF-1') ?? 'UN'"
                  :away-team="resolveLoserRef('L-SF-2') ?? 'UN'"
                  :home-score="knockoutScores['THIRD'].homeScore"
                  :away-score="knockoutScores['THIRD'].awayScore"
                  :disabled="!resolveLoserRef('L-SF-1') || !resolveLoserRef('L-SF-2')"
                  @update:home-score="knockoutScores['THIRD'].homeScore = $event"
                  @update:away-score="knockoutScores['THIRD'].awayScore = $event"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Final -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ t('admin.knockoutProgress') }} - Final</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div class="row q-mb-sm q-pa-sm items-center" style="border: 1px solid rgba(0,0,0,0.08); border-radius: 4px;">
              <div class="col-12 col-sm-auto text-caption text-grey q-py-xs" style="min-width: 55px">FINAL</div>
              <div class="col-12 col-sm">
                <ScoreInput
                  match-id="FINAL"
                  :home-team="finalOptions.home ?? 'UN'"
                  :away-team="finalOptions.away ?? 'UN'"
                  :home-score="knockoutScores['FINAL'].homeScore"
                  :away-score="knockoutScores['FINAL'].awayScore"
                  :disabled="!finalOptions.home || !finalOptions.away"
                  @update:home-score="knockoutScores['FINAL'].homeScore = $event"
                  @update:away-score="knockoutScores['FINAL'].awayScore = $event"
                />
              </div>
              <div class="col-12 col-sm-auto row items-center no-wrap q-gutter-xs q-pt-xs q-pt-sm-none">
                <q-icon name="arrow_forward" />
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
                  style="min-width: 130px"
                >
                  <template #option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section avatar>
                        <TeamFlag :code="scope.opt.value" size="20px" />
                      </q-item-section>
                      <q-item-section>{{ scope.opt.label }}</q-item-section>
                    </q-item>
                  </template>
                  <template #selected-item="scope">
                    <div class="row items-center no-wrap q-gutter-xs">
                      <TeamFlag :code="scope.opt.value" size="16px" />
                      <span>{{ scope.opt.label }}</span>
                    </div>
                  </template>
                </q-select>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <!-- Derived info display -->
        <q-card v-if="progressData['qf_1_winner'] || progressData['sf_1_winner'] || progressData['champion']" flat bordered class="q-mb-md bg-blue-1">
          <q-card-section>
            <div class="text-subtitle2 q-mb-xs">Auto-derived scoring keys:</div>
            <div v-if="progressData['qf_1_winner']" class="row items-center no-wrap q-mt-xs">
              <span class="text-caption text-weight-medium" style="min-width: 120px">Semifinalists:</span>
              <template v-for="i in 4" :key="i">
                <template v-if="progressData[`qf_${i}_winner`]">
                  <TeamFlag :code="progressData[`qf_${i}_winner`]" size="16px" class="q-mx-xs" />
                  <span class="text-caption">{{ teamName(progressData[`qf_${i}_winner`]) }}</span>
                  <span v-if="i < 4 && [2,3].filter(j => progressData[`qf_${j}_winner`]).length" class="q-mx-xs text-grey">·</span>
                </template>
              </template>
            </div>
            <div v-if="progressData['sf_1_winner']" class="row items-center no-wrap q-mt-xs">
              <span class="text-caption text-weight-medium" style="min-width: 120px">Finalists:</span>
              <template v-for="i in 2" :key="i">
                <template v-if="progressData[`sf_${i}_winner`]">
                  <TeamFlag :code="progressData[`sf_${i}_winner`]" size="16px" class="q-mx-xs" />
                  <span class="text-caption">{{ teamName(progressData[`sf_${i}_winner`]) }}</span>
                  <span v-if="i < 2 && progressData[`sf_2_winner`]" class="q-mx-xs text-grey">·</span>
                </template>
              </template>
            </div>
            <div v-if="progressData['champion']" class="row items-center no-wrap q-mt-xs">
              <span class="text-caption text-weight-medium" style="min-width: 120px">Champion:</span>
              <TeamFlag :code="progressData['champion']" size="16px" class="q-mx-xs" />
              <span class="text-caption text-weight-bold">{{ teamName(progressData['champion']) }}</span>
            </div>
          </q-card-section>
        </q-card>

        <!-- Actual Top Scorers -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ t('admin.actualTopScorers') }}</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <div v-for="key in topScorerProgressKeys" :key="key" class="row items-center q-mb-sm">
              <q-input
                v-model="progressData[key]"
                dense
                outlined
                :placeholder="t('admin.addTopScorer')"
                style="min-width: 200px"
                class="col"
              />
              <q-btn flat dense icon="close" color="negative" class="q-ml-sm" @click="removeTopScorerFromProgress(key)" />
            </div>
            <q-btn flat dense icon="add" :label="t('admin.addTopScorer')" color="primary" @click="addTopScorerToProgress" />
          </q-card-section>
        </q-card>

        <!-- Award Top Scorer Predictions -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-h6">{{ t('admin.awardTopScorer') }}</div>
          </q-card-section>
          <q-card-section class="q-pt-none">
            <q-inner-loading :showing="topScorerLoading" />
            <div v-if="topScorerEntries.length === 0 && !topScorerLoading" class="text-grey-6">
              No predictions yet
            </div>
            <q-list v-else separator bordered class="rounded-borders">
              <q-item v-for="entry in topScorerEntries" :key="entry.userId">
                <q-item-section>
                  <q-item-label>{{ entry.username }}</q-item-label>
                  <q-item-label caption>{{ entry.playerName }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    v-model="entry.isCorrect"
                    :label="t('admin.markCorrect')"
                    color="positive"
                  />
                </q-item-section>
              </q-item>
            </q-list>
            <q-btn
              v-if="topScorerEntries.length > 0"
              color="primary"
              :label="t('common.save')"
              class="q-mt-sm"
              @click="saveTopScorerAwards"
            />
          </q-card-section>
        </q-card>

        <!-- Save / Clear buttons -->
        <div class="row q-gutter-sm q-mb-md">
          <q-btn color="primary" :label="t('common.save')" @click="saveAllProgress" />
          <q-btn color="negative" :label="t('admin.clearAll')" @click="confirmClearProgress" />
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

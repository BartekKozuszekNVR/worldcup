<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../stores/auth'
import { useScoresStore } from '../stores/scores'
import { groupMatches, GROUPS } from '../data/groupMatches'
import { teams } from '../data/teams'
import ScoreInput from '../components/ScoreInput.vue'
import type { AuthUser, MatchStage } from '../types'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()
const scoresStore = useScoresStore()

const tab = ref('users')

const teamOptions = teams.map(t => ({ label: t.name, value: t.code }))

function groupTeamOptions(group: string) {
  return teams
    .filter(t => t.group === group)
    .map(t => ({ label: t.name, value: t.code }))
}

// Flatten all group matches
const allMatches = Object.entries(groupMatches).flatMap(([, matches]) =>
  matches.map(m => ({ ...m }))
)

const resultInputs = reactive<Record<string, { homeScore: number | null; awayScore: number | null }>>(
  Object.fromEntries(allMatches.map(m => [m.id, { homeScore: null, awayScore: null }]))
)

const progressData = reactive<Record<string, string>>({})

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
    $q.notify({ type: 'positive', message: t('admin.cleared') })
  })
}

async function saveAllProgress() {
  await scoresStore.saveProgress(progressData)
  $q.notify({ type: 'positive', message: t('admin.saved') })
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

onMounted(async () => {
  await authStore.loadUsers()
  await scoresStore.loadAdminResults()
  // Populate resultInputs from existing results
  for (const r of scoresStore.results) {
    if (resultInputs[r.matchId]) {
      resultInputs[r.matchId].homeScore = r.homeScore
      resultInputs[r.matchId].awayScore = r.awayScore
    }
  }
  // Populate progress data
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
        <div class="row items-center q-mb-md">
          <q-btn color="negative" :label="t('admin.clearAll')" @click="confirmClearResults" />
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
        <div class="text-h6 q-mb-sm">{{ t('admin.bestThird') }}</div>
        <div class="row q-gutter-sm q-mb-md">
          <q-select
            v-for="i in 8"
            :key="i"
            v-model="progressData[`third_${i}`]"
            :options="teamOptions"
            emit-value
            map-options
            dense
            outlined
            :label="`#${i}`"
            style="min-width: 140px"
          />
        </div>

        <div class="text-h6 q-mb-sm">{{ t('admin.groupResults') }}</div>
        <div class="row q-gutter-sm q-mb-md">
          <div v-for="group in GROUPS" :key="group" class="col-6 col-sm-4 col-md-3">
            <q-select
              v-model="progressData[`winner_${group}`]"
              :options="groupTeamOptions(group)"
              emit-value
              map-options
              dense
              outlined
              clearable
              :label="`${group} ${t('admin.winner')}`"
            />
            <q-select
              v-model="progressData[`runner_${group}`]"
              :options="groupTeamOptions(group)"
              emit-value
              map-options
              dense
              outlined
              clearable
              :label="`${group} ${t('admin.runnerUp')}`"
              class="q-mt-xs"
            />
          </div>
        </div>

        <div class="text-h6 q-mb-sm">{{ t('admin.knockoutProgress') }}</div>
        <div class="row q-gutter-sm q-mb-md">
          <q-input v-for="i in 4" :key="`sf${i}`" v-model="progressData[`sf_${i}`]" :label="`SF ${i}`" dense outlined style="width:140px" />
        </div>
        <div class="row q-gutter-sm q-mb-md">
          <q-input v-for="i in 2" :key="`f${i}`" v-model="progressData[`final_${i}`]" :label="`Final ${i}`" dense outlined style="width:140px" />
        </div>
        <div class="row q-gutter-sm q-mb-md">
          <q-input v-model="progressData['champion']" :label="t('admin.champion')" dense outlined style="width:140px" />
        </div>

        <div class="row q-gutter-sm">
          <q-btn color="primary" :label="t('common.save')" @click="saveAllProgress" />
          <q-btn color="negative" :label="t('admin.clearAll')" @click="confirmClearProgress" />
        </div>
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

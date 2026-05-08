<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { useLeaderboardStore } from '../stores/leaderboard'
import { useAuthStore } from '../stores/auth'
import confetti from 'canvas-confetti'

const { t } = useI18n()
const $q = useQuasar()
const store = useLeaderboardStore()
const authStore = useAuthStore()
const search = ref('')
const celebrated = ref(false)

interface RankedEntry {
  rank: number
  userId: number
  username: string
  avatarUrl?: string | null
  totalPoints: number
  matchPoints: number
  bonusPoints: number
  exactScores: number
  correctResults: number
  halfScoreCorrect: number
  correctOutcomes: number
  predictionCount: number
}

const rankedEntries = computed<RankedEntry[]>(() =>
  store.entries.map((e) => ({ ...e }))
)

const filteredEntries = computed(() => {
  if (!search.value) return rankedEntries.value
  const q = search.value.toLowerCase()
  return rankedEntries.value.filter(e => e.username.toLowerCase().includes(q))
})

const isFirstPlace = computed(() => {
  if (!authStore.user || !rankedEntries.value.length) return false
  return rankedEntries.value[0].userId === authStore.user.id
})

const columns = computed(() => [
  { name: 'rank', label: t('leaderboard.rank'), field: 'rank', align: 'center' as const, sortable: true },
  { name: 'user', label: t('leaderboard.user'), field: 'username', align: 'left' as const },
  { name: 'points', label: t('leaderboard.points'), field: 'totalPoints', align: 'center' as const, sortable: true },
  { name: 'exact', label: t('leaderboard.exact'), field: 'exactScores', align: 'center' as const },
  { name: 'result', label: t('leaderboard.correct'), field: 'correctResults', align: 'center' as const },
  { name: 'half', label: t('leaderboard.half'), field: 'halfScoreCorrect', align: 'center' as const },
  { name: 'outcome', label: t('leaderboard.outcome'), field: 'correctOutcomes', align: 'center' as const },
])

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

function celebrate() {
  confetti({
    particleCount: 300,
    spread: 120,
    colors: ['#FFD700', '#FFA500', '#FFEC8B', '#DAA520', '#B8860B'],
  })
}

onMounted(async () => {
  await store.loadLeaderboard()
  if (isFirstPlace.value && !celebrated.value) {
    celebrated.value = true
    celebrate()
  }
})
</script>

<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5">{{ t('leaderboard.title') }}</div>
      <q-space />
      <q-btn flat icon="refresh" :loading="store.loading" @click="store.refreshLeaderboard()" />
    </div>

    <q-input
      v-model="search"
      :placeholder="t('leaderboard.search')"
      dense
      outlined
      bg-color="white"
      clearable
      class="q-mb-md"
    >
      <template #prepend><q-icon name="search" /></template>
    </q-input>

    <q-inner-loading :showing="store.loading" />

    <!-- Desktop table -->
    <q-table
      v-if="$q.screen.gt.xs"
      :rows="filteredEntries"
      :columns="columns"
      row-key="userId"
      flat
      bordered
      :pagination="{ rowsPerPage: 50 }"
      hide-pagination
    >
      <template #body-cell-rank="props">
        <q-td :props="props">
          <img v-if="props.row.rank === 1" src="/favicon.ico" style="width: 24px; height: 24px;" />
          <q-icon v-else-if="props.row.rank === 2" name="emoji_events" color="grey-6" size="md" />
          <q-icon v-else-if="props.row.rank === 3" name="emoji_events" color="deep-orange" size="md" />
          <span v-else>#{{ props.row.rank }}</span>
        </q-td>
      </template>
      <template #body-cell-user="props">
        <q-td :props="props">
          <div class="row items-center q-gutter-sm">
            <q-avatar size="28px">
              <img v-if="props.row.avatarUrl" :src="props.row.avatarUrl" />
              <span v-else class="text-caption">{{ initials(props.row.username) }}</span>
            </q-avatar>
            <span>{{ props.row.username }}</span>
            <q-badge v-if="props.row.predictionCount" color="grey" :label="props.row.predictionCount" />
          </div>
        </q-td>
      </template>
    </q-table>

    <!-- Mobile cards -->
    <div v-else>
      <q-card v-for="entry in filteredEntries" :key="entry.userId" class="q-mb-sm">
        <q-card-section class="row items-center">
          <div class="q-mr-md">
            <img v-if="entry.rank === 1" src="/favicon.ico" style="width: 32px; height: 32px;" />
            <q-icon v-else-if="entry.rank === 2" name="emoji_events" color="grey-6" size="md" />
            <q-icon v-else-if="entry.rank === 3" name="emoji_events" color="deep-orange" size="md" />
            <span v-else class="text-h6">#{{ entry.rank }}</span>
          </div>
          <q-avatar size="36px" class="q-mr-sm">
            <img v-if="entry.avatarUrl" :src="entry.avatarUrl" />
            <span v-else>{{ initials(entry.username) }}</span>
          </q-avatar>
          <div class="col">
            <div class="text-subtitle1">{{ entry.username }}</div>
            <div class="text-caption">
              {{ t('leaderboard.points') }}: {{ entry.totalPoints }} |
              {{ t('leaderboard.exact') }}: {{ entry.exactScores }}
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Celebrate button -->
    <q-page-sticky v-if="isFirstPlace" position="bottom-right" :offset="[18, 18]">
      <q-btn fab icon="celebration" color="amber" text-color="dark" @click="celebrate" />
    </q-page-sticky>
  </q-page>
</template>

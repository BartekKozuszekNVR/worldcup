import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LeaderboardEntry } from '../types'
import { apiFetch } from '../composables/useApi'

export const useLeaderboardStore = defineStore('leaderboard', () => {
  const entries = ref<LeaderboardEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadLeaderboard() {
    try {
      loading.value = true
      error.value = null
      entries.value = await apiFetch<LeaderboardEntry[]>('/api/leaderboard')
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function refreshLeaderboard() {
    try {
      loading.value = true
      error.value = null
      await apiFetch('/api/leaderboard/refresh', { method: 'POST' })
      await loadLeaderboard()
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return {
    entries,
    loading,
    error,
    loadLeaderboard,
    refreshLeaderboard,
  }
})

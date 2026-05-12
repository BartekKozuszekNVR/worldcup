import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MatchResult, MatchStage } from '../types'
import { apiFetch } from '../composables/useApi'

export interface UserPoints {
  totalPoints: number
  matchPoints: number
  bonusPoints: number
  scores: Record<string, { points: number; type: string }>
}

export interface TopScorerInfo {
  prediction: string | null
  isCorrect: boolean
  points: number
  actualTopScorers: string[]
}

export const useScoresStore = defineStore('scores', () => {
  const results = ref<MatchResult[]>([])
  const bonusData = ref<Record<string, string>>({})
  const userPoints = ref<UserPoints>({
    totalPoints: 0,
    matchPoints: 0,
    bonusPoints: 0,
    scores: {},
  })
  const topScorerInfo = ref<TopScorerInfo>({
    prediction: null,
    isCorrect: false,
    points: 0,
    actualTopScorers: [],
  })
  const loading = ref(false)

  async function loadResults() {
    try {
      loading.value = true
      const data = await apiFetch<{
        results: MatchResult[]
        bonusData?: Record<string, string>
        userPoints?: UserPoints
        topScorer?: TopScorerInfo
      }>('/api/results')
      results.value = data.results ?? []
      bonusData.value = data.bonusData ?? {}
      if (data.userPoints) {
        userPoints.value = data.userPoints
      }
      if (data.topScorer) {
        topScorerInfo.value = data.topScorer
      }
    } finally {
      loading.value = false
    }
  }

  async function loadAdminResults() {
    try {
      loading.value = true
      const data = await apiFetch<{
        results: MatchResult[]
        bonusData?: Record<string, string>
      }>('/api/admin/results')
      results.value = data.results ?? []
      bonusData.value = data.bonusData ?? {}
    } finally {
      loading.value = false
    }
  }

  async function saveResult(params: {
    matchId: string
    homeScore: number
    awayScore: number
    stage: MatchStage
    homeTeam?: string
    awayTeam?: string
  }) {
    await apiFetch('/api/admin/results', {
      method: 'POST',
      body: params,
    })
  }

  async function clearAllResults() {
    await apiFetch('/api/admin/results', { method: 'DELETE' })
    results.value = []
  }

  async function saveProgress(data: Record<string, string>) {
    const entries = Object.entries(data)
      .filter(([, v]) => v && v.length > 0)
      .map(([key, teamCode]) => ({ key, teamCode }))
    await apiFetch('/api/admin/progress', {
      method: 'POST',
      body: { entries },
    })
    bonusData.value = data
  }

  async function clearProgress() {
    await apiFetch('/api/admin/progress', { method: 'DELETE' })
    bonusData.value = {}
  }

  return {
    results,
    bonusData,
    userPoints,
    topScorerInfo,
    loading,
    loadResults,
    loadAdminResults,
    saveResult,
    clearAllResults,
    saveProgress,
    clearProgress,
  }
})

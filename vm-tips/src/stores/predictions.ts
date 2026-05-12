import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { KnockoutPrediction } from '../types'
import { apiFetch } from '../composables/useApi'

export const usePredictionsStore = defineStore('predictions', () => {
  const predictions = ref<Record<string, { homeScore: number | null; awayScore: number | null }>>({})
  const knockoutPredictions = ref<Record<string, KnockoutPrediction>>({})
  const tiebreakerOverrides = ref<Record<string, number>>({})
  const topScorer = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadPredictions() {
    try {
      loading.value = true
      error.value = null
      const data = await apiFetch<{
        predictions: Record<string, { homeScore: number | null; awayScore: number | null }>
        knockoutPredictions: Record<string, KnockoutPrediction>
        thirdPlaceOverrides?: Record<string, number>
        topScorer?: string | null
      }>('/api/predictions')
      predictions.value = data.predictions ?? {}
      knockoutPredictions.value = data.knockoutPredictions ?? {}
      tiebreakerOverrides.value = data.thirdPlaceOverrides ?? {}
      topScorer.value = data.topScorer ?? null
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function savePredictions() {
    try {
      loading.value = true
      error.value = null
      await apiFetch('/api/predictions', {
        method: 'POST',
        body: {
          predictions: predictions.value,
          knockoutPredictions: knockoutPredictions.value,
          thirdPlaceOverrides: tiebreakerOverrides.value,
          topScorer: topScorer.value,
        },
      })
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearPredictions() {
    predictions.value = {}
    knockoutPredictions.value = {}
    tiebreakerOverrides.value = {}
    topScorer.value = null
  }

  return {
    predictions,
    knockoutPredictions,
    tiebreakerOverrides,
    topScorer,
    loading,
    error,
    loadPredictions,
    savePredictions,
    clearPredictions,
  }
})

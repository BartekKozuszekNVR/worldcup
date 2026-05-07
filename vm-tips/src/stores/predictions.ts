import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { KnockoutPrediction } from '../types'
import { apiFetch } from '../composables/useApi'

export const usePredictionsStore = defineStore('predictions', () => {
  const predictions = ref<Record<string, { homeScore: number | null; awayScore: number | null }>>({})
  const knockoutPredictions = ref<Record<string, KnockoutPrediction>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadPredictions() {
    try {
      loading.value = true
      error.value = null
      const data = await apiFetch<{
        predictions: Record<string, { homeScore: number | null; awayScore: number | null }>
        knockoutPredictions: Record<string, KnockoutPrediction>
      }>('/api/predictions')
      predictions.value = data.predictions ?? {}
      knockoutPredictions.value = data.knockoutPredictions ?? {}
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
  }

  return {
    predictions,
    knockoutPredictions,
    loading,
    error,
    loadPredictions,
    savePredictions,
    clearPredictions,
  }
})

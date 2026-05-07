<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  totalPoints: number
  matchPoints: number
  bonusPoints: number
}>()

const { t } = useI18n()
</script>

<template>
  <div class="row q-gutter-md">
    <div class="col-12 col-sm">
      <q-card class="text-center">
        <q-card-section>
          <q-icon name="stars" size="md" color="primary" />
          <div class="text-h4 text-primary q-mt-sm">{{ totalPoints }}</div>
          <div class="text-caption">{{ t('results.totalPoints') }}</div>
        </q-card-section>
      </q-card>
    </div>
    <div class="col-12 col-sm">
      <q-card class="text-center">
        <q-card-section>
          <q-icon name="sports_soccer" size="md" color="secondary" />
          <div class="text-h4 text-secondary q-mt-sm">{{ matchPoints }}</div>
          <div class="text-caption">{{ t('results.matchPoints') }}</div>
        </q-card-section>
      </q-card>
    </div>
    <div class="col-12 col-sm">
      <q-card class="text-center">
        <q-card-section>
          <q-icon name="card_giftcard" size="md" color="accent" />
          <div class="text-h4 text-accent q-mt-sm">{{ bonusPoints }}</div>
          <div class="text-caption">{{ t('results.bonusPoints') }}</div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

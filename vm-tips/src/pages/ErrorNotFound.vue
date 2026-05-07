<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <q-page class="flex flex-center">
    <div class="text-center">
      <div class="text-h1 text-weight-bold text-grey-4">404</div>
      <div class="text-h5 q-mt-md text-grey-7">{{ t('errors.pageNotFound') }}</div>
      <q-btn
        color="primary"
        :label="t('errors.goHome')"
        class="q-mt-lg"
        @click="router.push('/')"
      />
    </div>
  </q-page>
</template>

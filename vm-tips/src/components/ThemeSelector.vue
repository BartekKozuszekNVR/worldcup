<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAppStore } from '../stores/app'

const { t } = useI18n()
const appStore = useAppStore()
</script>

<template>
  <div>
    <q-select
      :model-value="appStore.themeId"
      :options="appStore.themes"
      option-value="id"
      option-label="name"
      emit-value
      map-options
      :label="t('profile.theme')"
      outlined
      @update:model-value="appStore.setTheme($event)"
    >
      <template #option="{ opt, itemProps }">
        <q-item v-bind="itemProps">
          <q-item-section>
            <q-item-label>{{ opt.name }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row q-gutter-xs">
              <div
                v-for="(color, i) in opt.colors"
                :key="i"
                :style="{ background: color, width: '16px', height: '16px', borderRadius: '50%' }"
              />
            </div>
          </q-item-section>
        </q-item>
      </template>
      <template #selected-item="{ opt }">
        <span v-if="opt">
          {{ opt.name }}
          <span class="q-ml-sm">
            <span
              v-for="(color, i) in opt.colors"
              :key="i"
              :style="{ background: color, width: '12px', height: '12px', borderRadius: '50%', display: 'inline-block', marginLeft: '2px' }"
            />
          </span>
        </span>
      </template>
    </q-select>

    <div v-if="appStore.currentTheme" class="row q-gutter-md q-mt-md justify-center">
      <div
        v-for="(color, i) in appStore.currentTheme.colors"
        :key="i"
        class="text-center"
      >
        <div :style="{ background: color, width: '48px', height: '48px', borderRadius: '8px' }" />
        <div class="text-caption q-mt-xs">{{ color }}</div>
      </div>
    </div>
  </div>
</template>

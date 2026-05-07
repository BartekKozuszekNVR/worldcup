<script setup lang="ts">
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-page-container>
      <q-page class="flex flex-center" style="background: var(--q-page-bg, #f5f5f5)">
        <div class="column items-center q-gutter-md" style="width: 100%; max-width: 400px">
          <div class="text-h4 text-primary text-weight-bold q-mb-md">
            VM Tips 2026
          </div>
          <q-card class="full-width q-pa-md" flat bordered>
            <router-view />
          </q-card>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

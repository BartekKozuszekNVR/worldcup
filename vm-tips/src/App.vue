<script setup lang="ts">
import { useAppStore } from './stores/app'

// Initialize theme on app boot
useAppStore()
</script>

<template>
  <suspense>
    <router-view />
  </suspense>
</template>

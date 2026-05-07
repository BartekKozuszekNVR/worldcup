<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  code: string
  size?: string
}>(), {
  size: '24px',
})

const hasError = ref(false)

const src = () => `/flags/${props.code.toLowerCase()}.png`
const fallback = '/flags/un.png'

function onError() {
  hasError.value = true
}
</script>

<template>
  <img
    :src="hasError ? fallback : src()"
    :alt="code"
    :style="{ width: size, height: size, objectFit: 'cover', borderRadius: '2px' }"
    @error="onError"
  />
</template>

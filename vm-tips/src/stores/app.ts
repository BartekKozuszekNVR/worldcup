import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { setCssVar } from 'quasar'
import colorData from '../theme/colorData.json'

interface ThemePalette {
  id: string
  name: string
  colors: string[]
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

export const useAppStore = defineStore('app', () => {
  const storedTheme = localStorage.getItem('vm-tips-theme') || 'lush-forest'
  const themeId = ref(storedTheme)

  const themes = computed<ThemePalette[]>(() =>
    (colorData as { name: string; colors: string[] }[]).map(entry => ({
      id: slugify(entry.name),
      name: entry.name,
      colors: entry.colors,
    }))
  )

  const currentTheme = computed(() =>
    themes.value.find(t => t.id === themeId.value) ?? themes.value[0]
  )

  function setTheme(id: string) {
    themeId.value = id
    localStorage.setItem('vm-tips-theme', id)
  }

  function hexToRgb(hex: string): string {
    const h = hex.replace('#', '')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    return `${r}, ${g}, ${b}`
  }

  function applyTheme() {
    const theme = currentTheme.value
    if (!theme) return
    const [primary, accent, secondary, dark] = theme.colors

    // Dynamic brand colors
    setCssVar('primary', primary)
    setCssVar('secondary', secondary)
    setCssVar('accent', accent)
    setCssVar('dark', dark)

    // Page background = accent color
    document.body.style.setProperty('--q-page-bg', accent)
    document.body.style.backgroundColor = accent

    // Primary at 10% opacity for subtle tinted backgrounds (expansion headers, etc.)
    document.body.style.setProperty('--primary-light', `rgba(${hexToRgb(primary)}, 0.1)`)

    // Surface color stays white for readability
    document.body.style.setProperty('--surface-color', '#ffffff')
  }

  watch(themeId, () => {
    applyTheme()
  })

  // Apply on init
  applyTheme()

  return {
    themeId,
    themes,
    currentTheme,
    setTheme,
    applyTheme,
  }
})

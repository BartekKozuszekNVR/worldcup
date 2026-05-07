<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'

const { t, locale } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const currentTab = ref('/')

const tabs = computed(() => [
  { icon: 'sports_soccer', label: t('nav.predict'), route: '/' },
  { icon: 'emoji_events', label: t('nav.advancing'), route: '/advancing' },
  { icon: 'assessment', label: t('nav.results'), route: '/results' },
  { icon: 'leaderboard', label: t('nav.leaderboard'), route: '/leaderboard' },
  { icon: 'person', label: t('nav.profile'), route: '/profile' },
  { icon: 'help_outline', label: t('nav.help'), route: '/help' },
  { icon: 'admin_panel_settings', label: t('nav.admin'), route: '/admin', admin: true },
])

const visibleTabs = computed(() =>
  tabs.value.filter((tab) => !tab.admin || authStore.isAdmin)
)

async function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header class="bg-primary text-white">
      <q-toolbar>
        <q-toolbar-title>VM Tips 2026</q-toolbar-title>
        <q-space />
        <q-btn-group flat>
          <q-btn
            :flat="locale !== 'sv'"
            :outline="locale === 'sv'"
            dense
            label="SV"
            @click="locale = 'sv'"
          />
          <q-btn
            :flat="locale !== 'en'"
            :outline="locale === 'en'"
            dense
            label="EN"
            @click="locale = 'en'"
          />
        </q-btn-group>
        <q-btn flat round icon="logout" class="q-ml-sm" @click="handleLogout" />
      </q-toolbar>
    </q-header>

    <q-drawer
      v-if="$q.screen.gt.sm"
      show-if-above
      bordered
      :width="220"
    >
      <q-list padding>
        <q-item
          v-for="tab in visibleTabs"
          :key="tab.route"
          clickable
          v-ripple
          :to="tab.route"
          exact
          active-class="text-primary"
        >
          <q-item-section avatar>
            <q-icon :name="tab.icon" />
          </q-item-section>
          <q-item-section>{{ tab.label }}</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer v-if="$q.screen.lt.md" class="bottom-nav text-primary" style="background: var(--surface-color)">
      <q-tabs
        v-model="currentTab"
        active-color="primary"
        indicator-color="primary"
        narrow-indicator
        dense
        outside-arrows
        mobile-arrows
      >
        <q-route-tab
          v-for="tab in visibleTabs"
          :key="tab.route"
          :icon="tab.icon"
          :to="tab.route"
          :label="tab.label"
        />
      </q-tabs>
    </q-footer>
  </q-layout>
</template>

<style scoped lang="scss">
.bottom-nav {
  position: relative;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 24px;
    z-index: 3;
    pointer-events: none;
  }

  &::before {
    left: 0;
    background: linear-gradient(to right, var(--surface-color), transparent);
  }

  &::after {
    right: 0;
    background: linear-gradient(to left, var(--surface-color), transparent);
  }
}
</style>

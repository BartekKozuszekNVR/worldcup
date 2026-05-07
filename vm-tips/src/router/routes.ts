import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('../pages/PredictPage.vue'), meta: { requiresAuth: true } },
      { path: 'advancing', component: () => import('../pages/AdvancingPage.vue'), meta: { requiresAuth: true } },
      { path: 'results', component: () => import('../pages/ResultsPage.vue'), meta: { requiresAuth: true } },
      { path: 'leaderboard', component: () => import('../pages/LeaderboardPage.vue'), meta: { requiresAuth: true } },
      { path: 'profile', component: () => import('../pages/ProfilePage.vue'), meta: { requiresAuth: true } },
      { path: 'help', component: () => import('../pages/HelpPage.vue'), meta: { requiresAuth: true } },
      { path: 'admin', component: () => import('../pages/AdminPage.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
    ],
  },
  {
    path: '/login',
    component: () => import('../layouts/AuthLayout.vue'),
    children: [
      { path: '', component: () => import('../pages/LoginPage.vue') },
    ],
  },
  {
    path: '/register',
    component: () => import('../layouts/AuthLayout.vue'),
    children: [
      { path: '', component: () => import('../pages/RegisterPage.vue') },
    ],
  },
  {
    path: '/:catchAll(.*)*',
    component: () => import('../pages/ErrorNotFound.vue'),
  },
]

export default routes

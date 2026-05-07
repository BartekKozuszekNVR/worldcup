import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser } from '../types'
import { apiFetch } from '../composables/useApi'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const userList = ref<AuthUser[]>([])
  const publicUserList = ref<{ id: number; username: string }[]>([])
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function fetchUser() {
    try {
      loading.value = true
      error.value = null
      user.value = await apiFetch<AuthUser>('/api/auth/me')
    } catch (e: any) {
      user.value = null
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function login(username: string, password: string) {
    try {
      loading.value = true
      error.value = null
      const result = await apiFetch<AuthUser>('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      })
      user.value = result
      return result
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function register(username: string, password: string) {
    try {
      loading.value = true
      error.value = null
      const result = await apiFetch<AuthUser>('/api/auth/register', {
        method: 'POST',
        body: { username, password },
      })
      user.value = result
      return result
    } catch (e: any) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  async function updateAvatar(avatarUrl: string) {
    if (!user.value) return
    const result = await apiFetch<AuthUser>(`/api/users/${user.value.id}`, {
      method: 'PATCH',
      body: { avatarUrl },
    })
    user.value = result
    return result
  }

  async function loadUsers() {
    userList.value = await apiFetch<AuthUser[]>('/api/admin/users')
  }

  async function loadPublicUsers() {
    try {
      publicUserList.value = await apiFetch<{ id: number; username: string }[]>('/api/users/public')
    } catch {
      publicUserList.value = []
    }
  }

  async function switchUser(targetUserId: number) {
    const result = await apiFetch<AuthUser>('/api/admin/switch-user', {
      method: 'POST',
      body: { targetUserId },
    })
    user.value = result
    return result
  }

  async function resetUserPassword(userId: number, newPassword: string) {
    await apiFetch('/api/admin/reset-password', {
      method: 'POST',
      body: { userId, newPassword },
    })
  }

  async function deleteUser(userId: number) {
    await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    userList.value = userList.value.filter(u => u.id !== userId)
  }

  async function resetPredictions(userId: number) {
    await apiFetch(`/api/admin/users/${userId}/predictions`, { method: 'DELETE' })
  }

  return {
    user,
    loading,
    error,
    userList,
    publicUserList,
    isAuthenticated,
    isAdmin,
    fetchUser,
    login,
    register,
    logout,
    updateAvatar,
    loadUsers,
    loadPublicUsers,
    switchUser,
    resetUserPassword,
    deleteUser,
    resetPredictions,
  }
})

import { boot } from 'quasar/wrappers'
import { useAuthStore } from '../stores/auth'

export default boot(({ router }) => {
  router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore()

    // On first load, try to restore session from cookie
    if (!authStore.isAuthenticated && !authStore.error) {
      await authStore.fetchUser()
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      next('/login')
    } else if (to.meta.requiresAdmin && authStore.user?.role !== 'admin') {
      next('/')
    } else {
      next()
    }
  })
})

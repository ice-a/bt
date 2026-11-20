import { FAVORITES_KEY } from '~/utils/favorites'
import { useFavorites } from '~/composables/useFavorites'

export default defineNuxtPlugin((nuxtApp) => {
  const { hydrate } = useFavorites()
  nuxtApp.hook('app:mounted', hydrate)
  window.addEventListener('storage', (event) => {
    if (event.key === FAVORITES_KEY || event.key === null) hydrate()
  })
})

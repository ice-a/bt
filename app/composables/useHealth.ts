import type { HealthResponse } from '~/types/api'

/** 全局健康状态：Mongo / webtorrent / 客户端在线数，用于顶栏状态灯与页面提示 */
export function useHealth() {
  return useState<HealthResponse | null>('health', () => null)
}

export async function refreshHealth() {
  const state = useHealth()
  try {
    state.value = await $fetch<HealthResponse>('/api/health')
  } catch {
    state.value = null
  }
  return state.value
}

import { ProxyAgent, fetch as undiciFetch, type RequestInit } from 'undici'

const agentCache = new Map<string, ProxyAgent>()

export function getProxyAgent(proxy?: string | null): ProxyAgent | undefined {
  const uri = (proxy || '').trim()
  if (!uri) return undefined
  let agent = agentCache.get(uri)
  if (!agent) {
    agent = new ProxyAgent(uri)
    agentCache.set(uri, agent)
  }
  return agent
}

export interface HttpOptions extends RequestInit {
  /** 走 HTTP/HTTPS 代理，例如 http://127.0.0.1:7890 */
  proxy?: string | null
  timeoutMs?: number
}

/** 统一出口：带超时 + 可选代理的 fetch */
export async function httpFetch(url: string, options: HttpOptions = {}) {
  const { proxy, timeoutMs = 12000, ...init } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await undiciFetch(url, {
      ...init,
      dispatcher: getProxyAgent(proxy),
      signal: controller.signal
    })
  } catch (err) {
    if (controller.signal.aborted) throw new Error(`请求超时（${timeoutMs}ms）：${url}`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function httpText(url: string, options: HttpOptions = {}): Promise<string> {
  const res = await httpFetch(url, options)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return await res.text()
}

export async function httpJson<T = unknown>(url: string, options: HttpOptions = {}): Promise<T> {
  const res = await httpFetch(url, options)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

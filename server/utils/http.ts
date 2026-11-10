export const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// 代理仅在 Node 运行时生效：Cloudflare Workers 不支持 TCP 代理，走全局 fetch 直连。
// undici 也只在真正需要代理时才按需加载，避免在非 Node 环境（Worker）下 import 报错。
const agentCache = new Map<string, unknown>()

async function getProxyAgent(uri: string): Promise<unknown> {
  let agent = agentCache.get(uri)
  if (agent) return agent
  const { ProxyAgent } = await import('undici')
  agent = new ProxyAgent(uri)
  agentCache.set(uri, agent)
  return agent
}

export interface HttpOptions extends RequestInit {
  /** 走 HTTP/HTTPS 代理，例如 http://127.0.0.1:7890（仅 Node 运行时生效） */
  proxy?: string | null
  timeoutMs?: number
}

/** 统一出口：带超时 + 可选代理的 fetch */
export async function httpFetch(url: string, options: HttpOptions = {}) {
  const { proxy, timeoutMs = 12000, ...init } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let dispatcher: unknown
    const rawProxy = (proxy || process.env.SEARCH_PROXY || '').trim()
    const isNode = typeof process !== 'undefined' && !!process.versions?.node
    if (rawProxy && isNode) {
      dispatcher = await getProxyAgent(rawProxy)
    }
    return await fetch(url, {
      ...init,
      ...(dispatcher ? { dispatcher } : {}),
      signal: controller.signal
    } as RequestInit)
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

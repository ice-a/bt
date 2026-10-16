import { baseUrlOf, loadSettings, type BtClientConfig } from '../appconfig'
import { aria2Adapter } from './aria2'
import { qbittorrentAdapter } from './qbittorrent'
import { transmissionAdapter } from './transmission'
import type { AddTaskInput, AddTaskResult, BtClientAdapter, ClientStatus } from './types'

export const ADAPTERS: BtClientAdapter[] = [qbittorrentAdapter, transmissionAdapter, aria2Adapter]

export function getAdapter(type: string): BtClientAdapter | undefined {
  return ADAPTERS.find((a) => a.type === type)
}

export function endpointOf(cfg: BtClientConfig): string {
  const adapter = getAdapter(cfg.type)
  const path = cfg.path && cfg.path.trim() ? cfg.path : adapter?.defaultPath || ''
  return `${baseUrlOf(cfg)}${path}`
}

export function friendlyClientError(err: unknown): string {
  // undici 的 fetch 失败时外层只有 "fetch failed"，真正的 ECONNREFUSED 藏在 err.cause 里
  const parts: string[] = []
  let current: unknown = err
  for (let i = 0; i < 5 && current; i++) {
    if (current instanceof Error) {
      parts.push(`${(current as Error & { code?: string }).code || ''} ${current.message}`)
      current = (current as Error & { cause?: unknown }).cause
    } else {
      parts.push(String(current))
      break
    }
  }
  const msg = parts.join(' | ')

  if (/ECONNREFUSED/i.test(msg)) return '端口未监听：客户端没有启动，或地址 / 端口填错了'
  if (/ETIMEDOUT|timeout|aborted|超时/i.test(msg)) return '连接超时：可能是防火墙拦截或地址填错了'
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) return '无法解析该主机名'
  if (/self-signed|certificate|SSL|TLS/i.test(msg)) return 'TLS 证书错误：如果客户端是自签证书，请改用 http'
  return err instanceof Error ? err.message : String(err)
}

/** 探测所有已启用的客户端，返回在线状态 */
export async function listClientStatuses(): Promise<ClientStatus[]> {
  const settings = await loadSettings()
  const targets = settings.btClients.filter((c) => c.enabled !== false)
  if (!targets.length) return []

  return await Promise.all(
    targets.map(async (cfg): Promise<ClientStatus> => {
      const adapter = getAdapter(cfg.type)
      const base: ClientStatus = {
        id: cfg.id,
        type: cfg.type,
        name: cfg.name,
        label: adapter?.label || cfg.type,
        endpoint: endpointOf(cfg),
        online: false
      }
      if (!adapter) return { ...base, error: `不支持的客户端类型：${cfg.type}` }
      try {
        const result = await adapter.probe(cfg)
        return { ...base, online: result.online, version: result.version, error: result.error }
      } catch (err) {
        return { ...base, error: friendlyClientError(err) }
      }
    })
  )
}

export async function sendTask(
  clientId: string,
  input: AddTaskInput
): Promise<{ ok: boolean; message: string; client: BtClientConfig | null }> {
  const settings = await loadSettings()
  const cfg = settings.btClients.find((c) => c.id === clientId)
  if (!cfg) throw new Error(`找不到客户端配置：${clientId}`)
  const adapter = getAdapter(cfg.type)
  if (!adapter) throw new Error(`不支持的客户端类型：${cfg.type}`)

  const result: AddTaskResult = await adapter.add(cfg, input)
  return { ok: result.ok, message: result.message, client: cfg }
}

export interface ClientTaskGroup {
  clientId: string
  clientName: string
  online: boolean
  error?: string
  tasks: BtTask[]
}

/** 获取所有在线客户端的任务 */
export async function listAllTasks(): Promise<ClientTaskGroup[]> {
  const settings = await loadSettings()
  const targets = settings.btClients.filter((c) => c.enabled !== false)

  return await Promise.all(
    targets.map(async (cfg): Promise<ClientTaskGroup> => {
      const adapter = getAdapter(cfg.type)
      const group: ClientTaskGroup = {
        clientId: cfg.id,
        clientName: cfg.name,
        online: false,
        tasks: []
      }
      if (!adapter) return { ...group, error: `不支持的客户端类型：${cfg.type}` }
      try {
        const tasks = await adapter.getTasks(cfg)
        return { ...group, online: true, tasks }
      } catch (err) {
        return { ...group, error: friendlyClientError(err) }
      }
    })
  )
}

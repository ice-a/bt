import type { BtClientConfig, BtClientType } from '../appconfig'

export interface ProbeResult {
  online: boolean
  version?: string
  error?: string
}

export interface AddTaskInput {
  /** 磁力链 */
  magnet?: string
  /** .torrent 文件内容（base64） */
  torrentBase64?: string
  /** 覆盖客户端的默认下载目录 */
  downloadDir?: string
  /** 任务名，仅用于记录与显示 */
  name?: string
}

export interface AddTaskResult {
  ok: boolean
  message: string
  /** 客户端返回的原始信息，便于排错 */
  detail?: unknown
}

export interface BtTask {
  infoHash: string
  name: string
  progress: number
  size: number
  downloaded: number
  uploaded: number
  dlspeed: number
  upspeed: number
  status: 'downloading' | 'seeding' | 'paused' | 'error' | 'queued' | 'checking' | 'completed' | 'unknown'
  eta?: number
}

export interface BtClientAdapter {
  type: BtClientType
  label: string
  defaultPort: number
  defaultPath?: string
  probe(cfg: BtClientConfig): Promise<ProbeResult>
  add(cfg: BtClientConfig, input: AddTaskInput): Promise<AddTaskResult>
  /** 获取当前活跃或全部任务 */
  getTasks(cfg: BtClientConfig): Promise<BtTask[]>
}

export interface ClientStatus {
  id: string
  type: BtClientType
  name: string
  label: string
  endpoint: string
  online: boolean
  version?: string
  error?: string
}

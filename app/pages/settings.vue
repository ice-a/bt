<script setup lang="ts">
import type { BtClientConfig, ClientsResponse, ClientStatus } from '~/types/api'

interface DownloadItem {
  _id: string
  name: string
  clientName: string
  clientType: string
  downloadDir: string | null
  ok: boolean
  message: string
  createdAt: string
}

const health = useHealth()

const loading = ref(true)
const saving = ref(false)
const clients = ref<ClientsResponse | null>(null)
const configs = ref<BtClientConfig[]>([])
const statuses = ref<ClientStatus[]>([])
const downloads = ref<DownloadItem[]>([])
const testState = ref<Record<string, { testing?: boolean; ok?: boolean; error?: string; version?: string; endpoint?: string }>>({})

const enabledProviders = ref<string[]>([])
const searchProxy = ref('')
const searchTimeout = ref(12000)
const metadataTimeout = ref(30000)

async function load() {
  loading.value = true
  try {
    const [c, , d] = await Promise.all([
      $fetch<ClientsResponse>('/api/clients'),
      refreshHealth(),
      $fetch<{ items: DownloadItem[] }>('/api/downloads', { query: { limit: 25 } })
    ])
    clients.value = c
    configs.value = JSON.parse(JSON.stringify(c.configs))
    statuses.value = c.statuses
    downloads.value = d.items
    enabledProviders.value = c.settings.enabledProviders
    searchProxy.value = c.settings.searchProxy
    searchTimeout.value = c.settings.searchTimeout
    metadataTimeout.value = c.settings.metadataTimeout
  } catch (err) {
    pushToast('err', '读取配置失败', errorMessage(err))
  } finally {
    loading.value = false
  }
}

const adapters = computed(() => clients.value?.adapters || [])
const statusOf = (id: string) => statuses.value.find((s) => s.id === id)

function statusPill(cfg: BtClientConfig): ClientStatus | undefined {
  return statusOf(cfg.id)
}

function addClient() {
  const seq = configs.value.length + 1
  configs.value.push({
    id: `client-${Date.now().toString(36)}`,
    type: 'qbittorrent',
    name: `新下载器 ${seq}`,
    host: '127.0.0.1',
    port: 8080,
    username: 'admin',
    password: '',
    downloadDir: '',
    enabled: true,
    useHttps: false
  })
}

function removeClient(index: number) {
  configs.value.splice(index, 1)
}

function onTypeChange(cfg: BtClientConfig) {
  const adapter = adapters.value.find((a) => a.type === cfg.type)
  if (adapter) {
    cfg.port = adapter.defaultPort
    cfg.path = adapter.defaultPath || undefined
  }
}

async function testClient(cfg: BtClientConfig) {
  testState.value = { ...testState.value, [cfg.id]: { testing: true } }
  try {
    const res = await $fetch<{ ok: boolean; online: boolean; version: string | null; endpoint: string; error?: string }>(
      '/api/clients/test',
      { method: 'POST', body: { client: cfg } }
    )
    testState.value = {
      ...testState.value,
      [cfg.id]: { ok: res.ok, version: res.version || undefined, endpoint: res.endpoint, error: res.error }
    }
    pushToast(res.ok ? 'ok' : 'err', res.ok ? `${cfg.name} 连接正常` : `${cfg.name} 连接失败`, res.error || undefined)
  } catch (err) {
    const msg = errorMessage(err)
    testState.value = { ...testState.value, [cfg.id]: { ok: false, error: msg } }
    pushToast('err', '测试失败', msg)
  }
}

async function save() {
  saving.value = true
  try {
    await $fetch('/api/clients', {
      method: 'PUT',
      body: {
        btClients: configs.value,
        enabledProviders: enabledProviders.value,
        searchProxy: searchProxy.value,
        searchTimeout: searchTimeout.value,
        metadataTimeout: metadataTimeout.value
      }
    })
    pushToast('ok', '配置已保存')
    await load()
  } catch (err) {
    pushToast('err', '保存失败', errorMessage(err))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <section class="rise">
      <p class="label">SETTINGS · ADAPTERS</p>
      <h1>搜索源与本机下载器</h1>
      <p class="sub">
        所有配置写在 MongoDB 的 settings 集合里（没连库时回落到 .env）。下载器地址默认指向本机，如果服务部署在别的机器上，改成本机可访问的地址即可。
      </p>
    </section>

    <div class="row mt rise rise-2">
      <button class="btn btn-primary" :disabled="saving || loading" @click="save">
        <span v-if="saving" class="spin" />{{ saving ? '保存中…' : '保存全部配置' }}
      </button>
      <button class="btn btn-ghost" :disabled="loading" @click="load">重新加载</button>
      <span v-if="health && !health.mongo.ok" class="small warn">MongoDB 未连接，配置只能在本次运行内生效</span>
    </div>

    <!-- ============ 搜索源 ============ -->
    <div class="panel mt rise rise-2">
      <div class="panel-hd"><span class="label">SEARCH SOURCES</span></div>
      <div class="panel-bd stack">
        <div class="row wrap">
          <span class="label">启用的搜索源</span>
          <label v-for="p in health?.providers || []" :key="p.id" class="check">
            <input v-model="enabledProviders" type="checkbox" :value="p.id" />
            {{ p.label }}
            <span class="mute small">{{ p.homepage }}</span>
          </label>
        </div>

        <div class="grid-3">
          <label class="field">
            <span class="label">HTTP 代理（搜索源用）</span>
            <input v-model="searchProxy" class="input" placeholder="http://127.0.0.1:7890 / 留空直连" />
          </label>
          <label class="field">
            <span class="label">搜索超时（毫秒）</span>
            <input v-model.number="searchTimeout" class="input" type="number" min="1000" max="60000" step="500" />
          </label>
          <label class="field">
            <span class="label">元数据解析超时（毫秒）</span>
            <input v-model.number="metadataTimeout" class="input" type="number" min="3000" max="180000" step="1000" />
          </label>
        </div>

        <div class="note">
          公开磁力站在部分网络环境下不可直连，配好代理后「设置 → 保存」再回搜索页重试即可。代理只作用于搜索源请求，不影响下载器通信。
        </div>
      </div>
    </div>

    <!-- ============ 下载器 ============ -->
    <div class="panel mt rise rise-3">
      <div class="panel-hd">
        <span class="label">LOCAL BT CLIENTS</span>
        <span class="mono small" :class="statuses.some((s) => s.online) ? 'ok' : 'err'">
          {{ statuses.filter((s) => s.online).length }}/{{ statuses.length }} 在线
        </span>
        <span class="spacer" />
        <button class="btn btn-sm btn-ghost" @click="addClient">+ 新增下载器</button>
      </div>

      <div class="panel-bd stack">
        <div v-for="(cfg, index) in configs" :key="cfg.id" class="panel" style="background: var(--panel-2)">
          <div class="panel-hd" style="background: var(--panel-3)">
            <label class="check">
              <input v-model="cfg.enabled" type="checkbox" />
              启用
            </label>
            <span class="spacer" />
            <span v-if="statusPill(cfg)" class="pill" :class="statusPill(cfg)!.online ? 'on' : 'off'" :title="statusPill(cfg)!.error || ''">
              <i class="dot" />
              {{ statusPill(cfg)!.online ? `在线 ${statusPill(cfg)!.version || ''}` : '离线' }}
            </span>
            <button class="btn btn-sm" :disabled="testState[cfg.id]?.testing" @click="testClient(cfg)">
              <span v-if="testState[cfg.id]?.testing" class="spin" />测试连接
            </button>
            <button class="btn btn-sm btn-danger" @click="removeClient(index)">删除</button>
          </div>
          <div class="panel-bd stack sm">
            <div class="grid-4">
              <label class="field">
                <span class="label">名称</span>
                <input v-model="cfg.name" class="input" />
              </label>
              <label class="field">
                <span class="label">类型</span>
                <select v-model="cfg.type" class="select" @change="onTypeChange(cfg)">
                  <option v-for="a in adapters" :key="a.type" :value="a.type">{{ a.label }}</option>
                </select>
              </label>
              <label class="field">
                <span class="label">主机</span>
                <input v-model="cfg.host" class="input" />
              </label>
              <label class="field">
                <span class="label">端口</span>
                <input v-model.number="cfg.port" class="input" type="number" />
              </label>
            </div>
            <div class="grid-4">
              <label class="field">
                <span class="label">RPC 路径（可空）</span>
                <input v-model="cfg.path" class="input" :placeholder="adapters.find((a) => a.type === cfg.type)?.defaultPath || '默认'" />
              </label>
              <label class="field">
                <span class="label">用户名{{ cfg.type === 'aria2' ? '（aria2 用不到）' : '' }}</span>
                <input v-model="cfg.username" class="input" :disabled="cfg.type === 'aria2'" />
              </label>
              <label class="field">
                <span class="label">{{ cfg.type === 'aria2' ? 'RPC 密钥 --rpc-secret' : '密码' }}</span>
                <input
                  v-model="cfg.password"
                  class="input"
                  :type="cfg.type === 'aria2' ? 'text' : 'password'"
                  :placeholder="cfg.type === 'aria2' ? 'aria2 的 --rpc-secret 值' : ''"
                />
              </label>
              <label class="field">
                <span class="label">默认下载目录</span>
                <input v-model="cfg.downloadDir" class="input" placeholder="留空用客户端默认" />
              </label>
            </div>
            <div class="row">
              <label class="check">
                <input v-model="cfg.useHttps" type="checkbox" />
                使用 HTTPS
              </label>
              <span v-if="testState[cfg.id]?.error" class="small err">{{ testState[cfg.id]?.error }}</span>
              <span v-else-if="testState[cfg.id]?.ok" class="small ok">
                可达 {{ testState[cfg.id]?.endpoint }} {{ testState[cfg.id]?.version ? `· v${testState[cfg.id]?.version}` : '' }}
              </span>
            </div>

            <div class="note">
              <span v-if="cfg.type === 'qbittorrent'">
                qBittorrent：开启「工具 → 选项 → Web UI」，默认端口 8080；首次访问会让客户端把本机 IP 加入白名单。
              </span>
              <span v-else-if="cfg.type === 'transmission'">
                Transmission：开启远程控制，默认端口 9091，RPC 路径 <span class="mono">/transmission/rpc</span>；没设用户名密码就留空。
              </span>
              <span v-else>
                aria2：启动时加 <span class="mono">--enable-rpc --rpc-listen-all=true --rpc-secret=你的密钥</span>，把密钥填到「RPC 密钥」框。
              </span>
            </div>
          </div>
        </div>

        <div v-if="!configs.length" class="empty">还没有下载器，点右上角「新增下载器」</div>
      </div>
    </div>

    <!-- ============ 下载记录 ============ -->
    <div class="panel mt rise rise-4">
      <div class="panel-hd"><span class="label">HANDOFF LOG</span><span class="spacer" /><span class="mute small">最近 25 条投递记录</span></div>
      <div class="panel-bd tight">
        <table v-if="downloads.length" class="table">
          <thead>
            <tr>
              <th style="width: 44%">任务</th>
              <th>下载器</th>
              <th class="hide-sm">目录</th>
              <th>结果</th>
              <th class="right">时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in downloads" :key="d._id">
              <td class="name">{{ d.name }}</td>
              <td><span class="tag">{{ d.clientName || d.clientId }}</span></td>
              <td class="small mute hide-sm">{{ d.downloadDir || '默认' }}</td>
              <td>
                <span class="tag" :class="d.ok ? 'ok' : 'err'">{{ d.ok ? '成功' : '失败' }}</span>
                <span class="small mute" style="display: block">{{ d.message }}</span>
              </td>
              <td class="num right dim">{{ formatRelative(d.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">还没有投递记录</div>
      </div>
    </div>

    <!-- ============ 环境信息 ============ -->
    <div class="panel mt rise rise-4">
      <div class="panel-hd"><span class="label">RUNTIME</span></div>
      <div class="panel-bd">
        <dl class="kv">
          <dt>MongoDB</dt>
          <dd>
            <span :class="health?.mongo.ok ? 'ok' : 'err'">{{ health?.mongo.ok ? '已连接' : '未连接' }}</span>
          </dd>
          <dt>磁力解析</dt>
          <dd :class="health?.webTorrent ? 'ok' : 'warn'">
            {{ health?.webTorrent ? 'webtorrent 可用，可通过 DHT/tracker 取文件清单' : 'webtorrent 不可用，但通过 torrent 缓存服务在线取清单（不走 DHT）' }}
          </dd>
          <dt>搜索源</dt>
          <dd class="mono small">{{ health?.providers?.map((p) => p.label).join(' / ') }}</dd>
          <dt>代理</dt>
          <dd class="mono small">{{ health?.searchProxy }}</dd>
        </dl>
      </div>
    </div>
  </div>
</template>

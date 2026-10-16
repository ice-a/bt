<script setup lang="ts">
import type { ClientsResponse, TorrentView } from '~/types/api'

const props = defineProps<{ torrent: TorrentView }>()

const clients = ref<ClientsResponse | null>(null)
const loading = ref(false)
const sending = ref(false)
const selectedId = ref('')
const dir = ref('')

const statuses = computed(() => clients.value?.statuses || [])
const onlineStatuses = computed(() => statuses.value.filter((s) => s.online))
const current = computed(() => statuses.value.find((s) => s.id === selectedId.value) || null)

async function load() {
  loading.value = true
  try {
    clients.value = await $fetch<ClientsResponse>('/api/clients')
    const firstOnline = clients.value.statuses.find((s) => s.online)
    if (!selectedId.value) selectedId.value = (firstOnline || clients.value.statuses[0])?.id || ''
    syncDir()
  } catch (err) {
    pushToast('err', '读取下载器配置失败', errorMessage(err))
  } finally {
    loading.value = false
  }
}

function syncDir() {
  const cfg = clients.value?.configs.find((c) => c.id === selectedId.value)
  dir.value = cfg?.downloadDir || ''
}

watch(selectedId, syncDir)

async function send() {
  if (!selectedId.value) return
  sending.value = true
  try {
    const res = await $fetch<{ ok: boolean; message: string }>('/api/send', {
      method: 'POST',
      body: {
        clientId: selectedId.value,
        infoHash: props.torrent.infoHash,
        magnet: props.torrent.magnet || undefined,
        name: props.torrent.name,
        downloadDir: dir.value || undefined
      }
    })
    pushToast('ok', '投递成功', res.message)
    refreshHealth()
  } catch (err) {
    pushToast('err', '投递失败', errorMessage(err))
  } finally {
    sending.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="panel">
    <div class="panel-hd">
      <span class="label">SEND TO LOCAL CLIENT</span>
      <span class="mono small" :class="onlineStatuses.length ? 'ok' : 'err'">
        {{ loading ? '探测中…' : `${onlineStatuses.length}/${statuses.length} 在线` }}
      </span>
      <span class="spacer" />
      <button class="btn btn-sm btn-ghost" :disabled="loading" @click="load">重新探测</button>
      <NuxtLink to="/settings" class="btn btn-sm btn-ghost">配置</NuxtLink>
    </div>

    <div class="panel-bd stack sm">
      <div v-if="!statuses.length" class="note warn">
        还没有配置任何下载器。去「设置」里填 qBittorrent / Transmission / aria2 的地址和账号密码。
      </div>

      <template v-else>
        <div class="row wrap">
          <div
            v-for="s in statuses"
            :key="s.id"
            class="pill"
            :class="s.online ? 'on' : 'off'"
            :title="s.error || s.endpoint"
          >
            <i class="dot" />
            {{ s.name }}
            <span class="mute">{{ s.version ? `v${s.version}` : s.online ? '' : '离线' }}</span>
          </div>
        </div>

        <div class="grid-2">
          <label class="field">
            <span class="label">目标下载器</span>
            <select v-model="selectedId" class="select">
              <option v-for="s in statuses" :key="s.id" :value="s.id">
                {{ s.name }}（{{ s.online ? '在线' : '离线' }}）
              </option>
            </select>
          </label>
          <label class="field">
            <span class="label">下载目录（留空用客户端默认）</span>
            <input v-model="dir" class="input" placeholder="D:\\Downloads" />
          </label>
        </div>

        <div v-if="current && !current.online" class="note err">{{ current.error || '该下载器当前不可用' }}</div>

        <div class="row">
          <button class="btn btn-primary" :disabled="sending || !selectedId" @click="send">
            <span v-if="sending" class="spin" />
            {{ sending ? '投递中…' : '投递到本机下载器' }}
          </button>
          <span class="mute small">种子交给本机客户端下载，服务器不中转文件内容</span>
        </div>
      </template>
    </div>
  </div>
</template>

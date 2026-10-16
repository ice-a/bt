<script setup lang="ts">
import type { BtTask, ClientTaskGroup } from '~/server/utils/clients'

const { data, refresh, pending } = await useFetch<{
  groups: ClientTaskGroup[]
  totalCount: number
  onlineCount: number
}>('/api/clients/tasks')

const timer = ref<any>(null)

onMounted(() => {
  timer.value = setInterval(() => {
    if (!pending.value) refresh()
  }, 5000)
})

onBeforeUnmount(() => {
  if (timer.value) clearInterval(timer.value)
})

function statusCls(status: BtTask['status']) {
  switch (status) {
    case 'downloading': return 'ok'
    case 'seeding': return 'acc'
    case 'error': return 'err'
    case 'paused': return 'mute'
    case 'checking': return 'warn'
    default: return ''
  }
}

function statusText(status: BtTask['status']) {
  switch (status) {
    case 'downloading': return '下载中'
    case 'seeding': return '做种中'
    case 'paused': return '已暂停'
    case 'error': return '错误'
    case 'queued': return '排队中'
    case 'checking': return '校验中'
    case 'completed': return '已完成'
    default: return '未知'
  }
}

function formatEta(seconds?: number) {
  if (seconds === undefined || seconds >= 8640000) return '—'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}
</script>

<template>
  <div class="page">
    <section class="rise">
      <p class="label">ACTIVE · DOWNLOADS</p>
      <h1>实时下载状态</h1>
      <p class="sub">直接从你配置的 qBittorrent / Transmission / aria2 客户端拉取的实时数据。</p>
    </section>

    <div class="grid-4 mt rise rise-2">
      <div class="stat">
        <span class="label">活跃任务总数</span>
        <span class="v">{{ data?.totalCount ?? 0 }}</span>
      </div>
      <div class="stat">
        <span class="label">在线下载器</span>
        <span class="v">{{ data?.onlineCount ?? 0 }}</span>
      </div>
      <div class="stat">
        <span class="label">刷新频率</span>
        <span class="v small">每 5 秒自动同步</span>
      </div>
      <div class="stat">
        <button class="btn btn-sm btn-ghost mt-sm" :disabled="pending" @click="refresh()">
          {{ pending ? '同步中…' : '手动刷新' }}
        </button>
      </div>
    </div>

    <div v-for="group in data?.groups" :key="group.clientId" class="stack mt rise rise-3">
      <div class="panel">
        <div class="panel-hd">
          <span class="label">{{ group.clientName }}</span>
          <span class="pill" :class="group.online ? 'on' : 'off'">
            <i class="dot" />
            {{ group.online ? '在线' : '离线' }}
          </span>
          <span v-if="group.error" class="small err ml">{{ group.error }}</span>
          <span class="spacer" />
          <span class="mono small dim">{{ group.tasks.length }} 个任务</span>
        </div>

        <div class="panel-bd tight">
          <table v-if="group.tasks.length" class="table">
            <thead>
              <tr>
                <th style="width: 40%">任务名称</th>
                <th style="width: 15%">进度</th>
                <th class="right">大小</th>
                <th class="right hide-sm">下载速度</th>
                <th class="right hide-sm">剩余时间</th>
                <th class="right">状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in group.tasks" :key="t.infoHash">
                <td class="name">
                  <NuxtLink class="mono small truncate" :to="`/torrent/${t.infoHash}`" style="max-width: 40ch">
                    {{ t.name }}
                  </NuxtLink>
                </td>
                <td>
                  <div class="row sm">
                    <div class="grow" style="height: 4px; background: var(--line); border-radius: 2px; overflow: hidden">
                      <div
                        style="height: 100%; background: var(--acc); transition: width 0.3s"
                        :style="{ width: (t.progress * 100) + '%' }"
                      />
                    </div>
                    <span class="mono small" style="min-width: 4ch; text-align: right">
                      {{ (t.progress * 100).toFixed(1) }}%
                    </span>
                  </div>
                </td>
                <td class="num right">{{ formatBytes(t.size) }}</td>
                <td class="num right hide-sm">
                  <span :class="t.dlspeed > 0 ? 'ok' : 'dim'">
                    {{ t.dlspeed > 0 ? `${formatBytes(t.dlspeed)}/s` : '—' }}
                  </span>
                </td>
                <td class="num right dim hide-sm">{{ formatEta(t.eta) }}</td>
                <td class="right">
                  <span class="tag" :class="statusCls(t.status)">{{ statusText(t.status) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty">暂无任务</div>
        </div>
      </div>
    </div>

    <div v-if="!data?.groups.length && !pending" class="empty mt">
      还没有配置任何下载器，或者所有下载器都已禁用。
      <NuxtLink to="/settings" class="btn btn-sm btn-primary ml">去设置</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.ml { margin-left: 12px; }
.mt-sm { margin-top: 4px; }
</style>

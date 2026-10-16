<script setup lang="ts">
import type { TorrentView } from '~/types/api'

interface SearchItem {
  _id: string
  keyword: string
  providers: string[]
  resultCount: number
  durationMs: number
  ok: boolean
  error: string | null
  createdAt: string
}

const { data, refresh, pending } = await useFetch<{
  items: SearchItem[]
  hot: { keyword: string; count: number; last: string }[]
  total: number
  torrentTotal: number
  offline: boolean
}>('/api/history')

const torrents = ref<TorrentView[]>([])
const torrentsPending = ref(false)

async function loadTorrents() {
  torrentsPending.value = true
  try {
    const res = await $fetch<{ items: TorrentView[] }>('/api/torrents', { query: { limit: 30 } })
    torrents.value = res.items
  } catch {
    torrents.value = []
  } finally {
    torrentsPending.value = false
  }
}

async function removeOne(id: string) {
  try {
    await $fetch('/api/history', { method: 'DELETE', query: { id } })
    pushToast('ok', '已删除该条记录')
    await refresh()
  } catch (err) {
    pushToast('err', '删除失败', errorMessage(err))
  }
}

async function clearAll() {
  if (!confirm('确定清空全部搜索历史？')) return
  try {
    const res = await $fetch<{ deleted: number }>('/api/history', { method: 'DELETE' })
    pushToast('ok', `已清空 ${res.deleted} 条记录`)
    await refresh()
  } catch (err) {
    pushToast('err', '清空失败', errorMessage(err))
  }
}

onMounted(loadTorrents)
</script>

<template>
  <div class="page">
    <section class="rise">
      <p class="label">HISTORY · LIBRARY</p>
      <h1>搜索历史与种子库</h1>
      <p class="sub">每次搜索都会落到 MongoDB 的 searches 集合；搜到和解析过的种子按 infoHash 去重存在 torrents 集合。</p>
    </section>

    <div v-if="data?.offline" class="note warn mt rise rise-2">
      MongoDB 未连接，历史记录不可用。启动本地 MongoDB 后刷新本页即可。
    </div>

    <div class="grid-4 mt rise rise-2">
      <div class="stat"><span class="label">搜索总次数</span><span class="v">{{ formatNumber(data?.total) }}</span></div>
      <div class="stat"><span class="label">库中种子数</span><span class="v">{{ formatNumber(data?.torrentTotal) }}</span></div>
      <div class="stat"><span class="label">高频关键词</span><span class="v">{{ data?.hot?.length || 0 }}</span></div>
      <div class="stat">
        <span class="label">状态</span>
        <span class="v small" :class="data?.offline ? 'err' : 'ok'">{{ data?.offline ? '未连接' : '正常' }}</span>
      </div>
    </div>

    <div v-if="data?.hot?.length" class="panel mt rise rise-3">
      <div class="panel-hd"><span class="label">TOP KEYWORDS</span><span class="spacer" /><span class="mute small">点击直接再搜一次</span></div>
      <div class="panel-bd row wrap">
        <NuxtLink
          v-for="h in data.hot"
          :key="h.keyword"
          class="tag acc"
          :to="{ path: '/', query: { q: h.keyword } }"
          style="padding: 4px 10px; font-size: 12px"
        >
          {{ h.keyword }} ×{{ h.count }}
        </NuxtLink>
      </div>
    </div>

    <div class="panel mt rise rise-3">
      <div class="panel-hd">
        <span class="label">SEARCH LOG</span>
        <span class="spacer" />
        <button class="btn btn-sm btn-ghost" :disabled="pending" @click="refresh()">
          {{ pending ? '刷新中…' : '刷新' }}
        </button>
        <button class="btn btn-sm btn-danger" :disabled="!data?.items?.length" @click="clearAll">清空</button>
      </div>
      <div class="panel-bd tight">
        <table v-if="data?.items?.length" class="table">
          <thead>
            <tr>
              <th style="width: 42%">关键词</th>
              <th class="right">结果数</th>
              <th class="right hide-sm">耗时</th>
              <th class="hide-sm">源</th>
              <th class="right">时间</th>
              <th class="right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in data.items" :key="it._id">
              <td>
                <NuxtLink class="name" :to="{ path: '/', query: { q: it.keyword } }">{{ it.keyword }}</NuxtLink>
                <span v-if="!it.ok && it.error" class="small err" style="display: block">{{ it.error }}</span>
              </td>
              <td class="num right" :class="it.ok ? '' : 'err'">{{ it.resultCount }}</td>
              <td class="num right dim hide-sm">{{ it.durationMs }}ms</td>
              <td class="hide-sm"><span class="tag">{{ it.providers?.join(' + ') || '—' }}</span></td>
              <td class="num right dim">{{ formatRelative(it.createdAt) }}</td>
              <td class="right">
                <button class="btn btn-sm btn-ghost" @click="removeOne(it._id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">还没有搜索记录</div>
      </div>
    </div>

    <div class="panel mt rise rise-4">
      <div class="panel-hd">
        <span class="label">RECENT TORRENTS</span>
        <span class="spacer" />
        <button class="btn btn-sm btn-ghost" :disabled="torrentsPending" @click="loadTorrents">
          {{ torrentsPending ? '加载中…' : '刷新' }}
        </button>
      </div>
      <div class="panel-bd tight">
        <table v-if="torrents.length" class="table">
          <thead>
            <tr>
              <th style="width: 48%">名称</th>
              <th>来源</th>
              <th class="right">大小</th>
              <th class="right hide-sm">文件</th>
              <th class="right">更新</th>
              <th class="right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in torrents" :key="t.infoHash">
              <td class="name">{{ t.name }}</td>
              <td><span class="tag">{{ t.source }}</span></td>
              <td class="num right">{{ formatBytes(t.size) }}</td>
              <td class="num right dim hide-sm">{{ t.files ? t.files.length : t.fileCount ?? '未解析' }}</td>
              <td class="num right dim">{{ formatRelative(t.resolvedAt || t.creationDate) }}</td>
              <td class="right">
                <NuxtLink class="btn btn-sm" :to="{ path: `/torrent/${t.infoHash}`, query: { magnet: t.magnet } }">打开</NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">库里还没有种子</div>
      </div>
    </div>
  </div>
</template>

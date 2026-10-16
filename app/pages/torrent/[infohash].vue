<script setup lang="ts">
import type { TorrentView } from '~/types/api'

const route = useRoute()

const infoHash = computed(() => String(route.params.infohash || '').toLowerCase())
const magnet = computed(() => String(route.query.magnet || ''))

const { data, error } = await useFetch<{ torrent: TorrentView; source: string }>(
  () => `/api/torrent/${infoHash.value}`,
  { query: { magnet }, watch: [infoHash, magnet] }
)

useHead(() => ({ title: data.value?.torrent?.name ? `${data.value.torrent.name} · 种子预览` : '种子预览' }))

refreshHealth()
</script>

<template>
  <div class="page">
    <div class="row small rise">
      <NuxtLink to="/" class="btn btn-sm btn-ghost">← 返回搜索</NuxtLink>
      <span class="mono mute truncate">{{ infoHash }}</span>
      <span v-if="data?.source" class="tag">{{ data.source === 'database' ? '来自 MongoDB 缓存' : '来自链接参数' }}</span>
    </div>

    <div v-if="error" class="panel mt rise rise-2">
      <div class="panel-bd stack sm">
        <span class="label">NOT FOUND</span>
        <h2>拿不到这个种子的信息</h2>
        <p class="sub">{{ errorMessage(error) }}</p>
        <p class="mute small">
          如果你是直接从外部链接进来的，请带上 magnet 参数，例如
          <span class="mono">/torrent/&lt;infoHash&gt;?magnet=magnet:?xt=urn:btih:…</span>
        </p>
        <div><NuxtLink to="/" class="btn btn-primary">回到搜索页</NuxtLink></div>
      </div>
    </div>

    <div v-else-if="data?.torrent" class="mt rise rise-2">
      <TorrentDetail :torrent="data.torrent" :can-resolve="true" />
    </div>

    <div v-else class="empty mt">
      <span class="spin" /> 加载中…
    </div>
  </div>
</template>

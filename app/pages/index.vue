<script setup lang="ts">
import type { SearchResponse, TorrentView } from '~/types/api'

type Tab = 'search' | 'file' | 'magnet'

const route = useRoute()
const health = useHealth()

/* ---------------- 热搜 3D 词云 ---------------- */
const { data: hotData, refresh: refreshHot } = await useFetch<{ keywords: { keyword: string; count: number }[] }>('/api/hot', {
  query: { limit: 10 }
})
const hotWords = computed(() => (hotData.value?.keywords || []).map((k) => ({ text: k.keyword, weight: k.count })))

function onHotSelect(kw: string) {
  if (tab.value !== 'search') tab.value = 'search'
  doSearch(kw)
}

const tab = ref<Tab>('search')

/* ---------------- 关键词搜索 ---------------- */
const keyword = ref('')
const activeProviders = ref<string[]>([])
const searching = ref(false)
const response = ref<SearchResponse | null>(null)
const page = ref(1)
const pageSize = ref(20)

const pagedResults = computed(() => {
  if (!response.value) return []
  const start = (page.value - 1) * pageSize.value
  return response.value.results.slice(start, start + pageSize.value)
})

const totalPages = computed(() => {
  if (!response.value) return 0
  return Math.ceil(response.value.results.length / pageSize.value)
})

onMounted(async () => {
  const data = health.value || (await refreshHealth())
  if (data) activeProviders.value = data.enabledProviders
  const q = String(route.query.q || '').trim()
  if (q) {
    keyword.value = q
    await doSearch()
  }
})

/* ---------------- 上传 / 磁力 ---------------- */
const dropping = ref(false)
const parsing = ref(false)
const parsed = ref<TorrentView | null>(null)
const magnetInput = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

async function doSearch(term?: string) {
  const q = (term ?? keyword.value).trim()
  if (!q) {
    pushToast('warn', '请输入关键词')
    return
  }
  
  // 如果输入的是 infoHash，直接跳转到详情页
  if (/^[a-f0-9]{40}$/i.test(q)) {
    navigateTo(`/torrent/${q.toLowerCase()}`)
    return
  }

  keyword.value = q
  searching.value = true
  page.value = 1
  try {
    response.value = await $fetch<SearchResponse>('/api/search', {
      query: { q, providers: activeProviders.value.join(',') }
    })
    if (!response.value.results.length) {
      pushToast('warn', '没有搜到结果', '可以换个关键词，或检查代理设置')
    }
  } catch (err) {
    pushToast('err', '搜索失败', errorMessage(err))
  } finally {
    searching.value = false
    refreshHot()
  }
}

async function pickFile(file: File) {
  parsing.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await $fetch<{ torrent: TorrentView; stored: boolean }>('/api/parse', {
      method: 'POST',
      body: form
    })
    parsed.value = res.torrent
    pushToast('ok', '种子解析完成', `${res.torrent.files?.length || 0} 个文件 / ${formatBytes(res.torrent.size)}`)
  } catch (err) {
    pushToast('err', '解析失败', errorMessage(err))
  } finally {
    parsing.value = false
  }
}

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) pickFile(file)
}

function onDrop(event: DragEvent) {
  dropping.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) pickFile(file)
}

async function parseMagnet() {
  const magnet = magnetInput.value.trim()
  if (!magnet) {
    pushToast('warn', '请粘贴磁力链')
    return
  }
  parsing.value = true
  try {
    const res = await $fetch<{ torrent: TorrentView }>('/api/parse', { method: 'POST', body: { magnet } })
    parsed.value = res.torrent
    pushToast('ok', '磁力链解析完成', '文件清单需要点击「在线解析」拉取')
  } catch (err) {
    pushToast('err', '解析失败', errorMessage(err))
  } finally {
    parsing.value = false
  }
}

function previewLink(item: TorrentView) {
  return {
    path: `/torrent/${item.infoHash}`,
    query: { magnet: item.magnet, name: item.name }
  }
}
</script>

<template>
  <div class="page">
    <section class="rise">
      <p class="label">SEARCH · PARSE · HANDOFF</p>
      <h1>搜种子、看清里面有什么，再丢给本机下载器</h1>
      <p class="sub">
        搜索走公开磁力源，预览只看文件清单（不下服务器），确认后把种子投递给本机的
        qBittorrent / Transmission / aria2，由它们完成实际下载。
      </p>
    </section>

    <div v-if="health && !health.mongo.ok" class="note warn mt rise rise-2">
      MongoDB 未连接，搜索记录与种子缓存不会被保存（其余功能可用）。在 .env 配置正确的 MONGODB_URI 后刷新即可。
    </div>

    <div class="tabs rise rise-2">
      <button :class="{ on: tab === 'search' }" @click="tab = 'search'">关键词搜索</button>
      <button :class="{ on: tab === 'file' }" @click="tab = 'file'">上传 .torrent</button>
      <button :class="{ on: tab === 'magnet' }" @click="tab = 'magnet'">磁力链</button>
    </div>

    <!-- ============ 关键词搜索 ============ -->
    <div v-show="tab === 'search'" class="stack mt rise rise-3">
      <form class="panel" @submit.prevent="doSearch()">
        <div class="panel-hd">
          <span class="label">QUERY</span>
          <span class="spacer" />
          <span class="mono small mute">{{ health?.searchProxy === '已配置' ? '经代理访问' : '直连访问' }}</span>
        </div>
        <div class="panel-bd stack sm">
          <div class="row">
            <input v-model="keyword" class="input" placeholder="输入片名 / 剧名 / 关键词，回车搜索" autofocus />
            <button class="btn btn-primary" type="submit" :disabled="searching">
              <span v-if="searching" class="spin" />
              {{ searching ? '搜索中' : '搜索' }}
            </button>
          </div>
          <div class="row wrap">
            <span class="label">搜索源</span>
            <label v-for="p in health?.providers || []" :key="p.id" class="check">
              <input v-model="activeProviders" type="checkbox" :value="p.id" />
              {{ p.label }}
            </label>
          </div>
        </div>
      </form>

      <ClientOnly>
        <KeywordCloud3D v-if="hotWords.length" :words="hotWords" @select="onHotSelect" />
      </ClientOnly>

      <div v-if="response" class="row wrap small">
        <span class="mono dim">
          {{ response.results.length }} 条结果 · {{ response.durationMs }}ms ·
          {{ response.stored ? '已写入 MongoDB' : 'MongoDB 未连接，未记录' }}
        </span>
        <span class="spacer" />
        <span v-for="r in response.reports" :key="r.id" class="tag" :class="r.ok ? 'ok' : 'err'" :title="r.error || ''">
          {{ r.label }} {{ r.ok ? `${r.count} 条 / ${r.ms}ms` : r.error }}
        </span>
      </div>

      <div v-if="response" class="panel rise">
        <div class="panel-bd tight">
          <table v-if="response.results.length" class="table">
            <thead>
              <tr>
                <th style="width: 46%">名称</th>
                <th class="hide-sm">来源</th>
                <th class="right">大小</th>
                <th class="right hide-sm">文件</th>
                <th class="right">做种</th>
                <th class="right hide-sm">下载</th>
                <th class="right hide-sm">发布</th>
                <th class="right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in pagedResults" :key="item.infoHash">
                <td class="name">{{ item.name }}</td>
                <td class="hide-sm"><span class="tag">{{ item.sourceLabel }}</span></td>
                <td class="num right">{{ formatBytes(item.size) }}</td>
                <td class="num right hide-sm dim">{{ item.fileCount ?? '—' }}</td>
                <td class="num right ok">{{ item.seeders ?? '—' }}</td>
                <td class="num right warn hide-sm">{{ item.leechers ?? '—' }}</td>
                <td class="num right dim hide-sm">{{ formatRelative(item.addedAt) }}</td>
                <td class="right">
                  <NuxtLink class="btn btn-sm" :to="previewLink(item)">预览</NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty">没有结果。换个关键词，或在「设置」里配置代理后再试。</div>
        </div>

        <div v-if="response && response.results.length > pageSize" class="panel-ft row center py-md">
          <button class="btn btn-sm btn-ghost" :disabled="page <= 1" @click="page--">上一页</button>
          <span class="mono small dim mx-lg">第 {{ page }} / {{ totalPages }} 页</span>
          <button class="btn btn-sm btn-ghost" :disabled="page >= totalPages" @click="page++">下一页</button>
        </div>
      </div>

      <div v-else-if="!searching" class="panel">
        <div class="empty">输入关键词开始搜索</div>
      </div>
    </div>

    <!-- ============ 上传 .torrent ============ -->
    <div v-show="tab === 'file'" class="stack mt rise rise-3">
      <div
        class="drop panel"
        :class="{ over: dropping }"
        @click="fileInput?.click()"
        @dragover.prevent="dropping = true"
        @dragleave.prevent="dropping = false"
        @drop.prevent="onDrop"
      >
        <div class="big">{{ parsing ? '解析中…' : '把 .torrent 文件拖到这里，或点击选择' }}</div>
        <p class="mute small">文件只在服务端解析出文件清单，不会上传到任何第三方</p>
        <input ref="fileInput" type="file" accept=".torrent,application/x-bittorrent" hidden @change="onFileChange" />
      </div>
      <TorrentDetail v-if="parsed" :torrent="parsed" :can-resolve="true" />
    </div>

    <!-- ============ 磁力链 ============ -->
    <div v-show="tab === 'magnet'" class="stack mt rise rise-3">
      <div class="panel">
        <div class="panel-hd"><span class="label">MAGNET URI</span></div>
        <div class="panel-bd stack sm">
          <textarea v-model="magnetInput" class="textarea" placeholder="magnet:?xt=urn:btih:…" />
          <div class="row">
            <button class="btn btn-primary" :disabled="parsing" @click="parseMagnet">
              <span v-if="parsing" class="spin" />
              解析磁力链
            </button>
            <span class="mute small">磁力链需要联网从 DHT / tracker 拉取元数据，才能看到文件清单</span>
          </div>
        </div>
      </div>
      <TorrentDetail v-if="parsed" :torrent="parsed" :can-resolve="true" />
    </div>
  </div>
</template>

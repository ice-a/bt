<script setup lang="ts">
import type { SearchResponse, TorrentView } from '~/types/api'
import { copyText } from '~/utils/format'
import { filterTorrents, type TorrentFilters } from '~/utils/torrentList'
import { translateText } from '~/utils/i18n'

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
const filters = reactive<TorrentFilters>({ text: '', source: '', size: '', seeded: false, sort: 'seeders' })
const selectedHashes = ref<string[]>([])

const sourceOptions = computed(() => {
  const values = new Map<string, string>()
  for (const item of response.value?.results || []) {
    if (item.source) values.set(item.source, item.sourceLabel || item.source)
  }
  return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'))
})

const filteredResults = computed(() => filterTorrents(response.value?.results || [], filters))

const pagedResults = computed(() => {
  if (!response.value) return []
  const start = (page.value - 1) * pageSize.value
  return filteredResults.value.slice(start, start + pageSize.value)
})

const totalPages = computed(() => {
  if (!response.value) return 0
  return Math.ceil(filteredResults.value.length / pageSize.value)
})

const selectedResults = computed(() => (response.value?.results || []).filter((item) => selectedHashes.value.includes(item.infoHash)))
const allVisibleSelected = computed(() => pagedResults.value.length > 0 && pagedResults.value.every((item) => selectedHashes.value.includes(item.infoHash)))

watch(filters, () => {
  page.value = 1
  selectedHashes.value = []
}, { deep: true })

watch(response, () => {
  selectedHashes.value = []
  page.value = 1
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
  selectedHashes.value = []
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

function toggleSelected(infoHash: string) {
  selectedHashes.value = selectedHashes.value.includes(infoHash)
    ? selectedHashes.value.filter((hash) => hash !== infoHash)
    : [...selectedHashes.value, infoHash]
}

function toggleAllVisible() {
  const visible = pagedResults.value.map((item) => item.infoHash)
  if (allVisibleSelected.value) {
    selectedHashes.value = selectedHashes.value.filter((hash) => !visible.includes(hash))
  } else {
    selectedHashes.value = [...new Set([...selectedHashes.value, ...visible])]
  }
}

async function copySelectedMagnets() {
  const links = selectedResults.value.map((item) => item.magnet).filter(Boolean)
  if (!links.length) return
  const ok = await copyText(links.join('\n'))
  pushToast(ok ? 'ok' : 'err', ok ? translateText('已复制 {count} 条磁力链').replace('{count}', String(links.length)) : '复制失败，请检查剪贴板权限')
}

function clearFilters() {
  filters.text = ''
  filters.source = ''
  filters.size = ''
  filters.seeded = false
  filters.sort = 'seeders'
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
      <p class="label">SEARCH · PARSE · PREVIEW</p>
      <h1>搜种子、解析文件清单、预览内容，并拿到磁力链</h1>
      <p class="sub">
        搜索走公开磁力源，解析与预览只拉取文件清单和需要的分片（不下完整文件）。
        确认后直接复制磁力链，交给你的下载工具即可。
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
          {{ filteredResults.length }} / {{ response.results.length }} 条结果 · {{ response.durationMs }}ms ·
          {{ response.stored ? '已写入 MongoDB' : 'MongoDB 未连接，未记录' }}
        </span>
        <span class="spacer" />
        <span v-for="r in response.reports" :key="r.id" class="tag" :class="r.ok ? 'ok' : 'err'" :title="r.error || ''">
          {{ r.label }} {{ r.ok ? `${r.count} 条 / ${r.ms}ms` : r.error }}
        </span>
      </div>

      <div v-if="response" class="panel rise">
        <div class="panel-hd">
          <span class="label">FILTERS</span>
          <span class="spacer" />
          <button class="btn btn-sm btn-ghost" type="button" @click="clearFilters">清除筛选</button>
        </div>
        <div class="panel-bd row wrap filter-bar">
          <input v-model="filters.text" class="input filter-search" :aria-label="translateText('按名称或 infoHash 筛选')" placeholder="按名称或 infoHash 筛选" />
          <select v-model="filters.source" class="select filter-select" :aria-label="translateText('来源筛选')">
            <option value="">全部来源</option>
            <option v-for="[id, label] in sourceOptions" :key="id" :value="id">{{ label }}</option>
          </select>
          <select v-model="filters.size" class="select filter-select" :aria-label="translateText('大小筛选')">
            <option value="">全部大小</option>
            <option value="small">小于 1 GB</option>
            <option value="medium">1–10 GB</option>
            <option value="large">10 GB 以上</option>
          </select>
          <select v-model="filters.sort" class="select filter-select" :aria-label="translateText('排序方式')">
            <option value="seeders">按做种数</option>
            <option value="newest">按发布时间</option>
            <option value="size-desc">按大小降序</option>
            <option value="size-asc">按大小升序</option>
            <option value="name">按名称</option>
          </select>
          <label class="check"><input v-model="filters.seeded" type="checkbox" /> 仅看有做种</label>
        </div>
      </div>

      <div v-if="response" class="panel rise">
        <div class="panel-ft row wrap">
          <label class="check"><input type="checkbox" :checked="allVisibleSelected" :indeterminate="!allVisibleSelected && pagedResults.some(item => selectedHashes.includes(item.infoHash))" :disabled="!pagedResults.length" @change="toggleAllVisible" /> 全选本页</label>
          <span class="mono small dim" aria-live="polite">{{ translateText('已选 {count} 条').replace('{count}', String(selectedResults.length)) }}</span>
          <span class="spacer" />
          <button class="btn btn-sm" type="button" :disabled="!selectedResults.length" @click="copySelectedMagnets">复制选中磁力链</button>
        </div>
        <div class="panel-bd tight table-scroll">
          <table v-if="filteredResults.length" class="table">
            <thead>
              <tr>
                <th class="select-col"><span class="sr-only">选择</span></th>
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
                <td class="select-col"><input type="checkbox" :checked="selectedHashes.includes(item.infoHash)" :aria-label="translateText('选择 {name}').replace('{name}', item.name)" @change="toggleSelected(item.infoHash)" /></td>
                <td class="name">{{ item.name }}</td>
                <td class="hide-sm"><span class="tag">{{ item.sourceLabel }}</span></td>
                <td class="num right">{{ formatBytes(item.size) }}</td>
                <td class="num right hide-sm dim">{{ item.fileCount ?? '—' }}</td>
                <td class="num right ok">{{ item.seeders ?? '—' }}</td>
                <td class="num right warn hide-sm">{{ item.leechers ?? '—' }}</td>
                <td class="num right dim hide-sm">{{ formatRelative(item.addedAt) }}</td>
                <td class="right">
                  <div class="row right-actions">
                    <FavoriteButton :torrent="item" />
                    <NuxtLink class="btn btn-sm" :to="previewLink(item)">预览</NuxtLink>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty">{{ translateText(response.results.length ? '没有符合筛选条件的结果。可以清除筛选后再试。' : '没有结果。换个关键词，或在「设置」里配置代理后再试。') }}</div>
        </div>

        <div v-if="response && filteredResults.length > pageSize" class="panel-ft row center py-md">
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

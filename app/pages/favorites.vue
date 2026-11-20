<script setup lang="ts">
import { MAX_BACKUP_BYTES, serializeFavorites } from '~/utils/favorites'
import { downloadText } from '~/utils/download'
import { filterTorrents, type TorrentFilters } from '~/utils/torrentList'
import { translateText } from '~/utils/i18n'

const { favorites, ready, storageError, hydrate, importBackup, removeMany } = useFavorites()
const filters = reactive<TorrentFilters>({ text: '', source: '', size: '', seeded: false, sort: 'saved' })
const fileInput = ref<HTMLInputElement | null>(null)
const selectedHashes = ref<string[]>([])
const importing = ref(false)

useHead({ title: '收藏夹 · BT 种子预览台' })

const sources = computed(() => {
  const values = new Map<string, string>()
  favorites.value.forEach((item) => values.set(item.source || 'unknown', item.sourceLabel || item.source || '未知来源'))
  return [...values.entries()]
})
const visibleFavorites = computed(() => filterTorrents(favorites.value, filters))
const allVisibleSelected = computed(() => visibleFavorites.value.length > 0 && visibleFavorites.value.every((item) => selectedHashes.value.includes(item.infoHash)))
const selectedItems = computed(() => favorites.value.filter((item) => selectedHashes.value.includes(item.infoHash)))

watch(filters, () => { selectedHashes.value = [] }, { deep: true })
watch(favorites, (items) => {
  selectedHashes.value = selectedHashes.value.filter((hash) => items.some((item) => item.infoHash === hash))
})

function toggleSelected(hash: string) {
  selectedHashes.value = selectedHashes.value.includes(hash)
    ? selectedHashes.value.filter((item) => item !== hash)
    : [...selectedHashes.value, hash]
}

function toggleAll() {
  const hashes = visibleFavorites.value.map((item) => item.infoHash)
  selectedHashes.value = allVisibleSelected.value
    ? selectedHashes.value.filter((hash) => !hashes.includes(hash))
    : [...new Set([...selectedHashes.value, ...hashes])]
}

async function copySelected() {
  if (!selectedItems.value.length) return
  const count = selectedItems.value.length
  const ok = await copyText(selectedItems.value.map((item) => item.magnet).join('\n'))
  pushToast(ok ? 'ok' : 'err', ok ? translateText('已复制 {count} 条磁力链').replace('{count}', String(count)) : '复制失败，请检查剪贴板权限')
}

function removeSelected() {
  if (!selectedItems.value.length) return
  if (removeMany(selectedHashes.value)) selectedHashes.value = []
}

function exportBackup() {
  try {
    downloadText(`bt-favorites-${new Date().toISOString().slice(0, 10)}.json`, serializeFavorites([...favorites.value]), 'application/json;charset=utf-8')
    pushToast('ok', '收藏备份已下载')
  } catch (error) {
    pushToast('err', '导出失败', errorMessage(error))
  }
}

function openImport() { fileInput.value?.click() }

async function onImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || importing.value) return
  importing.value = true
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error(translateText('收藏备份不能超过 2 MB'))
    const count = importBackup(await file.text())
    if (count !== null) pushToast('ok', count ? translateText('已导入 {count} 条新收藏').replace('{count}', String(count)) : '备份中没有新的收藏')
  } catch (error) {
    pushToast('err', '导入失败', errorMessage(error))
  } finally {
    importing.value = false
  }
}

onMounted(hydrate)
</script>

<template>
  <div class="page">
    <section class="rise">
      <p class="label">FAVORITES · LOCAL</p>
      <h1>收藏夹</h1>
      <p class="sub">收藏只保存在当前浏览器。可以导出 JSON 备份，在另一台设备导入后继续使用。</p>
    </section>

    <div v-if="storageError" class="note err mt rise rise-2" role="alert">{{ translateText(storageError) }}</div>

    <div class="panel mt rise rise-2">
      <div class="panel-hd row wrap">
        <span class="label">LIBRARY</span>
        <span class="mono small dim">{{ translateText('{count} 条收藏').replace('{count}', String(favorites.length)) }}</span>
        <span class="spacer" />
        <button class="btn btn-sm" type="button" :disabled="!ready || !!storageError" @click="exportBackup">导出备份</button>
        <button class="btn btn-sm btn-ghost" type="button" :disabled="!ready || importing" @click="openImport">{{ translateText(importing ? '导入中…' : '导入备份') }}</button>
        <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onImport" />
      </div>
      <div class="panel-bd row wrap filter-bar">
        <input v-model="filters.text" class="input filter-search" :aria-label="translateText('按名称或 infoHash 筛选')" placeholder="按名称或 infoHash 筛选" />
        <select v-model="filters.source" class="select filter-select" :aria-label="translateText('来源筛选')">
          <option value="">全部来源</option>
          <option v-for="[id, label] in sources" :key="id" :value="id">{{ label }}</option>
        </select>
        <select v-model="filters.size" class="select filter-select" :aria-label="translateText('大小筛选')">
          <option value="">全部大小</option>
          <option value="small">小于 1 GB</option>
          <option value="medium">1–10 GB</option>
          <option value="large">10 GB 以上</option>
        </select>
        <select v-model="filters.sort" class="select filter-select" :aria-label="translateText('排序方式')">
          <option value="saved">按收藏时间</option>
          <option value="seeders">按做种数</option>
          <option value="newest">按发布时间</option>
          <option value="size-desc">按大小降序</option>
          <option value="size-asc">按大小升序</option>
          <option value="name">按名称</option>
        </select>
        <label class="check"><input v-model="filters.seeded" type="checkbox" /> 仅看有做种</label>
      </div>
    </div>

    <div class="panel mt rise rise-3">
      <div class="panel-ft row wrap">
        <label class="check"><input type="checkbox" :checked="allVisibleSelected" :indeterminate="selectedItems.length > 0 && !allVisibleSelected" :disabled="!visibleFavorites.length" @change="toggleAll" /> 全选</label>
        <span class="mono small dim" aria-live="polite">{{ translateText('已选 {count} 条').replace('{count}', String(selectedItems.length)) }}</span>
        <span class="spacer" />
        <button class="btn btn-sm" type="button" :disabled="!selectedItems.length" @click="copySelected">复制选中磁力链</button>
        <button class="btn btn-sm btn-danger" type="button" :disabled="!selectedItems.length" @click="removeSelected">取消选中收藏</button>
      </div>
      <div class="panel-bd tight table-scroll">
        <table v-if="visibleFavorites.length" class="table">
          <thead><tr><th class="select-col"><span class="sr-only">选择</span></th><th style="width: 48%">名称</th><th class="hide-sm">来源</th><th class="right">大小</th><th class="right hide-sm">做种</th><th class="right hide-sm">收藏时间</th><th class="right">操作</th></tr></thead>
          <tbody>
            <tr v-for="item in visibleFavorites" :key="item.infoHash">
              <td class="select-col"><input type="checkbox" :checked="selectedHashes.includes(item.infoHash)" :aria-label="translateText('选择 {name}').replace('{name}', item.name)" @change="toggleSelected(item.infoHash)" /></td>
              <td class="name">{{ item.name }}<span class="mono small dim break" style="display: block">{{ item.infoHash }}</span></td>
              <td class="hide-sm"><span class="tag">{{ item.sourceLabel || item.source || '未知来源' }}</span></td>
              <td class="num right">{{ formatBytes(item.size) }}</td>
              <td class="num right ok hide-sm">{{ item.seeders ?? '—' }}</td>
              <td class="num right dim hide-sm">{{ formatRelative(item.savedAt) }}</td>
              <td class="right"><div class="row right-actions"><NuxtLink class="btn btn-sm" :to="{ path: `/torrent/${item.infoHash}`, query: { magnet: item.magnet, name: item.name } }">打开</NuxtLink><FavoriteButton :torrent="item" /></div></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">{{ translateText(!ready ? '加载中…' : storageError ? '收藏暂不可用' : favorites.length ? '没有符合筛选条件的收藏' : '还没有收藏。搜索结果和种子详情页都可以加入收藏。') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TorrentFileEntry } from '~/types/api'

const props = defineProps<{
  files: TorrentFileEntry[] | null
  total: number
  resolving?: boolean
  resolveError?: string | null
}>()

const emit = defineEmits<{ resolve: []; preview: [file: TorrentFileEntry] }>()

const keyword = ref('')
const sort = ref<'size' | 'name'>('size')

/** 图片且体积没超上限，才值得从 swarm 拉下来预览 */
function previewable(file: TorrentFileEntry): boolean {
  return file.length > 0 && file.length <= MAX_IMAGE_PREVIEW_BYTES && isImagePath(file.path)
}

const visible = computed(() => {
  let list = props.files || []
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    list = list.filter((f) => f.path.toLowerCase().includes(kw))
  }
  const sorted = [...list]
  if (sort.value === 'size') sorted.sort((a, b) => b.length - a.length)
  else sorted.sort((a, b) => a.path.localeCompare(b.path))
  return sorted.slice(0, 500)
})

const truncated = computed(() => (props.files?.length || 0) > 500)
</script>

<template>
  <div>
    <div v-if="resolving" class="empty">
      <span class="spin" /> 正在通过 DHT / tracker 获取种子元数据，通常几秒到几十秒…
    </div>

    <div v-else-if="!files" class="stack sm" style="padding: 18px">
      <div class="note warn">
        这个种子只有 infoHash，还没有文件清单。可以点击下面的按钮在线拉取元数据（需要本机能连上 DHT / tracker）。
      </div>
      <div v-if="resolveError" class="note err">{{ resolveError }}</div>
      <div>
        <button class="btn btn-primary" @click="emit('resolve')">在线解析文件清单</button>
      </div>
    </div>

    <template v-else>
      <div class="panel-hd" style="border-top: none">
        <span class="label">FILE LIST</span>
        <span class="mono small dim">{{ formatNumber(files.length) }} 个文件 · {{ formatBytes(total) }}</span>
        <span class="spacer" />
        <input v-model="keyword" class="input" style="width: 200px" placeholder="过滤文件名…" />
        <select v-model="sort" class="select" style="width: 120px">
          <option value="size">按大小</option>
          <option value="name">按名称</option>
        </select>
      </div>

      <div style="max-height: 520px; overflow: auto">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 58%">路径</th>
              <th class="right" style="width: 14%">大小</th>
              <th class="right" style="width: 10%">占比</th>
              <th style="width: 76px" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(f, i) in visible" :key="i">
              <td class="file-path">
                <span class="file-dir">{{ splitPath(f.path).dir }}</span><span class="file-name">{{ splitPath(f.path).name }}</span>
              </td>
              <td class="num right">{{ formatBytes(f.length) }}</td>
              <td class="num right mute">{{ filePercent(f.length, total) }}</td>
              <td class="right">
                <button
                  v-if="previewable(f)"
                  class="btn btn-sm btn-ghost"
                  :title="`从做种节点拉取这张图片用于预览：${f.path}`"
                  @click="emit('preview', f)"
                >
                  预览
                </button>
                <span v-else-if="isImagePath(f.path)" class="dim small" title="图片体积超出在线预览上限">过大</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="truncated" class="empty">结果较多，表格只展示前 500 条，可用过滤框缩小范围</div>
    </template>
  </div>
</template>

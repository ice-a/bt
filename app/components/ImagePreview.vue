<script setup lang="ts">
import type { TorrentFileEntry } from '~/types/api'

const props = defineProps<{
  infoHash: string
  magnet: string
  /** 全部可预览的图片，按文件清单原始顺序 */
  images: TorrentFileEntry[]
  index: number
}>()

const emit = defineEmits<{ close: []; 'update:index': [value: number] }>()

const status = ref<'loading' | 'ok' | 'err'>('loading')
const errorText = ref('')
const src = ref('')
let objectUrl = ''

const current = computed<TorrentFileEntry | undefined>(() => props.images[props.index])
const requestUrl = computed(
  () =>
    `/api/torrent/${props.infoHash}/preview?path=${encodeURIComponent(
      current.value?.path || ''
    )}&magnet=${encodeURIComponent(props.magnet)}`
)

function revoke() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }
}

async function load() {
  revoke()
  src.value = ''
  errorText.value = ''
  status.value = 'loading'
  try {
    const res = await fetch(requestUrl.value)
    if (!res.ok) {
      // 服务端用 statusMessage 带上可读原因：没有做种节点 / 图片过大 / 文件不存在
      const text = await res.text()
      let message = text
      try {
        const json = JSON.parse(text)
        message = json.statusMessage || json.message || text
      } catch {
        /* 不是 JSON 就用原文 */
      }
      throw new Error(message || `请求失败（HTTP ${res.status}）`)
    }
    objectUrl = URL.createObjectURL(await res.blob())
    src.value = objectUrl
    status.value = 'ok'
  } catch (err) {
    errorText.value = errorMessage(err)
    status.value = 'err'
  }
}

function step(delta: number) {
  const next = props.index + delta
  if (next < 0 || next >= props.images.length) return
  emit('update:index', next)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowLeft') step(-1)
  else if (e.key === 'ArrowRight') step(1)
}

watch(() => [props.index, props.infoHash, props.magnet], load, { immediate: true })

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  revoke()
})
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="lightbox">
      <div class="panel-hd">
        <span class="label">IMAGE</span>
        <span class="mono small truncate" style="max-width: 36ch" :title="current?.path">
          {{ splitPath(current?.path || '').name }}
        </span>
        <span class="spacer" />
        <span class="mono small dim">{{ index + 1 }} / {{ images.length }}</span>
        <span class="mono small dim">{{ formatBytes(current?.length) }}</span>
        <button class="btn btn-sm btn-ghost" @click="emit('close')">关闭</button>
      </div>

      <div class="lightbox-bd">
        <div v-if="status === 'loading'" class="empty">
          <span class="spin" /> 正在从做种节点拉取这张图片，取决于对方的上传速度…
        </div>
        <div v-else-if="status === 'err'" class="stack sm" style="padding: 22px">
          <div class="note err">{{ errorText }}</div>
          <div class="row">
            <button class="btn btn-sm" @click="load">重试</button>
            <a class="btn btn-sm btn-ghost" :href="requestUrl" target="_blank" rel="noreferrer noopener">
              直接打开图片地址
            </a>
          </div>
        </div>
        <img v-else :src="src" :alt="current?.path || 'preview'" class="lightbox-img" />
      </div>

      <div class="lightbox-ft">
        <button class="btn btn-sm" :disabled="index <= 0" @click="step(-1)">← 上一张</button>
        <span class="mono small dim truncate" style="max-width: 44ch" :title="current?.path">{{ current?.path }}</span>
        <button class="btn btn-sm" :disabled="index >= images.length - 1" @click="step(1)">下一张 →</button>
      </div>
    </div>
  </div>
</template>

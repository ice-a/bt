<script setup lang="ts">
import type { TorrentFileEntry, TorrentView } from '~/types/api'
import { translateText } from '~/utils/i18n'
import { resolveMetadataClient, type ResolveProgress } from '~/utils/clientTorrent'

const props = defineProps<{
  torrent: TorrentView
  /** 是否允许在线解析磁力链文件清单 */
  canResolve?: boolean
}>()

const emit = defineEmits<{ resolved: [payload: { files: TorrentFileEntry[]; size: number; name: string }] }>()

const local = ref<TorrentView>({ ...props.torrent })
const resolving = ref(false)
const resolveStatus = ref('')
const showTrackers = ref(false)

watch(
  () => props.torrent,
  (next) => {
    local.value = { ...next }
  },
  { deep: true }
)

const files = computed(() => local.value.files)
const total = computed(() => files.value?.reduce((s, f) => s + f.length, 0) || local.value.size || 0)

/** 可在线预览的图片：按文件清单原始顺序，预览弹窗靠这个顺序翻页 */
const previewImages = computed<TorrentFileEntry[]>(() =>
  (files.value || []).filter((f) => f.length > 0 && f.length <= MAX_IMAGE_PREVIEW_BYTES && isImagePath(f.path))
)
const previewIndex = ref<number | null>(null)

function openPreview(file: TorrentFileEntry) {
  const index = previewImages.value.findIndex((f) => f.path === file.path)
  if (index >= 0) previewIndex.value = index
}

// 文件清单变了（例如刚在线解析完），旧的索引可能已经失效
watch(files, () => {
  previewIndex.value = null
})

const sourceIcon: Record<string, string> = {
  apibay: 'The Pirate Bay',
  nyaa: 'Nyaa',
  cilisousuo: '磁力搜索',
  upload: '本地上传',
  magnet: '磁力链',
  database: '数据库'
}

function applyResolved(res: { files: TorrentFileEntry[]; size: number; name: string }) {
  local.value.files = res.files
  local.value.size = res.size
  local.value.fileCount = res.files.length
  local.value.resolveError = null
  if (res.name) local.value.name = res.name
  emit('resolved', res)
}

function resolveStatusText(p: ResolveProgress): string {
  if (p.phase === 'connecting') {
    return p.peers > 0
      ? `${translateText('已连接')} ${p.peers} ${translateText('个节点，正在获取元数据…')}`
      : translateText('正在通过 WebRTC 寻找 P2P 节点…')
  }
  if (p.phase === 'metadata') return translateText('已拿到元数据，正在整理文件清单…')
  return `${translateText('共')} ${p.peers} ${translateText('个节点')}`
}

async function doResolve() {
  resolving.value = true
  resolveStatus.value = ''
  try {
    // 服务端先尝试（缓存服务取清单，自托管还会走 P2P），成功即返回并落库
    const res = await $fetch<{ files: TorrentFileEntry[]; size: number; name: string }>(
      `/api/torrent/${local.value.infoHash}/resolve`,
      { method: 'POST', body: { magnet: local.value.magnet } }
    )
    applyResolved(res)
    pushToast('ok', '文件清单已解析', `共 ${res.files.length} 个文件 / ${formatBytes(res.size)}`)
  } catch {
    // 服务端无法走 P2P（如 Vercel/Serverless）→ 回退到浏览器端 WebRTC 直接解析
    try {
      const meta = await resolveMetadataClient(local.value.magnet, {
      timeoutMs: 30000,
      onProgress: (p: ResolveProgress) => {
        resolveStatus.value = resolveStatusText(p)
      }
    })
      applyResolved(meta)
      pushToast('ok', '通过浏览器 P2P 解析文件清单', `共 ${meta.files.length} 个文件 / ${formatBytes(meta.size)}`)
    } catch (err2) {
      const msg = errorMessage(err2)
      local.value.resolveError = msg
      pushToast('err', '解析失败', msg)
    }
  } finally {
    resolving.value = false
  }
}

async function copyMagnet() {
  const ok = await copyText(local.value.magnet)
  pushToast(ok ? 'ok' : 'err', ok ? '磁力链已复制到剪贴板' : '复制失败，请手动选中复制')
}

onMounted(() => {
  // 如果没有文件清单，且是磁力链接（有 magnet），则自动尝试解析
  if (!local.value.files && local.value.magnet && props.canResolve !== false) {
    doResolve()
  }
})
</script>

<template>
  <div class="stack">
    <div class="panel">
      <div class="panel-hd">
        <span class="label">TORRENT</span>
        <span class="mono small truncate" style="max-width: 46ch" :title="local.name">{{ local.name }}</span>
        <span class="spacer" />
        <span class="tag">{{ sourceIcon[local.source || ''] || local.source || '未知来源' }}</span>
        <span v-if="local.category" class="tag acc">{{ local.category }}</span>
      </div>

      <div class="panel-bd stack">
        <div class="grid-4">
          <div class="stat">
            <span class="label">总大小</span>
            <span class="v">{{ formatBytes(total) }}</span>
          </div>
          <div class="stat">
            <span class="label">文件数</span>
            <span class="v">{{ local.files ? formatNumber(local.files.length) : local.fileCount ?? '未知' }}</span>
          </div>
          <div class="stat">
            <span class="label">做种 / 下载</span>
            <span class="v">
              <span class="ok">{{ local.seeders ?? '—' }}</span>
              <span class="mute"> / </span>
              <span class="warn">{{ local.leechers ?? '—' }}</span>
            </span>
          </div>
          <div class="stat">
            <span class="label">发布时间</span>
            <span class="v small">{{ local.creationDate ? formatDate(local.creationDate) : '—' }}</span>
          </div>
        </div>

        <dl class="kv">
          <dt>infoHash</dt>
          <dd class="mono break small">{{ local.infoHash }}</dd>
          <dt>Trackers</dt>
          <dd>
            <button class="btn btn-sm btn-ghost" @click="showTrackers = !showTrackers">
              {{ local.trackers?.length || 0 }} 个{{ showTrackers ? ' · 收起' : ' · 展开' }}
            </button>
            <div v-if="showTrackers" class="stack sm mt" style="max-height: 180px; overflow: auto">
              <span v-for="t in local.trackers" :key="t" class="mono small dim break">{{ t }}</span>
            </div>
          </dd>
          <dt v-if="local.comment">备注</dt>
          <dd v-if="local.comment" class="small dim">{{ local.comment }}</dd>
        </dl>

        <div class="row wrap">
          <button class="btn btn-sm" @click="copyMagnet">复制磁力链</button>
          <a v-if="local.hasFile" class="btn btn-sm" :href="`/api/torrent/${local.infoHash}/file`">下载 .torrent</a>
          <a v-if="local.sourceUrl" class="btn btn-sm btn-ghost" :href="local.sourceUrl" target="_blank" rel="noreferrer noopener">
            打开来源页面
          </a>
        </div>
      </div>
    </div>

    <SendPanel :torrent="local" />

    <div v-if="previewImages.length" class="note">
      文件清单里有 {{ previewImages.length }} 张图片可以点「预览」直接看：只会按需拉取这几张图所在的分片，不会下载整个种子。
    </div>

    <div v-if="resolving && resolveStatus" class="note warn">{{ resolveStatus }}</div>

    <div class="panel">
      <div class="panel-bd tight">
        <FileTable
          :files="files"
          :total="total"
          :resolving="resolving"
          :resolve-error="local.resolveError"
          @resolve="doResolve"
          @preview="openPreview"
        />
      </div>
    </div>

    <ImagePreview
      v-if="previewIndex !== null"
      :info-hash="local.infoHash"
      :magnet="local.magnet"
      :images="previewImages"
      :index="previewIndex"
      @update:index="previewIndex = $event"
      @close="previewIndex = null"
    />
  </div>
</template>

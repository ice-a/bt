<script setup lang="ts">
import type { TorrentView } from '~/types/api'
import { translateText } from '~/utils/i18n'

defineProps<{ torrent: TorrentView }>()
const { ready, isFavorite, toggle } = useFavorites()
</script>

<template>
  <button
    class="btn btn-sm favorite-btn"
    :class="{ saved: isFavorite(torrent.infoHash) }"
    :disabled="!ready"
    :aria-pressed="isFavorite(torrent.infoHash)"
    :aria-label="translateText(isFavorite(torrent.infoHash) ? '取消收藏' : '收藏种子')"
    @click="toggle(torrent)"
  >
    <span aria-hidden="true">{{ isFavorite(torrent.infoHash) ? '★' : '☆' }}</span>
    <span>{{ translateText(isFavorite(torrent.infoHash) ? '已收藏' : '收藏') }}</span>
  </button>
</template>

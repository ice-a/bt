<script setup lang="ts">
const toasts = useToasts()
</script>

<template>
  <div class="toasts">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="t.kind" @click="dismissToast(t.id)">
      <span class="mono small" :class="t.kind === 'err' ? 'err' : t.kind === 'ok' ? 'ok' : 'acc'">
        {{ t.kind === 'err' ? '✕' : t.kind === 'warn' ? '!' : t.kind === 'ok' ? '✓' : 'i' }}
      </span>
      <span>
        <strong style="font-weight: 600">{{ t.title }}</strong>
        <span v-if="t.detail" class="dim" style="display: block; margin-top: 2px; font-size: 12px">{{ t.detail }}</span>
      </span>
    </div>
  </div>
</template>

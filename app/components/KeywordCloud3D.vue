<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Word {
  text: string
  weight: number
}

const props = defineProps<{
  words: Word[]
  max?: number
}>()

const emit = defineEmits<{ select: [keyword: string] }>()

const R = 130
const tagEls = ref<(HTMLElement | null)[]>([])
const paused = ref(false)
let raf = 0
let ry = 0
let rx = 0.15
const bases: { x: number; y: number; z: number }[] = []

/** 用斐波那契球把 N 个点均匀铺在球面上 */
function buildBases(n: number) {
  bases.length = 0
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n)
    const theta = golden * i
    bases.push({
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.sin(phi) * Math.sin(theta),
      z: Math.cos(phi)
    })
  }
}

function tick() {
  if (!paused.value) {
    ry += 0.0022
    rx += 0.0006
  }
  const maxW = Math.max(1, ...props.words.map((w) => w.weight))
  const cosY = Math.cos(ry)
  const sinY = Math.sin(ry)
  const cosX = Math.cos(rx)
  const sinX = Math.sin(rx)
  for (let i = 0; i < bases.length; i++) {
    const el = tagEls.value[i]
    if (!el) continue
    const b = bases[i]
    // 绕 Y 轴旋转
    const x1 = b.x * cosY + b.z * sinY
    const z1 = -b.x * sinY + b.z * cosY
    const y1 = b.y
    // 绕 X 轴旋转
    const y2 = y1 * cosX - z1 * sinX
    const z2 = y1 * sinX + z1 * cosX
    const x2 = x1

    const depth = (z2 + 1) / 2 // 0(远) ~ 1(近)
    const scale = 0.55 + depth * 0.85
    const w = props.words[i]
    const size = 13 + (w.weight / maxW) * 16

    el.style.transform = `translate(-50%, -50%) translate3d(${x2 * R}px, ${y2 * R}px, ${z2 * R}px) scale(${scale})`
    el.style.opacity = String(0.35 + depth * 0.65)
    el.style.zIndex = String(Math.round(depth * 100))
    el.style.fontSize = `${size}px`
    el.style.color = depth > 0.78 ? 'var(--acc)' : depth > 0.5 ? 'var(--fg)' : 'var(--mute)'
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  buildBases(props.words.length)
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => cancelAnimationFrame(raf))

watch(
  () => props.words.length,
  (n) => buildBases(n)
)
</script>

<template>
  <div class="cloud">
    <div class="cloud-hd">
      <span class="label">HOT KEYWORDS</span>
      <span class="spacer" />
      <span class="mute small">点击关键词直接搜索</span>
    </div>
    <div class="cloud-stage" @mouseenter="paused = true" @mouseleave="paused = false">
      <button
        v-for="(w, i) in words"
        :key="w.text"
        class="cloud-tag"
        :ref="(el) => { tagEls[i] = (el as unknown as HTMLElement) || null }"
        @click="emit('select', w.text)"
      >
        {{ w.text }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.cloud {
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--panel-2);
  padding: 12px 14px 4px;
}
.cloud-hd {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}
.cloud-stage {
  position: relative;
  height: 300px;
  perspective: 900px;
  overflow: hidden;
}
.cloud-tag {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  font-weight: 600;
  line-height: 1;
  transition: color 0.2s;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
}
.cloud-tag:hover {
  color: var(--acc) !important;
  opacity: 1 !important;
}
</style>

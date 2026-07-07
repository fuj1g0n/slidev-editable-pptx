<script setup>
// DiagCylinder — DB・ストレージのシリンダー（ADR-0002 P10、
// flowChartMagneticDisk 相当）。上面楕円 + 胴の縦シリンダー固定。
// editable PPTX へは data-pptx="polygon"（外形 = 閉路 + 手前リム = 開路）で写る。
import { computed, inject, onMounted } from 'vue'
import { resolveIconSrc } from './icons.js'
import { FILLS } from './fills.js'

const props = defineProps({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  w: { type: Number, required: true },
  h: { type: Number, required: true },
  label: { type: String, default: '' },
  icon: { type: String, default: '' }, // /icons/... の URL
  fill: { type: String, default: 'zoneInner' },
  size: { type: Number, default: 14 },
  iconSize: { type: Number, default: 28 },
})

const boxes = inject('diag-boxes')
onMounted(() => {
  boxes[props.id] = { x: props.x, y: props.y, w: props.w, h: props.h }
})

const N = 20 // 楕円弧のサンプル数

const geo = computed(() => {
  const { w, h } = props
  const ry = Math.min(Math.max(h * 0.16, 8), 18)
  const arc = (cy, dir, from, to) => {
    // 上面楕円の弧。dir=-1 で上に、+1 で下に膨らむ
    const pts = []
    for (let i = 0; i <= N; i++) {
      const t = from + ((to - from) * i) / N
      pts.push([0.5 + 0.5 * Math.cos(t), (cy + dir * ry * Math.sin(t)) / h])
    }
    return pts.map(([nx, ny]) => [nx, ny])
  }
  // 外形: 上面の上半分 → 右胴 → 底の下半分 → 左胴（閉路）
  const silhouette = [
    ...arc(ry, -1, Math.PI, 0),
    [1, (h - ry) / h],
    ...arc(h - ry, 1, 0, Math.PI),
  ]
  // 手前リム: 上面楕円の下半分（開路）
  const rim = arc(ry, 1, Math.PI, 0)
  const toD = (pts, close) =>
    `${pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0] * w} ${p[1] * h}`).join(' ')}${close ? ' Z' : ''}`
  return { ry, silhouette, rim, dSil: toD(silhouette, true), dRim: toD(rim, false) }
})

const meta = computed(() =>
  JSON.stringify({
    paths: [
      { points: geo.value.silhouette, closed: true },
      { points: geo.value.rim, closed: false },
    ],
  }),
)

const iconSrc = computed(() => resolveIconSrc(props.icon))
</script>

<template>
  <div
    class="diag-cylinder"
    :style="{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }"
  >
    <svg data-pptx="polygon" :data-pptx-polygon="meta" :viewBox="`0 0 ${w} ${h}`">
      <path :d="geo.dSil" :fill="FILLS[fill] ?? FILLS.zoneInner" stroke="var(--tech-fg)" stroke-width="1" />
      <path :d="geo.dRim" fill="none" stroke="var(--tech-fg)" stroke-width="1" />
    </svg>
    <div class="diag-cylinder-body" :style="{ top: `${geo.ry * 2}px`, height: `${h - geo.ry * 2}px` }">
      <div v-if="icon" data-diag="icon-label">
        <img :src="iconSrc" :style="{ width: `${iconSize}px`, height: `${iconSize}px` }" alt="" />
      </div>
      <span v-if="label" data-diag="text" :style="{ fontSize: `${size}px` }">{{ label }}</span>
    </div>
  </div>
</template>

<style scoped>
.diag-cylinder {
  position: absolute;
}
.diag-cylinder svg {
  width: 100%;
  height: 100%;
  display: block;
}
.diag-cylinder-body {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  pointer-events: none;
}
.diag-cylinder-body img {
  margin: 0;
}
.diag-cylinder-body span {
  color: var(--tech-fg);
  line-height: 1.3;
  text-align: center;
  white-space: pre-line;
}
</style>

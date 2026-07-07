<script setup>
// DiagBadge — 点物マーカー（ADR-0002 P8）。番号丸・リング・禁止・加算・
// 乗算・星を kind で選ぶ。境界は size 四方の正方形。
// circle / ring / ban は角丸 div（data-diag="box"、正円 roundRect に写る）、
// 斜線は data-diag="edge"、plus / cross / star は data-pptx="polygon" に写る。
import { computed, inject, onMounted } from 'vue'
import { FILLS } from './fills.js'

const props = defineProps({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  size: { type: Number, default: 28 },
  label: { type: String, default: '' }, // circle / ring の中央ラベル
  kind: { type: String, default: 'circle' }, // circle | ring | ban | plus | cross | star
  fill: { type: String, default: 'accent' },
})

const boxes = inject('diag-boxes')
onMounted(() => {
  boxes[props.id] = { x: props.x, y: props.y, w: props.size, h: props.size }
})

const isRound = computed(() => ['circle', 'ring', 'ban'].includes(props.kind))

// ban の斜線（左上 → 右下）。座標はキャンバス基準 px（data-diag="edge" 契約）
const slash = computed(() => {
  const r = props.size / 2
  const k = (r - 2) * Math.SQRT1_2
  const [cx, cy] = [props.x + r, props.y + r]
  return { points: [{ x: cx - k, y: cy - k }, { x: cx + k, y: cy + k }], noArrow: true }
})

const rot = (pts, deg, scale) => {
  const rad = (deg * Math.PI) / 180
  const [c, s] = [Math.cos(rad), Math.sin(rad)]
  return pts.map(([px, py]) => {
    const [dx, dy] = [px - 0.5, py - 0.5]
    return [0.5 + scale * (dx * c - dy * s), 0.5 + scale * (dx * s + dy * c)]
  })
}

const polyPoints = computed(() => {
  if (props.kind === 'star') {
    const pts = []
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.5 : 0.205
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      pts.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)])
    }
    return pts
  }
  const t = 0.32
  const [a, b] = [(1 - t) / 2, (1 + t) / 2]
  const plus = [
    [a, 0], [b, 0], [b, a], [1, a], [1, b], [b, b],
    [b, 1], [a, 1], [a, b], [0, b], [0, a], [a, a],
  ]
  return props.kind === 'cross' ? rot(plus, 45, 0.95) : plus
})

const d = computed(() =>
  `${polyPoints.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0] * props.size} ${p[1] * props.size}`)
    .join(' ')} Z`,
)
</script>

<template>
  <div
    v-if="isRound"
    data-diag="box"
    class="diag-badge"
    :class="`diag-badge-${kind}`"
    :style="{
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      background: kind === 'circle' ? (FILLS[fill] ?? FILLS.accent) : 'transparent',
    }"
  >
    <span v-if="label" data-diag-label :class="{ 'diag-badge-label-fg': kind !== 'circle' }">{{
      label
    }}</span>
  </div>
  <div
    v-else
    class="diag-badge-poly"
    :style="{ left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` }"
  >
    <svg
      data-pptx="polygon"
      :data-pptx-polygon="JSON.stringify({ paths: [{ points: polyPoints, closed: true }] })"
      :viewBox="`0 0 ${size} ${size}`"
    >
      <path :d="d" :fill="FILLS[fill] ?? FILLS.accent" stroke="none" />
    </svg>
  </div>
  <svg v-if="kind === 'ban'" class="diag-badge-slash" data-diag="edge" :data-diag-edge="JSON.stringify(slash)">
    <path
      :d="`M ${slash.points[0].x} ${slash.points[0].y} L ${slash.points[1].x} ${slash.points[1].y}`"
      fill="none"
      stroke="var(--tech-fg)"
      stroke-width="2"
    />
  </svg>
</template>

<style scoped>
.diag-badge {
  position: absolute;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.diag-badge-circle {
  color: var(--tech-bg);
}
.diag-badge-ring,
.diag-badge-ban {
  border: 2px solid var(--tech-fg);
}
.diag-badge span {
  font-size: 14px;
  font-weight: 700;
}
.diag-badge-label-fg {
  color: var(--tech-fg);
}
.diag-badge-poly {
  position: absolute;
}
.diag-badge-poly svg {
  width: 100%;
  height: 100%;
  display: block;
}
.diag-badge-slash {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
</style>

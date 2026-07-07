<script setup>
// DiagCallout — 吹き出し注釈（ADR-0002 P6）。wedge / border 系プリセットの
// 意味論（この対象への注釈）を、角丸矩形 + 三角尾の単一多角形に統一する
// （ADR-0002 R-4）。x/y/w/h は本体矩形で、尾は外側へ 12px 出る。
// target を指定すると尾の辺と位置を相手ボックスから自動決定する。
import { computed, inject, onMounted } from 'vue'
import { FILLS } from './fills.js'

const props = defineProps({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  w: { type: Number, required: true },
  h: { type: Number, required: true },
  label: { type: String, default: '' },
  tail: { type: String, default: 'bottom' }, // 尾の出る辺: bottom | top | left | right
  tailAt: { type: Number, default: 0.5 }, // 辺上の尾の位置（0..1）
  target: { type: String, default: '' }, // 指す相手の id。指定時は tail/tailAt を自動決定
  fill: { type: String, default: 'emphasis' },
  size: { type: Number, default: 14 },
  bold: { type: Boolean, default: false },
})

const TAIL = 12 // 尾の長さ px
const BASE = 16 // 尾の付け根幅 px
const R = 6 // 角丸半径 px

const boxes = inject('diag-boxes')
onMounted(() => {
  boxes[props.id] = { x: props.x, y: props.y, w: props.w, h: props.h }
})

// target 指定時は相手との相対位置から尾の辺と位置を解決する
const resolved = computed(() => {
  const t = props.target ? boxes[props.target] : null
  if (!t) return { side: props.tail, at: props.tailAt }
  const clamp = (v) => Math.min(0.85, Math.max(0.15, v))
  const [cx, cy] = [t.x + t.w / 2, t.y + t.h / 2]
  if (t.y + t.h <= props.y) return { side: 'top', at: clamp((cx - props.x) / props.w) }
  if (t.y >= props.y + props.h) return { side: 'bottom', at: clamp((cx - props.x) / props.w) }
  if (t.x + t.w <= props.x) return { side: 'left', at: clamp((cy - props.y) / props.h) }
  return { side: 'right', at: clamp((cy - props.y) / props.h) }
})

// SVG ボックスは本体 + 尾ぶんの外形。頂点は本体基準の px で組み、正規化する
const geo = computed(() => {
  const { w, h } = props
  const { side, at } = resolved.value
  const ox = side === 'left' ? TAIL : 0
  const oy = side === 'top' ? TAIL : 0
  const W = w + (side === 'left' || side === 'right' ? TAIL : 0)
  const H = h + (side === 'top' || side === 'bottom' ? TAIL : 0)
  const [x0, y0, x1, y1] = [ox, oy, ox + w, oy + h]
  const mid = (len) => Math.min(Math.max(at * len, R + BASE / 2 + 2), len - R - BASE / 2 - 2)
  const pts = []
  const L = (x, y) => pts.push([x, y])
  const Q = (cx, cy, x, y) => pts.push([cx, cy, x, y])
  L(x0 + R, y0)
  if (side === 'top') {
    const m = x0 + mid(w)
    L(m - BASE / 2, y0)
    L(m, y0 - TAIL)
    L(m + BASE / 2, y0)
  }
  L(x1 - R, y0)
  Q(x1, y0, x1, y0 + R)
  if (side === 'right') {
    const m = y0 + mid(h)
    L(x1, m - BASE / 2)
    L(x1 + TAIL, m)
    L(x1, m + BASE / 2)
  }
  L(x1, y1 - R)
  Q(x1, y1, x1 - R, y1)
  if (side === 'bottom') {
    const m = x0 + mid(w)
    L(m + BASE / 2, y1)
    L(m, y1 + TAIL)
    L(m - BASE / 2, y1)
  }
  L(x0 + R, y1)
  Q(x0, y1, x0, y1 - R)
  if (side === 'left') {
    const m = y0 + mid(h)
    L(x0, m + BASE / 2)
    L(x0 - TAIL, m)
    L(x0, m - BASE / 2)
  }
  L(x0, y0 + R)
  Q(x0, y0, x0 + R, y0)
  const norm = pts.map((p) =>
    p.length === 4 ? [p[0] / W, p[1] / H, p[2] / W, p[3] / H] : [p[0] / W, p[1] / H],
  )
  let d = ''
  pts.forEach((p, i) => {
    if (i === 0) d = `M ${p[0]} ${p[1]}`
    else if (p.length === 4) d += ` Q ${p[0]} ${p[1]} ${p[2]} ${p[3]}`
    else d += ` L ${p[0]} ${p[1]}`
  })
  return { W, H, ox, oy, d: `${d} Z`, norm }
})
</script>

<template>
  <div
    class="diag-callout"
    :style="{
      left: `${x - geo.ox}px`,
      top: `${y - geo.oy}px`,
      width: `${geo.W}px`,
      height: `${geo.H}px`,
    }"
  >
    <svg
      data-pptx="polygon"
      :data-pptx-polygon="JSON.stringify({ paths: [{ points: geo.norm, closed: true }] })"
      :viewBox="`0 0 ${geo.W} ${geo.H}`"
    >
      <path
        :d="geo.d"
        :fill="FILLS[fill] ?? FILLS.emphasis"
        stroke="var(--tech-fg)"
        stroke-width="1"
        stroke-linejoin="round"
      />
    </svg>
    <div
      v-if="label"
      class="diag-callout-label-wrap"
      :style="{ left: `${geo.ox}px`, top: `${geo.oy}px`, width: `${w}px`, height: `${h}px` }"
    >
      <span
        data-diag="text"
        :style="{ fontSize: `${size}px`, fontWeight: bold ? 700 : 400 }"
        >{{ label }}</span
      >
    </div>
  </div>
</template>

<style scoped>
.diag-callout {
  position: absolute;
}
.diag-callout svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}
.diag-callout-label-wrap {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  pointer-events: none;
}
.diag-callout-label-wrap span {
  color: var(--tech-fg);
  line-height: 1.3;
  text-align: center;
  white-space: pre-line;
}
</style>

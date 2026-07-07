<script setup>
// DiagBrace — ブレース（波括弧）注釈（ADR-0002 P9）。複数要素をまとめて
// 「この範囲」を示す。from/to の id 参照で範囲を自動決定するか、x/y/len で
// 直接指定する。side はカスプ（山）が向く方向 = 対象の反対側。
// editable PPTX へは data-diag="edge"（矢じりなしの経路点列）として写る。
import { computed, inject } from 'vue'

const props = defineProps({
  from: { type: String, default: '' }, // 範囲の一端のボックス id
  to: { type: String, default: '' }, // 範囲のもう一端のボックス id
  x: { type: Number, default: 0 }, // 直接指定: ブレース線の基準位置
  y: { type: Number, default: 0 },
  len: { type: Number, default: 0 }, // 直接指定: ブレースの全長
  side: { type: String, default: 'bottom' }, // カスプの向き: bottom | top | left | right
  gap: { type: Number, default: 8 }, // 対象からの離隔 px
  label: { type: String, default: '' },
  labelDx: { type: Number, default: 0 },
  labelDy: { type: Number, default: 0 },
  size: { type: Number, default: 12 },
})

const D = 7 // ブレースの深さ（カスプは 2D）
const boxes = inject('diag-boxes')

// 対象範囲（始点座標・長さ・基準線位置）を解決する
const span = computed(() => {
  const vertical = props.side === 'left' || props.side === 'right'
  if (props.from && props.to) {
    const [f, t] = [boxes[props.from], boxes[props.to]]
    if (!f || !t) return null
    if (vertical) {
      const [y1, y2] = [Math.min(f.y, t.y), Math.max(f.y + f.h, t.y + t.h)]
      const base =
        props.side === 'right'
          ? Math.max(f.x + f.w, t.x + t.w) + props.gap
          : Math.min(f.x, t.x) - props.gap
      return { start: y1, len: y2 - y1, base }
    }
    const [x1, x2] = [Math.min(f.x, t.x), Math.max(f.x + f.w, t.x + t.w)]
    const base =
      props.side === 'bottom'
        ? Math.max(f.y + f.h, t.y + t.h) + props.gap
        : Math.min(f.y, t.y) - props.gap
    return { start: x1, len: x2 - x1, base }
  }
  if (!props.len) return null
  return vertical
    ? { start: props.y, len: props.len, base: props.x }
    : { start: props.x, len: props.len, base: props.y }
})

const qSample = (p0, c, p1, n = 6) => {
  const out = []
  for (let i = 1; i <= n; i++) {
    const [u, v] = [i / n, 1 - i / n]
    out.push({
      x: v * v * p0.x + 2 * v * u * c.x + u * u * p1.x,
      y: v * v * p0.y + 2 * v * u * c.y + u * u * p1.y,
    })
  }
  return out
}

// ブレースの経路。s = カスプ方向の符号。キャンバス座標 px
const geo = computed(() => {
  if (!span.value) return null
  const { start, len, base } = span.value
  const s = props.side === 'right' || props.side === 'bottom' ? 1 : -1
  const mid = start + len / 2
  const vertical = props.side === 'left' || props.side === 'right'
  // 主軸 t / 交差軸 c の抽象座標で組んでから x/y に写す
  const P = (t, c) => (vertical ? { x: base + s * c, y: t } : { x: t, y: base + s * c })
  const pts = [P(start, 0)]
  pts.push(...qSample(P(start, 0), P(start, D), P(start + D, D)))
  pts.push(P(mid - D, D))
  pts.push(...qSample(P(mid - D, D), P(mid, D), P(mid, 2 * D)))
  pts.push(...qSample(P(mid, 2 * D), P(mid, D), P(mid + D, D)))
  pts.push(P(start + len - D, D))
  pts.push(...qSample(P(start + len - D, D), P(start + len, D), P(start + len, 0)))
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const cusp = P(mid, 2 * D + 6)
  return { pts, d, cusp }
})

const labelStyle = computed(() => {
  if (!geo.value) return {}
  const { cusp } = geo.value
  const tf = {
    right: 'translate(0, -50%)',
    left: 'translate(-100%, -50%)',
    bottom: 'translate(-50%, 0)',
    top: 'translate(-50%, -100%)',
  }[props.side]
  return {
    left: `${cusp.x + props.labelDx}px`,
    top: `${cusp.y + props.labelDy}px`,
    transform: tf,
    fontSize: `${props.size}px`,
  }
})
</script>

<template>
  <svg
    v-if="geo"
    class="diag-brace"
    data-diag="edge"
    :data-diag-edge="JSON.stringify({ points: geo.pts, noArrow: true })"
  >
    <path :d="geo.d" fill="none" stroke="var(--tech-fg)" stroke-width="1.5" />
  </svg>
  <span v-if="geo && label" data-diag="text" class="diag-brace-label" :style="labelStyle">{{
    label
  }}</span>
</template>

<style scoped>
.diag-brace {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.diag-brace-label {
  position: absolute;
  color: var(--tech-fg);
  line-height: 1.3;
  white-space: pre-line;
  text-align: center;
}
</style>

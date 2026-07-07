<script setup>
// DiagEdge — ボックス間のコネクタ。経路は 2 箱の相対位置から自動再構成:
// 対面（帯が重なる）= 直線、非対面 = L 字。座標は Diag の registry から解決。
// SVG overlay として描画し、data-diag-edge 属性で walker に経路とスタイルを宣言する。
import { computed, inject } from 'vue'

const props = defineProps({
  from: { type: String, required: true },
  to: { type: String, required: true },
  label: { type: String, default: '' },
  dashed: { type: Boolean, default: false },
  labelDy: { type: Number, default: 0 }, // ラベルの基準点からの縦オフセット
  labelDx: { type: Number, default: 0 }, // ラベルの基準点からの横オフセット
  labelAt: { type: String, default: 'mid' }, // 'mid' = 経路全体の中点 / 'last' = 終端セグメントの中点
  toAnchorX: { type: Number, default: 0.5 }, // L 字経路の着地 x（ターゲット幅に対する 0..1 の比率）
  fromSide: { type: String, default: 'auto' }, // 'right' = 源の右辺中央から出る L 字経路を強制
  curve: { type: Boolean, default: false }, // 下向きの滑らかな曲線（源の下辺中央から縦に降り、末端で横に振ってターゲット上辺へ）
  points: { type: Array, default: null }, // 経路の明示指定（[x,y] の列）。自動経路では表現できない折れ線用
  bezier: { type: Array, default: null }, // 3 次ベジェの明示指定 [p0, c1, c2, p3]。points より優先
  noArrow: { type: Boolean, default: false }, // 矢じりを省略（既存の線への合流など）
  dash: { type: String, default: '' }, // 破線パターンの明示指定（例 '10 5'）。境界枠などを通常の破線と区別する
  code: { type: Boolean, default: false }, // ラベルをコードブロック表記（等幅・地色背景）にする
  accent: { type: Boolean, default: false }, // アクセント色で描画（リポジトリ内容の同期・適用の流れ）
})

const boxes = inject('diag-boxes')

const route = computed(() => {
  if (props.bezier) {
    // points はベジェのサンプル列（PPTX 変換用の折れ線近似）
    const [p0, c1, c2, p3] = props.bezier.map(([x, y]) => ({ x, y }))
    const points = []
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, v = 1 - u
      points.push({
        x: v ** 3 * p0.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u ** 3 * p3.x,
        y: v ** 3 * p0.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u ** 3 * p3.y,
      })
    }
    return { points, d: `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p3.x} ${p3.y}` }
  }
  if (props.points) return { points: props.points.map(([x, y]) => ({ x, y })) }
  const s = boxes[props.from]
  const t = boxes[props.to]
  if (!s || !t) return null
  if (props.curve && t.y > s.y + s.h) {
    // 縦落ち + ベジェの扇形。points はベジェのサンプル列（PPTX 変換用の折れ線近似）
    const FAN = 48
    const K = 24
    const p0 = { x: s.x + s.w / 2, y: s.y + s.h }
    const p3 = { x: t.x + t.w * props.toAnchorX, y: t.y }
    const fy = p3.y - FAN
    const [c1, c2] = [{ x: p0.x, y: fy + K }, { x: p3.x, y: fy + K }]
    const points = [p0, { x: p0.x, y: fy }]
    for (let i = 1; i <= 16; i++) {
      const u = i / 16, v = 1 - u
      points.push({
        x: v ** 3 * p0.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u ** 3 * p3.x,
        y: v ** 3 * fy + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u ** 3 * p3.y,
      })
    }
    return {
      points, // 矢じりは末尾チャード（曲線の見かけの到達角）に沿わせる
      d: `M ${p0.x} ${p0.y} L ${p0.x} ${fy} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p3.x} ${p3.y}`,
    }
  }
  if (props.fromSide === 'right') {
    const from = { x: s.x + s.w, y: s.y + s.h / 2 }
    const to = { x: t.x + t.w * props.toAnchorX, y: t.y < s.y ? t.y + t.h : t.y }
    return { points: [from, { x: to.x, y: from.y }, to] }
  }
  const ovY = [Math.max(s.y, t.y), Math.min(s.y + s.h, t.y + t.h)]
  const ovX = [Math.max(s.x, t.x), Math.min(s.x + s.w, t.x + t.w)]
  if (ovY[0] < ovY[1]) {
    const y = (ovY[0] + ovY[1]) / 2
    const [x1, x2] = s.x < t.x ? [s.x + s.w, t.x] : [s.x, t.x + t.w]
    return { points: [{ x: x1, y }, { x: x2, y }] }
  }
  if (ovX[0] < ovX[1]) {
    // toAnchorX 指定時はターゲット基準の x に通す（既定は重なり帯の中央）
    const x = props.toAnchorX === 0.5 ? (ovX[0] + ovX[1]) / 2 : t.x + t.w * props.toAnchorX
    const [y1, y2] = s.y < t.y ? [s.y + s.h, t.y] : [s.y, t.y + t.h]
    return { points: [{ x, y: y1 }, { x, y: y2 }] }
  }
  const from = { x: s.x < t.x ? s.x + s.w : s.x, y: s.y + s.h / 2 }
  const to = { x: t.x + t.w * props.toAnchorX, y: t.y < s.y ? t.y + t.h : t.y }
  return { points: [from, { x: to.x, y: from.y }, to] }
})

const path = computed(() => {
  if (!route.value) return ''
  if (route.value.d) return route.value.d
  const pts = route.value.points
  // 折れ点は角丸（二次ベジェ）にする
  const R = 6
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, p, b] = [pts[i - 1], pts[i], pts[i + 1]]
    const da = Math.hypot(p.x - a.x, p.y - a.y)
    const db = Math.hypot(b.x - p.x, b.y - p.y)
    const r = Math.min(R, da / 2, db / 2)
    const pin = { x: p.x - ((p.x - a.x) / da) * r, y: p.y - ((p.y - a.y) / da) * r }
    const out = { x: p.x + ((b.x - p.x) / db) * r, y: p.y + ((b.y - p.y) / db) * r }
    d += ` L ${pin.x} ${pin.y} Q ${p.x} ${p.y} ${out.x} ${out.y}`
  }
  const last = pts[pts.length - 1]
  return `${d} L ${last.x} ${last.y}`
})
// 終端の矢じり。向きは「先端から矢じり長ぶん経路を遡った点 → 先端」で決める。
// 曲線は矢じりの範囲内でも曲がり続けるため、直前チャードや接線より見た目に合う。
const arrow = computed(() => {
  if (!route.value) return null
  const pts = route.value.points
  const tip = pts[pts.length - 1]
  const AL = 9 // 矢じりの長さ
  let base = pts[pts.length - 2]
  let acc = 0
  let prev = tip
  for (let i = pts.length - 2; i >= 0; i--) {
    const d = Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y)
    if (acc + d >= AL) {
      const r = (AL - acc) / d
      base = { x: prev.x + (pts[i].x - prev.x) * r, y: prev.y + (pts[i].y - prev.y) * r }
      break
    }
    acc += d
    prev = pts[i]
    base = pts[i]
  }
  const angle = (Math.atan2(tip.y - base.y, tip.x - base.x) * 180) / Math.PI
  return { x: tip.x, y: tip.y, angle }
})
const mid = computed(() => {
  if (!route.value) return null
  const pts = route.value.points
  const a = props.labelAt === 'last' ? pts[pts.length - 2] : pts[0]
  const b = pts[pts.length - 1]
  return { x: (a.x + b.x) / 2 + props.labelDx, y: (a.y + b.y) / 2 + props.labelDy }
})
</script>

<template>
  <svg
    v-if="route"
    data-diag="edge"
    :data-diag-edge="JSON.stringify({ points: route.points, dashed, noArrow, dash: dash || undefined, codeLabel: code || undefined, accent: accent || undefined })"
    class="diag-edge"
  >
    <path
      :d="path"
      fill="none"
      :stroke="accent ? 'var(--tech-accent)' : 'var(--tech-fg)'"
      stroke-width="1"
      :stroke-dasharray="dashed ? dash || '4 4' : undefined"
    />
    <path
      v-if="!noArrow"
      d="M 0 0 L -9 -4.5 L -9 4.5 Z"
      :fill="accent ? 'var(--tech-accent)' : 'var(--tech-fg)'"
      :transform="`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`"
    />
  </svg>
  <div
    v-if="route && label"
    data-diag="edge-label"
    class="diag-edge-label"
    :class="{ 'diag-edge-label-code': code }"
    :style="{ left: `${mid.x}px`, top: `${mid.y}px` }"
  >
    {{ label }}
  </div>
</template>

<style scoped>
.diag-edge {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.diag-edge-label {
  position: absolute;
  z-index: 1; /* 線上に置くラベルは後続 edge の SVG より前面に出し、背景で線を打ち消す */
  transform: translate(-50%, -50%);
  background: var(--tech-bg);
  padding: 0 4px;
  font-size: 12px;
  color: var(--tech-fg);
  white-space: pre-line; /* label 内の \n で改行できる */
  text-align: center;
}
.diag-edge-label-code {
  font-family: 'UDEV Gothic', 'OctoBiz', monospace;
  background: var(--tech-code-bg);
  border: 1px solid var(--tech-rule);
  border-radius: 4px;
  padding: 0 5px;
  font-size: 11px;
}
</style>

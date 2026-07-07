<script setup>
// DiagPolygon — 汎用多角形（ADR-0002 P11 / ADR-0003）。triangle / diamond /
// parallelogram など長尾図形の受け皿。頂点は w/h に対する 0..1 の正規化座標で
// 宣言し、editable PPTX には data-pptx="polygon" 契約で custGeom として写る。
// 頂点は [nx, ny]（直線）または [cx, cy, nx, ny]（制御点付き二次ベジェ）。
// 同じ points が 3 図以上で再利用されたら専用コンポーネントへの昇格を検討する。
import { computed, inject, onMounted } from 'vue'
import { FILLS } from './fills.js'

const props = defineProps({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  w: { type: Number, required: true },
  h: { type: Number, required: true },
  points: { type: Array, required: true }, // 正規化頂点列
  fill: { type: String, default: 'emphasis' }, // トークン名
  stroke: { type: Boolean, default: true }, // 1px の輪郭線
  label: { type: String, default: '' },
  labelColor: { type: String, default: 'fg' }, // fg | bg（accent 塗りの白抜き用）
  bold: { type: Boolean, default: false },
  size: { type: Number, default: 14 }, // ラベルの文字サイズ px
})

const boxes = inject('diag-boxes')
onMounted(() => {
  boxes[props.id] = { x: props.x, y: props.y, w: props.w, h: props.h }
})

const d = computed(() => {
  let s = ''
  props.points.forEach((p, i) => {
    if (i === 0) s = `M ${p[0] * props.w} ${p[1] * props.h}`
    else if (p.length === 4)
      s += ` Q ${p[0] * props.w} ${p[1] * props.h} ${p[2] * props.w} ${p[3] * props.h}`
    else s += ` L ${p[0] * props.w} ${p[1] * props.h}`
  })
  return `${s} Z`
})

const meta = computed(() =>
  JSON.stringify({ paths: [{ points: props.points, closed: true }] }),
)
</script>

<template>
  <div
    class="diag-polygon"
    :style="{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` }"
  >
    <svg data-pptx="polygon" :data-pptx-polygon="meta" :viewBox="`0 0 ${w} ${h}`">
      <path
        :d="d"
        :fill="FILLS[fill] ?? FILLS.emphasis"
        :stroke="stroke ? 'var(--tech-fg)' : 'none'"
        stroke-width="1"
        stroke-linejoin="round"
      />
    </svg>
    <div v-if="label" class="diag-polygon-label-wrap">
      <span
        data-diag="text"
        :style="{
          fontSize: `${size}px`,
          fontWeight: bold ? 700 : 400,
          color: labelColor === 'bg' ? 'var(--tech-bg)' : 'var(--tech-fg)',
        }"
        >{{ label }}</span
      >
    </div>
  </div>
</template>

<style scoped>
.diag-polygon {
  position: absolute;
}
.diag-polygon svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}
.diag-polygon-label-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.diag-polygon-label-wrap span {
  line-height: 1.3;
  text-align: center;
  white-space: pre-line;
}
</style>

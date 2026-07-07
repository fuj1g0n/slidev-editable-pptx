<script setup>
// DiagCycle — 円環ループ（Code → Build → Test → Debug のような反復工程）。
// ラベル数ぶんの円弧セグメント + 終端矢印で時計回りの循環を表し、中央に任意の
// アイコンを置く。ラベルは startDeg の位置（既定 12 時）から時計回りに配置する。
// editable PPTX では arc ネイティブ図形 + テキスト + 画像に変換される
// （円弧の角度は data-diag-cycle の JSON で walker に宣言する）。
import { computed, inject, onMounted } from 'vue'
import { resolveIconSrc } from './icons.js'

const props = defineProps({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  size: { type: Number, default: 120 }, // 円の直径 px
  labels: { type: Array, required: true }, // 時計回り。先頭が startDeg の位置
  icon: { type: String, default: '' }, // 中央アイコンの URL
  iconSize: { type: Number, default: 28 },
  fontSize: { type: Number, default: 12 },
  gapDeg: { type: Number, default: 56 }, // ラベル位置に空ける円弧の切れ目（度）
  startDeg: { type: Number, default: -90 }, // 先頭ラベルの角度（-90 = 12 時、-135 = 左上）
})

const boxes = inject('diag-boxes')
onMounted(() => {
  boxes[props.id] = { x: props.x, y: props.y, w: props.size, h: props.size }
})

const r = computed(() => props.size / 2)
const step = computed(() => 360 / props.labels.length)

// 角度は PowerPoint の arc と同じ規約（0 度 = 3 時、時計回り正）で持つ
const arcs = computed(() =>
  props.labels.map((_, i) => {
    const at = props.startDeg + i * step.value // ラベル i の角度
    return { start: at + props.gapDeg / 2, end: at + step.value - props.gapDeg / 2 }
  }),
)

const pt = (deg) => {
  const rad = (deg * Math.PI) / 180
  return { x: r.value + r.value * Math.cos(rad), y: r.value + r.value * Math.sin(rad) }
}
const arcPath = (a) => {
  const s = pt(a.start)
  const e = pt(a.end)
  return `M ${s.x} ${s.y} A ${r.value} ${r.value} 0 0 1 ${e.x} ${e.y}`
}
// 終端の矢じり（時計回りの接線方向 = 終端角 + 90 度）
const arrow = (a) => ({ ...pt(a.end), angle: a.end + 90 })

const labelPos = (i) => pt(props.startDeg + i * step.value)

const iconSrc = computed(() => resolveIconSrc(props.icon))
</script>

<template>
  <div
    data-diag="cycle"
    :data-diag-cycle="JSON.stringify({ arcs })"
    class="diag-cycle"
    :style="{ left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` }"
  >
    <svg :viewBox="`0 0 ${size} ${size}`" class="diag-cycle-arcs">
      <g v-for="(a, i) in arcs" :key="i">
        <path :d="arcPath(a)" fill="none" stroke="var(--tech-fg)" stroke-width="1" />
        <path
          d="M 0 0 L -9 -4.5 L -9 4.5 Z"
          fill="var(--tech-fg)"
          :transform="`translate(${arrow(a).x} ${arrow(a).y}) rotate(${arrow(a).angle})`"
        />
      </g>
    </svg>
    <span
      v-for="(lb, i) in labels"
      :key="lb"
      data-diag="text"
      class="diag-cycle-label"
      :style="{
        left: `${labelPos(i).x}px`,
        top: `${labelPos(i).y}px`,
        fontSize: `${fontSize}px`,
      }"
      >{{ lb }}</span
    >
    <div v-if="icon" data-diag="icon-label" class="diag-cycle-icon">
      <img :src="iconSrc" :style="{ width: `${iconSize}px`, height: `${iconSize}px` }" alt="" />
    </div>
  </div>
</template>

<style scoped>
.diag-cycle {
  position: absolute;
}
.diag-cycle-arcs {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.diag-cycle-label {
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 0 4px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--tech-fg);
  white-space: nowrap;
}
.diag-cycle-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.diag-cycle-icon img {
  margin: 0;
  flex: none;
}
</style>

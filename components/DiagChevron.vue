<script setup>
// DiagChevron — 工程帯の 1 ステップ（シェブロン矢羽根）。横に並べて Plan → Do の
// ような工程の流れを表す。first を立てると左端が平ら（五角形）になる。
// editable PPTX では homePlate / chevron のネイティブ図形に変換される。
import { inject, onMounted } from 'vue'

const props = defineProps({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  w: { type: Number, required: true },
  h: { type: Number, required: true },
  label: { type: String, default: '' },
  first: { type: Boolean, default: false },
})

const boxes = inject('diag-boxes')
onMounted(() => {
  boxes[props.id] = { x: props.x, y: props.y, w: props.w, h: props.h }
})

const NOTCH = 14
const clip = props.first
  ? `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%)`
  : `polygon(0 0, calc(100% - ${NOTCH}px) 0, 100% 50%, calc(100% - ${NOTCH}px) 100%, 0 100%, ${NOTCH}px 50%)`
</script>

<template>
  <div
    data-diag="chevron"
    :data-diag-chevron="JSON.stringify({ first, notch: NOTCH })"
    class="diag-chevron"
    :style="{
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`,
      clipPath: clip,
    }"
  >
    <span data-diag-label>{{ label }}</span>
  </div>
</template>

<style scoped>
.diag-chevron {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tech-accent);
  color: var(--tech-bg);
  font-size: 16px;
  font-weight: 700;
}
</style>

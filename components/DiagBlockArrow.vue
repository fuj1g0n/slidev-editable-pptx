<script setup>
// DiagBlockArrow — ブロック矢印（ADR-0002 P7）。rightArrow / leftRightArrow 等の
// プリセット図形に相当する。回転は使わず dir の対称形状で表現する（ADR-0002 R-7）。
// 実体は DiagPolygon（data-pptx="polygon" 契約）に頂点列を渡すだけの薄い部品。
import { computed } from 'vue'
import DiagPolygon from './DiagPolygon.vue'

const props = defineProps({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  w: { type: Number, required: true },
  h: { type: Number, required: true },
  label: { type: String, default: '' },
  dir: { type: String, default: 'right' }, // right | left | up | down | leftRight | upDown
  fill: { type: String, default: 'accent' },
  size: { type: Number, default: 14 },
})

const T = 0.55 // 軸の太さ（交差方向に対する比）

const points = computed(() => {
  const { w, h, dir } = props
  if (dir === 'right' || dir === 'left' || dir === 'leftRight') {
    const hl = Math.min(h * 0.75, w * 0.35) / w // 矢じり長（正規化）
    const [y1, y2] = [(1 - T) / 2, (1 + T) / 2]
    if (dir === 'right')
      return [[0, y1], [1 - hl, y1], [1 - hl, 0], [1, 0.5], [1 - hl, 1], [1 - hl, y2], [0, y2]]
    if (dir === 'left')
      return [[1, y1], [hl, y1], [hl, 0], [0, 0.5], [hl, 1], [hl, y2], [1, y2]]
    return [
      [0, 0.5], [hl, 0], [hl, y1], [1 - hl, y1], [1 - hl, 0],
      [1, 0.5], [1 - hl, 1], [1 - hl, y2], [hl, y2], [hl, 1],
    ]
  }
  const vl = Math.min(w * 0.75, h * 0.35) / h
  const [x1, x2] = [(1 - T) / 2, (1 + T) / 2]
  if (dir === 'down')
    return [[x1, 0], [x1, 1 - vl], [0, 1 - vl], [0.5, 1], [1, 1 - vl], [x2, 1 - vl], [x2, 0]]
  if (dir === 'up')
    return [[x1, 1], [x1, vl], [0, vl], [0.5, 0], [1, vl], [x2, vl], [x2, 1]]
  return [
    [0.5, 0], [1, vl], [x2, vl], [x2, 1 - vl], [1, 1 - vl],
    [0.5, 1], [0, 1 - vl], [x1, 1 - vl], [x1, vl], [0, vl],
  ]
})
</script>

<template>
  <DiagPolygon
    :id="id"
    :x="x"
    :y="y"
    :w="w"
    :h="h"
    :points="points"
    :fill="fill"
    :stroke="false"
    :label="label"
    label-color="bg"
    bold
    :size="size"
  />
</template>

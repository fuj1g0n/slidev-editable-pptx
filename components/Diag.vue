<script setup>
// Diag — Vue コンポーネント図のコンテナ（DESIGN.md「Vue コンポーネント図」参照）。
// 座標系は表示 px そのまま（変倍なし）。子の DiagBox が provide された
// registry に自身の矩形を登録し、DiagEdge が経路を自動計算する。
// data-diag 属性は editable PPTX 変換器（walker）の分岐キー。
import { provide, reactive } from 'vue'

defineProps({
  w: { type: Number, required: true },
  h: { type: Number, required: true },
})

const boxes = reactive({})
provide('diag-boxes', boxes)
</script>

<template>
  <div
    data-diag="root"
    class="diag-root"
    :style="{ width: `${w}px`, height: `${h}px`, position: 'relative' }"
  >
    <slot />
  </div>
</template>

<script setup>
// DiagIcon — 枠なしのアイコン + キャプション（人物・サービスの点在表現）。
// registry に登録するので DiagEdge の端点にできる。
// editable PPTX では画像 + テキストボックスに変換される。
import { computed, inject, onMounted } from 'vue'
import { resolveIconSrc } from './icons.js'

const props = defineProps({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  icon: { type: String, required: true }, // /icons/... の URL
  label: { type: String, default: '' },
  size: { type: Number, default: 32 },
  labelW: { type: Number, default: 96 }, // キャプション幅（size より広く取れる）
  labelPos: { type: String, default: 'bottom' }, // bottom | right
})

const boxes = inject('diag-boxes')
onMounted(() => {
  // 端点計算用の矩形はアイコン部分のみ
  boxes[props.id] = { x: props.x, y: props.y, w: props.size, h: props.size }
})

const iconSrc = computed(() => resolveIconSrc(props.icon))
</script>

<template>
  <div
    data-diag="icon-label"
    class="diag-icon-label"
    :class="`diag-icon-${labelPos}`"
    :style="{ left: `${x - (labelPos === 'bottom' ? (labelW - size) / 2 : 0)}px`, top: `${y}px` }"
  >
    <img :src="iconSrc" :style="{ width: `${size}px`, height: `${size}px` }" alt="" />
    <span v-if="label" data-diag-label :style="{ width: labelPos === 'bottom' ? `${labelW}px` : undefined, whiteSpace: label.includes('\n') ? 'pre-line' : undefined }">{{
      label
    }}</span>
  </div>
</template>

<style scoped>
.diag-icon-label {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tech-fg);
}
.diag-icon-label img {
  margin: 0; /* テーマ側の img { margin: auto } を打ち消す */
  flex: none;
}
.diag-icon-bottom {
  flex-direction: column;
  gap: 2px;
}
.diag-icon-label span {
  font-size: 12px;
  line-height: 1.25;
  text-align: center;
}
.diag-icon-right span {
  text-align: left;
}
</style>

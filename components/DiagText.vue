<script setup>
// DiagText — 図中の説明テキスト（枠なし）。列見出しや補足に使う。
// editable PPTX ではテキストボックスに変換される。
defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  w: { type: Number, required: true },
  label: { type: String, required: true },
  size: { type: Number, default: 14 },
  bold: { type: Boolean, default: false },
  align: { type: String, default: 'center' }, // left | center
  muted: { type: Boolean, default: false },
  bg: { type: Boolean, default: false }, // 背景を塗って下の線を隠す（線上に置くラベル用）
})
</script>

<template>
  <div
    data-diag="text"
    class="diag-text"
    :style="{
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      fontSize: `${size}px`,
      fontWeight: bold ? 700 : 400,
      textAlign: align,
      color: muted ? 'var(--tech-muted)' : 'var(--tech-fg)',
      background: bg ? 'var(--tech-bg)' : undefined,
      whiteSpace: label.includes('\n') ? 'pre-line' : undefined,
    }"
  >
    {{ label }}
  </div>
</template>

<style scoped>
.diag-text {
  position: absolute;
  line-height: 1.3;
}
</style>

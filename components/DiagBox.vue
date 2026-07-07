<script setup>
// DiagBox — 図のボックス（ゾーン・ノード共通）。角丸矩形 + ラベル + 任意のアイコン。
// fill はテーマ CSS 変数のトークン名のみ（野良色の禁止。lint-design が CSS 側を検査）。
// labelPos="top-left" でゾーン（枠上部にラベル）、既定はノード（中央）。
import { computed, inject, onMounted } from 'vue'
import { resolveIconSrc } from './icons.js'

const props = defineProps({
  id: { type: String, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  w: { type: Number, required: true },
  h: { type: Number, required: true },
  label: { type: String, default: '' },
  icon: { type: String, default: '' }, // /icons/... の URL
  fill: { type: String, default: 'background' }, // トークン名
  labelPos: { type: String, default: 'center' }, // center | top-left
  raised: { type: Boolean, default: false }, // エッジの線より前面に置く（線上に載るボックス用）
  bold: { type: Boolean, default: false },
  size: { type: Number, default: 16 }, // ラベルの文字サイズ px
  iconSize: { type: Number, default: 32 }, // アイコンの一辺 px
  frameless: { type: Boolean, default: false }, // 外枠と背景を持たないラベル+アイコンのみの表示
})

const boxes = inject('diag-boxes')
onMounted(() => {
  boxes[props.id] = { x: props.x, y: props.y, w: props.w, h: props.h }
})

const FILLS = {
  background: 'var(--tech-bg)',
  zoneOuter: 'var(--diag-zone-outer)',
  zoneInner: 'var(--diag-zone-inner)',
  nodeExternal: 'var(--diag-node-external)',
  emphasis: 'var(--diag-emphasis)',
  transparent: 'transparent',
}
const bg = computed(() => FILLS[props.fill] ?? FILLS.background)

const iconSrc = computed(() => resolveIconSrc(props.icon))
</script>

<template>
  <div
    data-diag="box"
    :data-raised="raised || null"
    class="diag-box"
    :style="{
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`,
      background: frameless ? 'transparent' : bg,
      border: frameless ? 'none' : undefined,
      zIndex: raised ? 1 : undefined,
    }"
  >
    <div class="diag-box-inner" :class="`diag-label-${labelPos}`" :style="{ fontSize: `${size}px` }">
      <img v-if="icon" :src="iconSrc" class="diag-icon" :style="{ width: `${iconSize}px`, height: `${iconSize}px` }" alt="" />
      <span v-if="label" data-diag-label :style="{ fontWeight: bold ? 700 : 400, whiteSpace: label.includes('\n') ? 'pre-line' : undefined, textAlign: label.includes('\n') && labelPos === 'center' ? 'center' : undefined }">{{
        label
      }}</span>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.diag-box {
  position: absolute;
  border: 1px solid var(--tech-fg);
  border-radius: 6px;
}
.diag-box-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 100%;
  padding: 0 12px;
  font-size: 16px;
  line-height: 1.3;
  color: var(--tech-fg);
}
.diag-label-center {
  justify-content: center;
}
.diag-label-top-left {
  align-items: flex-start;
  justify-content: flex-start;
  padding-top: 10px;
}
.diag-icon {
  width: 32px;
  height: 32px;
  flex: none;
  margin: 0; /* テーマ側の img { margin: auto } を打ち消す */
}
</style>

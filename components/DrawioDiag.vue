<script setup>
// DrawioDiag — drawio (mxGraph XML) を SVG 化せずライブ描画する第二の契約入口
// （ADR-0019）。vendor の viewer-static.min.js（Apache-2.0、全ステンシル同梱）で
// scale=1 固定描画し、テーマ写像表（src + '.theme.json'）に従い XML 中の hex を
// 現テーマの CSS 変数実値へ置換してから読み込む。walker には data-diag="drawio"
// と要素プロパティ __drawioGraph（mxGraph インスタンス）で構造を引き渡す。
import { onMounted, ref } from 'vue'
import viewerUrl from '../vendor/viewer-static.min.js?url'

const props = defineProps({
  src: { type: String, required: true }, // 例 /figures/x.drawio（public 配下）
  themeSrc: { type: String, default: '' }, // 省略時は src + '.theme.json'
  w: { type: Number, required: true }, // 宣言サイズ（埋め込み契約。図の bbox と一致すること）
  h: { type: Number, required: true },
})

const el = ref(null)

// viewer-static.min.js は古典的スクリプト（window グローバル）のため一度だけ注入
let viewerReady
function loadViewer() {
  if (window.GraphViewer) return Promise.resolve()
  viewerReady ??= new Promise((res, rej) => {
    window.mxLoadResources = false
    window.mxLoadStylesheets = false
    window.DRAWIO_PUBLIC_BUILD = true
    const s = document.createElement('script')
    s.src = viewerUrl
    s.onload = res
    s.onerror = rej
    document.head.appendChild(s)
  })
  return viewerReady
}

onMounted(async () => {
  const [xmlRaw, theme] = await Promise.all([
    // 図の更新がブラウザの heuristic cache で見えなくなるのを防ぐ
    // （ETag があれば 304 で安価に再検証される）
    fetch(props.src, { cache: 'no-cache' }).then((r) => r.text()),
    fetch(props.themeSrc || `${props.src}.theme.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ])

  // テーマ写像: 図の正準 hex → 現テーマの実値（同テーマなら恒等）
  let xml = xmlRaw
  const applied = {}
  if (theme?.palette) {
    const cs = getComputedStyle(el.value)
    for (const [hexColor, varName] of Object.entries(theme.palette)) {
      const cur = cs.getPropertyValue(varName).trim()
      if (!/^#[0-9a-fA-F]{6}$/.test(cur)) continue
      applied[hexColor] = cur
      xml = xml.replaceAll(new RegExp(hexColor, 'gi'), cur)
    }
  }

  await loadViewer()
  // print ビューの隣接プリロード等で非表示のままマウントされると GraphViewer が
  // 失敗することがある。契約対象は表示中の実体のみのため、失敗しても ready は
  // 立てて（エラー印付き）walker を待たせない
  try {
    const doc = window.mxUtils.parseXml(xml)
    const viewer = new window.GraphViewer(el.value, doc.documentElement, {
      nav: false,
      highlight: 'none',
      lightbox: false,
      resize: false,
      border: 0,
      'auto-fit': false,
      'auto-crop': false,
      zoom: '1',
    })
    const g = viewer.graph
    // 宣言サイズでの 1:1 描画を強制（viewer の fit/center を無効化）
    g.view.scaleAndTranslate(1, 0, 0)
    el.value.__drawioGraph = g
  } catch (e) {
    el.value.dataset.drawioError = String(e)
  } finally {
    if (el.value) el.value.dataset.drawioReady = '1'
  }
})
</script>

<template>
  <div
    ref="el"
    data-diag="drawio"
    :data-drawio-src="src"
    class="drawio-diag"
    :style="{ width: `${w}px`, height: `${h}px` }"
  />
</template>

<style scoped>
.drawio-diag {
  position: relative;
  overflow: hidden;
}
.drawio-diag :deep(svg) {
  display: block;
}
</style>

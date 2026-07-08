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
  // 表示するレイヤー名（mxCell parent="0" の value）の列。省略時は全レイヤー。
  // 段階図（差分管理）の各段をひとつの .drawio で持ち、スライド側で選ぶ
  layers: { type: Array, default: null },
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

  // テーマ写像: 現テーマの iconSet に合うページを選び（アイコンは build 時に
  // 系統ごと焼き込み済み）、そのページの palette（正準 hex → CSS 変数名）を
  // 現テーマの実値へ置換する。非選択ページに同じ hex があっても描画されない
  const iconSet =
    getComputedStyle(document.documentElement).getPropertyValue('--diag-icon-set').trim() ||
    'light'
  let pageIdx = 0
  let palette = theme?.palette
  if (Array.isArray(theme?.pages)) {
    const i = theme.pages.findIndex((p) => p.iconSet === iconSet)
    if (i >= 0) pageIdx = i
    else
      console.warn(
        `DrawioDiag: iconSet "${iconSet}" のページが ${props.src} に無いためページ 0 を使う（図の再生成が必要）`,
      )
    palette = theme.pages[pageIdx]?.palette
  }
  let xml = xmlRaw
  const applied = {}
  if (palette) {
    const cs = getComputedStyle(el.value)
    for (const [hexColor, varName] of Object.entries(palette)) {
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
    // レイヤー選択: 選択ページの root 直下セル（レイヤー）の visible を
    // props.layers に従い上書きする。GraphViewer は visible="0" のレイヤーを
    // 描画せず、walker も view state 不在として自然に skip する
    if (props.layers) {
      const models = [...doc.documentElement.querySelectorAll('mxGraphModel')]
      const model = models[pageIdx]
      if (model) {
        for (const c of model.querySelectorAll(':scope > root > mxCell')) {
          const p = c.getAttribute('parent')
          if (p !== '0') continue // レイヤーは parent="0"（"0" 自身は root）
          const name = c.getAttribute('value') ?? ''
          c.setAttribute('visible', props.layers.includes(name) ? '1' : '0')
        }
      }
    }
    const viewer = new window.GraphViewer(el.value, doc.documentElement, {
      nav: false,
      highlight: 'none',
      lightbox: false,
      resize: false,
      border: 0,
      'auto-fit': false,
      'auto-crop': false,
      page: pageIdx,
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

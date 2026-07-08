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
    const cellOf = (id) => doc.querySelector(`mxCell[id="${id}"]`)

    // アイコンのテーマ適応（ADR-0004 の drawio 経路版）: 抽出時に焼き込まれた
    // 単色 octicon を、現テーマの --diag-icon-set に従い正準（light）/dark 版へ
    // 差し替える。パス参照にすることで dev server から現テーマの実体を取る
    const rootCs = getComputedStyle(document.documentElement)
    const iconSet = rootCs.getPropertyValue('--diag-icon-set').trim() || 'light'
    if (theme?.icons && iconSet !== (theme.iconSet ?? 'dark')) {
      for (const [id, canonical] of Object.entries(theme.icons)) {
        const cell = cellOf(id)
        if (!cell) continue
        const src =
          iconSet === 'dark'
            ? canonical.replace('/icons/octicons/', '/icons/octicons-dark/')
            : canonical
        // mxGraph は相対パスを imageBasePath (diagrams.net) 基準で解決するため
        // 現オリジンの絶対 URL にする
        const abs = new URL(src, window.location.origin).href
        cell.setAttribute(
          'style',
          cell.getAttribute('style').replace(/image=[^;]*;/, `image=${abs};`),
        )
      }
    }
    // plate（ロゴの下敷き）はテーマ依存: --diag-icon-plate 未定義のテーマでは
    // 除去し、ロゴ矩形を padding 分外側（原本の外形寸法）へ戻す。
    // 定義されていればその実値で着色する
    if (theme?.plates?.length) {
      const plateColor = rootCs.getPropertyValue('--diag-icon-plate').trim()
      const resolved = plateColor.startsWith('var(')
        ? rootCs.getPropertyValue(plateColor.slice(4, -1).trim()).trim()
        : plateColor
      for (const pl of theme.plates) {
        const { id, img, pad } = typeof pl === 'string' ? { id: pl } : pl
        const cell = cellOf(id)
        if (!cell) continue
        if (/^#[0-9a-fA-F]{6}$/.test(resolved)) {
          cell.setAttribute(
            'style',
            cell.getAttribute('style').replace(/fillColor=[^;]*;/, `fillColor=${resolved};`),
          )
        } else {
          cell.remove()
          const geo = img != null && pad > 0 && cellOf(img)?.querySelector('mxGeometry')
          if (geo) {
            for (const [k, d] of [['x', -pad], ['y', -pad], ['width', 2 * pad], ['height', 2 * pad]])
              geo.setAttribute(k, String(Number(geo.getAttribute(k) || 0) + d))
          }
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

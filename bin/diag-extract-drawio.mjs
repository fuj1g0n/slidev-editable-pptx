#!/usr/bin/env node
// diag-extract-drawio — 描画済み Diag コンポーネント図を実測し、等価な
// drawio (mxGraph XML) とテーマ写像表（hex → CSS 変数名）を生成する。
// ADR-0019 の UC-D1（既存表現からの再構成）の入り口となる抽出器。
// walker の中間語彙（diag-box / diag-chevron / diag-edge / text / image /
// diag-arc）をそのまま mxCell の列へ写像するため、変換器（walker の drawio
// 分岐）との往復で幾何が保存される。
// 使い方: SLIDES_ENTRY=slides/deck.md SLIDE_NO=6 OUT=slides/public/figures/x.drawio \
//         node bin/diag-extract-drawio.mjs
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import puppeteer from 'puppeteer-core'
import { walker } from '../lib/walker.mjs'

const ENTRY = process.env.SLIDES_ENTRY ?? 'slides/deck.md'
const SLIDE_NO = Number(process.env.SLIDE_NO ?? 1)
const OUT = process.env.OUT ?? 'out/figure.drawio'
const PORT = Number(process.env.SLIDEV_PORT ?? 18731)
const BASE = `http://localhost:${PORT}`
// 変種ページ（単体閲覧用）: 別テーマのデッキを開いてテーマ値だけを読み、
// 同一幾何の diagram ページを追加で焼き込む
const VARIANT_ENTRY = process.env.VARIANT_ENTRY
const VARIANT_SLIDE = Number(process.env.VARIANT_SLIDE ?? 1)
const VARIANT_NAME = process.env.VARIANT_NAME ?? 'light'

const browserPath = process.env.CHROME_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH
if (!browserPath) {
  console.error('CHROME_PATH が未設定です。flake devShell（direnv）内で実行してください。')
  process.exit(1)
}

// テーマ写像の候補となる CSS 変数（値が色のもの）。同値の変数がある場合は
// 先勝ちのため、図の意味に近い --diag-* を先に置く
const THEME_VARS = [
  '--diag-zone-outer',
  '--diag-zone-inner',
  '--diag-node-external',
  '--diag-emphasis',
  '--tech-fg',
  '--tech-bg',
  '--tech-accent',
  '--tech-muted',
  '--tech-rule',
  '--tech-code-bg',
  '--tech-th-bg',
  '--tech-error',
]

// ---- Slidev dev server ----
const servers = []
process.on('exit', () => {
  for (const s of servers) {
    try {
      process.kill(-s.pid, 'SIGTERM')
    } catch {
      /* 既に終了 */
    }
  }
})

function startServer(entry, port) {
  let log = ''
  let exited = false
  const proc = spawn('npx', ['slidev', entry, '--port', String(port), '--force'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  proc.stdout.on('data', (d) => (log += d))
  proc.stderr.on('data', (d) => (log += d))
  proc.on('exit', () => (exited = true))
  servers.push(proc)
  return {
    stop() {
      try {
        process.kill(-proc.pid, 'SIGTERM')
      } catch {
        /* 既に終了 */
      }
    },
    async wait(url, timeoutMs = 180000) {
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        if (exited) break
        try {
          const res = await fetch(url)
          if (res.ok) return
        } catch {
          /* まだ起動していない */
        }
        await new Promise((r) => setTimeout(r, 500))
      }
      console.error(log || '(出力なし)')
      throw new Error(`Slidev dev server が ${url} で起動しない`)
    },
  }
}

// ---- XML 生成 ----
const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\n', '&#10;')

const hex = (c) => (c ? `#${c.toLowerCase()}` : 'none')
const N = (v) => Math.round(v * 100) / 100

// mxGraph の crisp 描画規約 (mxShape.getSvgScreenOffset): round(strokeWidth×scale)
// が奇数の shape は SVG 側で translate(0.5,0.5) される。strokeColor=none でも
// style の strokeWidth（無指定は 1）で判定される点に注意。scale=1 契約なので、
// geometry は「塗り位置 − stroke/2 − このオフセット」で出せば描画ピクセルが
// CSS 実測と一致し、塗り境界がページ矩形に収まる
const crispOffset = (sw) => (Math.max(1, Math.round(sw || 1)) % 2 === 1 ? 0.5 : 0)

function buildDrawio(elements, dg, imageData, background, opts = {}) {
  let id = 1
  const cells = []
  const usedColors = new Set()
  // テーマ切替情報（theme.json 用）: セル id → 正準アイコンパス、plate セル id
  const icons = {}
  const plates = []
  const color = (c) => {
    if (!c) return 'none'
    // 変種ページ: 抽出テーマの色を変種テーマの色へ写像（palette 経由）
    const mapped = opts.colorMap?.[`#${c.toLowerCase()}`]
    if (mapped) c = mapped.slice(1)
    usedColors.add(`#${c.toLowerCase()}`)
    return hex(c)
  }
  const norm = (r) => ({ x: N(r.x - dg.x), y: N(r.y - dg.y), w: N(r.w), h: N(r.h) })
  // 塗り矩形（painted bbox）→ geometry。stroke 有りは輪郭線中心へ sw/2 内側取り、
  // さらに crisp オフセット分を引く（strokeColor=none でも style の strokeWidth
  // 既定値 1 でオフセット判定される）
  const fit = (r, sw = 1, stroked = false) => {
    const o = crispOffset(sw)
    const i = stroked ? sw / 2 : 0
    return { x: N(r.x + i - o), y: N(r.y + i - o), w: N(r.w - 2 * i), h: N(r.h - 2 * i) }
  }

  const vertex = (rect, style, value = '') => {
    const cid = `c${id++}`
    cells.push(
      `<mxCell id="${cid}" value="${esc(value)}" style="${esc(style)}" vertex="1" parent="1">` +
        `<mxGeometry x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" as="geometry"/></mxCell>`,
    )
    return cid
  }
  const fontStyle = (f) =>
    `fontFamily=${f.font};fontSize=${N(f.sizePx)};fontColor=${color(f.color)};` +
    (f.bold ? 'fontStyle=1;' : '')

  for (const el of elements) {
    if (el.kind === 'diag-box') {
      const bw = el.borderWPx > 0 ? N(el.borderWPx) : 0
      // 座標規約の変換: walker の rect は CSS border-box（枠は内側）、
      // mxGraph の stroke は輪郭線中心 + crisp オフセット。fit で geometry に
      // 直すと描画ピクセルが CSS と一致し、塗り境界（= viewer の
      // min-width/min-height の源）も宣言サイズに収まる
      const r = fit(norm(el.rect), bw || 1, bw > 0)
      const st =
        `rounded=${el.radiusPx > 0 ? 1 : 0};` +
        (el.radiusPx > 0
          ? `absoluteArcSize=1;arcSize=${N(Math.max(0, el.radiusPx - bw / 2) * 2)};`
          : '') +
        `fillColor=${color(el.fill)};` +
        (el.borderWPx > 0
          ? `strokeColor=${color(el.border)};strokeWidth=${N(el.borderWPx)};`
          : 'strokeColor=none;') +
        'html=0;'
      vertex(r, st)
      if (el.label) {
        const lr = norm(el.label.rect)
        vertex(
          lr,
          `text;html=0;align=center;verticalAlign=middle;${fontStyle(el.label)}`,
          el.label.text,
        )
      }
    } else if (el.kind === 'text') {
      const r = norm(el.rect)
      const run = el.runs[0]
      // CSS ソフトラップ由来の複数行（textContent に \n が無いのに高さが 2 行分
      // ある）は、mxGraph の html ラベルで幅内折返しさせる
      const text = el.runs.map((x) => x.text).join('')
      const wrap = !text.includes('\n') && el.rect.h > run.sizePx * 1.9
      const st =
        `text;html=${wrap ? 1 : 0};${wrap ? 'whiteSpace=wrap;' : ''}align=${el.align ?? 'center'};verticalAlign=middle;${fontStyle(run)}` +
        (el.bg ? `labelBackgroundColor=${color(el.bg)};` : '')
      vertex(r, st, text)
    } else if (el.kind === 'image') {
      let r = norm(el.rect)
      let plateInfo = null
      if (el.plate && !opts.dropPlates) {
        // plate（下敷き）はテーマ依存（--diag-icon-plate 未定義のテーマでは
        // 存在しない）。id を記録し、描画側でテーマに合わせて着色/除去する。
        // ロゴは padding 分内側に縮んでいる（dark-icons.css）ため、除去時に
        // 元の外形へ戻せるよう pad も記録する
        const plateId = vertex(
          fit(r),
          `rounded=1;absoluteArcSize=1;arcSize=${N(el.plate.radiusPx * 2)};fillColor=${color(el.plate.color)};strokeColor=none;html=0;`,
        )
        const p = N(el.plate.padPx)
        r = { x: N(r.x + p), y: N(r.y + p), w: N(r.w - 2 * p), h: N(r.h - 2 * p) }
        plateInfo = { id: plateId, pad: p }
      }
      // drawio 単体でも表示できるよう data URI（drawio 慣行の base64）で埋め込む
      let src = el.src?.startsWith('http') ? new URL(el.src).pathname : el.src
      // 変種ページ: octicon をそのテーマのアイコンセットへ差し替える
      if (opts.iconResolve && src) src = opts.iconResolve(src)
      const uri = imageData.get(src) ?? src
      const cid = vertex(r, `shape=image;imageAspect=0;image=${uri};`)
      if (plateInfo) plates.push({ ...plateInfo, img: cid })
      // テーマ切替で差し替わる単色 octicon は正準パス（light 版）を記録する
      if (src?.includes('/icons/'))
        icons[cid] = src.replace('/icons/octicons-dark/', '/icons/octicons/')
    } else if (el.kind === 'diag-chevron') {
      const r = fit(norm(el.rect))
      const n = N(el.notchPx / r.w)
      const font =
        `html=0;align=center;verticalAlign=middle;` + (el.label ? fontStyle(el.label) : '')
      // first（左端が平ら）は drawio 標準 step に無いため basic.polygon
      // （polyCoords 0..1 正規化 = walker の diag-polygon と同じ語彙）で表す
      const st = el.first
        ? `shape=mxgraph.basic.polygon;polyCoords=[[0,0],[${N(1 - n)},0],[1,0.5],[${N(1 - n)},1],[0,1]];` +
          `fillColor=${color(el.fill)};strokeColor=none;${font}`
        : `shape=step;perimeter=stepPerimeter;fixedSize=1;size=${N(el.notchPx)};` +
          `fillColor=${color(el.fill)};strokeColor=none;${font}`
      vertex(r, st, el.label?.text ?? '')
    } else if (el.kind === 'diag-edge') {
      // 点列は線の中心。crisp オフセット分を引いて描画位置を実測に合わせる
      const eo = crispOffset(el.widthPx)
      const pts = el.points.map((p) => ({ x: N(p.x - dg.x - eo), y: N(p.y - dg.y - eo) }))
      const st =
        `html=0;rounded=1;arcSize=6;strokeColor=${color(el.color)};strokeWidth=${N(el.widthPx)};` +
        (el.noArrow ? 'endArrow=none;' : 'endArrow=classic;endFill=1;endSize=4;') +
        (el.dashed || el.dash ? 'dashed=1;' : '') +
        (el.dash ? `dashPattern=${el.dash};` : '')
      const mid = pts
        .slice(1, -1)
        .map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`)
        .join('')
      cells.push(
        `<mxCell id="c${id++}" style="${esc(st)}" edge="1" parent="1">` +
          `<mxGeometry relative="1" as="geometry">` +
          `<mxPoint x="${pts[0].x}" y="${pts[0].y}" as="sourcePoint"/>` +
          `<mxPoint x="${pts[pts.length - 1].x}" y="${pts[pts.length - 1].y}" as="targetPoint"/>` +
          (mid ? `<Array as="points">${mid}</Array>` : '') +
          `</mxGeometry></mxCell>`,
      )
    } else if (el.kind === 'diag-arc') {
      // 弧の rect は SVG viewBox（stroke 込みの外形）。stroke 中心の
      // geometry へ widthPx/2 の内側取り + crisp オフセット補正で変換する
      const aw = N(el.widthPx)
      const r = fit(norm(el.rect), aw, true)
      // mxgraph.basic.arc: startAngle/endAngle は 0..1（0 = 3 時、時計回り）
      const st =
        `shape=mxgraph.basic.arc;startAngle=${N((((el.angleRange[0] % 360) + 360) % 360) / 360)};` +
        `endAngle=${N((((el.angleRange[1] % 360) + 360) % 360) / 360)};` +
        `fillColor=none;strokeColor=${color(el.color)};strokeWidth=${N(el.widthPx)};html=0;`
      vertex(r, st)
    } else {
      console.warn(`未対応 kind をスキップ: ${el.kind}`)
    }
  }

  // 背景: 変種ページでは実測値そのもの（colorMap を通すと、抽出テーマの
  // 前景色と偶然同値の場合に誤写像される）
  const bgColor = background ? (opts.colorMap ? hex(background) : color(background)) : null
  const pageXml =
    `<diagram id="${opts.pageId ?? 'poc'}" name="${opts.pageName ?? 'dark'}">` +
    `<mxGraphModel dx="0" dy="0" grid="0" gridSize="10" guides="1" tooltips="0" connect="1" arrows="1" fold="0" page="1" pageScale="1" pageWidth="${N(dg.w)}" pageHeight="${N(dg.h)}"${bgColor ? ` background="${bgColor}"` : ''} math="0" shadow="0">` +
    `<root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
    cells.join('') +
    `</root></mxGraphModel></diagram>`
  return { pageXml, usedColors, icons, plates }
}

const wrapMxfile = (pages) => `<mxfile host="diag-extract-drawio">${pages.join('')}</mxfile>`

// スライドからテーマ関連の実測値を読む（メイン抽出と変種で共用）
const measure = (sel, vars) => {
  const root = document.querySelector(sel)
  const rootRect = root.getBoundingClientRect()
  const scale = 1280 / rootRect.width
  const dg = root.querySelector('[data-diag="root"]')
  const r = dg.getBoundingClientRect()
  const cs = getComputedStyle(dg)
  // 図の実効背景色: 祖先を遡って最初の不透明 background-color。
  // Slidev では背景はスライド側が持つため、drawio 単体表示用に
  // page background として埋める
  let bg = null
  for (let e = dg; e; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor
    const m = c.match(/^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/)
    if (m && (m[4] === undefined || parseFloat(m[4]) > 0)) {
      bg = [m[1], m[2], m[3]]
        .map((v) => Number(v).toString(16).padStart(2, '0'))
        .join('')
      break
    }
  }
  const theme = {}
  for (const v of vars) {
    const val = cs.getPropertyValue(v).trim()
    if (/^#[0-9a-fA-F]{6}$/.test(val)) theme[v] = val.toLowerCase()
  }
  const rootCs = getComputedStyle(document.documentElement)
  const iconSet = rootCs.getPropertyValue('--diag-icon-set').trim() || 'light'
  const plate = rootCs.getPropertyValue('--diag-icon-plate').trim()
  return {
    dg: {
      x: (r.left - rootRect.left) * scale,
      y: (r.top - rootRect.top) * scale,
      w: r.width * scale,
      h: r.height * scale,
    },
    theme,
    bg,
    iconSet,
    plate,
  }
}

const server = startServer(ENTRY, PORT)
try {
  await server.wait(BASE)
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720 })
  await page.goto(`${BASE}/${SLIDE_NO}?print=true`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 800))

  const sel = `[data-slidev-no="${SLIDE_NO}"]`
  const data = await page.evaluate(walker, sel)
  const info = await page.evaluate(measure, sel, THEME_VARS)
  await browser.close()

  // Diag 内の要素だけを対象にする（見出し等は図の外）
  const inside = (r) =>
    r.x >= info.dg.x - 2 && r.y >= info.dg.y - 2 && r.x + r.w <= info.dg.x + info.dg.w + 2
  const els = data.elements.filter((el) =>
    el.kind === 'diag-edge' ? true : inside(el.rect),
  )
  console.log(`抽出: ${els.length} 要素（全 ${data.elements.length} 中） 図領域 ${N(info.dg.w)}x${N(info.dg.h)}`)

  // 変種テーマの実測（VARIANT_ENTRY 指定時）: 幾何は再抽出せず、
  // テーマ値（CSS 変数・背景・アイコンセット・plate）だけを読む
  let variant = null
  if (VARIANT_ENTRY) {
    const vBase = `http://localhost:${PORT + 1}`
    const vServer = startServer(VARIANT_ENTRY, PORT + 1)
    await vServer.wait(vBase)
    const b = await puppeteer.launch({ executablePath: browserPath, headless: true })
    const p = await b.newPage()
    await p.setViewport({ width: 1280, height: 720 })
    await p.goto(`${vBase}/${VARIANT_SLIDE}?print=true`, { waitUntil: 'networkidle0' })
    await p.evaluate(() => document.fonts.ready)
    await new Promise((r) => setTimeout(r, 800))
    variant = await p.evaluate(measure, `[data-slidev-no="${VARIANT_SLIDE}"]`, THEME_VARS)
    await b.close()
    vServer.stop()
    console.log(`変種 "${VARIANT_NAME}": iconSet=${variant.iconSet} plate=${variant.plate || '(なし)'} bg=#${variant.bg}`)
  }

  // 変種ページ用の octicon 差し替え規則（ADR-0004 resolveIconSrc と同じ）
  const iconResolve =
    variant &&
    ((src) =>
      variant.iconSet === 'dark'
        ? src.replace('/icons/octicons/', '/icons/octicons-dark/')
        : src.replace('/icons/octicons-dark/', '/icons/octicons/'))

  // 画像を dev server から取得して data URI 化（drawio 慣行: base64 をカンマ直後に置く）
  const imageData = new Map()
  const embed = async (path) => {
    if (imageData.has(path)) return
    const res = await fetch(`${BASE}${path}`)
    if (!res.ok) {
      console.warn(`画像取得失敗: ${path}`)
      return
    }
    const mime = path.endsWith('.svg') ? 'image/svg+xml' : (res.headers.get('content-type') ?? 'image/png').split(';')[0]
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64')
    imageData.set(path, `data:${mime},${b64}`)
  }
  for (const el of els) {
    if (el.kind !== 'image' || !el.src) continue
    const path = el.src.startsWith('http') ? new URL(el.src).pathname : el.src
    await embed(path)
    if (iconResolve) await embed(iconResolve(path))
  }
  console.log(`画像埋め込み: ${imageData.size} 種`)

  const { pageXml, usedColors, icons, plates } = buildDrawio(els, info.dg, imageData, info.bg, {
    pageId: 'poc',
    pageName: info.iconSet,
  })

  // テーマ写像: 使用色のうち CSS 変数値と一致するものを対応表にする
  const byValue = {}
  for (const [name, val] of Object.entries(info.theme)) byValue[val] ??= name
  const palette = {}
  const unmapped = []
  for (const c of usedColors) {
    if (byValue[c]) palette[c] = byValue[c]
    else unmapped.push(c)
  }

  // 変種ページ: palette を介して抽出テーマ色 → 変種テーマ色へ写像し、
  // アイコン・plate も変種テーマの姿で焼き込む（単体閲覧でのページ切替用）
  const pages = [pageXml]
  if (variant) {
    const colorMap = {}
    for (const [hexVal, varName] of Object.entries(palette))
      if (variant.theme[varName]) colorMap[hexVal] = variant.theme[varName]
    const v = buildDrawio(els, info.dg, imageData, variant.bg, {
      pageId: `poc-${VARIANT_NAME}`,
      pageName: VARIANT_NAME,
      colorMap,
      iconResolve,
      dropPlates: !/^#[0-9a-fA-F]{6}$/.test(variant.plate ?? ''),
    })
    pages.push(v.pageXml)
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, wrapMxfile(pages))
  await writeFile(
    `${OUT}.theme.json`,
    JSON.stringify({ palette, unmapped, iconSet: info.iconSet, icons, plates }, null, 2) + '\n',
  )
  console.log(`書き出し: ${OUT} / ${OUT}.theme.json（${pages.length} ページ）`)
  console.log(
    `テーマ写像: ${Object.keys(palette).length} 色, 未対応 ${unmapped.length} 色 ${unmapped.join(' ')}, ` +
      `アイコン ${Object.keys(icons).length}, plate ${plates.length}`,
  )
} finally {
  server.stop()
}

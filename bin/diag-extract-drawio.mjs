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
let serverLog = ''
let serverExited = false
const server = spawn('npx', ['slidev', ENTRY, '--port', String(PORT), '--force'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
})
server.stdout.on('data', (d) => (serverLog += d))
server.stderr.on('data', (d) => (serverLog += d))
server.on('exit', () => (serverExited = true))
const stopServer = () => {
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    /* 既に終了 */
  }
}
process.on('exit', stopServer)

async function waitForServer(url, timeoutMs = 180000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (serverExited) break
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* まだ起動していない */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  console.error(serverLog || '(出力なし)')
  throw new Error(`Slidev dev server が ${url} で起動しない`)
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

function buildDrawio(elements, dg, imageData) {
  let id = 1
  const cells = []
  const usedColors = new Set()
  const color = (c) => {
    if (c) usedColors.add(`#${c.toLowerCase()}`)
    return hex(c)
  }
  const norm = (r) => ({ x: N(r.x - dg.x), y: N(r.y - dg.y), w: N(r.w), h: N(r.h) })

  const vertex = (rect, style, value = '') => {
    cells.push(
      `<mxCell id="c${id++}" value="${esc(value)}" style="${esc(style)}" vertex="1" parent="1">` +
        `<mxGeometry x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" as="geometry"/></mxCell>`,
    )
  }
  const fontStyle = (f) =>
    `fontFamily=${f.font};fontSize=${N(f.sizePx)};fontColor=${color(f.color)};` +
    (f.bold ? 'fontStyle=1;' : '')

  for (const el of elements) {
    if (el.kind === 'diag-box') {
      let r = norm(el.rect)
      const bw = el.borderWPx > 0 ? N(el.borderWPx) : 0
      // 座標規約の変換: walker の rect は CSS border-box（枠は内側）、
      // mxGraph の stroke は輪郭線中心。geometry を borderWidth/2 だけ
      // 内側に取ると描画ピクセルが CSS と一致し、描画境界（= viewer の
      // min-width/min-height の源）も宣言サイズに収まる
      if (bw > 0) r = { x: N(r.x + bw / 2), y: N(r.y + bw / 2), w: N(r.w - bw), h: N(r.h - bw) }
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
      if (el.plate) {
        vertex(
          r,
          `rounded=1;absoluteArcSize=1;arcSize=${N(el.plate.radiusPx * 2)};fillColor=${color(el.plate.color)};strokeColor=none;html=0;`,
        )
        const p = N(el.plate.padPx)
        r = { x: N(r.x + p), y: N(r.y + p), w: N(r.w - 2 * p), h: N(r.h - 2 * p) }
      }
      // drawio 単体でも表示できるよう data URI（drawio 慣行の base64）で埋め込む
      const src = el.src?.startsWith('http') ? new URL(el.src).pathname : el.src
      const uri = imageData.get(src) ?? src
      vertex(r, `shape=image;imageAspect=0;image=${uri};`)
    } else if (el.kind === 'diag-chevron') {
      const r = norm(el.rect)
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
      const pts = el.points.map((p) => ({ x: N(p.x - dg.x), y: N(p.y - dg.y) }))
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
      // geometry へは widthPx/2 の内側取りで変換する
      let r = norm(el.rect)
      const aw = N(el.widthPx)
      r = { x: N(r.x + aw / 2), y: N(r.y + aw / 2), w: N(r.w - aw), h: N(r.h - aw) }
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

  const xml =
    `<mxfile host="diag-extract-drawio"><diagram id="poc" name="Page-1">` +
    `<mxGraphModel dx="0" dy="0" grid="0" gridSize="10" guides="1" tooltips="0" connect="1" arrows="1" fold="0" page="1" pageScale="1" pageWidth="${N(dg.w)}" pageHeight="${N(dg.h)}" math="0" shadow="0">` +
    `<root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
    cells.join('') +
    `</root></mxGraphModel></diagram></mxfile>`
  return { xml, usedColors }
}

try {
  await waitForServer(BASE)
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720 })
  await page.goto(`${BASE}/${SLIDE_NO}?print=true`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await new Promise((r) => setTimeout(r, 800))

  const sel = `[data-slidev-no="${SLIDE_NO}"]`
  const data = await page.evaluate(walker, sel)
  const info = await page.evaluate(
    (sel, vars) => {
      const root = document.querySelector(sel)
      const rootRect = root.getBoundingClientRect()
      const scale = 1280 / rootRect.width
      const dg = root.querySelector('[data-diag="root"]')
      const r = dg.getBoundingClientRect()
      const cs = getComputedStyle(dg)
      const theme = {}
      for (const v of vars) {
        const val = cs.getPropertyValue(v).trim()
        if (/^#[0-9a-fA-F]{6}$/.test(val)) theme[v] = val.toLowerCase()
      }
      return {
        dg: {
          x: (r.left - rootRect.left) * scale,
          y: (r.top - rootRect.top) * scale,
          w: r.width * scale,
          h: r.height * scale,
        },
        theme,
      }
    },
    sel,
    THEME_VARS,
  )
  await browser.close()

  // Diag 内の要素だけを対象にする（見出し等は図の外）
  const inside = (r) =>
    r.x >= info.dg.x - 2 && r.y >= info.dg.y - 2 && r.x + r.w <= info.dg.x + info.dg.w + 2
  const els = data.elements.filter((el) =>
    el.kind === 'diag-edge' ? true : inside(el.rect),
  )
  console.log(`抽出: ${els.length} 要素（全 ${data.elements.length} 中） 図領域 ${N(info.dg.w)}x${N(info.dg.h)}`)

  // 画像を dev server から取得して data URI 化（drawio 慣行: base64 をカンマ直後に置く）
  const imageData = new Map()
  for (const el of els) {
    if (el.kind !== 'image' || !el.src) continue
    const path = el.src.startsWith('http') ? new URL(el.src).pathname : el.src
    if (imageData.has(path)) continue
    const res = await fetch(`${BASE}${path}`)
    if (!res.ok) {
      console.warn(`画像取得失敗: ${path}`)
      continue
    }
    const mime = path.endsWith('.svg') ? 'image/svg+xml' : (res.headers.get('content-type') ?? 'image/png').split(';')[0]
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64')
    imageData.set(path, `data:${mime},${b64}`)
  }
  console.log(`画像埋め込み: ${imageData.size} 種`)

  const { xml, usedColors } = buildDrawio(els, info.dg, imageData)

  // テーマ写像: 使用色のうち CSS 変数値と一致するものを対応表にする
  const byValue = {}
  for (const [name, val] of Object.entries(info.theme)) byValue[val] ??= name
  const palette = {}
  const unmapped = []
  for (const c of usedColors) {
    if (byValue[c]) palette[c] = byValue[c]
    else unmapped.push(c)
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, xml)
  await writeFile(
    `${OUT}.theme.json`,
    JSON.stringify({ palette, unmapped }, null, 2) + '\n',
  )
  console.log(`書き出し: ${OUT} / ${OUT}.theme.json`)
  console.log(`テーマ写像: ${Object.keys(palette).length} 色, 未対応 ${unmapped.length} 色 ${unmapped.join(' ')}`)
} finally {
  stopServer()
}

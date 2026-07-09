#!/usr/bin/env node
// slidev-editable-pptx — Slidev のスライドを編集可能な PPTX に変換する。
// 思想は marp-to-editable-pptx を継承: Chromium で描画済み DOM を
// 実測し、PptxGenJS のネイティブ図形（テキストボックス・表・画像）として再構築する。
// 図形選定の基準（詳細は DESIGN.md「Vue コンポーネント図」の節）:
//   プリセット図形は実測ジオメトリを adjust 値で完全に再現できる場合
//   （roundRect の rectRadius、arc の angleRange）に限り使い、
//   それ以外は custGeom で実測座標を直接書く。プリセットの既定 adjust に
//   依存しない（bentConnector2 / chevron で形状ズレが起きた前例がある）。
// 入力は Slidev dev server の per-slide print ビュー（/{n}?print=true）。
// 生成後、slides/public/fonts/ の全フォントを EOT 形式で全字埋め込みする。
// 前提: flake devShell（direnv）内で実行し CHROME_PATH が設定されていること。
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import JSZip from 'jszip'
import { Font } from 'fonteditor-core'
import puppeteer from 'puppeteer-core'
import PptxGenJS from 'pptxgenjs'
import { walker } from '../lib/walker.mjs'

const ENTRY = process.env.SLIDES_ENTRY ?? 'slides/deck.md'
const OUT = process.env.OUT ?? 'out/deck-editable.pptx'
const PORT = Number(process.env.SLIDEV_PORT ?? 18730)
const BASE = `http://localhost:${PORT}`

const browserPath = process.env.CHROME_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH
if (!browserPath) {
  console.error('CHROME_PATH が未設定です。flake devShell（direnv）内で実行してください。')
  process.exit(1)
}

// ---- 座標変換: 1280x720 px -> 13.333 x 7.5 inch (96dpi) ----
// フォント変換 px2pt (=*0.75) は 96px/inch 前提なので、幾何も同じ密度に
// 揃える。10x5.625in (128px/inch) にするとテキストだけ 4/3 倍になり溢れる。
const PXW = 1280
const PXH = 720
const INW = PXW / 96
const INH = PXH / 96
const px2inX = (v) => (v / PXW) * INW
const px2inY = (v) => (v / PXH) * INH
const px2pt = (v) => v * 0.75

// ---- フォント全字埋め込み（TTF→EOT。生 TTF は PowerPoint に無視される） ----
// EMBED_FONTS 環境変数（JSON 配列）で差し替え可能。既定は tech-slide 系の同梱フォント。
const EMBED_FONTS = process.env.EMBED_FONTS
  ? JSON.parse(process.env.EMBED_FONTS)
  : [
      {
        typeface: 'OctoBiz',
        regular: 'slides/public/fonts/OctoBiz-Regular.ttf',
        bold: 'slides/public/fonts/OctoBiz-Bold.ttf',
      },
      {
        typeface: 'UDEV Gothic',
        regular: 'slides/public/fonts/UDEVGothic-Regular.ttf',
        bold: 'slides/public/fonts/UDEVGothic-Bold.ttf',
      },
    ]

const FONT_REL_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font'

function ttfToEot(ttf) {
  const font = Font.create(ttf, { type: 'ttf', hinting: true })
  // 固定ピッチ宣言を解除する。UDEV Gothic のような等幅宣言
  // （post.isFixedPitch=1 / PANOSE bProportion=9）のフォントを埋め込むと、
  // PowerPoint が全角の字送りを実メトリクスの 2 倍で計算し間延びする。
  // グリフと advance width は変えないため見た目の字形は同一。
  const data = font.get()
  if (data.post) data.post.isFixedPitch = 0
  const os2 = data['OS/2']
  if (os2 && os2.bProportion === 9) os2.bProportion = 0
  return Buffer.from(font.write({ type: 'eot', hinting: true }))
}

async function embedFonts(pptx) {
  const zip = await JSZip.loadAsync(pptx)

  const fontParts = []
  let embeddedFontLst = '<p:embeddedFontLst>'
  let relEntries = ''

  let fontIndex = 0
  for (const f of EMBED_FONTS) {
    let entry = `<p:embeddedFont><p:font typeface="${f.typeface}"/>`
    for (const style of ['regular', 'bold']) {
      fontIndex += 1
      const rId = `rIdEmbedFont${fontIndex}`
      const file = `fonts/font${fontIndex}.fntdata`
      const eot = ttfToEot(await readFile(resolve(f[style])))
      fontParts.push({ file: `ppt/${file}`, data: eot })
      relEntries += `<Relationship Id="${rId}" Type="${FONT_REL_TYPE}" Target="${file}"/>`
      entry += `<p:${style} r:id="${rId}"/>`
    }
    embeddedFontLst += `${entry}</p:embeddedFont>`
  }
  embeddedFontLst += '</p:embeddedFontLst>'

  const ct = await zip.file('[Content_Types].xml').async('string')
  zip.file(
    '[Content_Types].xml',
    ct.replace(
      '</Types>',
      '<Default Extension="fntdata" ContentType="application/x-fontdata"/></Types>',
    ),
  )

  const rels = await zip.file('ppt/_rels/presentation.xml.rels').async('string')
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    rels.replace('</Relationships>', `${relEntries}</Relationships>`),
  )

  let pres = await zip.file('ppt/presentation.xml').async('string')
  // 全字埋め込みのため saveSubsetFonts は付けない
  pres = pres
    .replace(/ (?:embedTrueTypeFonts|saveSubsetFonts)="[^"]*"/g, '')
    .replace('<p:presentation ', '<p:presentation embedTrueTypeFonts="1" ')
    .replace(/(<p:notesSz[^/]*\/>)/, `$1${embeddedFontLst}`)
  zip.file('ppt/presentation.xml', pres)

  for (const p of fontParts) zip.file(p.file, p.data)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

// ---- in-page walker は lib/walker.mjs（ブラウザ内で実行、page.evaluate で注入） ----

// ---- Slidev dev server の起動と待機 ----
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
  console.error('--- slidev dev server output ---')
  console.error(serverLog || '(出力なし)')
  throw new Error(`Slidev dev server が ${url} で起動しない`)
}

let serverLog = ''
let serverExited = false
const server = spawn(
  'npx',
  ['slidev', ENTRY, '--port', String(PORT), '--force'],
  { stdio: ['ignore', 'pipe', 'pipe'], detached: true },
)
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

try {
  await waitForServer(BASE)

  const browser = await puppeteer.launch({ executablePath: browserPath, headless: true })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 720 })

  // スライド数を print ビューから検出する
  await page.goto(`${BASE}/print?print=true`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.slidev-page', { timeout: 30000 })
  const total = await page.evaluate(() => document.querySelectorAll('.slidev-page').length)
  console.log(`スライド数: ${total}`)

  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'W16x9', width: INW, height: INH })
  pptx.layout = 'W16x9'

  for (let n = 1; n <= total; n++) {
    // dev server 起動直後は Vite の依存最適化とレースしてスライドモジュールの
    // 読み込みが一時的に失敗することがあるため、空描画ならリロードで再試行する
    for (let attempt = 1; ; attempt++) {
      await page.goto(`${BASE}/${n}?print=true`, { waitUntil: 'networkidle0' })
      const loaded = await page.evaluate(
        (sel) => (document.querySelector(sel)?.children.length ?? 0) > 0,
        `[data-slidev-no="${n}"]`,
      )
      if (loaded) break
      if (attempt >= 5) throw new Error(`slide ${n}: 読み込みに失敗（${attempt} 回試行）`)
      await new Promise((r) => setTimeout(r, 2000))
    }
    // フォント読み込みとレイアウト安定を待つ
    await page.evaluate(() => document.fonts.ready)
    await new Promise((r) => setTimeout(r, 800))
    // drawio 図（DrawioDiag）がある場合は描画完了（契約公開）まで待つ
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[data-diag="drawio"]')].every(
          (e) => e.dataset.drawioReady === '1',
        ),
      { timeout: 30000 },
    )
    const data = await page.evaluate(walker, `[data-slidev-no="${n}"]`)
    if (!data) {
      console.error(`slide ${n}: 描画要素が見つからない`)
      continue
    }
    const slide = pptx.addSlide()
    slide.background = { color: data.slideBg }
    // テーマレイアウトの背景画像（cover/section 等）。透過 PNG を背景色に重ねる
    // ため slide.background ではなく最背面の全面画像として敷く
    if (data.slideBgImg) {
      const res = await fetch(data.slideBgImg)
      const mime = res.headers.get('content-type')?.split(';')[0] ?? 'image/png'
      const b64 = Buffer.from(await res.arrayBuffer()).toString('base64')
      slide.addImage({ data: `data:${mime};base64,${b64}`, x: 0, y: 0, w: INW, h: INH })
    }

    for (const el of data.elements) {
      // drawio 変換のカバレッジ報告（図形ではない）
      if (el.kind === 'drawio-coverage') {
        console.log(
          `slide ${n}: drawio ${el.src ?? ''} 変換 ${el.converted} / ラスタライズ ${el.rasterized} / スキップ ${el.skipped}`,
        )
        continue
      }
      // diag-edge は rect ではなく points を持つ
      const box = el.rect
        ? {
            x: px2inX(el.rect.x),
            y: px2inY(el.rect.y),
            w: px2inX(el.rect.w),
            h: px2inY(el.rect.h),
          }
        : null
      if (el.kind === 'image') {
        let dataUrl = el.dataUrl
        if (!dataUrl && el.src) {
          const res = await fetch(el.src)
          const mime = res.headers.get('content-type')?.split(';')[0] ?? 'image/png'
          const b64 = Buffer.from(await res.arrayBuffer()).toString('base64')
          dataUrl = `data:${mime};base64,${b64}`
        }
        if (dataUrl) {
          // dark テーマの下敷き（img の背景色）を角丸矩形として先に敷く
          if (el.plate) {
            slide.addText('', {
              // rectRadius: 0 は pptxgenjs が adj を書かず PowerPoint 既定の丸みに
              // 落ちるため、丸みなしはプリセット rect を使う
              shape: el.plate.radiusPx > 0 ? 'roundRect' : 'rect',
              ...box,
              rectRadius: px2inX(el.plate.radiusPx),
              fill: { color: el.plate.color },
              line: { color: el.plate.color, width: 0.25 },
            })
          }
          const pad = el.plate?.padPx ?? 0
          slide.addImage({
            data: dataUrl,
            x: px2inX(el.rect.x + pad),
            y: px2inY(el.rect.y + pad),
            w: px2inX(el.rect.w - pad * 2),
            h: px2inY(el.rect.h - pad * 2),
            // CSS background-size: contain/cover 由来の画像はアスペクト比を保つ
            sizing: el.sizing
              ? {
                  type: el.sizing,
                  w: px2inX(el.rect.w - pad * 2),
                  h: px2inY(el.rect.h - pad * 2),
                }
              : undefined,
          })
        }
      } else if (el.kind === 'diag-box') {
        slide.addText('', {
          shape: el.radiusPx > 0 ? 'roundRect' : 'rect',
          ...box,
          rectRadius: px2inX(el.radiusPx),
          fill: el.fill ? { color: el.fill } : undefined,
          line: { color: el.border, width: px2pt(el.borderWPx) },
        })
        if (el.label) {
          slide.addText(
            [
              {
                text: el.label.text,
                options: {
                  fontFace: el.label.font,
                  fontSize: px2pt(el.label.sizePx),
                  color: el.label.color,
                  bold: el.label.bold,
                },
              },
            ],
            {
              // PPTX 側のフォント計測差で折り返さないよう左右に余裕を持たせる
              x: px2inX(el.label.rect.x - 8),
              y: px2inY(el.label.rect.y - 2),
              w: px2inX(el.label.rect.w + 16),
              h: px2inY(el.label.rect.h + 4),
              align: 'center',
              valign: 'middle',
              margin: 0,
            },
          )
        }
      } else if (el.kind === 'diag-chevron') {
        // シェブロンはプリセット図形だとノッチ深さが PowerPoint 既定 (min(w,h) の
        // 50%) に固定され CSS clip-path と一致しないため、実測ノッチで多角形を描く
        const { w, h } = el.rect
        const nt = Math.min(el.notchPx, w / 2)
        const poly = [
          [0, 0],
          [w - nt, 0],
          [w, h / 2],
          [w - nt, h],
          [0, h],
          ...(el.first ? [] : [[nt, h / 2]]),
        ]
        slide.addShape('custGeom', {
          ...box,
          points: [
            ...poly.map(([px, py]) => ({ x: px2inX(px), y: px2inY(py) })),
            { close: true },
          ],
          fill: { color: el.fill },
          line: { type: 'none' },
        })
        if (el.label)
          slide.addText(
            [
              {
                text: el.label.text,
                options: {
                  fontFace: el.label.font,
                  fontSize: px2pt(el.label.sizePx),
                  color: el.label.color,
                  bold: el.label.bold,
                },
              },
            ],
            { ...box, align: 'center', valign: 'middle', margin: 0 },
          )
      } else if (el.kind === 'diag-polygon') {
        // 正規化頂点列（[nx,ny] = 直線 / [cx,cy,nx,ny] = 二次ベジェ）を
        // 実測矩形へ展開して custGeom で描く
        const { w, h } = el.rect
        slide.addShape('custGeom', {
          ...box,
          points: [
            ...el.points.map((p) =>
              p.length === 4
                ? {
                    x: px2inX(p[2] * w),
                    y: px2inY(p[3] * h),
                    curve: { type: 'quadratic', x1: px2inX(p[0] * w), y1: px2inY(p[1] * h) },
                  }
                : { x: px2inX(p[0] * w), y: px2inY(p[1] * h) },
            ),
            ...(el.closed ? [{ close: true }] : []),
          ],
          fill: el.fill ? { color: el.fill } : { type: 'none' },
          line: el.stroke
            ? { color: el.stroke, width: px2pt(el.strokeWPx) }
            : { type: 'none' },
        })
      } else if (el.kind === 'diag-arc') {
        slide.addShape('arc', {
          ...box,
          angleRange: el.angleRange.map((a) => ((a % 360) + 360) % 360),
          fill: { type: 'none' },
          line: { color: el.color, width: px2pt(el.widthPx), endArrowType: 'triangle' },
        })
      } else if (el.kind === 'diag-edge') {
        const from = el.points[0]
        const to = el.points[el.points.length - 1]
        const line = {
          color: el.color,
          width: px2pt(el.widthPx),
          // 明示 dash（境界枠の長破線など）は lgDash、通常の破線は dash
          dashType: el.dashed ? (el.dash ? 'lgDash' : 'dash') : 'solid',
          endArrowType: el.noArrow ? 'none' : 'triangle',
        }
        if (el.points.length === 2) {
          slide.addShape('line', {
            x: px2inX(Math.min(from.x, to.x)),
            y: px2inY(Math.min(from.y, to.y)),
            w: px2inX(Math.abs(to.x - from.x)),
            h: px2inY(Math.abs(to.y - from.y)),
            line,
            flipH: to.x < from.x,
            flipV: to.y < from.y,
          })
        } else {
          // 折れ線はカスタム図形で忠実に描く。折れ点は SVG 描画（DiagEdge）と同じ
          // R=6px の角丸（二次ベジェ）にする。L 字も含め全経路をこの形式に統一する
          // （bentConnector2 は水平→垂直の形状固定で、垂直→水平の経路が破綻するため）
          const xs = el.points.map((p) => p.x)
          const ys = el.points.map((p) => p.y)
          const [minX, minY] = [Math.min(...xs), Math.min(...ys)]
          const P = el.points.map((p) => ({ x: p.x - minX, y: p.y - minY }))
          const R = 6 * el.widthPx // CSS 6px 相当（widthPx = 実効倍率 × scale）
          const pts = [{ x: px2inX(P[0].x), y: px2inY(P[0].y) }]
          for (let i = 1; i < P.length - 1; i++) {
            const [a, p, b] = [P[i - 1], P[i], P[i + 1]]
            const da = Math.hypot(p.x - a.x, p.y - a.y)
            const db = Math.hypot(b.x - p.x, b.y - p.y)
            if (!da || !db) continue
            const r = Math.min(R, da / 2, db / 2)
            pts.push({
              x: px2inX(p.x - ((p.x - a.x) / da) * r),
              y: px2inY(p.y - ((p.y - a.y) / da) * r),
            })
            pts.push({
              x: px2inX(p.x + ((b.x - p.x) / db) * r),
              y: px2inY(p.y + ((b.y - p.y) / db) * r),
              curve: { type: 'quadratic', x1: px2inX(p.x), y1: px2inY(p.y) },
            })
          }
          const last = P[P.length - 1]
          pts.push({ x: px2inX(last.x), y: px2inY(last.y) })
          slide.addShape('custGeom', {
            x: px2inX(minX),
            y: px2inY(minY),
            w: px2inX(Math.max(...xs) - minX),
            h: px2inY(Math.max(...ys) - minY),
            points: pts,
            fill: { type: 'none' },
            line,
          })
        }
      } else if (el.kind === 'table') {
        const rows = el.rows.map((cells) =>
          cells.map((c) => ({
            text: c.runs.map((r) => r.text).join(''),
            options: {
              bold: c.bold,
              fill: c.bg ? { color: c.bg } : undefined,
              fontFace: c.runs[0]?.font,
              fontSize: c.runs[0] ? px2pt(c.runs[0].sizePx) : 12,
              color: c.runs[0]?.color,
              valign: 'middle',
            },
          })),
        )
        const colW = el.rows[0].map((c) => px2inX(c.wPx))
        slide.addTable(rows, {
          ...box,
          colW,
          border: { type: 'solid', color: 'D8DEE9', pt: 0.75 },
          margin: 0.04,
        })
      } else if (el.kind === 'code') {
        const runs = []
        el.lines.forEach((line) => {
          if (line.length === 0) runs.push({ text: '', options: { breakLine: true } })
          line.forEach((r, j) => {
            runs.push({
              text: r.text,
              options: {
                fontFace: r.font,
                fontSize: px2pt(r.sizePx),
                color: r.color,
                bold: r.bold,
                breakLine: j === line.length - 1,
              },
            })
          })
        })
        slide.addText(runs, {
          ...box,
          fill: el.bg ? { color: el.bg } : undefined,
          valign: 'top',
          align: 'left',
          // pptxgenjs margin 配列は [左, 右, 下, 上] (pt)。実測 padding に合わせる
          margin: [el.paddingPx[0], el.paddingPx[2], el.paddingPx[3], el.paddingPx[1]].map(
            (v) => px2pt(v),
          ),
          lineSpacing: px2pt(el.lineHeightPx),
        })
      } else {
        const runs = el.runs.map((r) => ({
          text: r.text,
          options: {
            fontFace: r.font,
            fontSize: px2pt(r.sizePx),
            color: r.color,
            bold: r.bold,
            italic: r.italic,
            highlight: r.highlight || undefined,
          },
        }))
        slide.addText(runs, {
          ...box,
          align: el.align,
          valign: 'top',
          margin: 0,
          fill: el.bg ? { color: el.bg } : undefined,
          bullet: el.bullet ? { code: '2022', indent: px2pt(16) } : undefined,
          lineSpacing: el.lineHeightPx ? px2pt(el.lineHeightPx) : undefined,
          wrap: el.noWrap ? false : undefined,
        })
      }
    }
    console.log(`slide ${n}: ${data.elements.length} 要素, bg=#${data.slideBg}`)
  }

  await browser.close()

  const raw = await pptx.write({ outputType: 'nodebuffer' })
  const buf = await embedFonts(raw)
  await mkdir('out', { recursive: true })
  await writeFile(OUT, buf)
  console.log(
    `書き出し: ${OUT} (${buf.length} bytes, フォント全字埋め込み: ${EMBED_FONTS.map((f) => f.typeface).join(', ')})`,
  )
} finally {
  stopServer()
}

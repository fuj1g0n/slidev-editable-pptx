#!/usr/bin/env node
// drawio 図の塗り境界 lint。.drawio を vendor の viewer-static.min.js で
// headless 描画し、各セルの塗り境界（mxShape.boundingBox = stroke/矢印込みの
// 描画外形 + mxShape.getSvgScreenOffset の crisp オフセット）が
// ページ矩形 [0,0,pageWidth,pageHeight] に収まることを検査する。
// 輪郭線がキャンバス外へはみ出す描き方（クリップされて欠けて見える）を検出する。
// 使い方: lint-drawio-bounds [file.drawio ...]
//         引数なしは slides/public/figures/**/*.drawio を走査
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const ROOT = process.cwd()
const VIEWER = resolve(dirname(fileURLToPath(import.meta.url)), '../vendor/viewer-static.min.js')
const EPS = 0.01 // 浮動小数の丸め誤差のみ許容（0.5px のはみ出しは検出対象）

const browserPath = process.env.CHROME_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH
if (!browserPath) {
  console.error('CHROME_PATH が未設定です。flake devShell（direnv）内で実行してください。')
  process.exit(1)
}

let files = process.argv.slice(2)
if (files.length === 0) {
  const base = join(ROOT, 'slides/public/figures')
  ;(function walk(dir) {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(join(dir, e.name))
      else if (e.name.endsWith('.drawio')) files.push(join(dir, e.name))
    }
  })(base)
}
if (files.length === 0) {
  console.log('drawio 塗り境界 lint: 対象なし')
  process.exit(0)
}

const browser = await puppeteer.launch({ executablePath: browserPath, headless: true })
const page = await browser.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') console.error(`(viewer) ${m.text()}`)
})
await page.setContent('<!DOCTYPE html><html><body></body></html>')
await page.evaluate(() => {
  window.mxLoadResources = false
  window.mxLoadStylesheets = false
  window.DRAWIO_PUBLIC_BUILD = true
})
await page.addScriptTag({ path: VIEWER })

const errors = []
for (const file of files) {
  const rel = relative(ROOT, file)
  const xml = readFileSync(file, 'utf8')
  const result = await page.evaluate((xmlText) => {
    const doc = window.mxUtils.parseXml(xmlText)
    const models = [...doc.documentElement.querySelectorAll('mxGraphModel')]
    if (models.length === 0) return { error: 'mxGraphModel が無い' }
    const pages = []
    for (let i = 0; i < models.length; i++) {
      const model = models[i]
      const name = model.closest('diagram')?.getAttribute('name') ?? `#${i}`
      const pageW = parseFloat(model.getAttribute('pageWidth'))
      const pageH = parseFloat(model.getAttribute('pageHeight'))
      if (!(pageW > 0 && pageH > 0)) {
        pages.push({ name, error: 'mxGraphModel の pageWidth/pageHeight が無い（ページ矩形が契約の基準）' })
        continue
      }
      const el = document.createElement('div')
      el.style.width = `${pageW}px`
      el.style.height = `${pageH}px`
      document.body.appendChild(el)
      try {
        const viewer = new window.GraphViewer(el, doc.documentElement, {
          nav: false,
          highlight: 'none',
          lightbox: false,
          resize: false,
          border: 0,
          'auto-fit': false,
          'auto-crop': false,
          zoom: '1',
          page: i,
        })
        const g = viewer.graph
        g.view.scaleAndTranslate(1, 0, 0)
        const bad = []
        const N = (v) => Math.round(v * 100) / 100
        const check = (cell, kind, bb, o) => {
          const over = {
            left: N(-(bb.x + o)),
            top: N(-(bb.y + o)),
            right: N(bb.x + o + bb.width - pageW),
            bottom: N(bb.y + o + bb.height - pageH),
          }
          const sides = Object.entries(over).filter(([, v]) => v > 0.01)
          if (sides.length === 0) return
          bad.push(
            `${cell.id}${cell.value ? ` "${String(cell.value).slice(0, 20)}"` : ''} (${kind}): ` +
              sides.map(([s, v]) => `${s} +${v}px`).join(', '),
          )
        }
        const walk = (cell) => {
          const s = g.view.getState(cell)
          if (s?.shape) {
            const o = s.shape.getSvgScreenOffset?.() ?? 0
            check(cell, cell.edge ? 'edge' : 'shape', s.shape.boundingBox ?? s, o)
            if (s.text?.boundingBox) check(cell, 'label', s.text.boundingBox, 0)
          }
          for (const c of cell.children ?? []) walk(c)
        }
        walk(g.model.root)
        pages.push({ name, pageW, pageH, bad })
      } catch (e) {
        pages.push({ name, error: String(e) })
      } finally {
        el.remove()
      }
    }
    return { pages }
  }, xml)
  if (result.error) errors.push(`${rel}: ${result.error}`)
  else
    for (const pg of result.pages) {
      if (pg.error) errors.push(`${rel} [${pg.name}]: ${pg.error}`)
      else
        for (const b of pg.bad)
          errors.push(
            `${rel} [${pg.name}]: ページ (${pg.pageW}x${pg.pageH}) から塗りがはみ出す: ${b}`,
          )
    }
}
await browser.close()

if (errors.length) {
  for (const e of errors) console.error(`NG ${e}`)
  console.error(`drawio 塗り境界 lint: ${errors.length} 件のエラー`)
  process.exit(1)
}
console.log(`drawio 塗り境界 lint: OK (${files.length} ファイル)`)

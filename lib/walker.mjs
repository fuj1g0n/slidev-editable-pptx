// lib/walker.mjs — ブラウザ内で実行される in-page walker。
// bin/slidev-editable-pptx.mjs から page.evaluate(walker, sel) で注入される。
// 依存なし・自己完結（Function.prototype.toString でシリアライズされるため）。
export function walker(sel) {
  const root = document.querySelector(sel)
  if (!root) return null
  const rootRect = root.getBoundingClientRect()
  const scale = 1280 / rootRect.width
  const rel = (r) => ({
    x: (r.left - rootRect.left) * scale,
    y: (r.top - rootRect.top) * scale,
    w: r.width * scale,
    h: r.height * scale,
  })
  const isUiSkipped = (el) =>
    !!el.closest('button, nav, .slidev-icon-btn, .slidev-nav, .slidev-code-copy')
  // aria-hidden はテキストには適用するが、画像には適用しない。テーマの装飾画像
  // （cover のタイル群など）は aria-hidden="true" の中に置かれるのが普通のため
  const isSkipped = (el) => isUiSkipped(el) || !!el.closest('[aria-hidden="true"]')
  const toHex = (rgb) => {
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
    if (!m) return null
    if (m[4] !== undefined && Number(m[4]) === 0) return null
    return [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')
  }
  const firstFont = (ff) => ff.split(',')[0].trim().replace(/^["']|["']$/g, '')
  const tagIsImage = (el) => {
    const t = el.tagName.toLowerCase()
    return t === 'img' || t === 'svg'
  }

  // dark テーマの下敷き（--diag-icon-plate）: img に背景色が付いていれば矩形として運ぶ
  const iconPlate = (im) => {
    const st = getComputedStyle(im)
    const color = toHex(st.backgroundColor)
    if (!color) return undefined
    return { color, radiusPx: parseFloat(st.borderRadius) || 0, padPx: parseFloat(st.paddingLeft) || 0 }
  }

  // ブロック要素内のインラインラン
  const runsOf = (el) => {
    const runs = []
    const visit = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent
        if (!text) return
        const st = getComputedStyle(node.parentElement)
        // インラインコード（pre 外の code）の薄い背景を run ハイライトとして保持
        const codeEl = node.parentElement.closest('code')
        const codeBg =
          codeEl && !codeEl.closest('pre')
            ? toHex(getComputedStyle(codeEl).backgroundColor)
            : null
        runs.push({
          text,
          font: firstFont(st.fontFamily),
          sizePx: parseFloat(st.fontSize) * scale,
          bold: Number(st.fontWeight) >= 600,
          italic: st.fontStyle === 'italic',
          color: toHex(st.color) ?? '000000',
          highlight: codeBg,
        })
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase()
        if (tag === 'ul' || tag === 'ol' || tag === 'table' || tag === 'pre' || tag === 'img')
          return
        if (isSkipped(node)) return
        for (const c of node.childNodes) visit(c)
      }
    }
    for (const c of el.childNodes) visit(c)
    return runs.filter((r) => r.text.trim() !== '' || runs.length === 1)
  }

  const blockStyle = (el) => {
    const st = getComputedStyle(el)
    return {
      align:
        st.textAlign === 'center' ? 'center' : st.textAlign === 'right' ? 'right' : 'left',
      lineHeightPx: (parseFloat(st.lineHeight) || 0) * scale || null,
      bg: toHex(st.backgroundColor),
    }
  }

  // スライド背景（色 + テーマレイアウトの背景画像）
  let slideBg = 'FFFFFF'
  let slideBgImg = null
  for (const el of [root, ...root.querySelectorAll('.slidev-layout')]) {
    const st = getComputedStyle(el)
    const bg = toHex(st.backgroundColor)
    if (bg) slideBg = bg
    const m = st.backgroundImage.match(/url\("?([^")]+)"?\)/)
    if (m) slideBgImg = m[1]
  }

  const elements = []

  // Vue コンポーネント図（Diag/DiagBox/DiagEdge）。data-diag 属性が出自の宣言で、
  // 経路座標は data-diag-edge の JSON をそのまま使う（推測しない）
  for (const dg of root.querySelectorAll('[data-diag="root"]')) {
    if (isSkipped(dg)) continue
    const dgRect = dg.getBoundingClientRect()
    const fx = dgRect.width / dg.offsetWidth // CSS transform を含む実効倍率
    const fy = dgRect.height / dg.offsetHeight
    const pushBox = (bx) => {
      const st = getComputedStyle(bx)
      const labelEl = bx.querySelector('[data-diag-label]')
      let label = null
      if (labelEl) {
        const lst = getComputedStyle(labelEl)
        label = {
          text: labelEl.textContent,
          rect: rel(labelEl.getBoundingClientRect()),
          font: firstFont(lst.fontFamily),
          sizePx: parseFloat(lst.fontSize) * scale,
          bold: Number(lst.fontWeight) >= 600,
          color: toHex(lst.color) ?? '000000',
        }
      }
      elements.push({
        kind: 'diag-box',
        rect: rel(bx.getBoundingClientRect()),
        fill: toHex(st.backgroundColor),
        border: toHex(st.borderTopColor) ?? '000000',
        borderWPx: parseFloat(st.borderTopWidth) * fx * scale,
        radiusPx: parseFloat(st.borderTopLeftRadius) * fx * scale,
        label,
      })
      // アイコンとスロット内の画像・テキスト（ロゴ列挙など）をすべて捕捉する
      for (const img of bx.querySelectorAll('img'))
        elements.push({
          kind: 'image',
          rect: rel(img.getBoundingClientRect()),
          src: img.currentSrc || img.src,
          plate: iconPlate(img),
        })
      for (const sp of bx.querySelectorAll('span:not([data-diag-label])')) {
        if (!sp.textContent.trim()) continue
        const sst = getComputedStyle(sp)
        elements.push({
          kind: 'text',
          tag: 'p',
          bullet: false,
          rect: rel(sp.getBoundingClientRect()),
          runs: [
            {
              text: sp.textContent,
              font: firstFont(sst.fontFamily),
              sizePx: parseFloat(sst.fontSize) * scale,
              bold: Number(sst.fontWeight) >= 600,
              italic: false,
              color: toHex(sst.color) ?? '000000',
              highlight: null,
            },
          ],
          align: 'center',
          lineHeightPx: null,
          bg: null,
          noWrap: true,
        })
      }
    }
    // raised（線上に載る）ボックスはエッジより後に描画する
    const allBoxes = [...dg.querySelectorAll('[data-diag="box"]')]
    for (const bx of allBoxes.filter((b) => !b.dataset.raised)) pushBox(bx)
    for (const cv of dg.querySelectorAll('[data-diag="chevron"]')) {
      const st = getComputedStyle(cv)
      const labelEl = cv.querySelector('[data-diag-label]')
      const lst = labelEl ? getComputedStyle(labelEl) : null
      elements.push({
        kind: 'diag-chevron',
        rect: rel(cv.getBoundingClientRect()),
        fill: toHex(st.backgroundColor) ?? '000000',
        first: JSON.parse(cv.dataset.diagChevron ?? '{}').first === true,
        notchPx: (JSON.parse(cv.dataset.diagChevron ?? '{}').notch ?? 14) * fx * scale,
        label: labelEl
          ? {
              text: labelEl.textContent,
              font: firstFont(lst.fontFamily),
              sizePx: parseFloat(lst.fontSize) * scale,
              bold: Number(lst.fontWeight) >= 600,
              color: toHex(lst.color) ?? 'FFFFFF',
            }
          : null,
      })
    }
    // data-pptx="polygon"（DiagPolygon / DiagBlockArrow / DiagCallout /
    // DiagBadge / DiagCylinder）。頂点は要素矩形に対する 0..1 正規化で宣言され、
    // 塗り・線は対応する path の computed style を実測する（ADR-0003）
    for (const pg of dg.querySelectorAll('[data-pptx="polygon"]')) {
      const meta = JSON.parse(pg.dataset.pptxPolygon)
      const rect = rel(pg.getBoundingClientRect())
      const pathEls = [...pg.querySelectorAll('path')]
      meta.paths.forEach((p, i) => {
        const st = getComputedStyle(pathEls[i] ?? pg)
        const stroke = st.stroke && st.stroke !== 'none' ? toHex(st.stroke) : null
        elements.push({
          kind: 'diag-polygon',
          rect,
          points: p.points,
          closed: p.closed !== false,
          fill: st.fill && st.fill !== 'none' ? toHex(st.fill) : null,
          stroke,
          strokeWPx: stroke ? (parseFloat(st.strokeWidth) || 1) * fx * scale : 0,
        })
      })
    }
    for (const cc of dg.querySelectorAll('[data-diag="cycle"]')) {
      const meta = JSON.parse(cc.dataset.diagCycle)
      const stroke = toHex(getComputedStyle(cc.querySelector('path')).stroke) ?? '000000'
      for (const a of meta.arcs)
        elements.push({
          kind: 'diag-arc',
          rect: rel(cc.getBoundingClientRect()),
          angleRange: [a.start, a.end],
          color: stroke,
          widthPx: fx * scale,
        })
    }
    for (const tx of dg.querySelectorAll('[data-diag="text"]')) {
      const st = getComputedStyle(tx)
      elements.push({
        kind: 'text',
        tag: 'p',
        bullet: false,
        rect: rel(tx.getBoundingClientRect()),
        runs: [
          {
            text: tx.textContent,
            font: firstFont(st.fontFamily),
            sizePx: parseFloat(st.fontSize) * scale,
            bold: Number(st.fontWeight) >= 600,
            italic: false,
            color: toHex(st.color) ?? '000000',
            highlight: null,
          },
        ],
        align: st.textAlign === 'left' ? 'left' : 'center',
        lineHeightPx: null,
        bg: null,
      })
    }
    for (const il of dg.querySelectorAll('[data-diag="icon-label"]')) {
      const img = il.querySelector('img')
      if (img)
        elements.push({
          kind: 'image',
          rect: rel(img.getBoundingClientRect()),
          src: img.currentSrc || img.src,
          plate: iconPlate(img),
        })
      const labelEl = il.querySelector('[data-diag-label]')
      if (labelEl) {
        const lst = getComputedStyle(labelEl)
        elements.push({
          kind: 'text',
          tag: 'p',
          bullet: false,
          rect: rel(labelEl.getBoundingClientRect()),
          runs: [
            {
              text: labelEl.textContent,
              font: firstFont(lst.fontFamily),
              sizePx: parseFloat(lst.fontSize) * scale,
              bold: Number(lst.fontWeight) >= 600,
              italic: false,
              color: toHex(lst.color) ?? '000000',
              highlight: null,
            },
          ],
          align: lst.textAlign === 'left' ? 'left' : 'center',
          lineHeightPx: null,
          bg: null,
        })
      }
    }
    for (const eg of dg.querySelectorAll('[data-diag="edge"]')) {
      const meta = JSON.parse(eg.dataset.diagEdge)
      const pst = getComputedStyle(eg.querySelector('path'))
      elements.push({
        kind: 'diag-edge',
        points: meta.points.map((p) => ({
          x: (dgRect.left - rootRect.left + p.x * fx) * scale,
          y: (dgRect.top - rootRect.top + p.y * fy) * scale,
        })),
        dashed: !!meta.dashed,
        dash: meta.dash || null,
        noArrow: !!meta.noArrow,
        color: toHex(pst.stroke) ?? '000000',
        widthPx: (parseFloat(pst.strokeWidth) || 1) * fx * scale,
      })
    }
    for (const bx of allBoxes.filter((b) => b.dataset.raised)) pushBox(bx)
    for (const lb of dg.querySelectorAll('[data-diag="edge-label"]')) {
      const st = getComputedStyle(lb)
      elements.push({
        kind: 'text',
        tag: 'p',
        bullet: false,
        rect: rel(lb.getBoundingClientRect()),
        runs: [
          {
            text: lb.textContent,
            font: firstFont(st.fontFamily),
            sizePx: parseFloat(st.fontSize) * scale,
            bold: Number(st.fontWeight) >= 600,
            italic: false,
            color: toHex(st.color) ?? '000000',
            highlight: null,
          },
        ],
        align: 'center',
        lineHeightPx: null,
        bg: toHex(st.backgroundColor),
      })
    }
  }

  // drawio 図（DrawioDiag、ADR-0019 の第二契約入口）。DOM は走査せず、
  // コンポーネントが公開する mxGraph インスタンス（__drawioGraph）の
  // モデル（z 順 = 子順）と view state（解決済み絶対座標）から
  // 既存の中間語彙へ写像する。未対応スタイルはセル単位で SVG ラスタライズし
  // z 順のまま interleave する（coverage レポート付き）
  for (const dg of root.querySelectorAll('[data-diag="drawio"]')) {
    if (isSkipped(dg)) continue
    const g = dg.__drawioGraph
    if (!g) {
      console.warn('drawio: __drawioGraph 未公開（描画未完了？）')
      continue
    }
    const dgRect = dg.getBoundingClientRect()
    const fx = dgRect.width / dg.offsetWidth
    const fy = dgRect.height / dg.offsetHeight
    const px = (v) => v * fx * scale
    const P = (x, y) => ({
      x: (dgRect.left - rootRect.left + x * fx) * scale,
      y: (dgRect.top - rootRect.top + y * fy) * scale,
    })
    const R = (s) => {
      const p = P(s.x, s.y)
      return { x: p.x, y: p.y, w: s.width * fx * scale, h: s.height * fy * scale }
    }
    // 塗り矩形（painted bbox）: geometry に crisp オフセット
    // （mxShape.getSvgScreenOffset、奇数 strokeWidth で +0.5）を足し、
    // stroke 有りなら sw/2 外側へ広げる。extractor の fit() の逆写像
    const painted = (state, sw = 0) => {
      const o = state.shape?.getSvgScreenOffset?.() ?? 0
      return R({
        x: state.x + o - sw / 2,
        y: state.y + o - sw / 2,
        width: state.width + sw,
        height: state.height + sw,
      })
    }
    const styleOf = (cell) => {
      const st = {}
      for (const kv of (cell.style || '').split(';')) {
        if (!kv) continue
        const i = kv.indexOf('=')
        if (i < 0) st[kv] = '1'
        else st[kv.slice(0, i)] = kv.slice(i + 1)
      }
      return st
    }
    const col = (v) => (v && v !== 'none' ? v.replace('#', '').toLowerCase() : null)
    const fontOf = (st) => ({
      font: st.fontFamily ?? 'Helvetica',
      sizePx: px(parseFloat(st.fontSize ?? '12')),
      bold: (Number(st.fontStyle ?? 0) & 1) === 1,
      color: col(st.fontColor) ?? '000000',
    })
    const pushLabel = (cell, st, state) => {
      // ラベルは view の text 実測境界（なければセル矩形）に置く
      if (cell.value == null || String(cell.value) === '') return
      const tb = state.text?.boundingBox
      const rect = tb
        ? (() => {
            const p = P(tb.x, tb.y)
            return { x: p.x, y: p.y, w: tb.width * fx * scale, h: tb.height * fy * scale }
          })()
        : R(state)
      const f = fontOf(st)
      elements.push({
        kind: 'text',
        tag: 'p',
        bullet: false,
        rect,
        runs: [
          {
            text: String(cell.value),
            font: f.font,
            sizePx: f.sizePx,
            bold: f.bold,
            italic: false,
            color: f.color,
            highlight: null,
          },
        ],
        align: st.align ?? 'center',
        lineHeightPx: null,
        bg: col(st.labelBackgroundColor),
        // drawio ラベルは whiteSpace=wrap を使わない契約（改行は明示 \n のみ）。
        // rect は Chromium の実測 tight bbox のため、PowerPoint のフォント計測差で
        // 数 px 不足すると末尾 1 文字が折り返れてしまう。自動折り返しを禁止する
        noWrap: true,
      })
    }
    const coverage = { converted: 0, rasterized: 0, skipped: 0 }
    const rasterize = (cell, state) => {
      // 未対応セルのフォールバック: 描画済み SVG ノードを単体 SVG に包んで
      // data URL 画像として z 位置に挿す
      const node = state.shape?.node
      if (!node) {
        coverage.skipped++
        return
      }
      const bb = state.boundingBox ?? state
      const clone = node.cloneNode(true)
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
        `viewBox="${bb.x} ${bb.y} ${bb.width} ${bb.height}" width="${bb.width}" height="${bb.height}">` +
        new XMLSerializer().serializeToString(clone) +
        '</svg>'
      elements.push({
        kind: 'image',
        rect: R({ x: bb.x, y: bb.y, width: bb.width, height: bb.height }),
        dataUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
      })
      coverage.rasterized++
    }
    const emit = (cell) => {
      const state = g.view.getState(cell)
      if (!state) return
      const st = styleOf(cell)
      if (cell.edge) {
        const pts = state.absolutePoints ?? []
        if (pts.length >= 2) {
          const o = state.shape?.getSvgScreenOffset?.() ?? 0
          elements.push({
            kind: 'diag-edge',
            points: pts.map((p) => P(p.x + o, p.y + o)),
            dashed: st.dashed === '1',
            dash: st.dashPattern ?? null,
            noArrow: (st.endArrow ?? 'classic') === 'none',
            color: col(st.strokeColor) ?? '000000',
            widthPx: px(parseFloat(st.strokeWidth ?? '1')),
          })
          coverage.converted++
        }
        pushLabel(cell, st, state)
        return
      }
      if (!cell.vertex) return
      const shape = st.shape ?? (st.text !== undefined ? 'text' : 'rect')
      if (st.text !== undefined) {
        pushLabel(cell, st, state)
        coverage.converted++
      } else if (shape === 'image') {
        elements.push({
          kind: 'image',
          rect: painted(state),
          src: st.image.startsWith('data:')
            ? undefined
            : new URL(st.image, location.origin).href,
          dataUrl: st.image.startsWith('data:')
            ? st.image.replace(/^data:([^;,]+),/, 'data:$1;base64,')
            : undefined,
        })
        coverage.converted++
      } else if (shape === 'step') {
        elements.push({
          kind: 'diag-chevron',
          rect: painted(state),
          fill: col(st.fillColor) ?? '000000',
          first: false,
          notchPx: px(parseFloat(st.size ?? '14')),
          label: cell.value ? { text: String(cell.value), ...fontOf(st) } : null,
        })
        coverage.converted++
      } else if (shape === 'mxgraph.basic.polygon') {
        // polyCoords（0..1 正規化）は diag-polygon と同一語彙
        const coords = JSON.parse(st.polyCoords ?? '[]')
        elements.push({
          kind: 'diag-polygon',
          rect: painted(state, col(st.strokeColor) ? parseFloat(st.strokeWidth ?? '1') : 0),
          points: coords,
          closed: true,
          fill: col(st.fillColor),
          stroke: col(st.strokeColor),
          strokeWPx: col(st.strokeColor) ? px(parseFloat(st.strokeWidth ?? '1')) : 0,
        })
        pushLabel(cell, st, state)
        coverage.converted++
      } else if (shape === 'mxgraph.basic.arc') {
        const s360 = parseFloat(st.startAngle ?? '0') * 360
        const e360 = parseFloat(st.endAngle ?? '0.5') * 360
        elements.push({
          kind: 'diag-arc',
          rect: painted(state, parseFloat(st.strokeWidth ?? '1')),
          angleRange: [s360, e360 < s360 ? e360 + 360 : e360],
          color: col(st.strokeColor) ?? '000000',
          widthPx: px(parseFloat(st.strokeWidth ?? '1')),
        })
        coverage.converted++
      } else if (shape === 'rect') {
        elements.push({
          kind: 'diag-box',
          rect: painted(state, col(st.strokeColor) ? parseFloat(st.strokeWidth ?? '1') : 0),
          fill: col(st.fillColor),
          border: col(st.strokeColor) ?? '000000',
          borderWPx: col(st.strokeColor) ? px(parseFloat(st.strokeWidth ?? '1')) : 0,
          radiusPx:
            st.rounded === '1'
              ? st.absoluteArcSize === '1'
                ? px(parseFloat(st.arcSize ?? '20') / 2)
                : (Math.min(state.width, state.height) * parseFloat(st.arcSize ?? '15')) / 100 / 2
              : 0,
          label: null,
        })
        pushLabel(cell, st, state)
        coverage.converted++
      } else {
        // ラスタライズは図形ノード（state.shape.node）のみ複製し、ラベルは
        // 別ノード（state.text）のため運ばれない。テキストとして別途出力する
        rasterize(cell, state)
        pushLabel(cell, st, state)
      }
      for (const ch of cell.children ?? []) emit(ch)
    }
    // root 直下 = レイヤ、その子が図要素（子順 = z 順）
    for (const layer of g.model.root.children ?? [])
      for (const c of layer.children ?? []) emit(c)
    elements.push({
      kind: 'drawio-coverage',
      src: dg.dataset.drawioSrc ?? null,
      ...coverage,
    })
  }

  // CSS background-image による装飾・メディア画像（co-branding lockup、
  // ロゴマーク、feature の ::media:: ブロック等）。スライド背景として敷いた
  // 画像（slideBgImg）・レイアウト要素・図コンポーネント内は除外する
  for (const el of root.querySelectorAll('*')) {
    if (el === root || el.classList.contains('slidev-layout')) continue
    if (isUiSkipped(el) || el.closest('[data-diag="root"], [data-diag="drawio"]')) continue
    const st = getComputedStyle(el)
    const m = st.backgroundImage.match(/url\("?([^")]+)"?\)/)
    if (!m || m[1] === slideBgImg) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    elements.push({
      kind: 'image',
      rect: rel(r),
      src: m[1],
      sizing: st.backgroundSize === 'contain' || st.backgroundSize === 'cover'
        ? st.backgroundSize
        : null,
    })
  }

  const blocks = root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,pre,table,img,svg')
  for (const b of blocks) {
    // 画像は aria-hidden（装飾宣言）でも運ぶ。テキスト等は従来通りスキップ
    if (tagIsImage(b) ? isUiSkipped(b) : isSkipped(b)) continue
    if (b.closest('[data-diag="root"], [data-diag="drawio"]')) continue // 図コンポーネント内は上で捕捉済み
    const tag = b.tagName.toLowerCase()
    const r = b.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (b.closest('table') && tag !== 'table') continue
    if (tag !== 'pre' && b.closest('pre')) continue
    if (tag === 'p' && b.parentElement?.tagName.toLowerCase() === 'li') continue
    if ((tag === 'img' || tag === 'svg') && b.closest('svg') !== (tag === 'svg' ? b : null))
      continue

    if (tag === 'img') {
      elements.push({
        kind: 'image',
        rect: rel(r),
        src: b.currentSrc || b.src,
        plate: iconPlate(b),
      })
    } else if (tag === 'svg') {
      // インライン SVG（アイコン・Mermaid など）は data URL 化して画像として貼る
      const xml = new XMLSerializer().serializeToString(b)
      elements.push({
        kind: 'image',
        rect: rel(r),
        dataUrl: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`,
      })
    } else if (tag === 'table') {
      const rows = []
      for (const tr of b.querySelectorAll('tr')) {
        const cells = []
        for (const cell of tr.querySelectorAll('th,td')) {
          const cst = getComputedStyle(cell)
          cells.push({
            runs: runsOf(cell),
            bold: Number(cst.fontWeight) >= 600,
            bg: toHex(cst.backgroundColor),
            wPx: cell.getBoundingClientRect().width * scale,
          })
        }
        rows.push(cells)
      }
      elements.push({ kind: 'table', rect: rel(r), rows })
    } else if (tag === 'pre') {
      const lines = []
      const lineEls = b.querySelectorAll('.line')
      if (lineEls.length > 0) {
        for (const ln of lineEls) lines.push(runsOf(ln))
      } else {
        lines.push(runsOf(b))
      }
      const st = getComputedStyle(b.querySelector('code') ?? b)
      const pst = getComputedStyle(b)
      elements.push({
        kind: 'code',
        rect: rel(r),
        lines,
        bg:
          blockStyle(b).bg ??
          toHex(getComputedStyle(b.querySelector('code') ?? b).backgroundColor),
        font: firstFont(st.fontFamily),
        sizePx: parseFloat(st.fontSize) * scale,
        lineHeightPx: (parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.4) * scale,
        paddingPx: [
          parseFloat(pst.paddingLeft),
          parseFloat(pst.paddingTop),
          parseFloat(pst.paddingRight),
          parseFloat(pst.paddingBottom),
        ].map((v) => (v || 0) * scale),
      })
    } else {
      const runs = runsOf(b)
      if (runs.length === 0) continue
      elements.push({
        kind: 'text',
        tag,
        bullet: tag === 'li',
        rect: rel(r),
        runs,
        ...blockStyle(b),
      })
    }
  }
  return { slideBg, slideBgImg, elements }
}

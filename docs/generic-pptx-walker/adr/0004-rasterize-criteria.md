---
status: proposed
date: 2026-07-06
---

# ラスタライズの検出条件と可視化

## Context and Problem Statement

推論層が再現できないスタイルは多数ある（グラデーション・transform・clip-path・
CSS filter・foreignObject）。marp-to-editable-pptx は一部を rasterize フラグで
画像化するが、条件が散在しどれが画像化されたか外から分からない。

## Considered Options

- marp-to-editable-pptx の一部 rasterize フラグ
- `rasterizeReason(el, style)` による検出条件と可視化

## Decision Outcome

Chosen option: "rasterizeReason(el, style) による検出条件と可視化", because marp-to-editable-pptx は一部を rasterize フラグで画像化するが、条件が散在しどれが画像化されたか外から分からない。

- 判定関数 `rasterizeReason(el, style)` を 1 箇所に置き、次を検出したら
  その要素のサブツリー全体を 1 枚の領域スクリーンショットにする:
  1. `foreignObject` を含む SVG
  2. `filter` / `backdrop-filter` が none 以外
  3. `background-image` にグラデーションまたは画像
  4. `transform` が単位行列・純平行移動以外（回転・skew・scale）
  5. `clip-path` が none 以外
  6. ADR-0003 のサブセット外要素を含む SVG
  7. 契約による明示指定 `data-pptx="rasterize"`
- 変換ログに `rasterized: <セレクタ相当> reason=<番号と名称>` を必ず出力し、
  終了時に統計（ネイティブ図形数 / 画像数 / ラスタライズ数）を出す。
- スクリーンショットは Puppeteer の clip 付き screenshot で該当領域のみ取得し、
  デバイスピクセル比 2 で撮る（既存 export と同等の解像度）。

### Consequences

- Good, because 「黙って消える」「黙って崩れる」が仕様上存在しなくなる。
- Good, because QA ループ（qa:pptx）でラスタライズ済み領域を重点確認できる。
- Good, because 純平行移動の transform は座標合成で救うため、過剰な画像化を避けられる。

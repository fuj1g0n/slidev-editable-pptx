---
status: accepted
date: 2026-07-08
---

# ラスタライズの検出条件・前景保護・可視化

## Context and Problem Statement

推論層が再現できないスタイルは多数ある（グラデーション・transform・
clip-path・CSS filter・foreignObject・疑似要素）。marp-to-editable-pptx は
一部を rasterize フラグで画像化するが、条件が散在しどれが画像化されたか
外から分からない。さらに素朴な「サブツリー丸ごと画像化」は、装飾を持つ
コンテナの子テキストまで画像に焼き込み、editable の定義（requirements
2026-07-08 §2.3 E-1〜E-3）を破壊する。初版（2026-07-06）の本 ADR は
この前景保護の観点と疑似要素の検出を欠いていた。

## Considered Options

- 散在する個別 rasterize フラグ（marp-to-editable-pptx 方式）
- サブツリー丸ごと画像化を常に許す単純な敗者復活
- `rasterizeReason(el, style)` 集約判定 + 前景保護 + ネイティブ優先

## Decision Outcome

Chosen option: "集約判定 + 前景保護 + ネイティブ優先", because
「黙って消えない」保証には検出条件の一元化と理由の可視化が必要であり、
同時に編集性優先クラス（本文テキスト等）を画像へ焼き込まないことが
editable の成立条件だから。

### 検出条件（rasterizeReason、1 箇所に集約）

1. `foreignObject` を含む SVG
2. `filter` / `backdrop-filter` が none 以外
3. `background-image` に画像以外（グラデーション等）——ただし下記
   「ネイティブ優先」を先に評価する
4. `transform` が単位行列・純平行移動以外（回転・skew・scale）
5. `clip-path` が none 以外
6. ADR-0009 のサブセット外要素を含む SVG
7. 契約による明示指定 `data-pptx="rasterize"`
8. content が none 以外の可視疑似要素（`getComputedStyle(el, '::before'/'::after')`
   で検出。rect は取得できないが存在検出は可能。CSS 三角矢印・装飾線を
   黙って消さないために必須。FR-7c）

### ネイティブ優先（検出条件より先に評価）

- 線形/放射グラデーション（stop ≤ 10、conic/repeating を除く）は
  ラスタライズせず、ADR-0015 の後処理で a:gradFill へ写像する。
- 純平行移動の transform は座標合成で救う（過剰な画像化を避ける）。

### 前景保護（FR-7a）

- 編集性優先クラス（本文テキスト・契約図形）を子孫に含む要素は、
  サブツリー丸ごと画像化を禁止する。装飾のみを再現するため、
  子孫を一時 `visibility: hidden` にして領域スクリーンショットを撮り、
  背景画像として敷いた上に子孫を通常経路で出力する。
- サブツリー丸ごと画像化が許されるのは、編集性優先クラスの子孫を
  含まない場合のみ（例: 純装飾の SVG アート、Mermaid 図）。

### 可視化

- 変換ログに `rasterized: <セレクタ相当> reason=<番号と名称>` を必ず出力し、
  終了時に統計（ネイティブ図形数 / 画像数 / ラスタライズ数 / 未処理数）を出す。
  未処理数は 0 でなければならない（FR-8）。
- スクリーンショットは Puppeteer の clip 付き screenshot で該当領域のみ、
  デバイスピクセル比 2 で撮る。

### Consequences

- Good, because 「黙って消える」「黙って崩れる」が仕様上存在しなくなり、
  QA でラスタライズ済み領域を重点確認できる。
- Good, because 前景保護により、装飾コンテナ内のテキストが画像に
  焼き込まれず E-1〜E-3 が保たれる。
- Bad, because 子孫隠し撮影は「隠す → 撮る → 戻す」の DOM 操作を要素ごとに
  行うため変換時間が伸びる（NFR-7 の性能予算で歯止めをかける）。
  また hidden にしても layout は保たれるが、装飾が子のサイズに依存する場合
  （box-shadow の広がり等）に微差が出る可能性は残る。
- Bad, because 疑似要素は存在検出のみで矩形が取れず、親要素の領域で
  撮るしかない。親が大きい場合は過大な画像領域になる。

## More Information

初版（2026-07-06、同番号）を全面改訂。改訂根拠:
requirements [2026-07-08](../requirements/2026-07-08-generic-pptx-walker.md)
FR-7a/7b/7c、扉絵グラデーション欠落の実機検証
（[research 2026-07-07](../research/2026-07-07-powerpoint-rendering-verification.md)）。
グラデーションのネイティブ写像は [ADR-0015](0015-ooxml-postprocess-layer.md) に依存する。

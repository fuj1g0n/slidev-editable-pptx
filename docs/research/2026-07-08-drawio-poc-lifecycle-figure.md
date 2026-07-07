# PoC 検証: drawio 版「GitHub と開発ライフサイクル」4 表示等価性（2026-07-08）

日付: 2026-07-08。不変の調査スナップショット。
対象 ADR: [ADR-0019](../adr/0019-drawio-second-contract-entrance.md)
（drawio を第二の契約入口とする, accepted）。
本稿は ADR-0019 Stage 1 相当の先行 PoC の実施記録である。
検証対象は tech-slide `slides/deck.md` スライド 6
（「GitHub と開発ライフサイクル」、Diag 中間語彙で約 190 要素の
最重量ページ）。

## 1. 実施内容

パイプライン全区間を実装し、同一図の 4 表示を比較した。

```
原本 Diag ページ
  → walker 実測 → mxGraph XML 抽出 (bin/diag-extract-drawio.mjs)
  → DrawioDiag.vue が viewer-static.min.js でライブ描画
  → walker の data-diag="drawio" 分岐が graph model/view を構造変換
  → 既存中間語彙 → 既存 PptxGenJS builder（無変更）→ editable pptx
```

### 実装物

| パーツ | 場所 | 概要 |
|---|---|---|
| 抽出器 | `bin/diag-extract-drawio.mjs` | 原本ページを walker で実測し、中間語彙 → mxGraph XML + テーマ色対応表 (.theme.json) を生成。エッジは解決済み waypoints を明示埋め込み、アイコンは data URI 埋め込み |
| 描画 | `components/DrawioDiag.vue` | vendored viewer-static.min.js (Apache-2.0, 3.9MB) で scale=1 固定描画。テーマ対応表により hex→現テーマ CSS 変数実値へ書き換え。`el.__drawioGraph` と `data-drawio-ready` を公開 |
| 変換器 | `lib/walker.mjs` (bin から抽出) | `[data-diag="drawio"]` 分岐: model 子順 (z 順) で走査し view state (絶対座標) から中間語彙へ写像。未対応セルは state.shape.node の SVG 単体化でセル単位ラスタライズ (z 位置維持)。`drawio-coverage` 要素で被覆数を報告 |
| PoC デッキ | tech-slide `slides/drawio-poc.md` | p1 = DrawioDiag 版、p2 = 原本 (`src: ./deck.md#6`) |

## 2. 検証マトリクス（結果）

図領域 (y≥95px, 1280x720 基準) の pixel 差分。合格基準は
[marp 二段テスト輸入調査](2026-07-08-marp-two-tier-test-import.md)
由来の 8% ゲート。

| 表示 | 手段 | 結果 |
|---|---|---|
| drawio 素描画 | viewer-static 単体 HTML (テーマ書き換えなし素 XML) | 描画成立、全 189 セル表示 (`out/poc/drawio-standalone.png`) |
| Slidev | drawio 版 vs 原本のブラウザ screenshot 比較 | **5.03%** 合格 |
| PDF | `slidev export --per-slide` p1 vs p2 | **4.50%** 合格 |
| pptx | editable pptx → PowerPoint COM (Windows) PNG export、p1 vs p2 | **4.64%** 合格 |

（数値は pixelmatch threshold=0.1。座標規約修正後の再計測値）

変換被覆: **189 セル変換 / 0 ラスタライズ / 0 スキップ**
（ラスタライズ fallback は経路として実装済みだが、この図では
全セルが構造変換された）。

## 3. 得られた知見

### 座標規約: CSS border-box と mxGraph geometry は異なる

- **CSS border-box**: 枠線は矩形の内側。1160x590 の要素は正確に
  1160x590 px に収まる。
- **mxGraph geometry**: stroke は輪郭線中心。セル [0,0,1160,590] は
  各辺 strokeWidth/2 はみ出し、描画境界は 1161x591 になる。
- viewer の container サイズは `mxGraph.sizeDidChange` が
  `ceil(max(0,bounds.x)+bounds.width+2*border)` を SVG の min-width に
  与える（bounds = `getGraphBounds`、`mxShape.augmentBoundingBox` が
  stroke 付き shape の bbox を strokeWidth/2 拡張）。規約差を放置すると
  +1px でスクロールバーが出る（overflow は GraphViewer が
  inline style で auto に後書きする）。
- 正しい写像は**抽出器側**で行う: 枠付き box は geometry を
  borderWidth/2 内側に取り（角丸半径も bw/2 減）、弧 (stroke 中心規約の
  viewBox) も widthPx/2 内側に取る。これで描画ピクセルが CSS と一致し、
  描画境界 = 宣言サイズ、min-width = 宣言幅で container にちょうど収まる。
  コンポーネントや CSS での場当たり対処（overflow 上書き等）は不要。

### viewer-static.min.js の性質

- `GraphViewer(container, xml, {nav:false, 'auto-fit':false, zoom:'1', ...})`
  の後に `graph.view.scaleAndTranslate(1,0,0)` で宣言サイズ 1:1 描画が
  成立する。
- `mxgraph.basic.arc` (startAngle/endAngle は 0..1 周分率) と
  `mxgraph.basic.polygon` (polyCoords 0..1 正規化 JSON) は JS 定義で
  バンドル内蔵 = オフライン安全。XML ステンシルはネットワーク遅延
  ロードのため使用しない。homePlate 等の flat-left chevron 形状は
  存在せず、basic.polygon で代替した。
- style 中の相対画像パスは app.diagrams.net 基準で解決される。
  オフライン成立には **data URI 埋め込みが必須**。drawio 慣行は
  `data:image/svg+xml,<base64>`（`;base64` マーカーなし・カンマ直結）で、
  pptx builder へ渡す際に標準形へ修正が要る。

### 変換器 (walker drawio 分岐)

- `graph.view` の state (絶対座標・`absolutePoints`・
  `state.text.boundingBox`) を使うことで、drawio のルーティングや
  ラベル配置をそのまま引き写せる。model の幾何を再解釈する必要がない。
- 座標系変換は container の getBoundingClientRect と offsetWidth の比
  (Slidev の transform scale 対応) のみで成立。

### 落とし穴（再発防止）

1. **walker の二重取得**: blocks ループ (`svg` セレクタ) が drawio の
   巨大インライン SVG を画像として拾い、構造変換と重複した。
   `closest('[data-diag="drawio"]')` の除外が bg-image スキャンと
   blocks ループの両方に必要。
2. **Slidev print/export プリロード**: p2 の print view が隠し状態の
   p1 をマウントし、そこで GraphViewer が失敗して readiness が
   立たなくなる。コンポーネントは try/catch + finally で
   `data-drawio-ready` を必ず立てること。
3. **PDF export**: 単一 print ページ方式では重量ページの非同期描画に
   間に合わず図が空白になる（deck.md 6 で既知の事象と同一）。
   `--wait` は無効、`--per-slide` が解。
4. **Vite dev server 直後の 500**: `--force` 直後は
   `/@slidev/slides/N/md` が dep 再最適化で一時 500 を返し、
   walker が空スライドを見る。リトライ検知は root の children 数では
   不十分（エラープレースホルダも children を持つ）。

## 4. 残差分（既知・許容）

- soft-wrap テキストの折返し位置差（抽出時のヒューリスティック
  `whiteSpace=wrap` による近似）
- chevron ノッチ形状の微差（basic.polygon 近似）
- 弧矢印 (diag-arc) の矢頭なし
- アイコンは dark テーマ描画時の色が data URI に焼き込まれる
  （テーマ切替時の再抽出が必要 = ADR-0019 の mxlibrary 生成で解消予定）

## 5. 結論

ADR-0019 の中核仮説
「**drawio XML をライブ描画したまま walker が構造から editable pptx へ
変換できる**」は、最重量の実ページで 100% 構造変換・全 4 表示
8% ゲート内という結果で成立した。Stage 1 本実装
（正式な DrawioDiag API、mxlibrary 生成、テーマプロファイル）へ
進む根拠が得られた。

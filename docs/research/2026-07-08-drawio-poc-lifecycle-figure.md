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
| PoC デッキ | tech-slide `slides/drawio-poc-dark.md` | p1 = DrawioDiag 版、p2 = 原本 (`src: ./deck.md#6`) |

## 2. 検証マトリクス（結果）

図領域 (y≥95px, 1280x720 基準) の pixel 差分。合格基準は
[marp 二段テスト輸入調査](2026-07-08-marp-two-tier-test-import.md)
由来の 8% ゲート。

| 表示 | 手段 | 結果 |
|---|---|---|
| drawio 素描画 | viewer-static 単体 HTML (テーマ書き換えなし素 XML) | 描画成立、全 189 セル表示 (`out/poc/drawio-standalone.png`) |
| Slidev | drawio 版 vs 原本のブラウザ screenshot 比較 | **3.39%** 合格 |
| PDF | `slidev export --per-slide` p1 vs p2 | **2.92%** 合格 |
| pptx | editable pptx → PowerPoint COM (Windows) PNG export、p1 vs p2 | **3.19%** 合格 |

（数値は pixelmatch threshold=0.1。crisp オフセット補正後の再計測値）

変換被覆: **189 セル変換 / 0 ラスタライズ / 0 スキップ**
（ラスタライズ fallback は経路として実装済みだが、この図では
全セルが構造変換された）。

## 3. 得られた知見

### 座標規約: CSS border-box / mxGraph geometry / crisp オフセット

- **CSS border-box**: 枠線は矩形の内側。1160x590 の要素は正確に
  1160x590 px に収まる。
- **mxGraph geometry**: stroke は輪郭線中心。セル [0,0,1160,590] は
  各辺 strokeWidth/2 はみ出し、描画境界は 1161x591 になる。
- **crisp オフセット** (`mxShape.getSvgScreenOffset`): mxGraph は
  `round(strokeWidth×scale)` が奇数の shape 全体を SVG の
  `translate(0.5,0.5)` で右下へずらす（奇数幅ストロークを画素格子に
  整列させる描画規約）。strokeColor=none でも style の strokeWidth
  既定値 1 で判定される。text (mxText) と image (mxImageShape) は 0。
- viewer の container サイズは `mxGraph.sizeDidChange` が
  `ceil(max(0,bounds.x)+bounds.width+2*border)` を SVG の min-width に
  与える（bounds = `getGraphBounds`、`mxShape.augmentBoundingBox` が
  stroke 付き shape の bbox を strokeWidth/2 拡張）。規約差を放置すると
  +1px でスクロールバーが出る（overflow は GraphViewer が
  inline style で auto に後書きする）。
- 正しい写像は**抽出器側**で行う: 塗り矩形（CSS 実測）から
  `geometry = painted + stroke/2 内側取り − crispOffset`（`fit()`）。
  エッジ点列も crispOffset を引く。これで描画ピクセルが CSS と一致し、
  塗り境界 = 宣言サイズで container にちょうど収まる。
  コンポーネントや CSS での場当たり対処（overflow 上書き等）は不要。
  walker の drawio 分岐は逆写像（`painted()` = geometry + offset ±
  stroke/2）で塗り位置を復元する。
- **教訓**: stroke/2 の内側取りだけでは不十分で、奇数幅では crisp
  オフセットと二重補正になり、境界ストロークが半画素外へ出て
  クリップされ半輝度（欠けて見える）になる。`lint-drawio-bounds` が
  この描き方（塗りがページ矩形を超えるセル）をエンジン実値
  （`shape.boundingBox` + `getSvgScreenOffset`）で検出する。
- なお drawio 本体では pageWidth/pageHeight は印刷ガイドであって
  クリップ境界ではない（ページ外への描画は合法で、エクスポートも
  塗り込みのコンテンツ境界基準）。「ページ外の塗り = 欠け」は
  DrawioDiag の埋め込み契約（ページ == 宣言サイズの container +
  overflow hidden）が持ち込む本プロジェクト独自の制約であり、
  linter はその契約違反を検査するもの。

### pptx (DrawingML) の枠線規約 — 将来の pptx → drawio 取り込みへの含意

ECMA-376 Part 1 の `<a:ln>`（shape outline）は `algn` 属性
（ST_PenAlignment）で枠線の位置を規定する。値は 2 つのみ:

| algn | 意味 | 対応する規約 |
|---|---|---|
| `ctr`（既定） | 輪郭線中心。線幅の半分ずつ内外にまたがる | mxGraph geometry と同一 |
| `in` | 全て内側 | CSS border-box と同一 |

- **既定 (`ctr`) の shape は stroke/2 の内側取りが不要**。DrawingML の
  矩形をそのまま mxGraph geometry へ写せる。`algn="in"` が明示された
  shape にのみ CSS と同じ w/2 補正を適用する。
- **crisp オフセット補正は出自に依らず必要**。mxGraph が描画時に行う
  ものだからである（`geometry = 輪郭線中心位置 − crispOffset`）。
  ただし pptx の座標は EMU（1pt = 12700 EMU）の連続値で、線幅も
  0.75pt = 1px 等の非整数が普通のため、CSS 抽出ほどピクセル整列が
  効く場面は少ない。
- **境界クリップの挙動も一致**: PowerPoint もスライドショー・画像
  エクスポート時はスライド矩形でクリップする（編集ビューでは見える）。
  端に置いた `ctr` 枠線が半分欠けるのは PowerPoint でも起きる。
  そのような pptx を取り込むと `lint-drawio-bounds` が検出するため、
  「原本の欠けを忠実に再現する」か「reject して直させる」かが
  取り込みポリシーの論点になる。
- 複合線（`cmpd`: 二重線等）や線端処理は別途対応が要るが、
  座標規約そのものは上記で閉じる。

### テーマ適応（ページ選択 + palette）

図はダークテーマで抽出されるが、Slidev 埋め込みはテーマ切替
（背景・テーマ色・白黒アイコン・plate 下敷き）へ追従する必要がある。
アイコンは light/dark の 2 系統しかないため、**両系統をページとして
build 時に焼き込み**、実行時は「ページ選択 + 色の palette 置換」だけで
適応する（実行時のアイコン差し替え・plate 除去は廃止）:

- .drawio はマルチページ mxfile: ページ「light」（light octicons、
  plate なし + ロゴ外形復元）を先頭、ページ「dark」（抽出テーマ、dark
  octicons + plate あり）を後ろに置く。data URI 焼き込みなのでオフライン・
  単体閲覧でも両系統が完全表示できる（VS Code 拡張のページタブで切替）。
- `<OUT>.theme.json` は `pages: [{name, iconSet, palette, unmapped}]`。
  DrawioDiag は mount 時に現テーマの `--diag-icon-set` に一致する
  iconSet のページを選び（無ければページ 0 + console.warn）、その
  ページの palette（正準 hex → CSS 変数名）を現テーマの実値へ文字列
  置換して `GraphViewer` に `page: idx` で渡す。
- palette 置換は XML 全文への文字列置換だが、非選択ページに同じ hex が
  あっても描画されないため無害。base64 data URI に `#` 付き hex は
  現れないため誤置換の危険もない。
- 同系統でテーマ色だけ異なるテーマ（security/copilot 等）は palette
  置換が吸収する。plate の色も palette（--tech-fg）経由で追従する。

歴史的経緯: 当初は theme.json に icons/plates のセル id を記録し
DrawioDiag が実行時に style の `image=`/fillColor を書き換えていたが、
**mxGraph は相対画像パスを imageBasePath (app.diagrams.net) 基準で
解決する**ため絶対 URL 化が必要になるなど複雑だった。アイコンが
2 系統しかない事実を使い、build 時焼き込み + ページ選択に単純化した。

検証: github-default-light の別デッキで原本と比較し pixelmatch 3.39%
（ダークと同値）。ダーク側も 3.39% を維持（非回帰）。

### 変種ページの焼き込み（生成方法）

`VARIANT_ENTRY`（+ `VARIANT_SLIDE` / `VARIANT_NAME`）指定でマルチページ
mxfile を生成する:

- 抽出テーマページ（名前は抽出時 iconSet）と変種ページを生成し、
  **light 系を先頭に並べ替えて**書き出す。先頭ページが埋め込み側の
  fallback になるため: 一般的なスライドでは、明るい背景に暗い図が
  紛れる方が、暗い背景に明るい図が紛れるより違和感が大きい。
- 変種は幾何を再抽出せず、変種デッキをヘッドレスで開いて
  テーマ値（CSS 変数・背景・iconSet・plate）だけを読み、palette 経由の
  colorMap・octicon 差し替え（変種セットの data URI 焼き込み）・plate
  除去（pad 分の外形復元込み）を build 時に適用する。
- lint-drawio-bounds は全ページを検査する。
- 注意: 変種の background は colorMap を通さない。抽出テーマの前景
  #ffffff と変種背景 #ffffff のように偶然同値だと誤写像されるため
  （実測値をそのまま使い、palette には記録する）。
- 制約: 変種ページを省いた図を iconSet 不一致のテーマで埋め込むと
  ページ 0（light 系）に fallback する（アイコンが系統違いのまま）。
  図の生成は常に VARIANT_ENTRY 付きで行うこと。

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

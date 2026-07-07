# 調査: Figma→PPTX 前例のサポート型と本プロジェクトの事前定義型への示唆（2026-07-08）

日付: 2026-07-08。不変の調査スナップショット。
調査手段: 各リポジトリ・公式ドキュメントの一次ソース実査（research agent 1 回）。
比較基準: [ADR-0004（パターン語彙）](../adr/0004-shape-pattern-vocabulary.md)、
[ADR-0008（契約語彙）](../adr/0008-contract-vocabulary.md)、
[ADR-0010（画像化基準）](../adr/0010-rasterize-criteria.md)。

## 1. 調査の目的

Figma→PPTX 変換の前例（プラグイン・OSS 変換器）が「どの型をネイティブ図形で
受け、どの型を画像化するか」を実装レベルで棚卸しし、本プロジェクトの
事前定義型（Diag\* 語彙 + `data-pptx` 契約語彙）に不足がないか検証する。
ADR-0004 は「参照 PPTX 資産に現れた図形」からの帰納であり、本調査は
「独立した変換器群の設計判断」という別の証拠系列を突き合わせる。

## 2. 調査対象

| ツール | 種別 | マッピングの一次ソース |
|---|---|---|
| trkbt10/aurochs | OSS。Figma バイナリ → DrawingML 直生成。最も網羅的 | `fig-to-pptx/src/converter/geometry.ts`, `shape.ts`, `text.ts`; `interop-drawing-ml/src/fig-to-dml/fill.ts`, `effects.ts`, `line.ts` |
| julianshen/stagecraft | OSS。プレゼンビルダー → pptxgenjs | `src/lib/shapes.js`（SHAPES レジストリ）, `src/lib/pptxExport.js` |
| 22130188/…SupportSystemFrontEnd | OSS。FabricJS エディタ → pptxgenjs。30+ 図形 | `src/hooks/usePptxExport.js` |
| Pitchdeck (Hypermatic) | 商用 Figma プラグインの最大手 | docs.hypermatic.com/pitchdeck/export/powerpoint |
| KatsuYuzu/marp-to-editable-pptx | 隣接前例。HTML 実測 → pptxgenjs | `src/native-pptx/README.md` |
| BramAlkema/svg2ooxml | 隣接前例。SVG → DrawingML 直生成 | README.md（機能マトリクス） |

## 3. 前例のサポート型（合議マトリクス）

### 3-1. 複数ツールがネイティブ図形で受ける型（Tier 1 相当）

| 型 | prstGeom | 対応ツール数 | 本プロジェクトの受け皿 |
|---|---|---|---|
| 矩形 | rect | 5 | DiagBox（shape-rect）✅ |
| 角丸矩形 | roundRect + adj | 3 | DiagBox（rectRadius）✅ |
| **楕円・正円** | **ellipse** | **3** | **△ 正円 roundRect で代用（DiagBadge）。楕円プリセットなし** |
| 直線 | line | 3 | DiagEdge ✅（前例より強い: 矢じり・破線・折れ線） |
| 三角形 | triangle | 3 | DiagPolygon（custGeom）〇 |
| ひし形 | diamond | 3 | DiagPolygon（custGeom）〇 |
| 五角形 / 六角形 | pentagon / hexagon | 3 | DiagPolygon（custGeom）〇 |
| 星形 | star4..star32 + adj | 2（aurochs は全プリセット） | DiagBadge → polygon（custGeom）〇 |
| 右向きブロック矢印 | rightArrow | 2 | DiagBlockArrow（polygon）〇 |
| テキストボックス（run 単位書式） | sp + txBody | 4 | text 契約 ✅ |
| 画像 | pic + blipFill | 全部 | image ✅ |
| 単色塗り | solidFill | 全部 | fill トークン ✅ |
| 線形/放射グラデーション | gradFill | 2（aurochs, svg2ooxml） | ❌ 意図的に非対応（ADR-0004 R-6） |
| 外側/内側シャドウ | outerShdw / innerShdw | 3 | ❌ 意図的に非対応（同上） |
| グループ | grpSp + childExtent | 1（aurochs） | ❌ フラット出力（ADR-0004 R-10） |

### 3-2. 1〜2 ツールが受ける型（Tier 2 相当）

chevron・parallelogram・trapezoid・rtTriangle・octagon、
flowChart 系（terminator / decision / preparation / inputOutput / document）、
can（シリンダー）、wedgeRect/wedgeRoundRectCallout、bentArrow、arc。
→ 本プロジェクトは DiagChevron / DiagCylinder / DiagCallout / DiagBlockArrow /
DiagCycle / DiagPolygon で全系統に受け皿があり、**不足なし**。

### 3-3. 全前例が画像化・破棄する型（Tier 3 相当）

| 型 | 前例の扱い | 本プロジェクトの扱い |
|---|---|---|
| 自由ベクター（VECTOR / path） | aurochs は rect フォールバック、usePptxExport は canvas 画像化 | rasterize / drawio 例外 ✅ 一致 |
| BOOLEAN_OPERATION | 分解せず bbox 化 | 該当なし（SVG サブセット外は画像。ADR-0009）✅ |
| CONNECTOR（自動経路） | aurochs は完全スキップ | DiagEdge が経路点列を宣言で受ける。**前例より優位** |
| background blur / mix-blend-mode | 破棄 or 画像化 | 対象外 ✅ |
| CSS clip-path / transform | marp は無視 | R-7（回転不使用）で同型 ✅ |
| foreignObject 入り SVG | 画像化 | 画像化 ✅ |
| 角ごとに異なる corner radius | aurochs は平均値で近似 | converter は borderTopLeftRadius のみ読む（同水準） |

## 4. 本プロジェクトへの示唆（考察）

### 4-1. 採用すべき: 楕円（ellipse）プリセット

前例との差分で唯一の Tier 1 欠落。3 ツール全てが `ellipse` を出すのに対し、
本プロジェクトは正円を「roundRect の adj 最大」で代用しており
（DiagBadge circle/ring/ban）、次の劣化がある。

- 縦横比 1:1 でない楕円を表現できない（roundRect ではスタジアム形になる）。
- PowerPoint 上で受け手が図形種別「楕円」として編集できず、
  角丸ハンドルが露出する（意味論の劣化）。
- ellipse は adjust 値を持たないプリセットなので、「adjust 値で実測形状を
  完全再現できる場合のみ preset を使う」という既存基準（ADR-0004 §3）を
  無条件に満たす。preset 形状ズレの前例（bentConnector2 / chevron）の
  リスク自体が存在しない。

提案: 契約語彙に `shape-ellipse` を追加し、`border-radius: 50%` かつ
実測 bbox が楕円に一致する要素（DiagBadge の circle/ring/ban、
DiagCycle の中心円など）を ellipse プリセットへ写す。
新規コンポーネントは不要（既存 Diag\* の出力先変更のみ）。

### 4-2. 採用を検討してよい（優先度低）: 星形プリセット star{N}

aurochs は STAR を `star4..star32` プリセット + `adj = 内径比 × 50000` で
写す。星は「adjust 1 個で完全再現できる」プリセット群であり既存基準に適合する。
ただし参照資産での頻度は star4/7 で計 13 件（ADR-0004 §2-2 長尾）に過ぎず、
現行の polygon（custGeom）でも視覚上は等価。編集可能性（内径ハンドル）が
必要になった時点で導入すれば足りる。

### 4-3. 採用しない（現行方針を維持）

- **正多角形プリセット**（triangle / diamond / pentagon / hexagon / octagon）:
  前例 3 ツールはプリセットで写すが、本プロジェクトは custGeom（DiagPolygon）で
  受けている。プリセットは PowerPoint 実機とライブラリ定義の形状ズレの前例が
  あり（bin 冒頭の注記）、頂点宣言 + custGeom の方が実測 HTML との一致を
  保証できる。前例の選択はソースが Figma の「N 角形ノード」という抽象度の
  高い入力だから成立するもので、実測 px を正とする本プロジェクトには
  逆に不利。
- **gradFill / outerShdw**: aurochs・svg2ooxml は角度・距離の変換式まで
  持つが（`dir = atan2(oy,ox)`, `dist = √(ox²+oy²)`, 1/60000° 単位）、
  本プロジェクトはフラットデザイン規範（ADR-0004 R-6）で装飾を落とす方針。
  PptxGenJS も gradFill を生成できず（2026-07-08 ランドスケープ調査 §2）、
  導入するなら ADR-0015 の OOXML 後処理層になる。テーマ要求が生じるまで見送る。
- **grpSp（グループ）**: aurochs は FRAME/GROUP を grpSp + childExtent の
  暗黙スケーリングで写すが、本プロジェクトは R-10 で意図的にフラット。
  受け手の「まとめて動かせる」編集性は上がるが、PptxGenJS 非対応で
  後処理必須、かつ z-order/座標検証の複雑度が上がる。現状維持。
- **flowChart 系プリセット・callout プリセット**: usePptxExport 自身が
  `RASTERIZED_SHAPE_TYPES` で callout / cylinder / document 等を pptxgenjs
  対応済みにもかかわらず画像化へ倒している事実は、これらのプリセットの
  忠実度が信頼されていない傍証。polygon / 合成で受ける現行方針が正しい。

### 4-4. 前例が本設計を裏付ける点（変更不要の確認）

- **画像化エスケープハッチ**: Pitchdeck の `[PNG]` レイヤー命名規約は
  本プロジェクトの `data-pptx="rasterize"` と同型。商用最大手も
  「宣言による強制画像化」を必要とした。
- **テキスト最優先**: Pitchdeck は「Use Editable Text」（テキストのみ
  ネイティブ、図形は画像）を既定の売りにしており、editable の価値の大半が
  テキストにあるという本プロジェクトの優先順位（ADR-0012）と一致。
- **実測主義**: marp-to-editable-pptx も getComputedStyle +
  getBoundingClientRect を唯一の真実とする。CSS 解釈をしない方針は
  独立に収斂している。
- **コネクタ**: aurochs は CONNECTOR をスキップ、他ツールも矢じり・破線付きの
  折れ線コネクタを持たない。DiagEdge（経路点列 + 矢じり + 破線宣言）は
  前例群より踏み込んだ領域であり、簡略化の必要はない。

## 5. 結論

前例合議との差分で採用価値があるのは **ellipse プリセット（`shape-ellipse`
契約語彙）の 1 点のみ**。star{N} は必要時に検討、それ以外の差分
（多角形プリセット・gradFill・シャドウ・grpSp）は本プロジェクトの
実測主義・フラットデザイン規範の下では採用しない判断が前例からも支持される。
ellipse 導入時は ADR-0004 §3 の表（P8 バッジの受け皿）と ADR-0008 の
語彙リストへの追記を要する。

---
status: accepted
date: 2026-07-06
decision-makers: ["@fuj1g0n", "Coding Agent"]
---

# 参照 PPTX 資産の図形インベントリと再現用パターン語彙

## Context and Problem Statement

最終目的は `references/` 直下および `references/作業場/` の PPTX 資産を
Slidev で再現することである。本リポジトリの図は宣言契約型
（Diag\* コンポーネント + `data-pptx` 属性、ADR-0008）で
editable PPTX に変換されるため、参照資産に現れる図形を過不足なく表現できる
自前語彙（コンポーネント群）を予め設計する必要がある。

注記: 本 ADR の `references/`、`references/作業場/`、DESIGN.md への言及は、
元リポジトリ（利用側）である tech-slide における調査・規範を指す。
本リポジトリは、その調査結果から Diag\* 語彙と変換器契約を移設して維持する。

### 調査方法

`references/` 配下の全 `.pptx`（38 本）を zip として展開し、
各 `ppt/slides/slideN.xml` を XML 走査して
`prstGeom` プリセット名・`custGeom`・コネクタ・SmartArt レイアウト・
矢じり・破線・回転・グラデーション等を集計した
（Python 標準ライブラリのみの使い捨てスクリプト。取得日 2026-07-06）。

- 解析成功: 31 本 / 1,216 スライド。
- 解析不能: 7 本（`作業場/` 内。秘密度ラベルによる暗号化 CDFV2 形式で
  zip 展開不可）。これらは PowerPoint 実機で開いて目視棚卸しするまで
  カバレッジ保証の対象外とする（§5 R-9）。

### 2. インベントリ結果（31 本 / 1,216 スライド）

#### 2-1. 全体統計

| 項目 | 件数 | 備考 |
|---|---:|---|
| 図形 `sp` | 12,921 | |
| コネクタ `cxnSp` | 1,304 | |
| 画像 `pic` | 3,268 | アイコン・スクリーンショット |
| グループ `grpSp` | 1,714 | |
| フリーフォーム `custGeom` | 2,101 | 大半が Google Slides 由来の装飾（テキストなし） |
| SmartArt | 54 | cycle1×20, process1×16, hChevron3×14, hList×4 |
| 表 | 24 | |
| グラフ | 14 | |
| 回転あり | 838 | |
| 反転あり | 700 | |
| グラデーション塗り | 1,923 | |
| 外側シャドウ | 1,179 | |

#### 2-2. プリセット図形の頻度（全 31 本）

| prstGeom | 件数 | | prstGeom | 件数 |
|---|---:|---|---|---:|
| rect | 9,025 | | snip1Rect | 45 |
| roundRect | 1,884 | | arc | 43 |
| ellipse | 641 | | leftRightArrow | 35 |
| straightConnector1 | 526 | | noSmoking | 33 |
| line | 362 | | flowChartMagneticDisk | 31 |
| wedgeRoundRectCallout | 252 | | rightBrace / leftBrace | 42 |
| chevron | 222 | | triangle | 21 |
| bentConnector3 | 180 | | downArrow | 19 |
| curvedConnector2/3/4 | 164 | | circularArrow | 18 |
| bentConnector2/4 | 80 | | accentBorderCallout1 | 18 |
| halfFrame | 66 | | borderCallout1 | 17 |
| rightArrow | 53 | | up/upDown/left/bentArrow ほか | 26 |
| homePlate | 52 | | donut / diamond / plus ほか | 20 |
| foldedCorner | 50 | | star4/7, parallelogram, uturnArrow ほか | 13 |

矢じりは triangle 584 / arrow 261 / oval 9 / diamond 8 / stealth 4。
破線は dash 82 / lgDash 71 / sysDash 46 / sysDot 42 / dot 26。

#### 2-3. 移植対象（直下 9 本）に限った特徴

直下 9 本（2,491 rect / 417 roundRect / 105 chevron / 93 ellipse /
74 straightConnector1 / 46 halfFrame / 45 wedge 系吹き出し / 12 bentConnector3）は
`作業場/` より図形種が絞られており、既存 Diag\* 語彙（box / edge / chevron /
cycle / text / icon-label）でおよそ 9 割の個体をすでに受けられる。
不足は吹き出し・ブロック矢印・バッジ・ブレース・シリンダーの 5 系統である。

## Decision Drivers

制約は次の 2 点である。

1. **図形の無視は許されない**。参照デッキに現れる図形はすべて何らかの語彙で受ける。
2. **意味論的に同一なパターン化は許す**が、その省略・単純化は全て本 ADR の
   §5 に記録する。

## Considered Options

* パターン語彙カタログ

## Decision Outcome

Chosen option: "パターン語彙カタログ", because 参照資産に現れる図形を過不足なく表現できる自前語彙（コンポーネント群）を予め設計する必要がある。

### 3. 決定: パターン語彙カタログ

出現図形を以下の 12 パターンに正規化する。Tier は導入優先度
（1 = 既存語彙で受ける、2 = 新規コンポーネント必須、3 = 汎用受け皿）。

| # | パターン | Tier | 受け皿 | 吸収する prstGeom |
|---|---|---|---|---|
| P1 | 箱（カード・ゾーン枠） | 1 | DiagBox | rect, roundRect, snip1Rect, foldedCorner, round2SameRect, frame |
| P2 | エッジ（線・矢印・コネクタ） | 1 | DiagEdge | line, straight/bent/curvedConnector 全種 + 矢じり + 破線 |
| P3 | プロセス山形 | 1 | DiagChevron | chevron, homePlate（ノッチなし chevron として `notch=false`） |
| P4 | 循環・弧 | 1 | DiagCycle | arc, circularArrow, donut(循環文脈), SmartArt cycle1 |
| P5 | テキスト・アイコンラベル | 1 | DiagText / DiagIcon | （textBox, pic のうちアイコン） |
| P6 | 吹き出し | 2 | DiagCallout（新規） | wedgeRoundRectCallout, wedgeRectCallout, borderCallout1, accentBorderCallout1, accentCallout2 |
| P7 | ブロック矢印 | 2 | DiagBlockArrow（新規、direction prop） | right/left/up/down/leftRight/upDownArrow, bentArrow, curvedDownArrow, uturnArrow |
| P8 | バッジ・マーカー | 2 | DiagBadge（新規） | ellipse（番号・ステップ丸）, donut(リング), noSmoking(禁止), plus, mathMultiply, star4/7 |
| P9 | ブレース注釈 | 2 | DiagBrace（新規） | left/rightBrace, left/rightBracket |
| P10 | シリンダー（DB/ストレージ） | 2 | DiagCylinder（新規） | flowChartMagneticDisk, flowChartMultidocument(文書束) |
| P11 | 汎用多角形 | 3 | DiagPolygon（`data-pptx="polygon"` 直付け） | triangle, diamond, parallelogram, irregularSeal1, flowChartOffpageConnector ほか長尾全部 |
| P12 | コーナー装飾枠 | 3 | テーマ装飾（レイアウト CSS） | halfFrame |

構造要素の受け皿:

- **SmartArt（54 件）**: 図形としては再現せず、レイアウト別に再作図する。
  cycle1 → DiagCycle、process1 / hChevron3 → DiagChevron 行、
  hList1/3 → DiagBox グリッド。
- **表（24 件）**: Markdown 表。**グラフ（14 件）**: 検証済み数値と出典記録からの再作図を原則とし、不可なら画像。
- **フリーフォーム custGeom（2,101 件）**: 実査の結果、テキストを持たない
  Google Slides 由来の装飾が大半。意味を持つものだけ P11 で受け、
  純装飾はテーマ装飾または省略（§5 R-6）。

PPTX 出力側は、P6〜P10 も ADR-0008 の契約語彙
（shape-rect / edge / polygon / arc-group）へ正規化して出力する。
preset 図形の直接使用は「adjust 値で実測形状を完全再現できる場合のみ」の
既存基準（DESIGN.md）を維持し、それ以外は custGeom とする。

### 4. 導入順序

1. Tier 2 のうち移植対象 9 本に現れる **DiagCallout / DiagBlockArrow /
   DiagBadge** を先行実装（直下 9 本の未カバー個体の約 8 割を占める）。
2. DiagBrace / DiagCylinder / DiagPolygon は `作業場/` デッキの移植着手時。
3. P12 と custGeom 装飾はテーマ整備の一部として扱い、図形語彙からは外す。

### 5. 意味論的パターン化・省略の記録

参照資産と再現結果が意図的に異なる箇所の全記録。移植時に個別デッキで
これ以外の省略を行った場合は、本節に追記すること。

| ID | 元の表現 | パターン化後 | 根拠 |
|---|---|---|---|
| R-1 | snip1Rect / foldedCorner / round2SameRect / frame | すべて DiagBox の variant（角丸・切り欠きは装飾差でカード意味論は同一） | 頻度低（計 106）。専用形状の維持コストに見合わない |
| R-2 | curvedConnector 2/3/4（曲線コネクタ） | 角丸折れ線エッジ（既存 R=6px quadBezTo）に統一 | 経路の意味（始点→終点・折れ位置）は保存。曲率は装飾 |
| R-3 | homePlate | DiagChevron の notch なし形 | 「工程の一段」という意味論が同一 |
| R-4 | borderCallout / accentCallout 系（引き出し線吹き出し） | DiagCallout（角丸矩形 + 三角尾）に統一 | 「この対象への注釈」という意味論が同一。引き出し線形状は装飾 |
| R-5 | bentArrow / curvedDownArrow / uturnArrow | DiagBlockArrow の直線形 + 必要なら DiagEdge の折れ線矢印 | 計 8 件。方向の意味だけ保存 |
| R-6 | テキストなし装飾フリーフォーム（custGeom の大半）・グラデーション塗り・外側シャドウ | フラット塗りのテーマ装飾へ置換、または省略 | DESIGN.md のフラットデザイン規範。情報を持たない装飾 |
| R-7 | 図形の回転・反転（rot / flipH / flipV） | 原則使わず、direction prop と対称形状で表現 | converter が transform 非対応。回転個体の大半は装飾矢印 |
| R-8 | SmartArt / グラフ | Diag\* 再作図（レイアウト対応は §3）・検証値からの再作図 | ネイティブ SmartArt/Chart XML の生成はスコープ外 |
| R-9 | 暗号化 7 本（作業場内、秘密度ラベル付き） | 本調査のカバレッジ対象外 | zip 展開不可。移植時に実機で棚卸しし、本表へ追記 |
| R-10 | グループ `grpSp` の入れ子構造 | Vue コンポーネント合成で表現し、PPTX 出力はフラット（z-order は DOM 順） | 既存 converter の設計。グループ編集性より座標忠実性を優先 |
| R-11 | 矢じり oval / diamond / stealth（計 21 件） | triangle / arrow の 2 種に統一 | 頻度が僅少で、方向指示の意味論は同一 |

### Consequences

* Good, because 新規実装は 5 コンポーネント（DiagCallout / DiagBlockArrow / DiagBadge /
  DiagBrace / DiagCylinder）+ 汎用 DiagPolygon に絞られ、
  これで参照資産の図形個体の 99% 超（暗号化分を除く）が語彙上カバーされる。
* Good, because 長尾図形の新種が現れても P11（polygon）が受け皿になるため、
  語彙の無限増殖を防げる。
* Good, because 省略は §5 に集約されるため、「元デッキと違う」という指摘に対して
  意図的な単純化か欠陥かを常に判別できる。
* Good, because 新コンポーネントは既存の lint（lint-diagrams.mjs の幾何規則、
  diagram-bounds.mjs の boundary 契約）に従う。

## More Information

本 ADR は tech-slide `docs/adr/0002-shape-pattern-vocabulary.md`（旧採番）からの移設・再構成である。

- Status qualifier: 調査完了・実装は段階導入
- Related documents: [ADR-0001](0001-slide-architecture.md)、
  [ADR-0008（契約語彙）](0008-contract-vocabulary.md)、
  [docs/research/2026-07-07-pptx-approaches.md](../research/2026-07-07-pptx-approaches.md)

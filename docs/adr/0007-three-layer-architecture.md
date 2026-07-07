---
status: accepted
date: 2026-07-08
---

# 3 層フォールバック構成（宣言契約 > CSS 推論 > ラスタライズ）

## Context and Problem Statement

editable PPTX 変換には 2 つの実証済みアプローチがある。

- 宣言契約型（本リポジトリ `data-diag`）: 忠実性は完全だが専用コンポーネントが前提。
- CSS 推論型（marp-to-editable-pptx）: 汎用だが、矢印・エッジなど
  「見た目から復元できない意味」に原理的に届かず、例外ヒューリスティックが際限なく増える。

## Considered Options

- 宣言契約型（本リポジトリ `data-diag`）
- CSS 推論型（marp-to-editable-pptx）
- 3 層フォールバック構成（宣言契約 > CSS 推論 > ラスタライズ）

## Decision Outcome

Chosen option: "3 層フォールバック構成", because 要素ごとに次の優先順で解釈する。上位が該当したら下位は評価しない。

1. **Layer 1 宣言契約**: `data-pptx-*`（既存 `data-diag` を包含）を持つ要素。
   宣言された意味情報 + 実測座標で正確なネイティブ図形を出力。
2. **Layer 2 CSS 推論**: 可視の box 装飾（bg/border/radius/shadow）→ 図形、
   テキスト → runs、機械変換可能な SVG → ネイティブ図形、その他 SVG/img → 画像。
3. **Layer 3 ラスタライズ**: 再現不能条件を検出した要素は領域スクリーンショットで
   画像化し、理由をログに出す。「黙って消える」を禁止する。

### Consequences

- Good, because 汎用 deck はゼロ設定で Layer 2/3 により変換でき、忠実性を上げたい箇所だけ
  Layer 1 の属性を足せる（プログレッシブエンハンスメント）。
- Good, because 推論層の失敗は必ず Layer 3 に落ちるため、出力に「欠落」が存在しなくなる。
  品質劣化は統計とログで可視化される（FR-8, FR-10）。
- Bad, because 判定順が仕様の中心になるため、層間の判定条件はコードではなく
  ディスパッチテーブル 1 箇所に集約する（design.md）。

## More Information

2026-07-08 の再調査で妥当性を再確認した:

- 純推論型の限界の追加実証: 直接競合 dom-to-pptx（DOM 実測 → PptxGenJS）も
  グラデーション・SVG・グループの 3 点で native 化に届かない
  （[research 2026-07-08](../research/2026-07-08-pptx-tool-landscape.md) §3.1, §4）。
- Layer 1（宣言契約）の裏付け: native 忠実性を達成している Figma → PPTX
  プラグイン群は、レンダリング結果の実測ではなく Plugin API の構造化
  ジオメトリを読む方式。Layer 1 は同じ「構造データを渡す」経路の HTML 版
  である（同 §3.5）。
- 要求側の根拠: [requirements 2026-07-08](../requirements/2026-07-08-generic-pptx-walker.md)
  §3（要素クラス別トレードオフ）が層構成の前提を規定する。

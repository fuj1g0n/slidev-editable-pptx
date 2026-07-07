---
status: accepted
date: 2026-07-08
decision-makers: ["@fuj1g0n", "Coding Agent"]
---

# 楕円は ellipse プリセットで出力し、前例由来の他の型拡張は見送る

## Context and Problem Statement

事前定義型（Diag\* 語彙 + `data-pptx` 契約語彙）は参照 PPTX 資産の
インベントリ（ADR-0004）から帰納的に設計した。独立した証拠系列として
Figma→PPTX 変換器群（aurochs / stagecraft / usePptxExport / Pitchdeck /
marp-to-editable-pptx / svg2ooxml）が「どの型をネイティブ図形で受けるか」を
一次ソースで棚卸しした（research 2026-07-08）ところ、複数ツールが
ネイティブ対応する型のうち本プロジェクトに受け皿がないのは
**楕円（ellipse プリセット）のみ**だった。現状は正円を roundRect の
adj 最大で代用しており（DiagBadge circle/ring/ban）、縦横比 1:1 でない
楕円を表現できず、受け手の PowerPoint では図形種別が「角丸四角形」として
編集される。前例が示す他の候補（正多角形プリセット・star{N}・gradFill・
シャドウ・grpSp）も含め、語彙拡張の採否を決める必要がある。

## Decision Drivers

* preset 図形は「adjust 値で実測形状を完全再現できる場合のみ」使う既存基準
  （ADR-0004 §3。bentConnector2 / chevron で形状ズレの前例）
* フラットデザイン規範（ADR-0004 R-6）とフラット出力（同 R-10）の維持
* 受け手の編集性: 図形種別の意味論が PowerPoint UI に正しく現れること

## Considered Options

* ellipse プリセットのみ採用し、他の前例型は見送る
* 前例 Tier 1 を全て採用する（正多角形プリセット・star{N}・gradFill・
  シャドウ・grpSp を含む）
* 何も採用しない（正円 roundRect 代用を継続）

## Decision Outcome

Chosen option: "ellipse プリセットのみ採用し、他の前例型は見送る",
because ellipse は adjust 値を持たないプリセットであり preset 使用基準を
無条件に満たす唯一の Tier 1 欠落である一方、他の候補は既存の設計原則が
明示的に排除しているか、前例自身が信頼していないため。

- 契約語彙（ADR-0008）に `shape-ellipse` を追加する。`border-radius: 50%`
  かつ実測 bbox と一致する要素（DiagBadge の circle / ring / ban、
  DiagCycle の中心円など）を prstGeom `ellipse` へ写す。
  新規コンポーネントは作らない（既存 Diag\* の出力先変更のみ）。
- ADR-0004 §3 の P8（バッジ・マーカー）の ellipse 個体は本 ADR 以降
  roundRect 代用ではなく ellipse プリセットで受ける。
- 見送りの内訳:
  - **正多角形プリセット**（triangle / diamond / pentagon / hexagon /
    octagon）: 前例は Figma の「N 角形ノード」という抽象入力だから
    プリセットで写せる。実測 px を正とする本プロジェクトでは頂点宣言 +
    custGeom（DiagPolygon）の方が一致を保証でき、preset 形状ズレの
    リスクを避けられる。
  - **star{N} プリセット**: adj = 内径比 × 50000 で基準は満たすが、
    参照資産での頻度が計 13 件で custGeom と視覚上等価。内径ハンドルの
    編集性が要求された時点で再検討する。
  - **gradFill / シャドウ**: フラットデザイン規範（R-6）で装飾を落とす
    方針に反する。導入する場合の経路は OOXML 後処理層（ADR-0015）に
    確保済みで、テーマ要求が生じるまで見送る。
  - **grpSp（グループ）**: フラット出力（R-10）を維持する。
  - **flowChart 系・callout プリセット**: 前例（usePptxExport）自身が
    pptxgenjs 対応済みにもかかわらず画像化へ倒しており、プリセットの
    忠実度が信頼されていない傍証。polygon / 合成で受ける現行方針を維持。

### Consequences

- Good, because 楕円が図形種別「楕円」として受け手に渡り、縦横比の異なる
  楕円も表現可能になる。adjust 値がないため形状ズレの検証項目も増えない。
- Good, because 前例合議との差分が「意図的な見送り」として記録され、
  再審の起点が明確になる。
- Bad, because 既存 deck の正円バッジは出力図形種別が roundRect から
  ellipse に変わるため、fixture 回帰（qa:pptx + PowerPoint 実機、
  ADR-0013）での再検証が必要。
- Bad, because 語彙が 1 種増え、walker の正規化テーブルと lint の
  検査対象が増える。

## More Information

前例調査の全マトリクスと出典:
[research 2026-07-08](../research/2026-07-08-figma-pptx-precedent-types.md)。
関連: [ADR-0004（パターン語彙）](0004-shape-pattern-vocabulary.md)、
[ADR-0008（契約語彙）](0008-contract-vocabulary.md)、
[ADR-0015（OOXML 後処理層）](0015-ooxml-postprocess-layer.md)。

- Status qualifier: 決定済み・実装（walker / DiagBadge 出力先変更）は未着手

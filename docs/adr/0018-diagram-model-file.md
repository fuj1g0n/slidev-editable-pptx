---
status: proposed
date: 2026-07-08
decision-makers: fuj1g0n
---

# 図の正準表現をスキーマ付きモデルファイルとする

## Context and Problem Statement

最頻ユースケースは密なアーキテクチャ図・ライフサイクル図の構成であり、
その作成フローは (1) 既存 pptx からの再構成、(2) Coding Agent との
対話構成（canvas 型の双方向 UX が望ましい）、(3) 手書き、の 3 系統である
（[要求 2026-07-08 図の作成フロー](../requirements/2026-07-08-diagram-authoring.md)）。

現行の図は Diag DSL（ADR-0005）を deck.md に直書きした Vue markup であり、
実質は宣言的データだが markdown 埋め込みテキストに閉じているため、
スキーマ検証・プログラム的読み書き・canvas エディタや pptx 抽出器との
モデル共有ができない。図の正準表現をどう管理するか。

## Decision Drivers

- 表示・agent 編集・canvas 編集・pptx 抽出・pptx 生成が同一モデルを
  共有できること（FR-D1）
- ファイルを唯一の真実とし、双方向 UX を「ファイルへの書き戻し」で
  成立させられること（FR-D2、Slidev HMR の活用）
- agent の生成物を機械検証できること（NFR-D1）
- 既存 deck の直書き markup を壊さないこと（NFR-D2）

## Considered Options

- 図 1 枚 = 1 スキーマ付きモデルファイル（YAML）+ `<Diag src>` 参照
- 現行の deck.md 内 Diag markup を維持し、canvas 側が markup を直接操作
- 既存エディタ形式（draw.io / Excalidraw / tldraw）を正準とし Diag へ変換

## Decision Outcome

Chosen option: 「図 1 枚 = 1 スキーマ付きモデルファイル + `<Diag src>` 参照」。

- 図は `figures/<name>.diag.yaml`（スキーマバージョン付き）で管理する。
  モデルの語彙は既存 Diag コンポーネントの props をそのまま写像する
  （elements 配列: type=box|edge|icon|text|chevron|…、id、座標、
  fill トークン、label、icon パス等）。
- `Diag.vue` に `src` prop を追加し、モデルファイルを読み込んで既存の
  Diag* コンポーネント群を描画する。描画経路・テーマ継承・data-diag
  契約（walker との接続）は現行と同一のため、pptx 化は無変更で機能する。
- canvas エディタ・Coding Agent・pptx 抽出器（UC-D1）はいずれも
  このモデルファイルを読み書きする。canvas 操作はファイルへの書き戻しで
  実現し、Slidev HMR が表示側の反映を担う。
- 直書き markup は従来どおり有効（漸進移行、NFR-D2）。
- Vue の自由表現が必要な箇所（インライン img 列等）は、まず語彙拡張で
  吸収を試み、残るものは明示の escape hatch として仕様化する。
  escape hatch 部分は canvas 編集・モデル直変換の対象外と明記する（FR-D5）。

### Consequences

- Good, because canvas/agent/抽出器/レンダラが 1 つのモデルを共有し、
  双方向 UX が「ファイル書き戻し + HMR」という単純な機構に落ちる。
- Good, because スキーマにより agent 生成物の機械検証（NFR-D1）と、
  pptx 抽出（FR-D3）の出力先が定まる。
- Good, because 図に限り「モデル → PptxGenJS 直変換」（FR-D4）という
  DOM 実測を経ない高忠実度経路の余地が開ける。Figma プラグインが
  native 忠実度を出せるのは構造化データ入力だからであり
  （landscape 2026-07-08）、同じ構図を HTML 経由なしで得られる。
- Bad, because モデルスキーマの設計・維持コストが増える。Diag props と
  スキーマの二重定義にならないよう、スキーマを単一ソースにして
  props 検証を導出する等の工夫が要る。
- Bad, because Vue の自由表現が制限される。これは canvas/抽出/直変換を
  可能にするための意図的な交換である。

### Confirmation

- fixture deck に `<Diag src>` 参照の図を 1 枚追加し、直書き版と同一の
  DOM・同一の pptx 出力になることを確認する。
- モデルファイルを agent が編集 → HMR 反映 → pptx 化の一巡を実演する。

## Pros and Cons of the Options

### 現行 markup 維持 + canvas が markup を直接操作

- Good, because 追加の表現形式が増えない。
- Bad, because canvas エディタが「markdown 中の Vue markup の
  パース・書き換え」という脆い操作を負う。位置特定・整形保持・
  検証のいずれも困難。
- Bad, because pptx 抽出（UC-D1）の出力先として markup 生成は
  検証不能に近い。

### 既存エディタ形式（draw.io / Excalidraw / tldraw）を正準化

- Good, because エディタ実装を無償で得られる。
- Bad, because テーマ変数（--tech-bg 等）の継承、Diag 語彙・fill
  トークンとの対応、pptx 語彙への写像のいずれも失われるか二重管理になる。
- Bad, because agent にとって冗長かつ意味論の薄い形式（描画プリミティブ
  の羅列）になり、「意味論を理解したうえで再構成」（UC-D1）に不向き。
- Neutral, because 正準を自前スキーマにしたうえで、これらエディタとの
  相互変換を周辺ツールとして置くことは妨げない。

## More Information

[要求 2026-07-08 図の作成フロー](../requirements/2026-07-08-diagram-authoring.md)、
[ADR-0005](0005-diag-component-api.md)（Diag 語彙）、
[ADR-0007](0007-three-layer-architecture.md)（Layer 1 宣言契約 —
本 ADR はその一般化: 契約を DOM 属性から独立データモデルへ昇格）、
[ADR-0008](0008-contract-vocabulary.md)、
[調査 2026-07-08 landscape](../research/2026-07-08-pptx-tool-landscape.md)
§Figma（構造化データ入力が native 忠実度の条件という知見）。

canvas エディタ自体の実装方式（Slidev アドオン内蔵か独立ツールか、
tldraw 等の部品流用か）は本 ADR の範囲外とし、モデルが確定してから
別 ADR で扱う。

---
status: accepted
date: 2026-07-08
decision-makers: fuj1g0n
---

# drawio を第 2 の契約入口とし、ライブ描画 + 構造変換で統合する

## Context and Problem Statement

図の作成フロー（[要求 2026-07-08](../requirements/2026-07-08-diagram-authoring.md)
UC-D1..D3）に対し、ADR-0018 は Diag 語彙のモデルファイルを正準表現と
定めた。一方で drawio は成熟した canvas エディタ（web / desktop /
VS Code 拡張のファイル書き戻し型 GUI）と巨大な利用者層を持ち、
「drawio で表現できる範囲を Slidev テーマ適用のうえ editable pptx に
落とす」変換器には市場空白が確認されている
（[調査 2026-07-08 drawio 契約](2026-07-08-drawio-as-model-contract.md の §7）。

drawio を本プロダクトの入口として扱うか。扱う場合、事前 SVG 化は
pptx 化の時点で構造を失うため、どう統合するか。

## Decision Drivers

- UC-D2（canvas 双方向 UX）を実装済みエディタの流用で早期に成立させたい
- 構造化データ入力は DOM 実測より忠実度の上限が高い
  （landscape 2026-07-08 §Figma、drawio XML は決定的シーングラフ）
- テーマ・フォント・アイコンの一貫性（Slidev テーマが単一ソース）
- 「全て」を初期条件にしない段階的被覆（FR-13 系の fail-soft +
  可視化と両立させる）
- ADR-0018（Diag モデル）と競合せず併存できること

## Considered Options

- drawio を第 2 の契約入口として採用（ライブ描画 + 構造変換）
- drawio 統合を行わない（Diag モデル一本、canvas は自前実装）
- 事前 SVG export 経路の維持・拡張（現行の例外経路）

## Decision Outcome

Chosen option: 「drawio を第 2 の契約入口として採用」。
設計は [調査 2026-07-08 Slidev 統合](2026-07-08-drawio-slidev-integration.md)
のとおり:

1. **表示**: `<DrawioDiag src w h>` コンポーネントが .drawio XML を
   ブラウザ内でライブ描画する（事前 SVG 化の廃止）。テーマ由来
   リテラル色は描画直前に hex↔トークン対応表で現テーマ実値へ置換し、
   フォントはページの webfont を継承する。レンダラは viewer.min.js
   （Apache-2.0、全 stencil 同梱）を第一候補とする。
2. **契約**: root に `data-diag="drawio"` とソース参照・解決済み
   対応表（トークン写像、スケール/オフセット）を公開する。walker は
   subtree を DOM 走査せず、mxGraph XML を構造→PptxGenJS 変換器へ
   迂回する（ADR-0007 Layer 1 の拡張）。gradFill・grpSp 等は
   後処理層（ADR-0015）で補完する。
3. **被覆**: 変換不能セルはセル単位でラスタライズし、モデル順の
   z 位置を保って native shape 列に interleave する。ラスタ化は
   walker の headless Chromium 上で兄弟隠し screenshot
   （ADR-0010 と同一手技）。セルごとの native/raster と理由を
   被覆レポートとして出力する。
4. **組み込み契約**: 宣言サイズ + 図面 bbox の lint（変倍なし原則）、
   テーマ準拠 lint（パレット・フォント・アイコン・ラベルサブセット）を
   XML 静的検査で CI 強制する。エディタプロファイル（colorSchemes /
   customFonts / mxlibrary）と lint は同一のテーマ定義から生成する。
5. **段階導入**: Stage 0 = 既存 `.drawio.svg` 二重形式の検知
   （埋め込み mxfile XML から構造変換、表示は現状のまま）→
   Stage 1 = DrawioDiag ライブ描画。

ADR-0018 との関係: 併存する 2 入口である。Diag モデル
（*.diag.yaml）は本リポジトリ流の意味論優先表現・agent 主導編集の
正準であり、drawio 入口は GUI 主導編集と外部資産（既存 drawio 図・
pptx からの再構成先）の受け口である。相互変換は将来の周辺ツールと
して妨げない。

### Consequences

- Good, because canvas 双方向 UX（UC-D2）が hediet 拡張等の
  既存エディタ + ファイル書き戻しで即成立する。
- Good, because 変換はブラウザ実測に依らない決定的なモデル→モデル
  変換になり、忠実度の上限が HTML 実測経路より高い。
- Good, because 部分ラスタライズ interleave により初日から全図が
  変換可能で、stencil→custGeom コンパイラの拡充が単調に
  editable 率へ写る。
- Good, because 表示（ライブ SVG）と変換（XML 構造）の一致は
  既存の実 PowerPoint QA ゲート（ADR-0013）で検証できる。
- Bad, because 表示レンダラが Diag と drawio の二系統になる。
  viewer.min.js のバンドルは重く、図のあるページのみの遅延ロードで
  緩和する。
- Bad, because stencil→custGeom コンパイラと html=1 ラベルの
  サブセット変換は実装規模が大きい。被覆レポート駆動で段階拡大する。
- Bad, because 連動編集の喪失（画像化セルはノード移動に追随しない）
  という劣化モードが生じる。被覆レポートで可視化する。

### Confirmation

- fixture に drawio 図（native 変換セルとラスタ落ちセルの混在）を
  追加し、(a) z 順が PowerPoint 上で保存されること、(b) テーマ切替で
  表示・pptx 双方の色が追随すること、(c) 被覆レポートが実態と
  一致することを QA ゲートで確認する。
- Stage 0（.drawio.svg 検知）を先行実装し、既存 deck の例外経路の
  図が editable 化されることを確認する。

## Pros and Cons of the Options

### drawio 統合を行わない（Diag 一本 + canvas 自前実装）

- Good, because レンダラ・変換器が単系統のまま保守が軽い。
- Bad, because canvas エディタの自前実装は本体より大きくなりうる
  未知の工数であり、UC-D2 の成立が遠のく。
- Bad, because 市場空白（drawio → editable pptx）を放棄する。

### 事前 SVG export 経路の維持・拡張

- Good, because 実装済み（figures:normalize）。
- Bad, because pptx 化の時点で構造が失われ editable 化が原理的に
  不可能。テーマ非追随・フォント埋め込み運用も残る。
  本 ADR の Stage 0/1 が段階的にこの経路を置き換える。

## More Information

[調査 2026-07-08 drawio 契約考察](2026-07-08-drawio-as-model-contract.md)
（棄却した「Diag 語彙の搬送形式」案と、本 ADR の母体である §7）、
[調査 2026-07-08 Slidev 統合設計](2026-07-08-drawio-slidev-integration.md)、
[ADR-0018](0018-diagram-model-file.md)（併存する第 1 の入口）、
[ADR-0007](0007-three-layer-architecture.md) /
[ADR-0010](0010-rasterize-criteria.md) /
[ADR-0015](0015-ooxml-postprocess-layer.md)。

tech-slide ADR-0001 D6（drawio 採用→廃止）との整合: D6 の廃止理由は
「editable 変換のための lint がサブセットを Diag 同型まで狭めた」こと
だった。本 ADR は変換器の被覆域を drawio の表現力側へ広げる
（狭めるのではなく fail-soft + レポートで受ける）ため、同じ構図には
戻らない。tech-slide 側の執筆方針（図は Diag 一本化、drawio は
例外経路）をどう改訂するかは tech-slide 側の決定として別途扱う。

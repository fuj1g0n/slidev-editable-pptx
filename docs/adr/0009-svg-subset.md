---
status: accepted
date: 2026-07-08
---

# SVG ベクトル変換のスコープを固定サブセットに限定

## Context and Problem Statement

一般 deck の矢印は Slidev 組み込み `<Arrow>`（SVG line + marker-end polygon）が
代表で、Mermaid も SVG を出す。SVG 全仕様の図形変換は工数が発散する
（グラデーション・パターン・テキストパス・フィルタ・use 参照など）。

## Considered Options

- SVG 全仕様の図形変換
- 固定サブセットに限定した Layer 2 の SVG 変換

## Decision Outcome

Chosen option: "固定サブセットに限定した Layer 2 の SVG 変換", because SVG 全仕様の図形変換は工数が発散する（グラデーション・パターン・テキストパス・フィルタ・use 参照など）。

Layer 2 の SVG 変換対象は次のサブセットに限定する。

- 要素: `line, polyline, polygon, rect, circle, ellipse`、
  および直線コマンドのみの `path`（M/L/H/V/Z。曲線 C/Q/A は対象外）。
- `marker-start/-end` は「矢じり付き線」として PptxGenJS の
  `beginArrowType`/`endArrowType` へ写像する
  （marker の中身は解釈しない。向きは線の端点方向から決まる）。
- 属性 `transform` と `viewBox` スケーリングは座標へ合成してから出力する。
- `<text>` はテキストボックスへ写像する（Mermaid の非 foreignObject ラベル対策）。
- 上記以外の要素（foreignObject, defs 内 gradient 参照, use, 曲線 path 等）を
  1 つでも含む SVG は **SVG ごと** Layer 3（ラスタライズまたは SVG 画像貼付）に落とす。
  部分変換はしない（半分ネイティブ・半分画像の混成は位置ズレ QA が不能になる）。

### Consequences

- Good, because Slidev `<Arrow>` は完全に編集可能な線 + 矢じりになる。
- Bad, because Mermaid は実質ほぼ画像に落ちる（foreignObject があるため）。これは許容する。
  白抜け防止のため foreignObject 検出時はラスタライズを必須とする（FR-7）。
- Neutral, because 曲線対応（C/Q → custGeom の cubic/quadratic）は将来拡張として明示的に残す。
  pptxgenjs 側の受け皿は既存 converter で実証済み。

## More Information

2026-07-08 再調査による根拠の明確化:

- サブセット制限は出力側の制約ではない。PptxGenJS v4.0.1 の custGeom は
  moveTo/lnTo/cubicBezTo/quadBezTo/arcTo/close を完備しており
  （[research 2026-07-08](../research/2026-07-08-pptx-tool-landscape.md) §2）、
  制限は変換実装コストの判断である。曲線拡張は backend 変更なしで可能。
- 矢じりの語彙: beginArrowType/endArrowType =
  none/arrow/diamond/oval/stealth/triangle の 6 種（OOXML ST_LineEndType と
  一致）。矢じりサイズ指定は PptxGenJS 未実装（FUTURE）のため既定サイズとなる。
- Slidev `<Arrow>` の DOM 構造（絶対配置 SVG + line + marker-end polygon +
  透明な当たり判定線）を一次ソースで確認。当たり判定線
  （stroke: transparent, width 20）は出力から除外する必要がある。

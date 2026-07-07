---
status: proposed
date: 2026-07-06
---

# 宣言契約は data-pptx-* を正とし data-diag をエイリアスとして維持

## Context and Problem Statement

既存契約 `data-diag="root|box|edge|chevron|cycle|text|icon-label|edge-label"` は
本リポジトリの Diag* コンポーネント固有の語彙で、OSS 公開仕様の名前として狭い。
一方、既存 deck の後方互換（FR-2）は必須。

## Considered Options

- 既存契約 `data-diag="root|box|edge|chevron|cycle|text|icon-label|edge-label"`
- `data-pptx`（種別）+ `data-pptx-<kind>`（JSON メタデータ）

## Decision Outcome

Chosen option: "data-pptx-* を正とし data-diag をエイリアスとして維持", because 既存 deck の後方互換（FR-2）は必須。

- 公開仕様の属性名は `data-pptx`（種別）+ `data-pptx-<kind>`（JSON メタデータ）とする。
  語彙: `shape-rect | edge | polygon | arc-group | text | ignore | raise | rasterize`。
- walker は読み取り時に `data-diag` 語彙を `data-pptx` 語彙へ正規化する
  変換テーブルを 1 箇所持つ（box→shape-rect, chevron→polygon, cycle→arc-group など）。
  Diag* コンポーネント側は当面変更しない。
- 契約の原則（README に明記する仕様）:
  - 座標・寸法は宣言しない。常に getBoundingClientRect で実測する。
  - 宣言するのは推論不能な意味情報のみ: 経路点列・矢じり有無/向き・破線パターン・
    多角形頂点・弧角度・z-order 前面指定・「画像化せよ」「無視せよ」の指示。

### Consequences

- Good, because 既存 deck は無変更で通る（正規化テーブルで吸収）。
- Good, because OSS 化時は正規化テーブルごと export すれば Slidev/Marp どちらのエコシステムでも
  同じ契約が使える。
- Bad, because 語彙が 2 系統ある期間はテーブルが単一の真実。テーブル外の data-diag 値は
  lint（既存 lint-diagrams.mjs）で検出する。

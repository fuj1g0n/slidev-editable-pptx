---
status: accepted
date: 2026-07-08
decision-makers: fuj1g0n
---

# 区分色 14 種（7 色相 × 2 強度）を --diag-* 契約に追加する

## Context and Problem Statement

--diag-\* 契約（ADR-0008 / docs/diag-css-vars.md）の塗りトークンは
zone-outer / zone-inner / node-external / emphasis の 4 種のみで、
「本文・準本文的な構成要素」の役割区分しか表せない。アーキテクチャ図の
ように複数の**区分**（レイヤー・所有者・環境など）を同一図内で塗り分ける
用途では色種が不足している。一方で、テーマのトーン統一（tech-slide
ADR-0005 のトーンカード規範）を壊す派手な色の持ち込みは避けたい。
区分の見分けがつく色数を、トーンを保ったままどう供給するか。

## Decision Drivers

- 同一図内で 4〜7 区分を安定して塗り分けられる色数が必要
- テーマ族（light / dark × バリアント）全体でトーンの統一感を保つ
- 消費側テーマが実色の単一ソースであるという既存契約（ADR-0008）を維持
- error（red 系）や注意喚起（yellow 系）など既存の意味色と衝突しない運用

## Considered Options

- 色相名トークン 7 色相 × 2 強度（soft / strong）を契約に追加する
- 番号トークン（--diag-cat-1..n）を追加する
- 契約は変えず、図ごとに theme.json で生 hex を宣言する

## Decision Outcome

Chosen option: 「色相名トークン 7 色相 × 2 強度を契約に追加する」。

- 変数名は `--diag-cat-<hue>`（soft 塗り）と `--diag-cat-<hue>-strong`
  （強め塗り）。hue は `blue / green / purple / orange / yellow / red /
  pink` の 7 種。gray 相当は既存の中立トークン
  （zone-outer / node-external）が担う。
- 実色は従来どおり消費側テーマが宣言する。参照実装（tech-slide の
  GitHub テーマ族）は GitHub Primer の機能色スケールから導出し、
  light は *-subtle / scale-1 相当のパステル帯、dark は既存 emphasis
  群と同輝度の暗色帯に揃えることで、色相を増やしてもトーンの
  統一性を保つ。
- 番号トークン案は「図の意味と色の対応」がテーマ側で読めなくなるため
  棄却。生 hex 宣言案は実色の単一ソース原則（ADR-0008）に反するため
  棄却。

### Consequences

- Good, because 7 色相 × 2 強度で最大 14 区分（実用上は 7 区分 × 強弱）
  を、テーマを跨いで一貫した名前で塗り分けられる。
- Good, because Primer スケール由来のため light / dark いずれでも
  既存トークンと輝度帯が揃い、拒否感のない配色を保てる。
- Bad, because 消費側テーマの必須定義変数が 14 個増える（未定義は
  透明フォールバックで図が欠ける）。
- Bad, because red / yellow は error・注意喚起の意味色と色相が重なる。
  区分色としての使用は、同一図内に意味色が現れない場合に限る運用が
  必要（本 ADR では機械的検査は導入しない）。

---
status: accepted
date: 2026-07-07
decision-makers: ["@fuj1g0n"]
---

# tech-slide からの editable PPTX 機構の抽出

## Context and Problem Statement

editable PPTX に変換可能な Slidev を構築する仕組み（Diag\* コンポーネント、
HTML 実測 → ネイティブ図形再構築の変換器、図ジオメトリ lint）は tech-slide
リポジトリに、AI slop 回避や GitHub テーマと同居していた。tech-slide の
[ADR-0011（観点別の 3 リポジトリ分割）](https://github.com/fuj1g0n-demo-01/tech-slide/blob/main/docs/adr/0011-repository-split.md)
により、この観点を独立リポジトリとして抽出する。何をどの形で持ち込むか。

## Decision Drivers

* 他の Slidev プロジェクトから図コンポーネントと変換器を再利用できること
* skill 本文とそれが参照する変換・lint コードを同一リポジトリで版管理すること
* 分割元の決定（tech-slide ADR-0001 D3/D8/D9、ADR-0002、ADR-0003）の実質を変えないこと

## Considered Options

* Slidev addon（components/）+ bin CLI 群 + APM skill の構成で抽出
* コンポーネントと変換器を別リポジトリに分ける

## Decision Outcome

Chosen option: "Slidev addon + bin CLI 群 + APM skill の構成で抽出", because
Diag\* コンポーネントと変換器は data-diag 契約で一体であり（ADR-0002 系）、
分けるとバージョン整合が取れないため。Slidev addon 形式により消費側は
headmatter の `addons:` 指定だけでコンポーネントが自動登録される。

持ち込んだ資産と変更点:

- `components/`: tech-slide `slides/components/` の Diag\*.vue 13 点 +
  fills.js / icons.js を無改変で移設。
- `bin/slidev-editable-pptx.mjs`: tech-slide `scripts/slidev-editable-pptx.mjs` を
  移設。埋め込みフォント定義を `EMBED_FONTS` 環境変数（JSON）で差し替え可能に
  一般化（既定値は従来どおり）。
- `bin/lint-diagrams.mjs` / `bin/fetch-icons.mjs` / `bin/diagram-icons.mjs`:
  パッケージ相対だった ROOT 解決を `process.cwd()`（消費側リポジトリ root）へ変更。
- `bin/pptx-qa.sh`: パッケージ root への `cd` を削除し cwd 基準で実行。
- `bin/lint-figures.mjs` / `bin/figure-normalize.mjs`: 無改変
  （元から cwd 相対パス）。
- `docs/generic-pptx-walker/`: 変換器の要求仕様と下位 ADR ログ（0001〜0005）を
  ログごと移設（tech-slide ADR-0011 D5 の例外条項）。
- `docs/diag-css-vars.md`: `--diag-*` CSS 変数契約を新規に明文化。名前と意味は
  本パッケージが規定し、値（実色）は消費側テーマが持つ（tech-slide ADR-0011 D4）。
- skill `slidev-editable-pptx`: tech-slide skill の §5（図のルール）、
  §9（PPTX 出口）、PPTX 視覚 QA ループ、出自宣言原則を再構成。

### Consequences

* Good, because 他の Slidev プロジェクトでも addon 指定だけで Diag\* と変換器を使える。
* Good, because 変換器・コンポーネント・skill が同一バージョンで配布される。
* Bad, because CSS 変数契約の変更が消費側テーマとの 2 リポジトリ変更になる。
* Bad, because 既定フォント（OctoBiz / UDEV Gothic）は消費側アセット前提であり、
  他プロジェクトは `EMBED_FONTS` の明示設定が要る。

### Confirmation

利用側リポジトリでの `npx lint-diagrams` / `npx slidev-editable-pptx` /
`npx pptx-qa` の exit code と、PPTX 視覚 QA ループ（skill §3）で確認する。

## More Information

分割全体の経緯・境界の裁定は tech-slide の
[ADR-0011](https://github.com/fuj1g0n-demo-01/tech-slide/blob/main/docs/adr/0011-repository-split.md)
を一次資料とする。設計の原典は tech-slide の
[ADR-0002（図形パターン語彙）](https://github.com/fuj1g0n-demo-01/tech-slide/blob/main/docs/adr/0002-shape-pattern-vocabulary.md)、
[ADR-0003（Diag API 設計）](https://github.com/fuj1g0n-demo-01/tech-slide/blob/main/docs/adr/0003-diag-component-design.md)。

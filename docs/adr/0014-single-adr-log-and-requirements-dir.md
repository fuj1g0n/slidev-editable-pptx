---
status: accepted
date: 2026-07-07
decision-makers: ["@fuj1g0n", "Coding Agent"]
---

# 決定ログを docs/adr に一本化し要求調査は docs/requirements に置く

## Context and Problem Statement

汎用 walker の検討時に `docs/generic-pptx-walker/` 配下へ独立した下位 ADR ログ
（0001〜0007）と requirements.md を作った結果、ADR ログが 2 系統になり
番号が主ログ（docs/adr 0000〜0006）と衝突した。参照時にどちらの
「ADR-0004」か曖昧になり、決定ログとして機能しない。また requirements.md は
日付と文脈が固定された調査文書（status: draft / as_of 付き）なのに、
research snapshot（ADR-0006 の three-tier）と別の置き方になっていた。

## Considered Options

- 下位ログを機能領域ごとに維持する（現状）
- 決定ログを docs/adr へ一本化し、要求調査は docs/requirements へ日付付きで置く

## Decision Outcome

Chosen option: "docs/adr へ一本化", because ADR の番号は参照の一意な鍵であり、
リポジトリ内に複数の番号空間があると相互参照が成立しないため。
先行事例 fuj1g0n/skills も単一の docs/adr + docs/research 構成である。

- ADR は `docs/adr/NNNN-*.md` の単一連番ログのみとする。下位ログは作らない。
  旧下位ログ 0001〜0007 は docs/adr 0007〜0013 へ改番して統合した。
- 要求調査は `docs/requirements/YYYY-MM-DD-topic.md` の日付付きスナップショット
  とする（research と同じ運用: 後から書き換えず、再調査は新しい日付のファイル）。
  `docs/generic-pptx-walker/requirements.md` は
  `docs/requirements/2026-07-06-generic-pptx-walker.md` へ移した。
- ADR-0000 の「`docs/generic-pptx-walker/adr/` を独立した下位ログとして維持する」
  の一項は本 ADR により廃止する。

### Consequences

- Good, because ADR 番号がリポジトリ内で一意になり、相互参照が曖昧さなく機能する。
- Good, because 調査系文書の置き場が research / requirements の 2 種の
  日付付きスナップショットに統一され、three-tier 規則（ADR-0006）と整合する。
- Bad, because 既存の相互参照とリンクの改番修正が必要だった（本 ADR と同時に実施）。
  外部（過去の commit メッセージや PR）からの旧パス参照は追えなくなる。

## More Information

統合時の改番対応: 旧 generic-pptx-walker/adr 0001→0007, 0002→0008, 0003→0009,
0004→0010, 0005→0011, 0006→0012, 0007→0013。

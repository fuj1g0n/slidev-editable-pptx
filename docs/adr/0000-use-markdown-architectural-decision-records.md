---
status: accepted
date: 2026-07-07
decision-makers: ["@fuj1g0n"]
---

# Markdown Architectural Decision Records (MADR) の採用

## Context and Problem Statement

本リポジトリはアーキテクチャ上重要な決定を記録する必要がある。分割元の
tech-slide は MADR 4.0 で決定ログを管理しており（tech-slide ADR-0000）、
分割後の 3 リポジトリで形式を揃えたい。

## Considered Options

* MADR 4.0（YAML frontmatter + 英語の定型見出し、本文は日本語）
* 独自形式

## Decision Outcome

Chosen option: "MADR 4.0", because 分割元 tech-slide と形式を統一し、
ツール（Backstage、Structurizr `!adrs madr` 等）互換を保つため。

- scaffolding（frontmatter キー、status 値、節見出し）は英語の正規表記、本文は日本語。
- 採用済み ADR は status 変更と supersede リンク以外編集しない。
- `docs/generic-pptx-walker/adr/` は変換器仕様の独立した下位ログとして維持する。

### Consequences

* Good, because 3 リポジトリ間で決定ログの形式が揃い、機械処理も可能になる。
* Bad, because 見出しが英語・本文が日本語の混在になる。

## More Information

テンプレート: [MADR 4.0](https://adr.github.io/madr/)。

「`docs/generic-pptx-walker/adr/` を独立した下位ログとして維持する」の一項は
[ADR-0014](0014-single-adr-log-and-requirements-dir.md) により廃止された
（docs/adr へ統合）。

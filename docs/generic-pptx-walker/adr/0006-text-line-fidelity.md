---
status: accepted
date: 2026-07-07
---

# テキストは実測行で分割し PowerPoint に再折返しさせない

## Context and Problem Statement

フォントを EOT 全字埋め込みで同一にしても（ADR-0003）、ブラウザと
PowerPoint はテキストレイアウトエンジンが異なり、字送りと折返し位置が
微妙にずれる。現行 walker はブロック要素を 1 つのテキストボックス
（実測 rect + wrap あり）として出すため、PowerPoint 側で再折返しが起き、
行数が変わると他要素に被る（実機検証: cover タイトルが 2 行に増えて
右 1/3 のタイル領域へ食い込んだ。docs/research/2026-07-07-powerpoint-rendering-verification.md §2-3）。

## Considered Options

- 現状維持（ブロック単位のテキストボックス + PowerPoint の自動折返し）
- 実測行分割: ブラウザの描画行ごとに改行を確定して出力し、再折返しを禁止する
- フォントサイズに安全係数を掛けて縮める（例: 97%）
- テキストをラスタライズする

## Decision Outcome

Chosen option: "実測行分割", because 差異の根源は「折返し位置の再計算」であり、
ブラウザが確定した行分割を明示改行（breakLine）として運び、テキストボックスを
`wrap: false` + autofit なしにすれば、フォントメトリクスの微差が残っても
行数と行内容は不変になり、他要素への食い込みが構造的に起きなくなる。
安全係数は根本対処にならず（縮めても境界事例は残る）、ラスタライズは
editable PPTX の目的そのものを壊す。

- walker は Range API で各テキストノードの client rects を行単位に分解し、
  行ごとの runs 列（改行位置確定済み）を中間 JSON に持たせる。
- builder は行を `breakLine: true` の run 境界として出力し、
  テキストボックスは `wrap: false`・autofit なしとする。
- 行の縦位置はブロック rect + 実測 lineHeight から決まる現行方式を維持する。

### Consequences

- Good, because 折返し差異による重なり・あふれが原理的に消える（行分割は
  ブラウザ描画と常に一致する）。
- Good, because 中間 JSON に行構造が入るため、行単位の回帰比較ができる。
- Bad, because PowerPoint 上でテキストを書き換えたとき自然な再折返しが
  起きない（改行が手動改行として焼き付く）。長文を編集する受け手には
  1 ボックス自動折返しより不便で、忠実性と編集体験のトレードオフになる。
- Bad, because walker のテキスト抽出が複雑化する（Range 分解は縦書き・
  ruby 等の端で例外を持ちやすい）。対象は現行テーマで使う横書きに限定する。

## More Information

実測の根拠: docs/research/2026-07-07-powerpoint-rendering-verification.md。
generic-pptx-walker requirements FR-4（テキスト runs 実測）を精緻化する
決定であり、既存 ADR とは矛盾しない。

---
status: proposed
date: 2026-07-08
---

# モジュール分割と Slidev アダプタの分離

## Context and Problem Statement

現行 bin/slidev-editable-pptx.mjs は約 900 行の単一ファイルに
「Slidev dev server 起動」「ブラウザ内 walker」「PptxGenJS 出力」
「フォント埋め込み後処理」が同居する。リポジトリ自体の OSS 分離は
完了済みだが、コア（walker + builder）はまだ Slidev 依存部と分離されて
おらず、3 層化（ADR-0007）・後処理拡張（ADR-0015）を単一ファイルへ
足し込むと保守性（NFR-3）が崩れる。

初版（2026-07-06）は tech-slide リポジトリ内の scripts/ 配下を前提として
いたため、分離後の現構成（bin/ が npm bin エントリ）に合わせて改訂する。

## Considered Options

- 現行 bin/slidev-editable-pptx.mjs の単一ファイル構成のまま拡張する
- lib/ へのモジュール分割と Slidev アダプタの分離

## Decision Outcome

Chosen option: "lib/ へのモジュール分割と Slidev アダプタの分離", because
層・後処理の追加が互いに波及しない構造（NFR-3）と、アダプタ差し替えによる
将来の Marp 対応（NFR-4）には境界の明示が要るため。

```
bin/slidev-editable-pptx.mjs   # CLI エントリ（薄い引数処理のみ、npm bin 維持）
lib/
  walker/            # ブラウザ内で実行されるコード（文字列化して page.evaluate）
    index.mjs        #   3 層ディスパッチ（ADR-0007 の判定順）
    contract.mjs     #   Layer 1: data-pptx / data-diag 正規化と解釈
    infer-box.mjs    #   Layer 2: CSS ボックス推論
    infer-text.mjs   #   Layer 2: テキスト runs 抽出（実測行分割は ADR-0012）
    infer-svg.mjs    #   Layer 2: SVG サブセット変換（ADR-0009）
    rasterize.mjs    #   Layer 3: 判定 rasterizeReason（ADR-0010）
  builder.mjs        # 中間 JSON → PptxGenJS 呼び出し（Node 側）
  postprocess.mjs    # OOXML 後処理: gradFill / grpSp / フォント EOT（ADR-0015）
  adapter-slidev.mjs # dev server 起動・print ビュー巡回・領域スクリーンショット
```

- walker は DOM API のみ使用し、Node への依存を持たない
  （esbuild 等は使わず、単純な文字列連結でブラウザへ注入できる形を保つ）。
- 中間表現（walker → builder → postprocess の JSON）を唯一のインターフェース
  とし、型は lib/walker/index.mjs の JSDoc typedef で定義する。
- 移行は段階的に行う: 現行単一ファイルから機能単位で lib/ へ切り出し、
  各段階で fixture 回帰（fixture:pptx + qa）を通す。ビッグバン書き直しは
  しない（実機検証済みの挙動を持つ現行コードが唯一の仕様の実体であるため）。

### Consequences

- Good, because 中間 JSON を fixture として保存すれば builder / postprocess
  単体のユニットテストが書ける。
- Good, because アダプタ差し替えで Marp 等への展開が可能になり、
  コアは deck・テーマ・フォントに依存しない（NFR-4）。
- Bad, because 段階的切り出しの間、単一ファイルと lib/ が併存し
  diff が読みにくい期間が生じる。切り出しは機能追加と混ぜないコミット規律で
  緩和する。

## More Information

初版（2026-07-06、同番号）のパス前提（tech-slide 内 scripts/、二系統並存
凍結方式）を、リポジトリ分離後の現構成に合わせて改訂した。
requirements [2026-07-08](../requirements/2026-07-08-generic-pptx-walker.md)
NFR-3/NFR-4、および [ADR-0015](0015-ooxml-postprocess-layer.md)。

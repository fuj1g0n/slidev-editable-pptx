---
status: proposed
date: 2026-07-06
---

# モジュール分割と Slidev アダプタの分離

## Context and Problem Statement

現行 scripts/slidev-editable-pptx.mjs は約 800 行の単一ファイルに
「Slidev dev server 起動」「ブラウザ内 walker」「PptxGenJS 出力」「フォント埋め込み」が
同居する。OSS 切り出し（NFR-4）には deck 非依存コアの分離が要る。

## Considered Options

- 現行 scripts/slidev-editable-pptx.mjs の単一ファイル構成
- scripts/editable-pptx/ へのモジュール分割と Slidev アダプタの分離

## Decision Outcome

Chosen option: "モジュール分割と Slidev アダプタの分離", because OSS 切り出し（NFR-4）には deck 非依存コアの分離が要る。

scripts/editable-pptx/ に次の構成で分割する（仮実装も最初からこの形）。

```
scripts/editable-pptx/
  walker/            # ブラウザ内で実行されるコード（文字列化して page.evaluate）
    index.mjs        #   3 層ディスパッチ（ADR-0007 の判定順）
    contract.mjs     #   Layer 1: data-pptx / data-diag 正規化と解釈
    infer-box.mjs    #   Layer 2: CSS ボックス推論
    infer-text.mjs   #   Layer 2: テキスト runs 抽出
    infer-svg.mjs    #   Layer 2: SVG サブセット変換（ADR-0009）
    rasterize.mjs    #   Layer 3: 判定 rasterizeReason（ADR-0010）
  builder.mjs        # 抽出 JSON → PptxGenJS 呼び出し（Node 側）
  fonts.mjs          # フォント EOT 埋め込み（既存処理の移設）
  adapter-slidev.mjs # dev server 起動・print ビュー巡回・領域スクリーンショット
  cli.mjs            # エントリポイント（引数処理・統計出力）
```

- walker は DOM API のみ使用し、Node への依存を持たない
  （esbuild 等は使わず、単純な文字列連結でブラウザへ注入できる形を保つ）。
- 中間表現（walker → builder の JSON）を唯一のインターフェースとし、
  型は walker/index.mjs の JSDoc typedef で定義する。
- 既存 scripts/slidev-editable-pptx.mjs は当面残し、`npm run build:pptx:editable` の
  向き先変更は受け入れ基準（requirements §6）達成後に行う。

### Consequences

- Good, because OSS 化はこのディレクトリを package 化するだけになる（adapter を差し替えれば Marp も可）。
- Good, because 中間 JSON を fixture として保存すれば builder 単体のユニットテストが書ける。
- Bad, because 移行期間中は converter が 2 系統並存する。回帰比較にはむしろ好都合だが、
  修正の二重管理を避けるため既存側は凍結する（バグ修正も新系統で行う）。

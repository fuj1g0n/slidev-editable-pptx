# slidev-editable-pptx

editable PPTX に変換可能な Slidev を構築する仕組み。Diag\* 図コンポーネント
（Slidev addon）、HTML 実測 → ネイティブ図形再構築の変換器、図のジオメトリ lint、
PPTX 視覚 QA を提供する。

[tech-slide](https://github.com/fuj1g0n-demo-01/tech-slide) から観点分割で抽出した
（tech-slide ADR-0011）。

## 構成

| パス | 内容 |
|---|---|
| `components/` | Diag\* Vue コンポーネント（Slidev addon として自動登録）+ fills.js / icons.js |
| `bin/slidev-editable-pptx.mjs` | dev server の print ビューを Chromium で実測し、ネイティブ図形の PPTX を生成。フォント EOT 全字埋め込み |
| `bin/pptx-qa.sh` | LibreOffice → PDF → pdftoppm で PPTX をページ PNG 化する視覚 QA |
| `bin/lint-diagrams.mjs` | `<Diag>` ブロックの余白・整列規範を静的検査 |
| `bin/lint-figures.mjs` / `bin/figure-normalize.mjs` | drawio → SVG 例外経路の検証・正規化 |
| `bin/fetch-icons.mjs` / `bin/diagram-icons.mjs` | 公式アイコンセットの取得と単色 SVG 生成 |
| `docs/diag-css-vars.md` | `--diag-*` CSS 変数契約（値は消費側テーマが持つ） |
| `docs/generic-pptx-walker/` | 変換器の要求仕様と決定ログ（下位 ADR） |
| `.apm/skills/slidev-editable-pptx/` | agent skill（作図・PPTX 納品・QA の手順） |
| `docs/research/` | 調査記録。ADR を裏付ける日付付き不変スナップショット |
| `docs/adr/` | 決定ログ（MADR 4.0）。調査から採用した決定を記録 |

## Documentation

- [調査記録](docs/research/2026-07-07-pptx-approaches.md)
- [ADR 一覧](docs/adr/)

## 導入（npm: git URL 依存）

```sh
npm install -D git+ssh://git@github.com/fuj1g0n/slidev-editable-pptx.git
```

Slidev deck の headmatter で addon として読み込むと Diag\* が自動登録される:

```yaml
addons:
  - slidev-editable-pptx
```

消費側テーマは `docs/diag-css-vars.md` の CSS 変数を全て定義すること。

## 使い方

```sh
# 図のジオメトリ lint / drawio 例外経路の検証
npx lint-diagrams
npx lint-figures

# アイコン取得（slides/public/icons/ へ展開。冪等）
npx fetch-icons && npx diagram-icons

# editable PPTX 生成（CHROME_PATH 必須）
npx slidev-editable-pptx

# PPTX 視覚 QA（soffice / pdftoppm 必須）
npx pptx-qa
```

環境変数: `SLIDES_ENTRY`（既定 `slides/deck.md`）、`OUT`（既定
`out/deck-editable.pptx`）、`SLIDEV_PORT`、`CHROME_PATH`、`EMBED_FONTS`
（JSON 配列で埋め込みフォント差し替え）。パスはすべて実行時 cwd
（消費側リポジトリ root）基準。

## 導入（APM: agent skill）

```yaml
dependencies:
  apm:
    - fuj1g0n/slidev-editable-pptx#<sha>
```

`apm install` で `.agents/skills/slidev-editable-pptx/` へ配備される。

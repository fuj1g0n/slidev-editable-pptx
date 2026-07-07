---
name: slidev-editable-pptx
description: >-
  Slidev スライドを editable PPTX へ変換可能に保つための作図・変換・QA の手順。
  図は Vue コンポーネント（Diag*）でスライドに直接記述し、PPTX はネイティブ
  図形へ再構築して書き出す。Slidev の図・ダイアグラムの作成や修正、
  PPTX（PowerPoint）納品の依頼で使う。
---

# slidev-editable-pptx スキル：editable PPTX に耐える図と変換

Slidev で図を描く・PPTX を納品するときはこの手順に従う。
真実の置き場は Markdown + Vue であり、PPTX は round-trip しない一方向の成果物。

## 1. 図のルール

- 図は Vue コンポーネント（`Diag` / `DiagBox` / `DiagEdge` ほか、本パッケージの
  `components/`）でスライドに直接記述する。外部作図ツール（D2 / Mermaid / drawio）は
  原則使わない（統制と editable PPTX 変換の要求が外部ツールの利点を打ち消すため。
  tech-slide ADR-0001 D8）。
- 座標は表示 px、塗りは `fill` トークン名のみ。実色は消費側テーマの
  `--diag-*` CSS 変数が単一ソース（契約は
  [docs/diag-css-vars.md](https://github.com/fuj1g0n/slidev-editable-pptx/blob/main/docs/diag-css-vars.md)）。
  生色コードは書かない。
- 余白の規範: キャンバス内に収める・親ゾーンとの内側余白 12px 以上・
  兄弟要素の間隔 8px 以上。行・列は等間隔（差 2px 以内）、ゾーン内の行は
  左右余白を釣り合わせる（差 4px 以内）。`npx lint-diagrams` が座標を静的検査する。
- **例外**: 曲線・イラスト調など Vue で再現困難な複雑図に限り、drawio で作図して
  SVG を埋め込める。原本 `figures/*.drawio` と SVG `slides/public/figures/*.svg` を
  両方 commit し、エクスポート後に `npx figure-normalize <svg>` を通す。
  ラベルは書式なし（`html=0`、`whiteSpace=wrap` 禁止）、フォントは埋め込み
  フォント名を明示する。条件は `npx lint-figures` が検証する。
- アイコンは公式アセットのみ。概念アイコンは `npx fetch-icons && npx diagram-icons` で
  `slides/public/icons/` に展開する（gitignore 対象・冪等）。
- 図中の数値も本文の claims と矛盾させない。

## 2. PPTX 出口（要求時のみの一方向デリバリ）

客先が .pptx を要求した場合のみ、次のいずれかで書き出す。

| 経路 | コマンド | 特性 |
|---|---|---|
| 編集可能・高忠実 | `npx slidev-editable-pptx` | dev server の print ビューを Chromium で実測しネイティブ図形へ再構築。テキスト・表・コードが編集可能。図は画像のまま。フォントを EOT で全字埋め込み |
| 忠実・非編集 | `slidev export --format pptx` | Slidev 公式 export。各スライドが画像。見た目は PDF と同一 |

環境変数: `SLIDES_ENTRY`（既定 `slides/deck.md`）、`OUT`（既定
`out/deck-editable.pptx`）、`CHROME_PATH`（必須。Chromium 実行ファイル）、
`EMBED_FONTS`（JSON 配列で埋め込みフォントを差し替え）。

- 埋め込みフォントは OFL 等の再配布可能ライセンスに限る。受け手が
  PowerPoint (Windows) なら未インストール環境でも表示・編集ともに崩れない。
  LibreOffice / Google Slides は埋め込みフォントを読まないため代替表示になる。
- PowerPoint 上で入った編集は、ソース（deck.md / 出典記録）へ手動で還元する。
  pptx を直接メンテナンスの対象にしない。

## 3. PPTX 視覚 QA ループ（editable 変換後に必ず回す）

「生成 → 検査 → 修正」を PPTX にも適用する。初回出力をそのまま納品しない。

1. `npx slidev-editable-pptx` で editable PPTX を生成する。
2. `npx pptx-qa [pptx] [first] [last]` で LibreOffice → PDF → pdftoppm により
   ページ PNG を `out/qa-pptx/` に展開する（soffice / pdftoppm が必要）。
3. PNG を点検する。観点: 図形の欠落・座標破綻・テキスト折り返し・矢じり方向。
4. 問題があれば deck 側を直し、再変換して再点検する。変換器自体の問題は
   本パッケージへ issue / PR を出す。
5. LibreOffice の描画は PowerPoint のプリセット図形バグを隠すことがある。
   デリバリ前の最終確認は必ず PowerPoint 実機で行う。

## 4. 出自宣言原則

変換器は推測しない。HTML 側が `data-diag` / `data-pptx-*` 属性で意味
（種別・経路点列・矢じり・破線など）を宣言し、幾何は getBoundingClientRect で
実測する。宣言のない要素は画像へフォールバックする。仕様の詳細は
`docs/generic-pptx-walker/`（requirements と ADR）を参照。

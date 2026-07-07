# 調査: dom-to-pptx コード監査（2026-07-08）

日付: 2026-07-08。不変の調査スナップショット。
[同日ランドスケープ調査](2026-07-08-pptx-tool-landscape.md) §5 の留保
「コード実査未実施」を解消する一次ソース監査。
対象: github.com/atharva9167j/dom-to-pptx v2.0.3（shallow clone、src/ 全読）。

## 1. 基本事実

- ライセンス: **MIT**（LICENSE 実在確認。留保解消 — 取り込み・移植は可能）
- 規模: src/ 約 6,400 行。index.js 2,198 + utils.js 1,390 が中核の
  モノリシック walker。テストは vitest 5 ファイル（animations / font-embedder /
  pptx-normalizer / text-whitespace / table）
- 公開 API は `exportToPptx(target, options)` 1 関数のみ。
  **プラグイン・フック機構は存在しない**。拡張 = フォークか upstream PR
- ブラウザ内ライブラリが主形態。Node からは headless exporter
  （node-exporter.js 300 行）経由

## 2. 本プロジェクト要求との対応表

| 要求 | dom-to-pptx の実態 | 判定 |
|---|---|---|
| グラデーション native 化（FR-7b） | linear-gradient を **SVG 画像化して埋め込み**（utils.js generateGradientSVG）。radial は先頭色の solid に落とす（getGradientFallbackColor） | ✗ 非対応。gradFill なし |
| SVG → native 図形（FR-5, ADR-0009） | `<svg>` は svgToPng / svgToSvg で常に画像化（index.js:1270-1280）。線・矢印・コネクタの概念なし | ✗ |
| 宣言契約層（FR-1, ADR-0008） | なし。全面 CSS 推論 | ✗ |
| 実測行分割（ADR-0012） | なし。改行は author 由来（pre / block 境界）のみ。wrap:false は white-space:nowrap/pre の場合のみ。**コメントでフォントメトリクス差による再折返し問題を認識している**（index.js:897 付近）が対処は nowrap 限定 | ✗ |
| ラスタライズ理由ログ・統計（FR-8, ADR-0010） | なし。canvas フォールバックはあるが無告知 | ✗ |
| グループ化（FR-11） | なし | ✗ |
| OOXML 後処理層（ADR-0015） | **あり**。pptx-normalizer.js（601 行）: JSZip で出力 zip を開き、[Content_Types].xml の dangling Override 除去、pPr 子要素の順序正規化、アニメーション timing XML 注入。「PowerPoint が修復ダイアログを出す」問題への防御的正規化 | ◎ 同型機構の実装済み先行例 |
| フォント埋め込み（ADR-0003） | **あり**。font-embedder.js: opentype.js + fontToEot で EOT 化し p:embeddedFontLst へ注入。@font-face から使用フォントを自動検出（getUsedFontFamilies / getAutoDetectedFonts） | ◎ 本リポジトリと同一方式に独立到達 |
| テキスト runs 抽出（FR-4） | 充実。hyperlink 継承、**::before content の文字回収**（アイコンフォント対策）、letter-spacing（fontFace 名 `__spc_` サフィックス + 後処理）、white-space: pre 系の改行保持（splitPreformattedText、純文字列ロジック）、縦書き writing-mode 写像、色の CSS 変数解決 + 透明度フラット化（parseColor / flattenColor / resolveCssVariables） | ○ 部品として質が高い |
| box 装飾推論（FR-3） | border 4 辺個別（composite border は SVG 生成）、box-shadow、border-radius、filter: blur → softEdge、rotation | ○ |
| クリックビルド（FR-14） | v2.0 で click-step → **PowerPoint native アニメーション**（entrance/exit 20+、transition 70+ の XML テンプレート）。本プロジェクトはアニメーションをスコープ外としたが、v-click の native step 化という将来価値がある | ○（スコープ外領域） |

## 3. アーキテクチャ評価

- index.js の prepareRenderItem（推論の中枢）は分岐の集積で、
  marp-to-editable-pptx の dom-walker.ts と同じ「推論型は例外ヒューリス
  ティックが際限なく積み上がる」軌道にある（要求調査 2026-07-06 §2.2 と同型）。
- 判定順・検出条件が関数内に散在し、ディスパッチの一元化（ADR-0007 の
  Bad 対策）とは正反対の構造。契約層・行分割・理由ログを差し込むには
  中枢の改造が必要で、フォーク相当になる。
- 一方、周辺モジュール（pptx-normalizer / font-embedder / utils の
  CSS パーサ群 / animations）は責務が明確で、単体テストも付いており、
  **モジュール単位の移植適性が高い**。

## 4. 再利用性の層別評価

1. **ベース採用（本プロジェクトを dom-to-pptx の Slidev 拡張にする）**:
   拡張 API が無いため実態はフォーク。中核モノリスの改造なしに
   FR-7b/FR-5/FR-1/ADR-0012 は実現できず、フォーク後は upstream 追従と
   自前改造の二重負担になる。単一作者プロジェクトへの依存リスクも残る。
2. **実装の移植（MIT、出典明記の vendoring）**: 適性が高い部品:
   - pptx-normalizer.js — ADR-0015 後処理層の防御的正規化として先行実装。
     dangling Override 除去・pPr 順序修正は gradFill/grpSp 注入時の
     「修復ダイアログ」リスクへの直接の対策
   - utils.js の純関数群 — parseColor / flattenColor / resolveCssVariables /
     getBorderInfo / getVisibleShadow / splitPreformattedText（DOM 非依存の
     文字列ロジックでテスト付き）
   - animations/ — v-click native 化の将来素材
3. **アイデアの採用**: ::before content の文字回収（ADR-0010 検出条件 8 の
   補完: content が文字ならラスタライズでなくテキスト化できる）、
   letter-spacing の後処理注入方式、white-space 別の改行保持規則、
   isImageWrapper ヒューリスティック。
4. **upstream 貢献**: 汎用的な修正（radial gradient、行分割）は貢献候補に
   なり得るが、本プロジェクトの必要時期と upstream のレビュー速度は独立で、
   計画の前提にはできない。

## 5. 結論

「ベース採用」は拡張 API の不在と中核モノリスにより不成立。
「モジュール移植 + アイデア採用」が最適で、特に pptx-normalizer は
ADR-0015 の実装リスク（壊れた XML による修復ダイアログ）を直接下げる。

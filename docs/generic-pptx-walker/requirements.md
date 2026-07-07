# 汎用 editable PPTX walker — 要件調査

status: draft / branch: feat/editable-pptx-generic-walker / as_of: 2026-07-06

## 1. 背景と目的

scripts/slidev-editable-pptx.mjs は「Chromium で DOM を実測し PptxGenJS のネイティブ図形へ
再構築する」変換器だが、図の再現は本リポジトリ専用の Vue コンポーネント
（Diag* が付与する `data-diag` 属性）に全面依存している。
一般的な Slidev deck（素の div / SVG / Mermaid で図を組んだもの）では、
枠・背景を持つ四角が図形として出力されず、矢印は消えるか 1 枚の画像になる。

本機能は walker を 3 層構成に汎用化し、任意の Slidev deck を editable PPTX へ
変換できるコアを作る。将来の OSS 切り出し（deck 非依存パッケージ化）を見据える。

## 2. 現状調査

### 2.1 本リポジトリの converter（宣言契約型）

- 走査対象は `h1-h6, p, li, pre, table, img, svg` と `[data-diag]` のみ。
- エッジ（折れ線・矢じり・破線）、chevron ノッチ、cycle 弧は
  コンポーネントが JSON で宣言し、座標だけ getBoundingClientRect で実測する。
  「見た目から推測できない意味情報は宣言する」ことで忠実性は完全。
- 一般の div ボックスは図形化されない（テキストだけ裸で浮く）。

### 2.2 marp-to-editable-pptx（CSS 推論型、claim-0009）

dom-walker.ts（約 2,500 行）を実査した結果:

- fallback の `container` 型: background / border（top・left・bottom 個別）/
  border-radius / box-shadow を computed style から検出し、図形 + 再帰子要素として出力。
- inline-block/flex/grid + 背景 + 角丸を「バッジ」図形として抽出し、
  テキストボックスをバッジ幅ぶん右へずらす補正まで持つ。
- `foreignObject` を含む SVG や CSS filter つき画像は `rasterize: true` を立て、
  Puppeteer のスクリーンショットで PNG 差し替え（敗者復活経路）。
- 一方で線・矢印・コネクタの概念が無い。図は SVG 画像かラスタライズに落ちる。
- transform（rotate/scale）と z-index の制御も無い。
- flex/grid 直下の裸テキストノード回収など例外ヒューリスティックが多数
  （コメント内 ADR-22/23 など）。推論型は例外対応が際限なく積み上がる証左。

### 2.3 一般的な Slidev deck における「複雑な図」の作られ方（実査）

| パターン | 実装 | 現 converter の挙動 |
|---|---|---|
| カード・ゾーン枠 | div + border/bg/radius（UnoCSS/インライン style、絶対配置や flex/grid） | 図形が消える |
| 矢印 | Slidev 組み込み `<Arrow>` = SVG line + marker-end polygon。スライド原点に絶対配置された `max(x1,x2)+50` 四方の透明 SVG | 巨大な透明画像として貼られ、重なり・編集性が破綻 |
| フローチャート等 | Mermaid → インライン SVG（ラベルは foreignObject の場合あり） | 画像化（foreignObject は PowerPoint が SVG 描画不能で白抜けリスク） |
| 装飾矢印・三角 | CSS border ハック / 疑似要素 / clip-path | 完全に消える（疑似要素は DOM に現れない） |
| 回転・変形 | transform: rotate 等 | 未対応（座標が視覚と乖離） |

Slidev `<Arrow>` が SVG line + marker という規則的な構造である事実は重要:
SVG の基本図形（line/polyline/rect/circle/path + marker）をネイティブ図形へ
変換する層があれば、一般 deck の矢印の大半が編集可能になる。

## 3. 機能要件

3 層フォールバック構成。上の層が該当すれば下の層は使わない。

**Layer 1: 宣言契約層（最優先・既存の一般化）**

- FR-1 `data-pptx-*` 属性契約を公開仕様とし、既存 `data-diag` を包含する。
  推論では原理的に復元できない意味情報（経路点列・矢じり・破線パターン・
  ノッチ・弧角度・z-order 指定）はここで宣言する。
- FR-2 既存 Diag* コンポーネント deck の出力が回帰しないこと（後方互換）。

**Layer 2: 推論層（新規・汎用 deck のベースライン）**

- FR-3 可視の background / border（4 辺個別）/ border-radius / box-shadow を持つ
  要素を rect / roundRect として出力する。入れ子は DOM 順で z-order を保つ。
- FR-4 テキストは computed style 実測の runs として出力する（既存踏襲）。
  flex/grid コンテナ内・絶対配置のテキストも取りこぼさない。
- FR-5 インライン SVG のうち機械変換可能な構造
  （line / polyline / rect / circle / ellipse + marker 矢じり、単純 path）は
  ネイティブ図形へ変換する。最低限 Slidev `<Arrow>` パターンを図形化する。
  SVG の viewBox スケーリングと transform 属性を座標へ反映する。
- FR-6 preset 図形は「adjust 値で実測形状を完全再現できる場合」のみ使用し、
  それ以外は custGeom とする（DESIGN.md の既存基準を維持）。

**Layer 3: ラスタライズ敗者復活層（新規）**

- FR-7 再現不能条件を検出した要素は、その領域のスクリーンショット画像として
  出力する（消える・壊れるより画像の方がまし）。検出条件:
  foreignObject を含む SVG、CSS filter、グラデーション背景、
  transform（回転・skew）、clip-path、変換不能な path を含む SVG。
- FR-8 ラスタライズ対象と理由を変換ログに出力する（品質の可視化。
  無断で画像化された要素が分からないと QA ループが機能しない）。

**共通**

- FR-9 z-order は「DOM 順 + Layer 1 の宣言による前面指定」で決定する。
- FR-10 変換結果の統計（ネイティブ図形数 / 画像化数 / ラスタライズ数）を出力する。

## 4. 非機能要件

- NFR-1 決定性: 同一入力から同一 PPTX（タイムスタンプ除く）。
- NFR-2 回帰検証: 既存 deck.md 全ページを変換し、`npm run qa:pptx` の
  ページ PNG で図形欠落・座標破綻が無いこと。
- NFR-3 保守性: 単一ファイル約 800 行の現状から、層ごとのモジュールへ分割する。
  推論層のヒューリスティック追加が契約層・出力層に波及しない構造にする。
- NFR-4 OSS 切り出し可能性: コア（walker + builder）は本リポジトリの
  deck・テーマ・フォントに依存しない。Slidev 依存（dev server 起動・print ビュー）
  はアダプタとして分離する。
- NFR-5 実行環境: WSL / Linux、Nix flake devShell の Chromium。PowerShell 禁止。

## 5. スコープ外

- PPTX → Markdown の round-trip。
- アニメーション（v-click 等）・プレゼンタノート・クリックイベント。
- CSS 疑似要素の図形化（DOM に現れないため原理的に不可。Layer 3 で領域画像化）。
- Marp 対応（アダプタ分離により将来可能にするが、本仮実装では対象外）。

## 6. 受け入れ基準（複雑図耐性）

1. 契約層: 本リポジトリ deck.md の p6（GitHub と開発ライフサイクル。
   60+ 要素、L 字角丸エッジ、chevron、cycle 弧、破線、raised z-order）が
   現行 converter と同等の忠実性で変換される。
2. 推論層: 汎用フィクスチャ deck（Diag* 不使用。絶対配置 div カード群 +
   ゾーン枠 + Slidev `<Arrow>` 複数 + Mermaid 図 + flex/grid カード）を変換し、
   - div の枠・背景・角丸がネイティブ図形として現れる
   - `<Arrow>` が編集可能な線 + 矢じりになる
   - Mermaid は画像として正しい位置・サイズで貼られる（foreignObject あり時は
     ラスタライズされ白抜けしない）
   - テキストの取りこぼしが無い
3. QA ループ: 上記 2 deck を `npm run qa:pptx` で PNG 化し、
   元スライドとの目視比較で図形欠落ゼロ。最終確認は PowerPoint 実機。

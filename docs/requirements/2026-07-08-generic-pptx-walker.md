# 汎用 editable PPTX walker — 要求調査（第 2 版）

status: draft / as_of: 2026-07-08 /
前版: [2026-07-06-generic-pptx-walker.md](2026-07-06-generic-pptx-walker.md)（本版が置き換える。前版は不変スナップショットとして残す）

## 1. 本版の位置づけ

前版はコンバータ実装者の視点で機能を列挙しており、プロダクト要求として
次の欠落・矛盾があった。本版はこれを解消する再調査である。

- ユーザーとユースケースが未定義（「editable」の意味が規定されていない）
- 忠実性と編集性のトレードオフ方針が要素クラスごとに規定されていない
- 内部矛盾: Layer 3 のサブツリー丸ごと画像化が前景テキストの編集性を破壊する /
  疑似要素「検出は原理的に不可」は誤り / QA 手段（LibreOffice）が偽陰性を
  出す実証（ADR-0013）と矛盾
- 外部事実が未検証だった（PptxGenJS の機能境界、競合ツールの実在）

外部事実は 2026-07-08 に一次ソースで検証した（§7）。

## 2. ユーザーとユースケース

### 2.1 ユーザー

- **作者**: Slidev（Markdown + Vue）でデッキを書き、Git/CI で管理する開発者。
- **受け手**: PowerPoint（M365 デスクトップ）で成果物を受け取る非開発者。
  ビジネス文脈での再利用者。
- **OSS 利用者**: Diag\* コンポーネントを使わない一般の Slidev deck の作者。

### 2.2 ユースケース

- UC-1 納品と手直し: 作者が editable PPTX を納品し、受け手が文言修正・
  ロゴ/色のブランド差し替え・不要要素の削除を行う。
- UC-2 スライド移植: 受け手がスライドを自社テンプレートのデッキへコピーする
  （要素はスライド内で自己完結し、テーマ・マスタに依存しないこと）。
- UC-3 汎用変換: OSS 利用者が任意の Slidev deck をゼロ設定で変換する。
- UC-4 CI 生成: リポジトリの CI が deck 更新のたびに再生成し、QA を通す。

### 2.3 「editable」の定義（受け手ができること）

| ID | 操作 | 必須度 |
|---|---|---|
| E-1 | テキスト文言の修正（同程度の長さ）。書式・位置が崩れないこと | must |
| E-2 | 図形の移動・リサイズ・塗り/線色の変更 | must |
| E-3 | 要素の削除（背後に隠れた別要素の巻き添えなし） | must |
| E-4 | スライド単位の別デッキへのコピー（フォント埋め込み込みで崩れない） | should |
| E-5 | 長文の書き直し（再折返しを伴う） | 対象外。ADR-0012 で明示改行に固定し、忠実性を優先するトレードオフを受容済み |

「editable」の反対語は「スクリーンショット貼付」ではなく「編集すると壊れる」。
E-1〜E-3 が成立しない出力は editable を名乗らない。

## 3. コア・トレードオフ: 忠実性 / 編集性 / 実装コスト

3 つは同時に最大化できない。要素クラスごとに優先順を規定する
（前版はこの方針が無く、Layer 3 の設計矛盾の原因になった）。

| 要素クラス | 優先 | 帰結 |
|---|---|---|
| 本文テキスト（見出し・段落・リスト・表・コード） | 編集性 > 忠実性 | 常にネイティブ text runs。ラスタライズ禁止 |
| 宣言契約の図（Layer 1） | 編集性 = 忠実性 | ネイティブ図形。意味情報は宣言で運ぶ |
| 推論可能な box / SVG サブセット（Layer 2） | 編集性 > 忠実性 | ネイティブ図形。再現しきれない装飾（影の厳密形状等）は劣化を許容 |
| 装飾・テーマクローム（グラデーション、疑似要素、filter、複雑 SVG） | 忠実性 > 編集性 | ネイティブ表現があればネイティブ、なければラスタライズ |
| スライド背景 | 忠実性 > 編集性 | 同上。ただし前景を巻き込まない（FR-7b） |

## 4. 機能要件（改訂）

3 層フォールバック構成（Layer 1 宣言契約 > Layer 2 CSS 推論 > Layer 3
ラスタライズ）は維持する。前版 FR-1〜FR-6, FR-9, FR-10 は変更なし。
FR-7/FR-8 を改訂し、FR-11 以降を追加する。

- FR-7（改訂）ラスタライズの検出条件は前版どおり
  （foreignObject / filter / グラデーション / 回転・skew transform /
  clip-path / サブセット外 SVG / 契約指定）。ただし:
  - **FR-7a 前景保護**: ラスタライズは編集可能要素（§3 で編集性優先の
    クラス）を巻き込んではならない。テキストを子に持つ要素の背景装飾は、
    子を除いた背景ペイントのみを画像化する（例: 子を一時 visibility:hidden に
    して領域撮影）か、ネイティブ表現へ写像する。サブツリー丸ごと画像化が
    許されるのは、編集性優先クラスの子を含まない場合のみ。
  - **FR-7b ネイティブ優先**: OOXML に等価表現がある装飾（線形/放射
    グラデーション = a:gradFill）は、ラスタライズよりネイティブ写像を優先する。
    PptxGenJS は gradFill 非対応（§7 検証済み）のため、実現手段は
    XML 後処理（フォント埋め込みで実績あり）またはラスタライズのいずれかを
    ADR で決定する。
  - **FR-7c 疑似要素**: `getComputedStyle(el, '::before'/'::after')` で
    content が none 以外の可視疑似要素を検出した場合、その親要素を
    ラスタライズ候補とする（rect は取得不能でも存在検出は可能。前版の
    「検出は原理的に不可」は誤り。図形化が不可なだけである）。
    検出しなければ CSS 三角矢印等が黙って消え、Layer 3 の存在意義が崩れる。
- FR-8（改訂）ラスタライズの理由ログと統計出力は前版どおり。加えて
  「検出したが図形化もラスタライズもしなかった要素」はゼロでなければ
  ならない（黙って消えない保証の検査可能な言い換え）。
- FR-11 **グループ化**: Layer 1 の図 1 つ（data-diag root 単位）は
  PPTX 上で 1 グループとして移動・コピーできること（E-2/E-4 の成立条件。
  60 個のバラ図形は実用的な編集性を持たない）。
  PptxGenJS のグループ対応有無は未検証。非対応なら XML 後処理で
  実現するか、要求を should へ格下げするかを ADR で決定する。
- FR-12 **対象ビューア行列**: 一次ターゲットは M365 PowerPoint
  デスクトップ（Windows）。svgBlip（Office 2016+）を前提としてよい。
  PowerPoint Online / macOS は should（確認はするが blocker にしない）。
  LibreOffice Impress は QA 補助であり、受け手ターゲットではない。
- FR-13 **失敗時挙動**: スライド単位の変換エラーはビルド全体の失敗とする。
  無警告の部分成功（一部スライドだけ欠けた成果物）を禁止する。
- FR-14 **クリックビルド**: v-click 等は最終状態（全要素表示）で出力する
  （print ビューの既定動作を仕様として明文化）。
- FR-15 **代替テキスト**: img の alt / aria-label を PPTX の説明
  （descr）へ引き継ぐ（should。アクセシビリティ経路の温存）。

## 5. 非機能要件（改訂）

- NFR-1（改訂）決定性: 同一入力 + 同一環境（Nix flake が pin する
  Chromium / フォント）から同一 PPTX（タイムスタンプ除く）。
  Layer 3 のスクリーンショットはブラウザ実装依存のため、環境を跨いだ
  バイト同一性は保証しない（境界の明示。前版は無条件だった）。
- NFR-2（改訂）QA は二段構成: CI では LibreOffice ベースの qa:pptx を
  構造回帰スモークとして回し、レンダリング忠実性の最終判定は
  PowerPoint 実機（COM、ADR-0013）で行う。LibreOffice は svgBlip を
  ブラウザ同等に描画するため PowerPoint 固有の欠落を検出できない
  （偽陰性の実証: research 2026-07-07）。
- NFR-3 保守性（層分離）: 前版どおり。
- NFR-4 コア/アダプタ分離: 前版どおり。ただし「OSS 切り出し」自体は
  リポジトリ分離（fuj1g0n/slidev-editable-pptx）として完了済みで、
  残る要求は Slidev 依存部（dev server・print ビュー）のアダプタ分離。
- NFR-5（改訂）実行環境: 変換パイプラインは WSL / Linux、Nix flake の
  Chromium で完結し PowerShell を使わない。例外は ADR-0013 の QA ゲート
  （ホスト PowerPoint の COM 自動化）のみ。
- NFR-6 **フォントライセンス**: 全字埋め込み（EOT）は再配布に近い行為で
  あり、埋め込み許諾（OS/2 fsType が Installable / Editable）のある
  フォントに限る。判定責務は利用者にあるが、ツールは fsType を検査して
  警告を出す（should）。
- NFR-7 **性能予算**: 20 スライド級 deck の変換が CI で 5 分以内
  （現行実測の 2 倍を上限とする緩い予算。FR-7a の子隠し撮影が
  スライド数 × 要素数で効くため、予算超過を設計の歯止めにする）。

## 6. 受け入れ基準（改訂）

前版の 3 基準（契約層 p6 忠実性 / 推論層汎用フィクスチャ / QA ループ）に
次を追加する。

4. **編集性シナリオ**: 生成 PPTX に対し PowerPoint 実機で
   (a) 見出し文言を書き換えても位置・書式が保たれる（E-1）、
   (b) 図 1 つをグループとして選択・移動できる（E-2, FR-11）、
   (c) 装飾要素を削除しても他要素が巻き添えにならない（E-3）。
5. **無欠落検査**: 変換ログの統計で「未処理要素 = 0」（FR-8）。
   ラスタライズ件数と理由が列挙され、想定外の理由がないこと。
6. **ビューア行列**: 一次ターゲット（M365 デスクトップ）で COM 一括
   PNG 化 → ブラウザレンダリングと比較し、欠落・重なりゼロ（ADR-0013）。

## 7. 検証済み外部事実（2026-07-08、一次ソース実査）

| 事実 | 出典 |
|---|---|
| PptxGenJS の図形 fill は `'none' \| 'solid'` のみ。gradFill 生成コードは存在しない（コード全体で 0 ヒット） | gitbrent/PptxGenJS v4.0.1 src/core-interfaces.ts:174-201, src/gen-utils.ts genXmlColorSelection |
| スライド background も色 / 画像のみ。グラデーション不可 | 同 src/core-interfaces.ts:69-81, src/gen-xml.ts:89-96 |
| 矢じりは begin/endArrowType = none/arrow/diamond/oval/stealth/triangle の 6 種。サイズ指定は FUTURE（未実装） | 同 src/core-interfaces.ts:202-248 |
| custGeom は moveTo/lineTo/cubicBezTo/quadBezTo/arcTo/close を完備（曲線対応の受け皿あり） | 同 src/core-interfaces.ts:660-675, src/gen-xml.ts:429-486 |
| addImage sizing = contain/cover/crop、text は wrap(bool) / fit('none'\|'shrink'\|'resize') / run 単位 breakLine | 同 src/core-interfaces.ts:480-570, 979-1133 |
| Slidev `<Arrow>` = 絶対配置 SVG（max(x1,x2)+50 四方）+ line + marker-end polygon。二重線（透明の当たり判定線）を含む | slidevjs/slidev packages/client/builtin/Arrow.vue |
| marp-to-editable-pptx は公開リポジトリ KatsuYuzu/marp-to-editable-pptx（VS Code 拡張）。dom-walker.ts 2520 行。bg/border/radius/shadow 検出、foreignObject・CSS filter・グラデーションで rasterize フラグ。線・矢印・コネクタの概念なし | 同リポジトリ src/native-pptx/（前版 §2.2 の記述は正確と確認） |
| OOXML DrawingML は a:gradFill（線形 a:lin / 放射 a:path）を図形・スライド背景ともネイティブ対応。CSS 角度とは 90° ずれ（ooxml_ang = (90 − css_deg) × 60000）、stop 上限 10 | ECMA-376 §20.1.8.33 |
| PowerPoint（M365）は svgBlip で SVG を描画するが foreignObject は描画しない | PptxGenJS gen-xml.ts:576-587、KatsuYuzu dom-walker.ts:1779-1794、実機検証（research 2026-07-07） |
| Marp 公式 `--pptx-editable` は PDF → LibreOffice impress_pdf_import 変換。README が不完全出力を明記。DOM 実測型ではない | marp-team/marp-cli src/converter.ts convertFileToEditablePPTX |
| PptxGenJS にユーザー向けグループ化 API はない。`grpSp` は spTree ルートラッパー 1 箇所のみ | gitbrent/PptxGenJS src/gen-xml.ts（コード検索で確認） |
| python-pptx も gradFill API なし（issue #299）、グループの新規生成不可（既存の読み取りのみ） | scanny/python-pptx issues/299、公式 docs |
| native gradFill + p:grpSp を両方出力できる OSS は JoeyHwong-gk/svg2pptx（Python/MIT、SVG→DrawingML。path 全コマンド・g→grpSp・線形/放射 gradFill 対応）のみ | github.com/JoeyHwong-gk/svg2pptx README |
| 直接競合 dom-to-pptx（atharva9167j、npm v2.0.3）: getComputedStyle ベースの DOM 実測 → PptxGenJS。ただしグラデーションは SVG 画像埋め込み（native gradFill でない）、SVG は手動「図形に変換」前提、グループ化なし | github.com/atharva9167j/dom-to-pptx README |
| Pandoc / Quarto の pptx writer はテンプレート placeholder 充填型（7 レイアウト固定）。絶対座標レイアウトの再現は構造的に不可能で、本ツールと競合しない | pandoc.org/MANUAL.html#powerpoint-layout |
| Figma→PPTX プラグイン群（FigDeck 等）は native 図形 + gradFill + グループを実現しているが、CSS 実測ではなく Figma Plugin API の構造化ジオメトリを読む方式。ブラウザ HTML には適用不能 | figma.com/community plugins、github.com/DaftdragonAIlab/figdeck-plugin |
| Slidev の HTML を native shape の editable PPTX にする公開ツールは他に見当たらない（本ツールの空白領域は実在） | 2026-07-08 ランドスケープ調査 |

注: PptxGenJS の gradient 対応について二次情報に「2-stop 限定対応」の記述が
あるが、v4.0.1 ソースの直接検証（ShapeFillProps = none/solid、gradFill 生成
コード 0 件）と矛盾するため採用しない。

## 8. スコープ外（変更点のみ）

- 疑似要素の**図形化**はスコープ外のまま（rect 取得不能）。ただし**検出と
  ラスタライズ**は FR-7c によりスコープ内へ移動（前版は全面スコープ外で、
  「黙って消えない」保証と矛盾していた）。
- そのほか（round-trip、アニメーション、Marp アダプタ）は前版どおり。

## 9. 未解決の論点（ADR 判断待ち）

1. グラデーションの実現手段。選択肢は 3 つ:
   (a) XML 後処理で native a:gradFill を注入（フォント埋め込みで実績のある
   JSZip 後処理の延長。CSS→OOXML の角度変換・stop 上限 10 の写像が必要）、
   (b) FR-7a 準拠の背景ラスタライズ（ADR-0010 現案）、
   (c) SVG 画像埋め込み（dom-to-pptx 方式。見た目は正しいが受け手が
   グラデーションとして編集できず、E-2 を部分的に満たさない）。
2. FR-11 グループ化: PptxGenJS に API なし（§7 検証済み）。実現するなら
   XML 後処理で p:grpSp へ包む。子座標系（chOff/chExt）の再計算コストと、
   要求を should へ格下げする案の比較が必要。
3. ADR-0011 のモジュール分割先パス: 前提の `scripts/` はリポジトリ分離前の
   構成。現構成（`bin/`）に合わせた改訂が必要。
4. SVG サブセット変換（ADR-0009）の範囲: custGeom は曲線（cubic/quad/arc）
   まで受け皿がある（§7）ため、「直線コマンドのみ」の制限は実装コスト都合で
   あって backend 制約ではない。JoeyHwong-gk/svg2pptx（Python）の変換表は
   参考実装として有用だが、Node パイプラインへの言語跨ぎ依存は避けたい。

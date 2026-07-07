# 調査: drawio の Slidev 組み込みと構造変換経路の設計考察（2026-07-08）

日付: 2026-07-08。不変の調査スナップショット。
前提: [同日 drawio 契約考察](2026-07-08-drawio-as-model-contract.md) §7
（themed editable pptx コンパイラ案）。本稿はその Slidev 統合部分を
深掘りする。一次資料: viewer.min.js / @maxgraph/core のライセンス・
被覆確認（2026-07-08 web 調査）、tech-slide DESIGN.md の
旧 D2/Mermaid boundary 契約と figures:normalize 実装。

## 1. 問題: 事前 SVG 化は構造を破壊する

現行の例外経路（figures/*.drawio → 手動 SVG export → `<img>`）では、
slidev → pptx の時点で図は既に SVG に落ちており、mxGraph 構造
（セル・意味論・z 順・接続関係）は失われている。walker から見えるのは
1 枚の画像であり、editable 変換は原理的に不可能。
**変換器が構造に触れるには、pptx 化の時点で drawio XML が
生きている必要がある。**

## 2. 提案アーキテクチャ: ライブレンダリング + 構造検知

### 2.1 表示側: `<DrawioDiag>` Vue コンポーネント

- `figures/*.drawio` を Vite の `?raw` インポート等で読み込み、
  ブラウザ内で mxGraph レンダラにより SVG として描画する。
  事前 export は行わない。
- **テーマ適用はレンダリング直前の style 書き換え**で行う:
  テーマから生成した「hex ↔ トークン」対応表（§7.2 の
  エディタプロファイルと同一の生成元）を使い、mxCell style 中の
  テーマ由来リテラル色を現テーマの実値に置換して描画する。
  dark テーマでも同一 .drawio ファイルがそのまま使える。
- **フォントはページの webfont がそのまま当たる**。ブラウザ内
  レンダリングの決定的な利点であり、デスクトップ export で必要だった
  フォントサブセット埋め込み（figures:normalize）が表示経路から消える。
  エディタ（VS Code 拡張）とのメトリクス一致は customFonts 設定 +
  ローカルインストールで担保する。
- レンダラ候補（いずれも Apache-2.0、一次確認済み）:
  - **viewer.min.js（GraphViewer）**: drawio 公式ビューア。
    **全シェイプライブラリ同梱**で drawio アプリとの描画一致が最も高い。
    ビューア専用（編集 UI なし）。バンドルは重いが図のあるページのみ
    遅延ロードすればよい。
  - **@maxgraph/core**: mxGraph の現行後継（TS、npm、保守活発）。
    基本 XML は互換だが **drawio 固有シェイプは stencil 移植が必要**。
    軽量・tree-shakable。
  - 評価: 描画一致性を優先し viewer.min.js を第一候補とする。
    maxGraph は変換器側（Node での XML 解釈・stencil→custGeom
    コンパイル）の参照実装として有用で、表示用途では
    stencil 被覆が揃った時点の乗り換え先。

### 2.2 契約: walker による検知と構造への迂回

ADR-0007 Layer 1（宣言契約）の自然な拡張として定義する:

- コンポーネントは root に `data-diag="drawio"` を立て、
  `data-drawio-src`（ソースパス）を宣言する。さらに描画時に解決した
  「hex→トークン対応」「モデル座標系 → 表示 px のスケール・オフセット」
  を JSON で契約属性（または `<script type="application/json">` 子）
  として公開する。
- walker はこの subtree を **DOM 走査しない**。root の
  getBoundingClientRect と契約 JSON を回収し、drawio XML を
  構造→PptxGenJS 変換器へ引き渡す。
  - 座標写像: mxGeometry × スケール + root オフセット → EMU。
  - 色: XML 中のテーマ由来 hex はトークン経由で pptx テーマ色へ。
    逆引き不能な色はリテラルのまま通す（警告付き、fail-soft）。
- つまり「**表示はライブ SVG、変換は XML 構造**」の二重経路であり、
  同一ファイル・同一テーマ対応表から両者が導出されるため一致が保たれる。
  両経路の一致は既存の視覚 QA ゲート（ADR-0013、実 PowerPoint 描画 vs
  ブラウザスクリーンショット比較）がそのまま検証器になる。

### 2.3 段階導入: .drawio.svg 二重形式の検知（Stage 0）

ライブレンダラ導入前の安価な中間段として、既存の
`<img src="*.drawio.svg">`（SVG 内に mxfile XML を内包する二重形式）を
walker が検知し、埋め込み XML を抽出して構造変換する経路が成立する。
表示側は現行のまま（テーマ非追随）だが、pptx だけ先に editable になる。
移行順序: Stage 0（検知のみ）→ Stage 1（DrawioDiag ライブ描画）。

## 3. 「全て」への答え: 部分ラスタライズ + z 順合成

被覆できないセル（sketch/rough 描画、フリーハンド、複雑 HTML ラベル、
未移植 stencil）への対処として、**セル単位のラスタライズを z 順を
保って native shape 列に interleave する**方式を採る。

- **z 順の根拠**: mxGraph の描画順は root 直下の子順で決定的、
  PPTX の z 順も spTree 内の shape 順で決定的。従って
  「モデル順に走査し、変換可能セルは native shape、不能セルは
  画像として、同一列に順番どおり emit する」だけで前後関係は保存される。
  グループ内で混在する場合も grpSp（ADR-0015）内の子順で同様に成立。
- **ラスタ化の実行**: walker は既に headless Chromium 上で
  ライブページを持っている。対象セルの SVG ノードだけを残して
  兄弟を隠す screenshot 方式（ADR-0010 の前景保護と同一手技）で
  当該セルのみの透過 PNG を得る。shadow/blur のはみ出しは
  capture box にブラー半径ぶんのパディングを足して回収する。
- **限界の認知**: (a) 半透明セルが下のセルと重なる場合、
  透過 PNG 合成で正しく再現される（乗算的なブレンドモードは除く）。
  (b) エッジが多数のノードを跨いで下を潜る場合も、エッジ自体が
  1 セルなので z 位置は保存される。(c) 連結された図形群の一部だけが
  画像化されると、PowerPoint 上での編集（ノード移動）に画像側が
  追随しない — これは editability の劣化として被覆レポートに
  明示する（FR-13 の fail-soft + レポート）。
- この方式により「全て」は初期条件でなく**単調に広げられる被覆域**に
  なる: 初期リリースでも全図が変換でき（最悪全セル画像）、
  stencil コンパイラの拡充がそのまま editable 率の向上に写る。
  被覆レポート（セルごとの native/raster と理由）を変換出力に含め、
  QA と改善の駆動源とする。

## 4. 組み込み契約（サイズ・テーマ準拠）

きれいに埋め込むには表示側にも契約が要る。旧 D2/Mermaid の
boundary 契約（SVG サイズ検証 + 表示倍率固定）と DESIGN.md の
図規律を drawio 向けに再定義する:

- **サイズ契約**: `<DrawioDiag :w :h>` で論理サイズを宣言し、
  モデルの図面境界（全セルの bbox）が宣言サイズに収まることを
  lint で検査する。自動縮小で溢れを隠さない（縮小はフォント実寸を
  崩し、R3 密度規律と衝突するため）。表示倍率は原則 1.0
  （モデル px = 表示 px）とし、Diag と同じ「変倍なし」原則を維持する。
  ページ内の配置上限（スライド有効領域 1160×590 等）はテーマ側の
  layout が規定する。
- **テーマ準拠契約**（lint、fail-soft 警告）:
  - 色はテーマ生成パレット（colorSchemes として配布した集合）のみ。
    パレット外リテラルは「テーマ切替に追随しない」警告。
  - フォントはテーマ宣言フォント（OctoBiz / UDEV Gothic 等）のみ。
  - アイコンは配布 mxlibrary（/icons/ 由来 data URI）のみ。
    外部 URL 参照は禁止（自己完結性、旧経路と同じ規則）。
  - ラベルは html=0 を推奨。html=1 は定義済み HTML サブセット
    （b/i/br 程度）を超えるとラスタ落ちすることを宣言する。
- **フォントサイズ・密度**: DESIGN.md の最小フォントサイズ・
  余白規律は drawio 図にも適用対象（lint は図面境界と style の
  fontSize を XML から静的に検査できる）。
- これらの lint は XML の静的検査で完結するため、CI で強制できる
  （旧 lint:figures と同じ位置づけ）。契約は「エディタプロファイル
  生成」（考察 §7.2）と同じソース（テーマ定義）から導出し、
  作図時の誘導（プロファイル）と検査（lint）が同一真実を共有する。

## 5. 帰結

- 事前 SVG 化を廃し「ライブレンダリング + data-diag 契約による
  構造迂回」を採ることで、drawio 図は表示でテーマ・webfont を継承し、
  pptx では XML 構造から native 変換される。両経路の一致検証は
  既存 QA ゲートが担う。
- 部分ラスタライズ + z 順 interleave は健全（両側の z が決定的なため）
  であり、「全て」を初期条件から到達目標へ変換する装置になる。
  劣化（連動編集の喪失）は被覆レポートで可視化する。
- 表示レンダラは viewer.min.js（Apache-2.0、全 stencil 同梱）を
  第一候補、maxGraph を変換器参照実装 + 将来の乗り換え先とする。
- サイズ契約（宣言サイズ + bbox lint + 変倍なし）とテーマ準拠契約
  （パレット・フォント・アイコン・ラベルサブセット lint）を
  テーマ定義から一元導出することで、「slidev にきれいに埋め込む」
  ための統制を作図時（プロファイル）と CI（lint）の両面で敷ける。
- 残る主要リスク: viewer.min.js のバンドルサイズと API 安定性、
  stencil→custGeom コンパイラの実装規模、html=1 ラベルの
  サブセット設計。いずれも ADR（drawio 入口の採否）で
  トレードオフとして扱う。

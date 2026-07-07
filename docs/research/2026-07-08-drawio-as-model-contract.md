# 調査: drawio（mxGraph XML）をモデル表現契約とする案の考察（2026-07-08）

日付: 2026-07-08。不変の調査スナップショット。
関連: [要求 2026-07-08 図の作成フロー](../requirements/2026-07-08-diagram-authoring.md)、
ADR-0018。一次資料: tech-slide ADR-0001 D6（drawio 採用→廃止の実装経験）、
tech-slide DESIGN.md「drawio → SVG（例外経路）」、
figures/sample-illustration.drawio（実物 XML）、hediet.vscode-drawio 拡張の
.drawio.svg 二重形式仕様。

## 1. 案の内容

図の正準表現を自前スキーマ（*.diag.yaml）ではなく drawio の
mxGraphModel XML（.drawio または .drawio.svg）とし、
canvas UX は draw.io エディタ（web/desktop/VS Code 拡張）を流用する。

## 2. この案が強い点

- **canvas エディタが無償で手に入る**。特に hediet.vscode-drawio は
  VS Code 内で .drawio / .drawio.svg を GUI 編集し、保存はファイルへの
  書き戻しで行う。「ファイルが唯一の真実 + 書き戻し」（FR-D2）と
  機構的には完全に整合する。agent は XML を編集し、ユーザーは canvas を
  操作し、同一ファイルで合流できる。
- **.drawio.svg 二重形式**: SVG として表示可能かつ mxfile XML を内包する
  単一ファイル。ビューアと編集ソースの分離問題が形式レベルで解ける。
- 形式はテキスト XML であり、diff・VCS 管理は成立する（NFR-D1 の半分）。

## 3. 決定的な弱点（テーマ・フォント・アイコン）

実物（figures/sample-illustration.drawio）で確認できるとおり、
mxCell の style は文字列
`fillColor=#e6ecff;strokeColor=#24292f;fontFamily=OctoBiz;fontSize=16;...`
であり、**すべて実値のリテラル**である。

1. **テーマ継承が原理的に無い**。Diag 系は塗りをトークン名
   （fill="zoneInner" 等）で持ち、実色は `--diag-*` CSS 変数を
   テーマ（7 種、light/dark）が所有する。drawio には CSS 変数も
   トークン間接参照も存在せず、色は作図時に凍結される。
   dark テーマ切替・テーマ差し替えのたびに全図の XML を書き換えるか、
   「特定 hex 値をトークンとみなして描画時に翻訳する」写像層を
   置くことになる。後者はエディタ上の見た目（リテラル色）と
   Slidev 上の見た目（テーマ色）が乖離し、canvas UX の
   「見たまま編集」という価値自体を毀損する。
2. **フォント**。fontFamily=OctoBiz はリテラル指定であり、drawio
   エディタ側にカスタムフォント設定を配らないと編集画面では
   代替フォントで描画される（メトリクス乖離 → 配置判断が狂う）。
   SVG export 経路ではフォントサブセット埋め込みが必要
   （tech-slide の figures:normalize が現にそれを実装している）。
3. **アイコン**。Diag 系は `/icons/...`（Slidev dev サーバ配下）を参照する。
   drawio エディタは Slidev サーバの外で動くため相対 URL を解決できず、
   旧実装ではデータ URI 埋め込みで迂回していた（後述 D6 で
   「不要になった基盤」として列挙されている）。

## 4. 先行実装の教訓（tech-slide ADR-0001 D6）

drawio は本デッキ基盤で**一度本採用され、廃止済み**である。実装は
headless export（Electron + Xvfb）、フォントサブセット埋め込み、
データ URI アイコン、XML 直接解析による editable PPTX 変換、
作図規則 lint まで到達していた。廃止理由:

> editable 変換の前提として lint で強制したサブセット（絶対座標の
> 角丸矩形 + アイコン + 直交コネクタ + source/target 接続エッジ）は
> **drawio の GUI 自由度を奪った結果、Vue で直接表現できる範囲と一致**した。

つまり「editable pptx へ写像可能な意味論」を担保しようとすると、
drawio の利点（GUI の自由）を lint で削り落とすことになり、
最終的に残る表現力は Diag 語彙と同型になる。残るのは
export 基盤・フォント埋め込み・アイコン迂回という運用コストだけだった。

当時と今回の差分は UC-D2（canvas 双方向 UX）の要求が新規に
立ったことである。この差分は「エディタ無償入手」の価値を復活させるが、
§3 の乖離問題（テーマ・フォント・アイコンがエディタ内で再現されない）
により、入手できる canvas は「見たまま」ではなく「トポロジーと
おおまかな配置の編集」に留まる。

## 5. 意味論の搬送問題（UC-D1 との関係）

mxCell style は表示指示の羅列であり、Diag 語彙が持つ意味論
（zone/node/emphasis の別、straddle、frameless 等）を持たない。
搬送するには UserObject のカスタム属性に載せることになるが、
drawio エディタはその属性を理解も検証もしないため、
編集のたびに意味論が壊れうる。結局スキーマ検証と lint を
外付けすることになり、自前スキーマ案と同じ統制コストを
「より緩い形式の上で」払う構図になる。

## 6. 中間案の評価: drawio を交換形式に限定する

正準は *.diag.yaml のまま、drawio XML を**双方向変換の交換形式**として
扱う案（model ↔ mxGraph サブセット変換器を書き、canvas 編集したい時だけ
drawio に落として書き戻す）:

- Good: 正準側のテーマ・フォント・アイコン・意味論は無傷。
  canvas UX を「当面のつなぎ」として安価に得られる。
- Bad: 変換器の往復で落ちる情報（escape hatch、トークン、edge の
  自動経路）を管理する必要があり、編集セッション中はエディタ表示が
  テーマ非適用のまま。
- 評価: canvas エディタ自前実装（ADR-0018 が別 ADR に委ねた領域）が
  重いと判明した場合の代替として保持する価値はある。ただし最初から
  これを本線にすると §4 と同じ統制コストが先に立つ。

## 7. 製品としての反転視点: 「drawio 全表現 + Slidev テーマ → editable pptx」

ユーザー提起の再解釈（2026-07-08）: §3-§5 は「drawio を Diag 語彙の
搬送形式にする」前提の評価だった。逆に、**drawio で表現できる全てを
受け入れ、Slidev テーマを適用したうえで editable pptx 化する変換器**を
プロダクトの中核とみなすとどうか。D6 の教訓（サブセット lint で
自由度を奪うと Diag と同型になる）を、「変換器の被覆域を drawio の
表現力側へ広げる」ことで反転させる案である。

### 7.1 この視点で成立する根拠

- **drawio XML は完全な宣言的シーングラフ**である。mxGraph の描画は
  CSS カスケードにも DOM 実測にも依存せず、XML から決定的に定まる。
  つまり landscape 調査 §Figma の知見（構造化データ入力が native
  忠実度の条件）がそのまま適用でき、**ブラウザ不要のモデル→モデル
  純変換**として drawio → OOXML を実装できる。HTML 実測経路より
  忠実度の上限が高い。
- **市場空白が確認できた**（2026-07-08 web 調査）。drawio →
  editable pptx の直接変換は存在せず、既存経路は画像化（非編集）、
  SVG→pptx オンライン変換（grouped vector 止まり）、Lucidchart /
  Visio 経由（部分的・有償/要 Visio）のみ。drawio の巨大な利用者層に
  対し「編集可能な PowerPoint に出す」手段が無い。
- **drawio シェイプの大半は stencil XML（パス定義）**であり、
  OOXML custGeom（PptxGenJS で完全サポート確認済み）への機械的
  コンパイルが原理的に可能。シェイプ被覆は個別対応ではなく
  「stencil→custGeom コンパイラ」1 本で償却できる。
  gradient（drawio: gradientColor/gradientDirection → OOXML gradFill、
  ADR-0015 の後処理層）も両側 native で対応が付く。
- **エディタ統制は Configuration 配布で可能**（一次確認）:
  customFonts、カスタムカラーパレット（colorSchemes）、
  defaultVertexStyle、カスタムシェイプライブラリを設定ファイルで
  配れる。hediet 拡張は .vscode 配下の設定でワークスペース共有できる。
  つまり「テーマから生成したエディタプロファイル」を配布すれば、
  作図時点でトークン化可能な色・フォント・アイコンに誘導できる。

### 7.2 テーマ・フォント・アイコンの扱い（§3 の再評価）

§3 の「間接参照が無い」事実は変わらないが、対処の形が変わる:

- **色**: テーマの `--diag-*` / palette 実値から drawio 用
  colorSchemes + defaultVertexStyle を**生成**して配布し、変換器側は
  「テーマ由来 hex → トークン」の逆引き表で意味論を回復する。
  逆引きに失敗した色はリテラルとして通す（テーマ切替に追随しない
  ことを lint が警告する、fail-soft）。エディタ内の見た目は
  「その時点の light テーマの実色」であり、乖離は dark 変換時のみ。
- **フォント**: customFonts 設定に OctoBiz / UDEV Gothic を宣言し
  ローカルインストールを前提とする（エディタ内メトリクスも一致）。
  変換器はテーマのフォント指定へ写像。pptx 側は EOT 埋め込み
  （ADR-0003）で自己完結。
- **アイコン**: `/icons/` セットから mxlibrary（カスタムシェイプ
  ライブラリ、data URI）を**生成**して配布。drawio ファイルは
  自己完結になり、変換器は data URI → pptx 画像として扱う。
  生成元が同一なので Slidev 側アイコンとの同一性も保たれる。

いずれも「テーマ → エディタプロファイル生成」という一方向の
ビルドステップで、drawio 形式自体への改変は不要。

### 7.3 残る本質的コスト

- **被覆域の広さ**: 「drawio で表現できる全て」は膨大
  （HTML ラベル（html=1 のリッチテキスト）、swimlane/table、
  sketch/rough 描画、フリーハンド、組み込み図形数百 + 公式
  ライブラリ群）。stencil コンパイラで幾何は償却できても、
  HTML ラベル → テキストラン変換は小さな HTML サブセット問題として
  残り、sketch 系はラスタライズ落ちが妥当。**FR-13（fail-hard）と
  被覆レポートを最初から備えた段階的拡大**が必須で、
  「全て」は到達目標であって初期条件にできない。
- **Slidev 表示側**: 図の表示も drawio XML から行う必要がある
  （mxGraph viewer 埋め込み、またはビルド時 SVG 生成 +
  トークン置換）。Diag コンポーネント描画とは別系統の
  レンダラを持つことになる。
- **Diag 語彙との関係**: 本案は Diag/自前スキーマの置き換えではなく
  「第 2 の契約入口」。入口が 2 つになる分、requirements の
  トレードオフ表（fidelity/editability per element class）を
  drawio 要素クラスに対しても定義する必要がある。

### 7.4 プロダクト戦略上の意味

本案を採ると、プロダクトの重心が「Slidev addon」から
「**宣言的シーングラフ → themed editable pptx コンパイラ**
（入口: Diag モデル / drawio XML、出口: PptxGenJS + 後処理層）」へ
一般化する。Slidev 統合はその 1 消費者になる。商業的勝利を目的と
しない方針（ADR-0016 の前提）とも整合し、むしろ市場空白
（§7.1）ゆえに OSS としての独自価値が最大の領域である。

## 8. 結論

- 「Diag 語彙の搬送形式として drawio を使う」案（§1-§6）は棄却が
  妥当（テーマ間接参照の欠如、意味論搬送のコスト、D6 の反証）。
- 「drawio の表現力を被覆対象とし、テーマ適用つき editable pptx
  変換器をプロダクト化する」案（§7）は**別個の製品方向として
  成立しうる**。決定的シーングラフ（ブラウザ不要変換）、市場空白、
  stencil→custGeom の機械的償却、エディタプロファイル生成による
  テーマ統制、がそれを支える。コストは被覆域の広さと表示側
  レンダラの二重化であり、fail-hard + 被覆レポート前提の段階的
  拡大が条件。
- hediet 拡張の「ファイル書き戻し型 canvas」UX は、どちらの案でも
  FR-D2 の実装規範となる。
- 採否は ADR で扱う（ADR-0018 の改訂または別 ADR）。

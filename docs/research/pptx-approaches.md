# PPTX アプローチ調査抜粋

抜粋元: fuj1g0n-demo-01/tech-slide docs/research-adversarial-comparison.md（2026-06-17）・docs/design-evolution-2026-07.md（2026-07-03〜04）。ADR-0011 の観点仕訳けで移設（2026-07-07）。

この文書は、editable PPTX 変換基盤に関係する箇所だけを抜粋したアーカイブである。本文は要約で潰さず、元文書の表現を保つ。

---

## 0. 最初に潰すべき最大の分岐点（結論を分けるのはここだけ）

要件「**絵やダイアグラムを含めて編集・修正できる（AIが描き、人間が直す）**」と
「**PowerPoint（.pptx）資料を作る**」は、技術的に**真っ向から衝突する**。
ここを決めないと、どのツールも「正解にも不正解にもなる」。

最終成果物の解釈は3通りあり、選べる技術が排他的に決まる：

| 解釈 | 「編集可能」の意味 | 取りうる技術 | .pptxで開ける？ |
|---|---|---|---|
| **A. ソースが正（source of truth = テキスト）** | Markdown + ダイアグラムコードを人間が直し再ビルド | Marp / Slidev / Quarto(revealjs) / Beamer / Typst | △（出力はHTML/PDF。pptxはラスタ画像で非編集） |
| **B. ネイティブ.pptxが正** | PowerPointで図形・テキストを直接いじる | Pandoc(pptx) / Quarto(pptx) / python-pptx | ◎（本物の編集可能テキスト/図形） |
| **C. ハイブリッド** | スライド枠はソースが正、図だけ編集可能な中間形式 | 上記 + draw.io(XML埋込) / Excalidraw(JSON) | 図はB相当、枠はAまたはB |

**この文書の主張**：技術者向け技術営業で「AI slop回避・一次情報検証・情報密度」を最優先するなら、
**AまたはCが工学的に正しい**。Bの「ネイティブpptx生成」は一見要件に合うが、後述のとおり
**ダイアグラムは結局フラット画像になり**、レイアウト制御も貧弱で、git差分も実質機能しない。
ただし「客先がpptxファイルを要求する」という**営業上の制約**がBを強制することがある。
→ 推奨は §6 の2案として提示し、最後にあなたへの確認事項を置く。

---


---

## 3. PPT 専門スキルの敵対的比較

| 候補 | 機構 | editable | 告発 |
|---|---|---|---|
| [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master)（MIT, ★36k, 2025-12〜） | AI が SVG を描画 → `svg_to_pptx.py` が python-pptx で native DrawingML へ変換（claim-0008） | ◎ 真に編集可能 | **ソースが SVG であり Markdown ではない**。textlint 資産（本リポジトリの中核）が適用不能。対話セッション前提で CI 不可。日本語の行折返し・フォント代替は未整備。基盤の python-pptx は 2024-08 以降更新停止（open issues 534） |
| [anthropics/skills の pptx skill](https://github.com/anthropics/skills) | PptxGenJS（native OOXML・チャートも編集可）+ OOXML 直接編集 | ◎ | プロプライエタリ。Claude 環境前提。ソースは JS コードで、著者体験は前回調査で python-pptx を不採用にした理由と同じ |
| [MartinPacker/md2pptx](https://github.com/MartinPacker/md2pptx)（MIT, ★508） | 独自 Markdown 方言 → python-pptx | ◎ | テキストソースで CI 可能な唯一の direct 経路だが、表現力はテンプレの placeholder 制約に縛られ Marp の視覚品質に届かない。個人メンテ + python-pptx 停滞リスク |
| [presenton/presenton](https://github.com/presenton/presenton)（Apache-2.0, ★8.7k） | Web アプリ（HTML/Tailwind → PPTX） | △ 自称 | git 管理不能（状態はアプリ内）。エンジニアの Docs-as-Code と正面衝突 |

---

## 4. Marp / Slidev → editable PPTX の現状

- **Marp CLI `--pptx-editable`**：v4.1.0（2025-01-15）導入、v4.4.0（2026-05）でも
  experimental（claim-0004）。機構は **PDF を LibreOffice Impress で PPTX に変換**する
  二段変換で、公式 README が「複雑なテーマはエラーか不完全な出力」
  「発表者ノート非対応」「再現性はほかの形式より低い」と明記する。
  CSS テーマは意味的に消滅し、日本語はフォント代替と文字単位のテキスト分断が起きる。
- **Slidev**：公式ドキュメントが「PPTX 内の全スライドは画像として出力され、
  テキストは選択不可」と明記（claim-0005）。編集可能化の公式な動きはない。
- **コミュニティ**：[ebibibi/marp2pptx](https://github.com/ebibibi/marp2pptx) が
  Marp Markdown を直接パースして python-pptx で再構築する（CJK 対応・自動フォントサイズ）。
  ただしカスタム CSS テーマは無視され、独自 YAML 設定で置き換える。
- **逆方向**：[microsoft/markitdown](https://github.com/microsoft/markitdown) で
  pptx → Markdown 抽出は可能だが、Marp 構文への round-trip は存在しない。

**結論**：Markdown（CSS レイアウト・リフロー前提）と PPTX（EMU 絶対座標・リフローなし）は
構造的に不整合であり、「Marp 同等の体験 + 高忠実な editable PPTX」は 2026 年時点の
どのツールでも成立しない。これはツールの成熟度ではなくアーキテクチャの問題で、
待っても解決しない。

### 4-1. 追補（2026-07-03）：SVG 経由の検討 — 不成立

Marp / Slidev から編集可能テキストを持つ SVG を得る経路を追加調査した。

- Marp CLI の `--images` は png / jpeg のみ。Marpit の HTML は `<svg><foreignObject>`
  構造でブラウザ専用（ppt-master も foreignObject を明示的に禁止している）。
- PDF → SVG（pdftocairo）はグリフのパス化でテキスト消滅、mutool の `-O text=text` は
  日本語が康熙部首の符号位置に化ける（手元検証）。
- 結論：SVG 中間表現の路線は取れない。

### 4-2. 追補（2026-07-03）：HTML 実測方式の発見 — D6 の実装を更新

「Markdown と PPTX の構造的不整合」の結論を覆すものではないが、**変換の忠実度**を
大きく改善する実装が見つかった。
[KatsuYuzu/marp-to-editable-pptx](https://github.com/KatsuYuzu/marp-to-editable-pptx)
（MIT、v1.2.0 2026-05-31、claim-0009）は PDF → LibreOffice の二段変換ではなく、
**Chromium で Marp の HTML を描画し、`getComputedStyle` / `getBoundingClientRect` で
全要素の位置と書式を実測して PptxGenJS のネイティブ図形として再構築**する。

本リポジトリの deck.md（8 枚）で実変換した結果：

- 日本語テキスト・表・シンタックスハイライト付きコード・ページ番号が
  すべて編集可能要素になる（フォント指定 Yu Gothic UI / Cascadia Code も保持）。
- D2 図は PNG + SVG のペア（PowerPoint の svgBlip 形式）で埋め込み。画像のままで
  ネイティブ図形にはならない。
- LibreOffice で開いた見た目は元の Marp 出力とほぼ同一。

既知の制約：Star 9 の個人プロジェクト（SHA 固定の git 依存で導入し、更新は手動レビュー）、
npm 未公開、受け手のマシンにフォントがなければ再フローする（本テーマはシステムフォント
指定のため実質問題なし）。LibreOffice 直接変換（`soffice --convert-to pptx deck.html`）は
HTML が Writer 文書として読まれ export filter がなく失敗することを手元で確認済み。
Pandoc は Marp のスライド境界を認識しない。

これを受けて D6 の実装を更新した：`npm run build:pptx:editable` は
marp-to-editable-pptx（scripts/build-pptx-native.mts）を使い、旧 LibreOffice 経路は
`build:pptx:libreoffice` としてフォールバックに残す。
**PPTX が要求時のみの一方向デリバリである原則は変わらない。**

### 4-3. 追補（2026-07-03）：フォント同梱と PPTX 全字埋め込み — 「フォントがなければ再フロー」の解消

§4-2 の残課題「受け手のマシンにフォントがなければ再フローする」を解消した。

**フォントの決定。** 本文フォントを Windows 依存の Yu Gothic UI から
[OctoBiz](https://github.com/Songmu/OctoBiz)（v0.1.0、SIL OFL 1.1、Mona Sans + BIZ
UDPGothic 合成、claim-0011）へ変更し、コード用の Cascadia Code（OFL 1.1）とともに
`fonts/` に同梱した。両者とも fsType=0（installable）で、埋め込み・再配布とも許諾済み。
Marp（Chromium）描画には flake devShell が `FONTCONFIG_FILE` で `fonts/` を注入し、
CI（ubuntu）では `~/.local/share/fonts` へコピーして使う。環境によらず同一描画になる。

**埋め込みの実装。** `scripts/build-pptx-native.mts` の後処理 `embedFonts()` が
fonts/*.ttf を fonteditor-core で EOT 化し、OOXML の `embedTrueTypeFonts="1"` +
`<p:embeddedFontLst>` + `ppt/fonts/fontN.fntdata`（application/x-fontdata）として
注入する。編集・配布用途のため subset ではなく全字埋め込み（saveSubsetFonts なし）。
成果物は約 5.3MB。

**検証で判明した要点（claim-0010）：**

- fntdata に生 TTF を入れると PowerPoint は黙って無視する。**EOT 形式が必須**
  （対照実験で確認）。PowerPoint 自身の出力は EOT v2.2（MTX 圧縮）だが、
  fonteditor-core の EOT v2.1（非圧縮）も受理される。
- 実 PowerPoint 16.0 で開き PDF 出力すると、フォント未インストール環境でも
  埋め込みフォント由来の匿名サブセット名で描画される（pdffonts + 目視で確認）。
- LibreOffice / Google Slides は読み側で埋め込みフォントを無視し代替表示になる。
  受け手が PowerPoint であることが埋め込みの効果条件。
- marp-to-editable-pptx の `cleanFontFamily` は日本語テキストに対し CSS スタック中の
  既知日本語フォント名を優先する。テーマのフォント指定は `"OctoBiz", sans-serif` の
  単一候補にしないと typeface 名が埋め込みと一致しなくなる。Marp default テーマの
  `--fontStack-monospace`（Consolas を含む）も上書きが必要。

---

---

## 5. 決定

| # | 決定 | 根拠 |
|---|---|---|
| D1 | **Marp 主体を維持。PPT 主体への転換は不採用** | §4。editable PPTX で Marp 同等の体験は不成立。textlint 資産は Markdown ソースが前提 |
| D2 | **デザイン層を新設**：`DESIGN.md`（トークン宣言）+ `lint:design`（CSS との整合 CI） | §2。検証可能なデザイン層は DESIGN.md 形式のみ。文章品質と同じ「予防 + 検証」二重化 |
| D3 | **SKILL.md にデザイン規範を追加**：アンチデフォルト規律 + レイアウト語彙 | §2。taste-skill / Anthropic frontend-design の思想を独自に書き起こす（転記はしない） |
| D4 | **視覚 QA ループを規定**：`marp --images` → agent が点検 → 修正 | Anthropic pptx skill の視覚 QA 概念の独自実装。placeholder 検出は `lint:facts` で CI 化 |
| D5 | **引用 Lint を実装**（`lint:facts`）：単位付き数値に claim 参照がなければ fail | §1。前回調査 §4-3 の宣言倒れを完済 |
| D6 | **PPTX は「要求時のみの一方向デリバリ」と明文化** | §3・§4。編集可能 PPTX は marp-to-editable-pptx の HTML 実測方式（§4-2、claim-0009）、旧 LibreOffice 経路と画像 `--pptx` はフォールバック。round-trip はしない。PowerPoint 上の編集はソースに手動で還元する |
| D7 | **Marp から Slidev へ移行（2026-07-04 追補参照）** | ページ単位のモジュール化（`src:`、claim-0013）と Vue による図の表現力が references/ 移植の要件。editable PPTX は自作ツールで継承 |

### 不採用としたもの

- **ppt-master の導入**：品質は本物だが、ソースが SVG になり textlint・claims 参照・
  git diff の意味性という本リポジトリの根幹をすべて失う。
- **taste-skill / anthropics スキルの直接インストール**：前者はスライド対象外、
  後者はライセンス制約。SKILL.md の外部ロード禁止（セキュリティ §6）にも反する。
- **Quarto / Pandoc pptx への移行**：前回調査から状況の変化なし（レイアウト 7 種固定）。

### 追補（2026-07-04）：D7 — Marp から Slidev へ移行

D1（Marp 主体の維持）を、最終ゴールの具体化を受けて更新した。

**動機**。本リポジトリの最終ゴールは references/ にある手作り PowerPoint 資料
（9 デッキ・16〜73 枚・手描きインフォグラフィック多数）の移植と定めた。要件は
(1) 複雑な図の表現力、(2) ページ単位のモジュール化（モジュールページからのデッキ合成）。

**比較の結果**（PoC 2 回で検証）:

- ページ取り込み: Slidev は frontmatter `src:` で公式サポート（claim-0013、手元で動作確認）。
  Marp（Marpit）には include がなく、upstream が追加を拒否している（marp-team/marpit#227）。
  要件 (2) は Marp では満たせない。
- 図の表現力: Slidev は Vue コンポーネント + UnoCSS + Iconify が使え、
  繰り返し構造のインフォグラフィックをパラメトリックに記述できる。Marp は CSS のみ。
- editable PPTX: Slidev 公式 export は画像ベース（claim-0014）だが、
  marp-to-editable-pptx の思想（描画済み DOM の実測 → PptxGenJS ネイティブ図形）を
  継承した自作ツール scripts/slidev-editable-pptx.mjs で同等以上の忠実度を PoC で確認
  （フォントサイズ・表・コード・図・フォント全字埋め込みすべて動作）。
  D6 の「要求時のみの一方向デリバリ」は変更なし。
- 検証層: textlint / lint:facts / lint:design / lychee はすべて Markdown ソースが対象のため
  移行の影響なし。テーマは themes/tech.css から themes/tech/（styles + layouts/*.vue）へ移植し、
  DESIGN.md のトークンと lint:design の双方向整合は維持した。

**トレードオフ**。単一 HTML 出力は失われ `slidev build` の SPA になる。テーマが CSS 単体から
Vue コンポーネントになり学習コストが増える。dev server 前提の変換のため editable PPTX の
生成に数十秒かかる。いずれも最終ゴールの要件 (1)(2) に劣後すると判断した。

---

### 追補（2026-07-04）：Mermaid 一本化の検証 — D2 維持を再確認

Slidev が Mermaid をネイティブ対応していることから、D2 を廃止して Mermaid に
一本化できるか実測検証した（page 4 の D2 図を flowchart に移植し、mmdc 11.10 で
devShell（OctoBiz 注入済み）から SVG 生成、D2 出力とスクリーンショット比較）。
結論は**不採用（AD-8 の二本立てを維持）**。

比較結果（実測）:

| 観点 | D2 | Mermaid (mmdc) |
|---|---|---|
| フォント | woff サブセットを `@font-face` で SVG に埋め込み（自己完結） | `font-family` の名前参照のみ。埋め込みなし |
| アイコン | data URI で SVG に埋め込み | `img` shape はローカルパスを href 参照するだけ。描画も破綻 |
| ラベル | `<text>` 要素 | 既定は `foreignObject`（HTML ラベル） |
| 日本語折返し | 制御可能 | `htmlLabels:false` にすると `facts/claims<改行>.yaml` のような単語中間の強制折返しが発生 |

不採用の決定的理由:

1. **SVG の自己完結性の喪失（R8/R11 違反）**。editable PPTX は図 SVG をそのまま
   埋め込むため、フォント未埋め込みの Mermaid SVG は受け手の環境でフォールバックする。
   回避には woff サブセット化 + `@font-face` 注入の自作後処理が必要で、
   drawio 廃止で捨てたフォント埋め込み機構の再構築になる。
2. **foreignObject 問題**。Mermaid 既定（および Slidev ネイティブ描画）の HTML ラベルは
   `foreignObject` を含み、PowerPoint の SVG レンダラが非対応のため PPTX で
   テキストが消える。`htmlLabels:false` で回避すると折返し品質が崩壊する（上表）。
3. **Slidev ネイティブ描画は統制層を素通りする**。boundary 契約
   （diagram-bounds.mjs のサイズ検証 + 0.5 倍固定）、manifest 出自宣言（ADR AD-9）、
   lint-design の図ソース走査のいずれも通らない。
4. 一本化で得られるのは flake から d2 バイナリ 1 つの削減のみ
   （mmdc 側の headless Chromium 依存は残る）。

Mermaid の優位は sequence 図などの記法の簡潔さだけであり、それは現行の
`diagrams/*.mmd` → mmdc 事前レンダリング経路（同一 boundary/manifest 統制下）で
既に利用できる。

**後日追記（同日）**: 本検証の後、「D2 の残存価値 = 自動レイアウト」自体が
本リポジトリの制作体制（Coding Agent + 視覚 QA ループ、空間配置に意味を持つ図が
支配的な実デッキ）では低いと判断し、D2 / Mermaid を含む外部作図ツールを全廃して
Vue コンポーネント（Diag*）に一本化した。boundary 契約・manifest 出自宣言・
フォント注入を含む事前レンダリング機構も撤去した（ADR-0001 AD-8 改訂参照）。

**後日追記 2（同日）**: Vue で再現困難な複雑図（曲線・イラスト調など）に限り、
drawio → SVG のフラット画像埋め込みを例外として許可した。原本 XML の commit・
`figure-normalize.mjs` による自己完結化（viewBox / light-dark 畳み込み /
フォントサブセット埋め込み）・`lint:figures` による強制を条件とする
（ADR-0001 AD-8 例外条項参照）。

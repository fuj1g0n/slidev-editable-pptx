# 調査: editable PPTX 生成ツールのランドスケープ（2026-07-08）

日付: 2026-07-08。不変の調査スナップショット。
requirements [2026-07-08-generic-pptx-walker.md](../requirements/2026-07-08-generic-pptx-walker.md) §7 の根拠。
調査手段: 各リポジトリ・公式ドキュメントの一次ソース実査（research agent 2 回）。

## 1. 検証の目的

- 「ブラウザ描画 HTML → native shape の editable PPTX」を解く既存ツールの有無
- 出力バックエンドの機能境界（グラデーション gradFill / グループ p:grpSp）
- 前版 requirements（2026-07-06）が依拠した外部事実の裏取り

## 2. 出力バックエンド比較

| ライブラリ | gradFill | p:grpSp 生成 | 備考 |
|---|---|---|---|
| PptxGenJS v4.0.1（現用） | ❌ fill は none/solid のみ。gradFill 生成コード 0 件（src/gen-utils.ts genXmlColorSelection、core-interfaces.ts:174-201） | ❌ grpSp は spTree ルートラッパーのみ | custGeom は moveTo/lnTo/cubicBezTo/quadBezTo/arcTo/close 完備。addImage sizing contain/cover/crop。text: wrap(bool)/fit(none\|shrink\|resize)/run 単位 breakLine。矢じり 6 種（サイズ指定は FUTURE） |
| python-pptx | ❌ API なし（issue #299 長期未解決）。OxmlElement 直接注入のみ | ❌ 読み取りのみ、新規生成不可 | |
| OpenXML SDK (.NET, MIT) | ✅ raw XML | ✅ | 低レベル。DrawingML スキーマ直書き |
| Aspose.Slides（商用） | ✅ 全種 | ✅ | 最も網羅的。ライセンス費用 |
| GemBox / Syncfusion（商用 .NET） | ✅ | ✅ | Syncfusion は community license あり |
| officegen (npm) | ❌ | ❌ | 2020 年以降未保守 |

結論: JS エコシステムで native gradFill / grpSp を出すには
**PptxGenJS の出力 zip への XML 後処理**（本リポジトリはフォント埋め込みで
同型の実績あり）しか現実的な経路がない。

## 3. 同目的ツール（HTML/Markdown → PPTX）

### 3.1 DOM 実測型（直接競合）

- **atharva9167j/dom-to-pptx**（npm v2.0.3、~270 star、月 23 万 DL）:
  getComputedStyle で Flexbox/Grid の解決済み座標を取得し PptxGenJS へ写像。
  headless CLI あり。@font-face 由来フォントの自動埋め込み、PowerPoint
  ネイティブのアニメーション XML 生成が差別化点。
  ただし: CSS グラデーションは **SVG 画像埋め込み**（native gradFill でない）、
  DOM 内 SVG は挿入後に手動「図形に変換」前提、グループ化なし
  （PptxGenJS の制約を継承）。ライセンス未確認。Slidev での動作は未検証。
- **KatsuYuzu/marp-to-editable-pptx**（VS Code 拡張、MIT）: dom-walker.ts
  2520 行。bg/border/radius/shadow のコンテナ検出、foreignObject・CSS filter・
  グラデーションは rasterize フラグ。線・矢印・コネクタの概念なし。
  前版 requirements §2.2 の記述は正確と確認。
- **ddzeeuw1-ai/revealjs-to-pptx**（Python + BeautifulSoup）: CSS 実測でなく
  クラス名によるスライド型判別（6 型固定）。特定デザインシステム専用。

### 3.2 テンプレート充填型（非競合）

- **Pandoc pptx writer / Quarto format: pptx**: Markdown AST → reference doc の
  named placeholder へ充填。認識レイアウトは 7 種固定。絶対座標レイアウトの
  再現は構造的に不可能。全テキスト native（編集性は高いが忠実性の概念がない）。
- **remark / Deckset / presenterm / maaslalani/slides / slidesdown**:
  PPTX 出力経路なし（PDF またはスクリーンショットのみ）。

### 3.3 PDF 経由

- **marp-cli --pptx-editable**: PDF → LibreOffice impress_pdf_import。
  README が不完全出力を明記（"may throw an error or output the incomplete result"）。
- **Adobe PDF Services API**: クラウド REST で PDF→PPTX。LibreOffice より
  高品質だが複雑なベクタはラスタ化。ローカル CLI なし・要クレデンシャル。
- **pdf2pptx (PyPI)**: ページ PNG 貼付のみ。editable ではない。

### 3.4 SVG → DrawingML

- **JoeyHwong-gk/svg2pptx**（Python ≥3.11、MIT）: SVG path 全コマンド →
  custGeom、`<g>` → p:grpSp、線形/放射グラデーション → **native a:gradFill**、
  text → TextBox。native gradFill + grpSp を両方出す唯一の OSS。
  Node パイプラインからは言語跨ぎになる点が難。
- benouinirachid/svg2pptx（PyPI）: 基本図形のみ。曲線はポリライン近似、
  グラデーション非対応。保守停滞。
- Inkscape SVG→EMF→「図形に変換」: テキストがアウトライン化され編集不能。
  グラデーションは帯状に劣化。

### 3.5 AI / 商用プラットフォーム

- Gamma / Tome: PPTX エクスポートあり。複雑な要素はラスタ化されがち。
- Beautiful.ai / Canva: テキスト・基本図形は native。装飾は部分的。
- **Figma → PPTX プラグイン群**（FigDeck MIT ほか）: native 図形 + gradFill +
  グループを実現。ただし方式は CSS 実測ではなく **Figma Plugin API の
  構造化ジオメトリ**（ベクタ・グラデーション stop・フォントを構造データで
  取得）。「レンダリング結果を測る」のではなく「設計データを読む」アプローチで、
  ブラウザ HTML には移植不能。本ツールの Layer 1（宣言契約）は、この
  「構造データを渡す」経路を HTML 側で人工的に作る試みと位置づけられる。

## 4. 総合評価

- ブラウザ描画 HTML → native editable PPTX を完全に解く既存ツールは無い。
  最接近は dom-to-pptx だが、グラデーション・SVG・グループの 3 点で
  native 化に届かない（いずれも PptxGenJS の API 境界に起因）。
- 差別化の核は (a) Layer 1 宣言契約（Figma 型の構造データ経路の HTML 版）、
  (b) XML 後処理による PptxGenJS 境界の突破（gradFill / grpSp）、
  (c) 実測行分割によるテキスト折返し忠実性（ADR-0012）、
  (d) PowerPoint 実機 QA ゲート（ADR-0013）。
- CSS linear-gradient → a:gradFill の角度変換は
  `ooxml_ang = (90 − css_deg) × 60000`、stop 上限 10（ECMA-376 §20.1.8.33）。

## 5. 留保事項

- dom-to-pptx のグラデーション実装は README 記述からの解釈（コード実査未実施）。
- 二次情報に「PptxGenJS は 2-stop gradient 対応」という記述が存在するが、
  v4.0.1 ソース直接検証と矛盾するため不採用。
- pglavin/html-to-pptx は GitHub 404（実在しないものとして扱う）。

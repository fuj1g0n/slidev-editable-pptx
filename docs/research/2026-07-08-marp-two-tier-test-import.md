# 調査: marp-to-editable-pptx 二段テスト戦略の輸入（2026-07-08）

日付: 2026-07-08。不変の調査スナップショット。
出典: KatsuYuzu/marp-to-editable-pptx@94c5ee9（一次ソース読解:
jest.config.js, jest.setup.js, src/native-pptx/dom-walker.test.ts,
visual-regression.test.ts, ディレクトリ構成）。
関連: docs/research/2026-07-08-heuristics-quality-audit.md §2、ADR-0011、ADR-0013。

## 1. marp 側の実装（確認済み事実）

### 段 1: JSDOM 単体テスト（速い・決定的・CI 常時実行）

- `dom-walker.test.ts`（255KB, describe/it 208 個）+ `slide-builder.test.ts`
  + `utils.test.ts` + `index.test.ts`。Jest, `testEnvironment: 'node'`。
- **JSDOM は手動セットアップ**。`jest-environment-jsdom` は
  jest 30 + node 22 でハングするため、`beforeEach` で `new JSDOM()` を作り、
  `document` / `getComputedStyle` / `Node` / `NodeFilter` / `XMLSerializer`
  だけを globalThis に注入、`afterEach` で削除する。
- **JSDOM はレイアウトを計算しない**ため、2 種のモックヘルパで補う:
  - `mockRect(el, {left,top,width,height})` —
    要素ごとに `getBoundingClientRect` を差し替え。
  - `mockStyles(mappings, pseudoMappings)` —
    `getComputedStyle` を Proxy ベースの style オブジェクトで差し替え。
    `defaultStyles`（display/color/fontSize 等 14 プロパティ）に
    テスト側指定をマージ。`::before`/`::after` の解決もマップで対応し、
    未指定要素は元実装へフォールスルー。戻り値は restore 関数。
- テスト対象は「HTML 構造 + モック済み style/rect → IR（中間表現）」の
  純粋変換。walker のヒューリスティック分岐を DOM フィクスチャ単位で叩く。

### 段 2: 視覚回帰テスト（実 PowerPoint・環境ゲート付き）

`visual-regression.test.ts`（"Gate 3" と命名）:

1. **環境検出をモジュールロード時に 1 回実行**し、
   `describeOrSkip = CAN_RUN ? describe : describe.skip` で suite 全体を切替。
   条件は 3 つ: Chrome（`@puppeteer/browsers` の
   `computeSystemExecutablePath` → 環境変数 `CHROME_PATH` フォールバック）、
   PowerPoint（powershell で `New-ComObject PowerPoint.Application` を試行、
   15 秒タイムアウト）、ビルド済みバンドルの存在。
2. **PPTX 生成は子プロセス**（`gen-pptx.js` を spawnSync）。理由コメントあり:
   pptxgenjs の dynamic import が Jest VM 制約
   （--experimental-vm-modules）と衝突するため。
3. HTML 側スクリーンショット: puppeteer-core + `CHROME_PATH`。
   fragment を CSS 注入で全可視化し、bespoke（hash ナビゲーション）と
   static（SVG 領域 clip）の両ビューアに対応。
4. PPTX 側レンダリング: **PowerShell スクリプトを一時ファイルに書き出し**、
   PowerPoint COM で `Slides(n).Export(path, "PNG", 1280, 720)`。
5. 比較: pixelmatch（threshold 0.12 = アンチエイリアス許容）で
   ピクセル差分率を算出。**fail 閾値 8%**。根拠コメントが明記されている:
   「Chrome vs PowerPoint の通常フォント差は約 2-5%、コードブロック
   overflow は 15% 超になる」— つまり構造的欠陥のみを検出する閾値設計。
6. 差分画像 `diff-slide-*.png` と `gate3-results.txt`（全スライドの
   差分率一覧）を成果物として保存し、失敗メッセージに全結果を埋め込む。
7. 対象は全スライドではなく**既知リスクスライド（末尾 10 枚 =
   コードブロック回帰ケース）に限定**。3 分タイムアウト。

### 特徴の評価

- 強み: (a) suite 単位の自動 skip により同一テストファイルが
  CI（skip）と開発機（実行）で共用できる。(b) 閾値に根拠が書かれている。
  (c) 差分画像 + サマリの成果物化でデバッグ可能。
- 弱み: (a) 対象スライドが「末尾 10 枚」というフィクスチャ位置依存の
  ハードコード。(b) CI に Windows ランナーがなく段 2 は事実上ローカル専用。
  (c) 段 1 のモック style は実ブラウザの computed value と乖離しうる
  （defaultStyles は代表値 14 個のみ）。

## 2. 本リポジトリへの輸入設計

前提: ADR-0011 のモジュール分割（walker = ブラウザ内実測、
builder = 中間 JSON → PptxGenJS の純関数、postprocess = zip 後処理）。
段の割当ては marp と同型だが、境界は本リポジトリの中間 JSON に合わせる。

### 段 1（輸入する・ただし範囲を変える）

- **builder / postprocess のテストは JSDOM 不要**。中間 JSON フィクスチャ →
  生成 XML の検証で足りる（marp より単純になる。walker/builder 分離の利得）。
- **walker のヒューリスティック分岐**（aria-hidden 分岐、iconPlate、
  rasterize 判定基準、pseudo-element 検出）には marp 方式をそのまま輸入:
  手動 JSDOM + `mockRect` / `mockStyles`（Proxy + defaultStyles マージ +
  pseudo マップ + フォールスルー）。この 2 ヘルパは小さく（約 80 行）、
  移植ではなく参考実装として書き起こす。
- ランナーは既存プロジェクト方針に従い node:test を第一候補とし、
  Jest 固有機能（describe.skip 相当は node:test の skip オプション）で代替可。
- モック乖離リスクの緩和: 実 Chromium で採取した computed style を
  フィクスチャ JSON 化して defaultStyles の代わりに与える
  「recorded-style フィクスチャ」を併用できる（marp にはない改良点）。

### 段 2（輸入する・本リポジトリは条件が良い）

- 既存の実機検証手順（WSL → powershell.exe COM、ADR-0013）を
  テストコード化する。marp との差分:
  - **WSL から powershell.exe を呼べるため、開発機で常時実行可能**
    （marp は Windows ネイティブ前提で skip されがち）。パス変換は
    `wslpath -w` + Windows Temp へのコピーが必要（既検証済みの手順）。
  - 環境検出 → suite skip の構造、PowerShell の Export スクリプト、
    pixelmatch 差分率 + 差分画像 + サマリ成果物、はそのまま採用。
  - 閾値は marp の 8% を初期値として借用し、fixture deck での実測
    分布（通常差 2-5%）を確認後に本リポジトリの値へ較正する。
  - 対象スライドは「末尾 N 枚」ではなく fixture deck の名前付き
    スライド指定にする（位置依存ハードコードの回避）。
- CI では段 2 は skip（Linux ランナー）。LibreOffice 代替は
  svgBlip 偽陰性が既知のため使わない（ADR-0013 の帰結を維持）。

### 輸入しないもの

- jest-environment-jsdom 回避のワークアラウンド事情（ランナー選定は独立）。
- gen-pptx.js 子プロセス分離（Jest VM 制約由来。node:test なら不要の見込み。
  必要になった場合のみ同じ手を使う）。
- 末尾 N 枚方式のスライド選定。

## 3. 結論

marp の二段構成（JSDOM モック単体 + 環境ゲート付き実 PowerPoint 視覚回帰）は
一次ソースで確認でき、輸入価値がある。本リポジトリでは ADR-0011 の
walker/builder 分離により段 1 の大部分が JSDOM すら不要な純関数テストに
落ち、また WSL からの COM 呼び出しにより段 2 が開発機で常時実行できるため、
marp より有利な条件で同じ戦略を運用できる。テスト導入は ADR-0011 の
実装作業（モジュール分割）の一部として行う。

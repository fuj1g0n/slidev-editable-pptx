---
status: accepted
date: 2026-07-07
decision-makers: ["@fuj1g0n", "Coding Agent"]
---

# editable PPTX は HTML 実測からネイティブ図形を再構築する

## Context and Problem Statement

Slidev の公式 PPTX export は各スライドを画像としてページ背景に配置する方式で、テキストは編集できない（claim-0005、claim-0014）。一方で、顧客・社内共有の慣行上、PowerPoint で開いて手直しできる PPTX が求められる場面がある。Markdown（CSS レイアウト・リフロー前提）と PPTX（EMU 絶対座標・リフローなし）は構造的に不整合であり、ソースをテキストで保つ要件と PowerPoint 上の編集性は衝突する。

本リポジトリの主眼は、editable PPTX に変換可能な Slidev を構築する仕組みである。したがって、PPTX をソースに戻す round-trip ではなく、Slidev の描画結果を測り、納品物として一方向に再構築する境界を明確にする必要がある。

## Decision Drivers

* Slidev の Vue コンポーネント図、表、コード、和文折返しを、CSS テーマの描画結果に近い座標で PPTX 化できること。
* スライド本文・図・事実のソースはテキストに残し、PPTX は派生成果物として扱うこと。
* 変換器が URL、ファイル名、DOM 構造から図の意味を推測せず、宣言された契約だけで分岐できること。
* 既存の Marp / Slidev / PPTX 近隣ツールを再評価したうえで、採用しない理由を記録すること。

## Considered Options

* Marp CLI `--pptx-editable`
* SVG 中間表現
* LibreOffice 直接変換・Pandoc
* Markdown 直接変換
* ppt-master
* k1LoW/deck
* Songmu/slidown
* mizzy/peitho
* HTML 実測 → ネイティブ図形再構築の一方向デリバリ

## Decision Outcome

Chosen option: "HTML 実測 → ネイティブ図形再構築の一方向デリバリ", because CSS テーマ・日本語折返し・Vue コンポーネントの描画結果を座標の根拠にしつつ、PPTX をソースへ自動還元しない境界を保てるため。

### D1: 一方向デリバリ

PPTX は要求時のみ生成する納品物とする。受け手が PowerPoint 上で行った編集は、必要な場合だけ人間が Slidev ソースへ手動で還元する。生成済み PPTX の差分を自動で Markdown や Vue コンポーネントへ戻す round-trip は実装しない。

この境界により、git diff と lint の対象は引き続きテキストソースに限定される。代償として、PPTX の再生成は全量置換になり、受け手の手動編集は温存されない。

### D2: HTML 実測方式

変換器は Markdown を直接解釈しない。Slidev dev server の per-slide print ビューを Chromium で描画し、`getComputedStyle` と `getBoundingClientRect` で要素の位置・書式を実測する。その実測値から PptxGenJS のネイティブ図形、テキスト、表、コード、画像を再構築する。

この思想は marp-to-editable-pptx（claim-0009）を継承する。Slidev では公式 export が画像ベースであるため（claim-0014）、本リポジトリの `bin/slidev-editable-pptx.mjs` が同じ考え方を Slidev 用に実装する。

### D3: Vue 図はネイティブ図形へ再構築する

Diag\* コンポーネントは HTML 上で描画されるが、PPTX では単なるスクリーンショットにしない。変換器は DOM の実測座標と、コンポーネントが宣言する契約属性を組み合わせ、箱、エッジ、山形、循環、テキスト、アイコンなどを DrawingML の図形として出力する。

プリセット図形は、実測ジオメトリを adjust 値で完全に再現できる場合だけ使う。それ以外は custGeom で実測座標を直接書く。PowerPoint 側の既定 adjust に依存すると、chevron や bent connector で形状差が出るためである。

### D4: 出自宣言原則

変換器は図・要素の由来を URL、ファイル名、DOM 構造から推測しない。出自は属性で宣言する。Vue 図は `data-diag`（box / edge / edge-label など）と `data-diag-edge`（経路座標 JSON）を walker への契約とする。

この原則により、変換器の分岐は宣言の照合だけになる。図の種類追加はコンポーネントの契約追加として扱い、ヒューリスティックな DOM 推測を増やさない。

### D5: 近隣ツールは採用しないが観測を続ける

Marp CLI `--pptx-editable` は experimental で、PDF を LibreOffice Impress で PPTX に変換する二段経路に依存する（claim-0004）。複雑テーマでの失敗、再現性低下、発表者ノート非対応が公式に明記されており、CSS テーマは意味的に消滅し、日本語はフォント代替と文字単位の分断が起きる。

ppt-master は AI が描いた SVG を python-pptx で native DrawingML に変換し、編集可能な PPTX を生成する（claim-0008）。ただしソースは SVG 中間表現であり Markdown ではない。textlint、claims 参照、git diff の意味性という本基盤の前提から外れる。

k1LoW/deck、Songmu/slidown、mizzy/peitho は設計上参考になるが、本リポジトリの基盤としては採用しない。deck はデザインが Google Slides 側に残り、slidown は PPTX/POTX テンプレートと placeholder 写像に寄り、peitho は PPTX 出力を持たない。

### Consequences

* Good, because CSS テーマ・日本語折返し・Vue コンポーネントの描画結果を座標の根拠にでき、Markdown 直接変換より忠実度を上げられる。
* Good, because PPTX は派生成果物に留まり、ソースの単一性と git 差分レビューを壊さない。
* Good, because `data-diag` / `data-diag-edge` 契約により、変換器が推測で分岐しない。
* Bad, because Slidev の DOM 構造、ブラウザ描画、pptxgenjs の仕様変化に追従する保守責任を負う。
* Bad, because 生成 PPTX はスライドマスターや placeholder に接続せず、要素は浮動配置になる。
* Bad, because PPTX 上の手動編集は再生成時に失われる。

### Confirmation

`bin/slidev-editable-pptx.mjs` が Slidev dev server の per-slide print ビューを実測し、PptxGenJS で PPTX を生成する。受け入れは、消費側リポジトリでの `npx slidev-editable-pptx`、PowerPoint / LibreOffice / PNG 化による視覚 QA、契約属性を持つ Diag\* 図の出力確認で行う。

## Pros and Cons of the Options

### Marp CLI `--pptx-editable`

* Good, because Marp CLI の公式機能として Markdown から editable PPTX を要求できる。
* Bad, because PDF→LibreOffice の二段変換であり、テーマ消滅、日本語分断、複雑テーマでの不完全出力がある（claim-0004）。

### SVG 中間表現

* Good, because SVG は図形・テキストを一つの中間形式に見せられる。
* Bad, because PDF→SVG ではグリフがパス化されるか、日本語が康熙部首の符号位置に化ける。Marpit の HTML は `foreignObject` を含み、PowerPoint の SVG レンダラにも合わない。

### LibreOffice 直接変換・Pandoc

* Bad, because HTML は Writer 文書として読まれ、スライド境界を認識できない。Pandoc も Marp / Slidev の CSS レイアウトを保持しない。

### Markdown 直接変換

* Good, because Markdown をソースにしたまま PPTX を生成できる。
* Bad, because テンプレート placeholder の制約に縛られ、CSS テーマ・Vue コンポーネント・日本語折返しの描画結果を忠実に再現できない。

### ppt-master

* Good, because SVG から native DrawingML へ変換し、真に編集可能な PPTX を生成する（claim-0008）。
* Bad, because ソースが SVG であり Markdown ではない。対話セッション前提で CI に載せにくく、textlint と claims 参照の経路が切れる。

### k1LoW/deck

* Good, because コンテンツとデザインの分離という思想は本基盤と同根である。
* Bad, because デザインが Google Slides 側に残り、テキストで管理できない。Microsoft 系顧客文脈とも合いにくい。

### Songmu/slidown

* Good, because ネイティブ placeholder とテンプレート theme により、構造的に editable な PPTX を生成する。key / freeze による手動編集温存は将来要件として参考になる。
* Bad, because デザインが `.pptx` / `.potx` バイナリに残る。表現は placeholder 写像に限定され、図は画像になる。

### mizzy/peitho

* Good, because HTML/CSS デザインの git 管理、slot 契約の型検査、暗黙経路を残さない設計は参考になる。
* Bad, because PPTX 出力が存在せず、公開直後で仕様が固まっていない。

### HTML 実測 → ネイティブ図形再構築の一方向デリバリ

* Good, because Slidev の実描画を測るため、CSS テーマ・表・コード・Vue 図の見た目を座標へ反映できる。
* Good, because marp-to-editable-pptx の実証済み思想（claim-0009）を Slidev に適用できる。
* Bad, because PPTX は要求時のみの納品物であり、PowerPoint 側の編集はソースへ自動還元されない。

## More Information

本 ADR は tech-slide `docs/adr/0001-slide-architecture.md`（旧採番）の D3、D9、D12 と Pros and Cons、`docs/design-evolution-2026-07.md` §3・§4、`docs/research-adversarial-comparison.md` §0 からの移設・再構成である。

関連調査の抜粋アーカイブは [docs/research/pptx-approaches.md](../research/pptx-approaches.md) を参照する。事実根拠は [facts/claims.yaml](../../facts/claims.yaml) の claim-0004、claim-0005、claim-0008、claim-0009、claim-0014 に保存する。

---
status: accepted
date: 2026-07-07
decision-makers: ["@fuj1g0n", "Coding Agent"]
---

# PPTX へのフォント埋め込みは EOT 全字埋め込みにする

## Context and Problem Statement

HTML 実測方式で生成した editable PPTX は、受け手の環境に同じフォントがないと再フローする。日本語本文とコードを含むスライドでは、フォント代替により行長、折返し、図中ラベルの位置が変わり、Slidev で確認した見た目と PowerPoint 上の見た目がずれる。

PowerPoint は PPTX 埋め込みフォントを EOT 形式でのみ受理し、生の TTF を `fntdata` パートに入れても無視する（[調査記録](../research/2026-07-07-pptx-approaches.md) の該当事実）。したがって、単にフォントファイルを PPTX に同梱するだけでは要件を満たさない。

## Decision Drivers

* PowerPoint で開いたときに、受け手の環境へフォントを事前インストールしなくても同じ字形で描画できること。
* LibreOffice / Google Slides では埋め込みフォントが無視されることを効果条件として明記すること。
* フォントの選定、ライセンス確認、配布許諾は本パッケージではなく利用側リポジトリが責務を持つこと。
* 変換器は利用側のフォント構成を環境変数で受け取り、既定値に固定しないこと。

## Considered Options

* EOT 形式で全字埋め込みする
* 生 TTF を PPTX の `fntdata` に入れる
* フォントを埋め込まず、受け手環境へのインストールに任せる
* フォントを subset 化して埋め込む

## Decision Outcome

Chosen option: "EOT 形式で全字埋め込みする", because PowerPoint が受理する形式は EOT であり、生 TTF は無視されるため（[調査記録](../research/2026-07-07-pptx-approaches.md) の該当事実）。全字埋め込みにより、編集・配布後に文字を追加した場合の欠落も避ける。

### D1: TTF を EOT に変換して `fntdata` として注入する

`bin/slidev-editable-pptx.mjs` は PPTX 生成後、フォントを fonteditor-core で EOT に変換し、OOXML の `embedTrueTypeFonts="1"`、`<p:embeddedFontLst>`、`ppt/fonts/fontN.fntdata`、`application/x-fontdata` の Content-Type を注入する。

生 TTF は採用しない。PowerPoint は生 TTF の `fntdata` を黙って無視し、代替フォントで描画することが対照実験で確認されている（[調査記録](../research/2026-07-07-pptx-approaches.md) の該当事実）。PowerPoint 自身の出力は EOT v2.2（MTX 圧縮）だが、fonteditor-core の EOT v2.1（非圧縮）も受理される。

### D2: 全字埋め込みにする

編集・配布用途のため subset ではなく全字を埋め込む。`saveSubsetFonts` は付けない。生成 PPTX の容量は増えるが、受け手が PowerPoint で文字を追記したときに埋め込み対象外の文字だけ代替フォントへ落ちるリスクを避ける。

### D3: `EMBED_FONTS` で利用側がフォントを注入する

`bin/slidev-editable-pptx.mjs` は `EMBED_FONTS` 環境変数を JSON 配列として読み、`typeface`、`regular`、`bold` のパスを受け取る。未指定時の既定値は tech-slide 系の OctoBiz / UDEV Gothic だが、これは互換用の既定値である。

本リポジトリは変換器と注入機構を提供する。フォントの選定、ライセンス、fsType、配布許諾、出典管理は利用側リポジトリの責務である。利用側は検証済みの調査記録やライセンス台帳でフォントの許諾根拠を管理し、スライド描画時の CSS `font-family` と埋め込み `typeface` を一致させる。

### D4: 効果条件を PowerPoint に限定する

この埋め込みの効果条件は、受け手が PowerPoint で開くことである。LibreOffice / Google Slides は読み側で埋め込みフォントを無視し、代替表示になる（[調査記録](../research/2026-07-07-pptx-approaches.md) の該当事実）。視覚 QA では PowerPoint での確認を最終判断に置き、LibreOffice は変換・差分確認の補助に留める。

### Consequences

* Good, because PowerPoint で開いたときに、受け手の環境へフォントを入れずに同じ字形を使える。
* Good, because `EMBED_FONTS` により、利用側リポジトリごとのフォント構成に差し替えられる。
* Good, because 全字埋め込みにより、受け手が文字を追記した場合の欠落を避けられる。
* Bad, because PPTX のファイルサイズは増える。
* Bad, because LibreOffice / Google Slides では効果がないため、PowerPoint 以外の閲覧品質は別途確認が必要になる。
* Bad, because フォントのライセンス確認は自動化されず、利用側リポジトリが検証済み記録で根拠を管理し続ける必要がある。

### Confirmation

`bin/slidev-editable-pptx.mjs` の `embedFonts()` が EOT 変換、`embeddedFontLst`、`fntdata` パート、Content-Type、relationship を注入する。受け入れは、PowerPoint で開いた後の PDF 出力や目視確認により、埋め込みフォント由来の描画になっていることを確認する。

## Pros and Cons of the Options

### EOT 形式で全字埋め込みする

* Good, because PowerPoint が受理する形式であり、フォント未インストール環境でも同じ字形を使える（[調査記録](../research/2026-07-07-pptx-approaches.md) の該当事実）。
* Good, because subset ではないため、配布後の軽微な文字追記にも耐える。
* Bad, because ファイルサイズが増える。

### 生 TTF を PPTX の `fntdata` に入れる

* Bad, because PowerPoint は生 TTF を黙って無視する（[調査記録](../research/2026-07-07-pptx-approaches.md) の該当事実）。

### フォントを埋め込まず、受け手環境へのインストールに任せる

* Good, because PPTX は軽くなる。
* Bad, because 受け手の環境差で再フローし、HTML 実測した座標の前提が崩れる。

### フォントを subset 化して埋め込む

* Good, because ファイルサイズを抑えられる。
* Bad, because PowerPoint 上で文字を追記したとき、subset 外の文字が代替フォントになる。

## More Information

本 ADR は tech-slide `docs/adr/0001-slide-architecture.md`（旧採番）の D4 のうち EOT 埋め込み部分と、`docs/design-evolution-2026-07.md` §4-3 からの移設・再構成である。関連調査と旧 facts/claims.yaml 由来の事実表は [docs/research/2026-07-07-pptx-approaches.md](../research/2026-07-07-pptx-approaches.md) を参照する。

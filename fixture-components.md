---
theme: default
title: 図形パターン fixture
colorSchema: light
canvasWidth: 1280
aspectRatio: 16/9
---

# 図形パターン fixture（ADR-0004 / ADR-0005）

コンポーネントの描画と editable PPTX 変換を検証するための固定ページ。
リポジトリ直下に置くことで `components/` が Slidev に自動インポートされる
（addon 解決は不要）。`--tech-*` / `--diag-*` は消費側テーマが宣言する契約
（[docs/diag-css-vars.md](docs/diag-css-vars.md)）のため、ここでは
ラッパー div にサンプル値をインラインで与える。

起動: `npm run dev:fixture` / 変換: `npm run fixture:pptx`（要 CHROME_PATH）

<div style="--tech-bg:#ffffff; --tech-fg:#1a1a2e; --tech-accent:#0b6bcb; --tech-muted:#5a6473; --tech-rule:#d8dee9; --tech-code-bg:#f4f6f8; --diag-zone-outer:#f5f7ff; --diag-zone-inner:#e6ecff; --diag-node-external:#f0f4ff; --diag-emphasis:#d9eaff;">

<Diag :w="1160" :h="430">
  <DiagBlockArrow id="ba" :x="40" :y="60" :w="160" :h="56" dir="right" label="移行" />
  <DiagCallout id="co" :x="420" :y="40" :w="220" :h="64" label="対象を指す注釈" target="ba" />
  <DiagBadge id="b1" :x="760" :y="48" :size="28" kind="circle" label="1" />
  <DiagBadge id="b2" :x="820" :y="48" :size="28" kind="ring" label="2" />
  <DiagBadge id="b3" :x="880" :y="48" :size="28" kind="ban" />
  <DiagBadge id="b4" :x="940" :y="48" :size="28" kind="plus" />
  <DiagBadge id="b5" :x="1000" :y="48" :size="28" kind="cross" />
  <DiagBadge id="b6" :x="1060" :y="48" :size="28" kind="star" />
  <DiagCylinder id="db" :x="40" :y="200" :w="150" :h="140" label="監査ログ" />
  <DiagPolygon id="dm" :x="300" :y="200" :w="140" :h="140" :points="[[0.5,0],[1,0.5],[0.5,1],[0,0.5]]" label="判定" />
  <DiagBlockArrow id="ud" :x="550" :y="200" :w="80" :h="140" dir="upDown" />
  <DiagCallout id="co2" :x="740" :y="240" :w="240" :h="64" label="左向きの尾" tail="left" :tail-at="0.5" />
  <DiagEdge from="db" to="dm" label="書込" />
  <DiagBrace from="db" to="dm" side="bottom" label="保全の対象範囲" />
  <DiagText :x="740" :y="330" :w="240" label="キャプション例" />
</Diag>

</div>

---
status: accepted
date: 2026-07-06
decision-makers: ["@fuj1g0n", "Coding Agent"]
---

# Diag\* コンポーネント体系の整理と新規コンポーネントの API 設計

## Context and Problem Statement

ADR-0004 で参照 PPTX 資産の再現に必要な 12 パターン語彙を定め、
新規コンポーネント 6 種（DiagCallout / DiagBlockArrow / DiagBadge /
DiagBrace / DiagCylinder / DiagPolygon）の追加を決定した。
実装に入る前に、既存 7 コンポーネントに暗黙で存在する設計規約を明文化し、
新規分の API をこの規約に沿って固定する。規約なしに増築すると
props 命名や座標系が発散し、converter・lint・執筆者の三者が壊れる。

### 2. 既存コンポーネントの棚卸し（2026-07-06 実査）

| コンポーネント | 行数 | 役割 | 契約出力 |
|---|---:|---|---|
| Diag | 25 | キャンバス。`w/h` 固定・`position:relative`・`diag-boxes` レジストリを provide | `data-diag="root"` |
| DiagBox | 95 | カード・ゾーン枠。fill トークン、icon+label、raised、frameless | `data-diag="box"` |
| DiagEdge | 202 | 線・矢印。from/to の id 参照で自動経路、points/bezier 明示、破線、ラベル | `data-diag="edge"` + JSON |
| DiagChevron | 56 | プロセス山形。first でノッチなし | `data-diag="chevron"` + JSON |
| DiagCycle | 117 | 循環図。labels 配列・弧・中央アイコン | `data-diag="cycle"` 系 |
| DiagText | 42 | 裸テキスト注釈。bg で下の線を隠す | `data-diag="text"` |
| DiagIcon | 63 | アイコン + キャプション | `data-diag="icon-label"` |

## Decision Drivers

### 2-1. 暗黙規約の抽出（本 ADR で明文化する）

実装から抽出した、全コンポーネント共通の規約は次のとおり。

1. **座標系**: すべて Diag キャンバス左上原点の絶対 px。
   `x/y/w/h` は Number 必須（DiagCycle は `size`、DiagText は `h` なし）。
   相対配置・% 指定・flex は使わない。
2. **id レジストリ**: 位置を持つ要素は `id` を持ち、onMounted で
   `diag-boxes`（provide/inject）へ矩形を登録する。DiagEdge は
   `from`/`to` でこの id を参照し経路を自動計算する。
3. **色はトークン名**: `fill` prop は CSS 値ではなく DESIGN.md の
   トークン名（background / zoneOuter / zoneInner …）を取り、
   コンポーネント内の対応表で CSS 変数に解決する。生色コードは受けない。
4. **契約出力**: 見た目から推論できない意味情報（経路点列・矢じり・
   ノッチ・弧角度・前面指定）は `data-diag` / JSON 属性で宣言する。
   座標は宣言せず converter が getBoundingClientRect で実測する。
5. **意味 prop / 装飾 prop の分離**: 意味を変える prop
   （from/to、first、noArrow、labels）と表示調整 prop
   （size、labelDy、gapDeg）を混ぜず、既定値で成立させる。
6. **lint 服従**: 幾何は lint-diagrams.mjs（インセット 12px・
   兄弟ギャップ 8px・等間隔 ±2px）、文字サイズは boundary 契約
   （diagram-bounds.mjs、16/12px 相当）に従う。

## Considered Options

* Diag\* コンポーネント体系の整理と新規コンポーネントの API 設計

## Decision Outcome

Chosen option: "Diag\* コンポーネント体系の整理と新規コンポーネントの API 設計", because 規約なしに増築すると props 命名や座標系が発散し、converter・lint・執筆者の三者が壊れる。

### 3-1. 体系の整理

コンポーネントを 3 レイヤに分類し、ファイル配置と命名を固定する。

| レイヤ | 構成 | 規則 |
|---|---|---|
| キャンバス | Diag | 1 図 1 個。レジストリの唯一の owner |
| ノード | DiagBox, DiagChevron, DiagIcon, **DiagCallout, DiagBlockArrow, DiagBadge, DiagCylinder, DiagPolygon** | `id/x/y/w/h` 必須（Badge は `size` 可）。レジストリ登録必須（DiagEdge の端点になれる） |
| 接続・注釈 | DiagEdge, DiagCycle, DiagText, **DiagBrace** | id 参照または座標直指定。レジストリ登録しない |

- 置き場所は `components/` フラット直下を維持（9〜13 個は
  ディレクトリ分割に値しない）。命名は `Diag<意味名>.vue` 単数形。
- 既存 7 コンポーネントの props は**変更しない**（deck 後方互換）。
  規約違反が見つかった場合も deprecation を経ずに壊さない。

### 3-2. 新規コンポーネントの API（実装前に固定）

ADR-0004 の P6〜P11 に対応する。共通規約（§2-1）に従い、
意味 prop のみ列挙する（size/bold 等の表示調整 prop は DiagBox に準ずる）。

**DiagCallout（P6: 吹き出け先注釈）**

```
id, x, y, w, h, label
tail: 'bottom' | 'top' | 'left' | 'right'   // 尾の出る辺
tailAt: Number (0..1, default 0.5)          // 辺上の尾の位置比率
target: String (optional)                   // 指す相手の id。指定時は tail/tailAt を自動決定
```

契約: `data-pptx="polygon"`（角丸矩形 + 三角尾の頂点列を JSON 宣言）。

**DiagBlockArrow（P7: ブロック矢印）**

```
id, x, y, w, h, label
dir: 'right' | 'left' | 'up' | 'down' | 'leftRight' | 'upDown'
```

回転は使わず dir の対称形状で表現する（ADR-0004 R-7）。
契約: `data-pptx="polygon"`。

**DiagBadge（P8: バッジ・マーカー）**

```
id, x, y, size, label
kind: 'circle' | 'ring' | 'ban' | 'plus' | 'cross' | 'star'
```

正方形境界（w=h=size）。番号丸・禁止マーク等の点物マーカー。
契約: circle/ring は `data-pptx="shape-rect"`（正円）、
ban/plus/cross/star は `data-pptx="polygon"`。

**DiagBrace（P9: ブレース注釈）**

```
from, to (id 参照) または x, y, len
side: 'left' | 'right' | 'top' | 'bottom'   // 開口の向き
label, labelDx, labelDy
```

契約: `data-pptx="edge"`（矢じりなしの弧付き経路）。

**DiagCylinder（P10: DB・ストレージ）**

```
id, x, y, w, h, label, icon
```

見た目は上面楕円 + 胴の縦シリンダー固定。
契約: `data-pptx="polygon"`（楕円弧を含む頂点列宣言）。

**DiagPolygon（P11: 汎用受け皿）**

```
id, x, y, w, h, label
points: Array<[Number, Number]>   // w/h に対する 0..1 正規化頂点列
```

triangle / diamond / parallelogram 等の長尾はすべてここで受ける。
**頻出したら専用コンポーネントへ昇格**し、deck 内の生 points 使用は
lint で件数監視する（同一 points が 3 図以上に現れたら昇格を検討）。

### 3-3. 契約語彙との対応

新規 6 種はすべて generic-pptx-walker ADR-0002 の公開語彙
`shape-rect | edge | polygon` の範囲に収まり、**契約語彙の拡張は不要**。
converter 側の追加実装は polygon 頂点列の一般化のみで済む。
`data-diag` の新値は増やさず、新規コンポーネントは最初から
`data-pptx` 語彙で出力する（正規化テーブルを太らせない）。

### Consequences

* Good, because 既存 deck は無変更で通る（既存 props 凍結、契約語彙も既存範囲）。
* Good, because 執筆者（主に Coding Agent）は §2-1 の 6 規約と本 ADR の props 表だけで
  新旧コンポーネントを一貫して使える。規約の重複記述は避け、
  DESIGN.md からは本 ADR を参照する。
* Bad, because DiagPolygon が逃げ道になるため語彙の停滞リスクがあるが、
  昇格ルール（3 図以上で専用化検討）で回収する。

### Confirmation

実装順は ADR-0004 §4 のとおり（Callout / BlockArrow / Badge 先行）。
各コンポーネント追加時は、fixture 図 + `npm run lint` +
`npm run qa:pptx` の PNG 目視を受け入れ条件とする。

## More Information

本 ADR は tech-slide `docs/adr/0003-diag-component-design.md`（旧採番）からの移設・再構成である。

- Status qualifier: 実装前の設計固定
- Related documents: [ADR-0001](0001-slide-architecture.md)、
  [ADR-0004（図形パターン語彙）](0004-shape-pattern-vocabulary.md)、
  [generic-pptx-walker ADR-0002（契約語彙）](../generic-pptx-walker/adr/0002-contract-vocabulary.md)、
  [docs/research/2026-07-07-pptx-approaches.md](../research/2026-07-07-pptx-approaches.md)

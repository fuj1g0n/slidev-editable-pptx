# 調査: DOM 実測型 walker 3 実装のヒューリスティック品質監査（2026-07-08）

日付: 2026-07-08。不変の調査スナップショット。
対象: atharva9167j/dom-to-pptx v2.0.3、KatsuYuzu/marp-to-editable-pptx@94c5ee9、
本リポジトリ bin/slidev-editable-pptx.mjs（b41c2b9 時点）。
手段: 各ソースの読解監査（rubric: ヒューリスティック棚卸し / ディスパッチ構造 /
結合 / テスト / 回帰安全性 / smell / エラー処理）。

## 1. 総括比較

| 観点 | dom-to-pptx | marp-to-editable-pptx | 本リポジトリ |
|---|---|---|---|
| 推論中枢の規模 | prepareRenderItem 約 880 行、if 96 個、最大ネスト 8 | walkElements 約 1,100 行の if/else 優先列 | walker 約 430 行（契約が主経路のため推論は少数） |
| ディスパッチ | 中央テーブルなし。コード順が暗黙の優先順位 | 中央 if/else はあるが分岐内に fallback が入れ子 | 契約 → bg-image 走査 → ブロック走査の 3 段。判定は各所インライン |
| ヒューリスティック性格 | CSS 仕様由来と ad-hoc が混在。共有状態（_ctx、_inheritedOpacity、__spc_ suffix の 3 モジュール結合）に強依存 | 「壊れたスライドへの累積補正」型。固定閾値多数（8px/1.15 倍/+16px 等の DirectWrite 差分対策） | 事件駆動規則が 4〜5 件（aria-hidden 分岐、iconPlate 等）。共有状態なし |
| 単体テスト | 5 ファイル。ヒューリスティック表面の 70〜80% 未テスト | JSDOM モック方式 149 tests / 59 describe。表面の 6〜7 割をカバー | ゼロ |
| 視覚回帰 | なし（example はあるが fixture 化されていない） | **pixelmatch + PowerPoint COM の視覚回帰テストあり**（Windows 不在時 skip、対象は限定的） | fixture deck + qa:pptx + 実機 COM ゲート（手動、ADR-0013） |
| 決定の記録 | コード内コメント（BUG FIX / CHANGE 残骸） | 番号付き決定メモ（ADR-22/23/30）をコード・テスト名に埋め込み。理由はあるが選択肢・帰結は不足 | リポジトリ外形の MADR ログ（docs/adr、選択肢・帰結込み） |
| エラー処理 | silent skip 多数 + 一部 warn。image load 失敗は観測不能 | 基本 silent skip。一部 console.warn | silent continue（ログなし。ADR-0010 改訂の対象） |
| 保守性評価 | **2/5** — 堆積型。共有状態・描画順・normalizer hack への暗黙依存で、追加は「吸収」でなく「堆積」 | **3/5** — IR（types.ts）とテスト量は強いが、巨大 walkElements と hidden invariant（rasterize/pageX は index.ts 後処理前提等）が増加軌道 | **3/5** — 小さく契約主導で規律はあるが、テスト不在・ログ不在・事件駆動規則の入口。ADR 0007-0011 実装前の分岐点 |

## 2. 実装別の要点

### dom-to-pptx（詳細監査の抜粋）

- 強い hack: letter-spacing を fontFace 名 `__spc_` サフィックスに埋めて
  normalizer で復元（walker/utils/normalizer の三者結合）。z-order も
  altText 経由で normalizer へ運ぶ。動くが、変更影響が 3 ファイルに波及する。
- stacking context は簡略版（DOM 順 + zIndex sort）。transform/position が
  作る本物の stacking context は未再現。
- rotation は matrix の回転成分のみ。scale/skew/3d は無視。
- 部品の質は高い（whitespace 処理はテスト付き、border 分類、writing-mode
  写像）が、統合の仕方が密結合。
- 未テスト領域: gradient SVG、pseudo、composite border、opacity 相互作用、
  rotation 等の主要ヒューリスティックほぼ全部。

### marp-to-editable-pptx（詳細監査の抜粋）

- badge/chip 検出（inline-block + bg + radius）、badge 幅ぶんのテキスト
  オフセット補正（±8px 閾値）、flex/grid 裸テキスト回収（Range 使用、
  ADR-22/23）、nowrap 幅 1.15 倍 + 8/16px 拡張（フォントメトリクス差対策）等、
  補正の積層が明瞭。
- IR は union 型で整理されているが、`ContainerElement.runs` は badge 専用、
  `ListItem.leadingOffset` は indent 補正専用など、フィールドの意味が
  特定ヒューリスティックに寄生する形の hidden invariant が多い。
- テストは JSDOM + getComputedStyle/getBoundingClientRect のモック。
  DOM 構造単体テストとしては手厚いが、モック値が実ブラウザ値と乖離しうる。
- **視覚回帰に PowerPoint COM + pixelmatch を採用済み**（本リポジトリの
  ADR-0013 と同じ結論に独立到達）。ただし CI では skip され、対象は
  code block overflow 中心。

### 本リポジトリ

- 契約（data-diag/data-pptx）が主経路のため推論面積が小さく、
  ヒューリスティック密度は 3 者で最小。ただし 210d6a4 で入った
  aria-hidden 画像/テキスト分岐・CSS bg-image 走査・iconPlate は
  事件駆動であり、Layer 2 拡張を単一ファイルへ足し込めば
  dom-to-pptx / marp と同じ堆積軌道に入る。
- 固有の弱点: 単体テスト 0、silent continue のログなし、
  マジックナンバー（1280 canvas、bold 閾値 600、line-height 1.4 倍）。

## 3. 帰結（本リポジトリの設計への含意）

1. 「推論型は例外が際限なく積み上がる」（要求調査 2026-07-06 §2.2）は
   両外部実装の監査で定量的に裏付けられた（if 96 個 / 固定閾値多数 /
   未テスト 7〜8 割）。ADR-0007 の 3 層 + ディスパッチ一元化、
   ADR-0011 の層別モジュール分割は、この堆積を構造的に防ぐ装置として妥当。
2. marp 実装のテスト戦略（JSDOM モック単体 + COM 視覚回帰の二段）は
   輸入価値が高い。ADR-0011 の中間 JSON fixture 化と組み合わせれば、
   walker（ブラウザ実測）/ builder（純関数）を分けてテストできる。
3. dom-to-pptx からの移植対象（ADR-0016）は「テスト付き純関数」に
   限定するのが正しい。密結合の中枢（__spc_ 3 者結合等）は移植せず、
   letter-spacing はアイデアのみ採用して後処理層（ADR-0015）で
   一元的に実装する。
4. 本リポジトリの当面の最優先は、規則追加より FR-8（未処理要素ゼロの
   検査可能化）と fixture 単体テストの導入。テスト不在のまま Layer 2 を
   広げると、2/5 評価の実装と同じ場所に到達する。

# 調査: 既存 SVG → DrawingML 変換器の組み込み可否（2026-07-08）

日付: 2026-07-08。不変の調査スナップショット。
[2026-07-08-pptx-tool-landscape.md](2026-07-08-pptx-tool-landscape.md) §3.4 の深掘り。
調査手段: research agent による一次ソース実査（コード直接検証。README のみの主張は明記）。

## 1. 検討の目的

言語跨ぎ（Node → Python subprocess 等）は実装で解決できる前提で、既存の
SVG → DrawingML 変換器を組み込むことで、(a) 本実装の一部（ADR-0009 の
Layer 2 SVG サブセット変換）を削除できるか、(b) 精度・カバレッジ
（曲線 custGeom / gradFill / grpSp）を高められるか。

## 2. 候補の実査結果

### 2.1 JoeyHwong-gk/svg2pptx（Python, MIT）

前回調査（landscape §3.4）で「native gradFill + grpSp を両方出す唯一の OSS」
と評価したもの。コード実査により評価を**大幅下方修正**する。

- **保守実態**: 単一 commit（2026-04-06 作成・同日 push、以後更新なし）、
  star 0 / fork 0 / issue 0。テストごと AI 生成の一括投下と推定。
  実 SVG フィクスチャのテストなし。
- **できること（コード検証済み）**: 全 path コマンド解析（S/Q/T/A は
  cubic 正規化）→ a:cubicBezTo、`<g>` → p:grpSp、linear/radial → a:gradFill、
  text/tspan → run 分割 TextBox（CJK ea typeface あり）、stroke-dasharray →
  prstDash/custDash、`<image>` → p:pic。
- **致命的な欠落（コード検証済み）**:
  - **viewBox 非対応**。viewport スケーリングが存在せず座標を生で使う。
  - **inline `style=""` 非解析**。presentation 属性のみ読む。
  - **CSS 全滅**: `<style>` ブロック skip、`class` は FORBIDDEN 警告、
    `var()` 解決なし。
  - **marker 全滅**: `marker-end` は警告して黙って落とす。headEnd/tailEnd
    への写像も幾何展開もなし。
  - transform は translate/scale/rotate(角度のみ) だけ。**matrix() 無視**、
    rotate(a,cx,cy) 無視、skew 無視。
  - `<use>` 黙殺、gradientUnits=userSpaceOnUse 誤処理、
    gradientTransform / xlink:href 継承なし、複数位置 tspan は 1 段落に潰す。
- **API**: 完成 pptx 生成のみが公開 API。内部 `convert_single_svg()` が
  spTree 断片（shapes_xml, media, rels）を返すため、ADR-0015 の XML 後処理で
  既存スライドへ注入する経路は技術的には作れる（非公開・非文書化）。

### 2.2 BramAlkema/svg2ooxml（Python ≥3.13, AGPL-3.0 + 商用）

- README 主張は最強（CSS カスケード・`var()`/`calc()`・userSpaceOnUse・
  gradientTransform・clipPath/mask の EMF/raster フォールバック・textPath・
  W3C テスト 525/525 通過）。**ただしコード未監査**（91MB、主張は README のみ）。
  star 3、2026-05-11 最終 push。
- **AGPL-3.0** が採用障壁。subprocess 分離なら出力 pptx は非感染だが、
  客先納品パイプラインの構成要素としてはライセンス審査コストが高い。
  商用ライセンスは費用が発生する。
- marker 対応は README からも確認できず（未検証）。

### 2.3 その他（結論のみ）

- benouinirachid/svg2pptx (PyPI): 曲線ポリライン近似・グラデーション非対応。
  現行 Layer 3 より精度が落ちる方向で採用理由なし。
- **JS/TS エコシステム: 該当なし**。npm `svg2pptx` は 404。SVG → custGeom を
  group + gradient + text 込みでやる npm パッケージは存在しない。
- **Office JS API: `Shape.ConvertSvgToShape` 相当は存在しない**
  （OfficeDev/office-js#2152）。PowerPoint UI の「図形に変換」は
  プログラマブルに呼べない。VBA/COM は Windows 実機依存かつ低速。

## 3. アーキテクチャ適合性の分析

組み込みの成否は候補の機能表ではなく、**我々の入力クラス**との適合で決まる。

1. **入力は「ブラウザ描画済み SVG」**。Vue コンポーネント（DiagEdge 等）は
   class と `var(--diag-*)` で塗りを解決し、Slidev はスライドを scale する。
   outerHTML 直渡しでは class / var() / 継承スタイルが未解決のまま渡り、
   スタンドアロン変換器は全候補がこれを解決できない。渡すには
   「getComputedStyle で全属性を presentation 属性に焼き込む前処理」を
   **こちらで書く**必要があり、それは Layer 2 の実装の相当部分と同型。
2. **主要ユースケースは矢じり付き線**（DiagEdge / Slidev `<Arrow>` の
   marker-end）。marker を beginArrow/endArrow に写像できる外部ツールは
   確認できなかった。つまり **ADR-0009 の中核部分は外部化しても消えない**。
3. **座標の真実は getBoundingClientRect / getScreenCTM**。viewBox・transform・
   ページ scale の合成はブラウザが正解を持っており、我々は測るだけでよい。
   外部ツールはこれを SVG テキストから再計算する必要があり、そこが
   各候補の主要な欠陥箇所（viewBox 無視、matrix 無視）と一致している。
   **ブラウザ内実測方式は、外部ツールが失敗する問題を構造的に持たない。**
4. **注入経路**: 外部ツール出力（spTree 断片）を実測 rect に合わせて
   `p:grpSp` の xfrm off/ext + chOff/chExt で包んで注入することは、
   ADR-0015 の後処理レイヤで技術的に可能。組み込むならこの形になる。

## 4. 「削除できる実装」「上がる精度」の収支

| 項目 | 外部ツール組み込み | 自前 Layer 2 拡張 |
|---|---|---|
| ADR-0009 サブセット変換の削除 | 不可（marker 写像が残る） | — |
| 曲線 path → custGeom | JoeyHwong で可（cubic 正規化） | pptxgenjs custGeom は cubic/quad/arc 完備（landscape §2）。**arc→cubic 正規化アルゴリズムの移植だけで足りる** |
| gradFill / grpSp | 可 | ADR-0015 の XML 後処理で予定済み |
| CSS 解決・viewBox・CTM | **全候補が欠陥**。前処理を自作する必要 | ブラウザが解決済み。実測するだけ |
| 追加コスト | Python 実行環境（uv one-shot）、断片注入 API の自作、無保守コードの監査・fork 維持 | なし（既存アーキテクチャの延長） |

## 5. 結論

- **既存 SVG → DrawingML 変換器の組み込みは推奨しない。**
  実装削減効果はほぼゼロ（marker 写像が消えない）で、精度向上分
  （曲線・gradFill・grpSp）は自前拡張の方が到達点が高い。外部ツールが
  解けない部分（CSS・viewBox・transform 合成）こそ我々の方式が
  構造的優位を持つ部分であり、外部化はその優位を捨てて欠陥を輸入する。
- **借りるのはコードでなくアルゴリズム**（ADR-0016 の方針と同型）:
  - SVG arc (A) → cubic bezier 分割（SVG spec §F.6.5 の
    endpoint→center パラメトリゼーション、90° 分割）。JoeyHwong 版
    `path_parser.py` の実装が参照実装として使える（MIT）。
  - S/T の反射制御点による cubic 正規化、Q → C の 2/3 公式。
  - dasharray → prstDash のプリセット対応表。
  - これらにより ADR-0009 の「曲線は将来拡張」を backend 変更なしで
    実装できる（受け皿は pptxgenjs custGeom で実証済み）。
- **再検討トリガ**: (a) drawio 例外経路の図（曲線中心）を editable 化する
  要求が実際に発生し、かつ (b) svg2ooxml のコード監査とライセンス問題が
  解決した場合に限り、ADR-0015 後処理への断片注入方式で再評価する。

## 6. 留保事項

- svg2ooxml の機能主張は README 検証のみ（コード未読）。marker 対応有無も未確認。
- JoeyHwong 版の「AI 生成一括投下」は状況証拠（単一 commit・利用者ゼロ・
  フィクスチャなしテスト）による推定。
- npm 網羅検索は完全ではない（404 確認 + web 検索による不在確認）。

---
status: proposed
date: 2026-07-08
---

# dom-to-pptx はベースにせずモジュール移植とアイデア採用で取り込む

## Context and Problem Statement

本ツールは商業的競争を目的としない。同目的の MIT ライブラリ
dom-to-pptx（DOM 実測 → PptxGenJS、npm v2.0.3）が存在する以上、
車輪の再発明を避け、利用できるものは取り込むべきである。
取り込み方には複数の層がある: 本プロジェクトを dom-to-pptx の
Slidev 向け拡張として作り直す（ベース採用）、モジュール単位で実装を
移植する、アイデアだけ採用する、upstream へ貢献する。
コード監査（research 2026-07-08 dom-to-pptx-code-audit）を踏まえ、
どの層で再利用するかを決める。

## Decision Drivers

* 車輪の再発明の回避（非商業プロジェクトとして、既存 OSS の成果を尊重する）
* 本ツール固有の要求（宣言契約 Layer 1・実測行分割・ラスタライズ理由ログ・
  native gradFill/grpSp）が実現可能であること
* 保守の持続可能性（フォーク追従・単一作者依存のリスク）

## Considered Options

- ベース採用: 本プロジェクトを dom-to-pptx の Slidev 拡張として再構成する
- モジュール移植 + アイデア採用（MIT vendoring、出典明記）
- アイデアのみ採用（コードは共有しない）

## Decision Outcome

Chosen option: "モジュール移植 + アイデア採用", because 監査の結果、
ベース採用は成立しない — dom-to-pptx の公開 API は `exportToPptx` 1 関数のみで
プラグイン・フック機構が無く、本ツールの中核要求（Layer 1 契約、実測行分割、
ラスタライズ理由ログ、SVG→native 図形、gradFill/grpSp）はすべて 2,200 行の
中枢モノリス（prepareRenderItem）の改造を要し、実態がフォークになるため。
一方、周辺モジュールは責務が明確でテスト付きであり、移植適性が高い。

- **移植する（MIT、ファイル冒頭に出典を明記）**:
  - pptx-normalizer 相当の防御的 OOXML 正規化（dangling Override 除去・
    pPr 子要素順序修正）を ADR-0015 後処理層の一部として取り込む。
    gradFill / grpSp 注入で壊れた XML が PowerPoint の修復ダイアログを
    誘発するリスクへの直接の対策になる。
  - DOM 非依存の純関数（parseColor / flattenColor / resolveCssVariables /
    getBorderInfo / getVisibleShadow / splitPreformattedText）を Layer 2
    推論（infer-box / infer-text）の部品として必要時に移植する。
- **アイデアを採用する**:
  - ::before/::after の content が文字列の場合はラスタライズせず
    テキスト run として回収する（ADR-0010 検出条件 8 の緩和条項。
    アイコンフォント・番号付け対策）。
  - letter-spacing 等 PptxGenJS API 外のテキスト属性を後処理で注入する方式。
  - white-space（pre / pre-wrap / pre-line / nowrap）別の改行・空白保持規則。
- **採用しない**: グラデーションの SVG 画像化（FR-7b のネイティブ優先と矛盾）、
  SVG の全面画像化（ADR-0009 と矛盾）。
- **upstream 貢献**: 移植過程で見つけた汎用バグ修正は貢献するが、
  本ツールの計画は upstream のレビュー速度に依存させない。
- v-click → PowerPoint native アニメーション（animations/ モジュール）は
  現スコープ外のまま、将来の移植候補として記録する。

### Consequences

- Good, because ADR-0015 の最大リスク（自前 XML の正当性）に対し、
  実戦投入済みの正規化実装を先行例として使える。
- Good, because CSS パース系の枯れた純関数を再実装せずに済み、
  テストも同時に持ち込める。
- Bad, because vendoring したコードは upstream の修正に自動追従しない。
  移植時にファイル単位で出典コミットを記録し、更新は手動で判断する。
- Bad, because ベース採用と比べ「1 つの共通実装に集約される」将来は失われる
  （エコシステムとしては実装が 2 つ並存し続ける）。upstream に拡張 API が
  生まれた場合は本決定を再評価する。

## More Information

コード監査: [research 2026-07-08 dom-to-pptx-code-audit](../research/2026-07-08-dom-to-pptx-code-audit.md)。
ランドスケープ上の位置づけ: [research 2026-07-08 pptx-tool-landscape](../research/2026-07-08-pptx-tool-landscape.md) §3.1, §4。

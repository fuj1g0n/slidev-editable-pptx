---
status: accepted
date: 2026-07-07
---

# PPTX 視覚 QA の最終判定は PowerPoint 実機（COM 自動化）で行う

## Context and Problem Statement

「deck-editable.pptx に画像が入っていない」報告の調査で、LibreOffice
変換ベースの QA（qa:pptx / soffice → PDF → PNG）が偽陰性を出すことが
判明した。LibreOffice は svgBlip（ベクター側）を描画するため、
PowerPoint 実機で欠ける要素が LibreOffice では正常に見える
（docs/research/2026-07-07-powerpoint-rendering-verification.md §1）。
一方、開発環境は WSL / Linux で、requirements NFR-5 は PowerShell を
ビルドから排除している。

## Considered Options

- LibreOffice ベースの QA のみ（現状）
- PowerPoint 実機（WSL → powershell.exe → COM → Slide.Export PNG）を最終ゲートに追加
- PowerPoint Online 等での目視のみ

## Decision Outcome

Chosen option: "PowerPoint 実機を最終ゲートに追加", because 成果物の受け手が
開くのは PowerPoint であり、レンダリング判定は同じエンジンでしか確定できない
ことが実証されたため。LibreOffice QA は CI で回る一次スモークとして残す。

- 検証手順（WSL から実行可能）:
  1. pptx を Windows 側 Temp へコピーし `Unblock-File` で MOTW を除去
  2. `New-Object -ComObject PowerPoint.Application` → `Presentations.Open(src, readonly, untitled=false, window=false)`
  3. `Slides.Item(n).Export(path, 'PNG', w, h)` でページ PNG 化し、
     ブラウザ描画（Slidev export PNG）と目視 / 差分比較
- 適用範囲は「リリース前の最終確認」と「レンダリング差異の調査」。
  CI（Linux ランナー）には組み込まない。NFR-5 の PowerShell 禁止は
  ビルド・変換パイプラインに対する規定であり、ホスト PowerPoint を使う
  この QA ゲートはその例外として明示する。

### Consequences

- Good, because svgBlip・フォールバック・フォント代替など「ビューアで
  結果が割れる」領域の判定が受け手と同じエンジンで確定する。
- Good, because COM 自動化により目視前提だった実機確認が再現可能な
  手順（スクリプト）になる。
- Bad, because Windows ホスト + PowerPoint ライセンスが前提で、CI では
  実行できない。最終ゲートは開発者のローカル作業として残る。
- Bad, because LibreOffice QA と実機 QA の二重管理になる（役割分担を
  明記して緩和: CI は構造回帰、実機はレンダリング確定）。

## More Information

docs/research/2026-07-07-powerpoint-rendering-verification.md（検証ログと
PowerShell スニペット）。

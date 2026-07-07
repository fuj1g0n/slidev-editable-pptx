---
status: accepted
date: 2026-07-08
---

# PptxGenJS の機能境界は OOXML 後処理層で拡張する

## Context and Problem Statement

editable PPTX の要求（requirements 2026-07-08）には、出力バックエンド
PptxGenJS の公開 API では実現できないものがある。一次ソース検証
（research 2026-07-08 §2）の結果:

- グラデーション塗り: fill は `none | solid` のみ。gradFill 生成コードは
  存在しない（FR-7b ネイティブ優先と衝突）
- 図形グループ化: ユーザー向け grpSp API なし（FR-11 と衝突）
- フォント埋め込み: API なし（既に zip 後処理で実装済み）

一方 OOXML 側は a:gradFill / p:grpSp をネイティブ対応しており、
表現力の不足は PptxGenJS の API 境界だけに起因する。

## Considered Options

- バックエンドを乗り換える（OpenXML SDK / Aspose.Slides / python-pptx 等）
- PptxGenJS をフォークして拡張する
- PptxGenJS の出力 zip への OOXML 後処理層を公認の拡張点とする

## Decision Outcome

Chosen option: "OOXML 後処理層を公認の拡張点とする", because 乗り換えは
不成立（python-pptx は gradFill・grpSp 生成とも不可、OpenXML SDK は .NET で
Node パイプラインと不整合、Aspose は商用ライセンス）、フォークは
upstream 追従コストが恒常化するのに対し、後処理はフォント埋め込みで
既に同型の実績があり、必要な XML 断片だけを自前責任で持てるため。

- 後処理層（postprocess）は JSZip で pptx を開き、slideN.xml と rels を
  書き換える単一モジュールとする。当面の対象:
  1. a:gradFill 注入（線形/放射。CSS 角度 → `ooxml_ang = (90 − css_deg) × 60000`、
     stop 上限 10。ADR-0010 の検出条件と連動）
  2. p:grpSp によるグループ化（FR-11。chOff/chExt の子座標系再計算を含む）
  3. フォント EOT 埋め込み（既存処理の移設）
- walker/builder は後処理への指示を中間 JSON のフィールド
  （例: `gradient: {...}`, `group: <id>`）で表現し、PptxGenJS には
  プレースホルダ（solid 塗り・平坦な図形列）を出力させる。
  後処理はプレースホルダを一意に特定できるマーカー（図形名）で対象を探す。
- 対象は「OOXML にネイティブ表現があり、PptxGenJS に API がないもの」に
  限定する。PptxGenJS で表現できるものを後処理で書くことは禁止する
  （二重の出力経路を作らない）。

### Consequences

- Good, because FR-7b（グラデーションのネイティブ優先）と FR-11
  （グループ化）が実現可能になり、受け手は PowerPoint 上でグラデーションの
  stop や グループを通常の UI で編集できる。
- Good, because バックエンド乗り換え・フォークと比べ、依存の追加がゼロで
  （JSZip は使用済み）、影響範囲が出力 zip の書き換えに閉じる。
- Bad, because 生成 XML の正当性は自前責任になる。壊れた XML は PowerPoint が
  「修復」ダイアログを出すため、QA ゲート（ADR-0013）での実機検証を必須とする。
- Bad, because PptxGenJS の内部 XML 構造（図形名の付与規則等）への暗黙依存が
  生まれる。バージョン更新時は fixture 回帰（qa:pptx + 実機）で検出する。

## More Information

検証事実と代替ライブラリ比較: [research 2026-07-08](../research/2026-07-08-pptx-tool-landscape.md) §2。
要求側の根拠: requirements 2026-07-08 FR-7b, FR-11, §9.1-2。

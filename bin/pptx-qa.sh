#!/usr/bin/env bash
# PPTX 視覚 QA — editable PPTX を LibreOffice で PDF 化し、pdftoppm で
# ページ PNG に展開する（slidev-editable-pptx skill §PPTX 視覚 QA の QA ループ用）。
# LibreOffice の解釈は PowerPoint と完全一致しないが、図形の欠落・座標破綻・
# テキスト折り返しの検出には十分（最終確認は PowerPoint で行う）。
#
# 使い方: npx pptx-qa [pptx] [first-page] [last-page]
#   既定: out/deck-editable.pptx を全ページ、出力は out/qa-pptx/
set -euo pipefail
# 消費側リポジトリの root（cwd）で実行する

PPTX="${1:-out/deck-editable.pptx}"
FIRST="${2:-}"
LAST="${3:-}"
OUTDIR="out/qa-pptx"

if ! command -v soffice > /dev/null; then
  echo "soffice (LibreOffice) が見つからない。direnv exec . 経由で実行する（flake devShell が提供）" >&2
  exit 1
fi
[ -f "$PPTX" ] || { echo "$PPTX がない。先に npm run build:pptx:editable を実行する" >&2; exit 1; }

rm -rf "$OUTDIR"
mkdir -p "$OUTDIR"
soffice --headless --convert-to pdf --outdir "$OUTDIR" "$PPTX" > /dev/null 2>&1
PDF="$OUTDIR/$(basename "${PPTX%.pptx}").pdf"
[ -f "$PDF" ] || { echo "PDF 変換に失敗: $PDF" >&2; exit 1; }

RANGE=()
[ -n "$FIRST" ] && RANGE+=(-f "$FIRST")
[ -n "$LAST" ] && RANGE+=(-l "$LAST")
pdftoppm "${RANGE[@]}" -r 130 -png "$PDF" "$OUTDIR/page"

ls "$OUTDIR"/page-*.png

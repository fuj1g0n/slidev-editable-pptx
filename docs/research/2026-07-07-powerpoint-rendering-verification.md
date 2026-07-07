# PowerPoint 実機レンダリング検証（2026-07-07）

日付: 2026-07-07。不変の調査スナップショット。tech-slide の CI 成果物
（deck-editable.pptx / layout-tour-*-editable.pptx）で「画像が入っていない」
報告を受けた調査の記録。検証は Windows ホストの PowerPoint（M365）実機を
WSL から COM 経由で操作し、`Slide.Export` で PNG 化して行った
（LibreOffice レンダリングは判定に使えない。後述）。

## 1. 検証手法: WSL からの PowerPoint COM 自動化

```powershell
$app  = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open($src, $true, $false, $false)  # readonly, no window
$pres.Slides.Item($n).Export("slideNN.png", 'PNG', 960, 540)
```

- WSL から `powershell.exe -File` で実行できる。ファイルは Windows 側
  Temp にコピーしてから開く（`Unblock-File` で MOTW を除去）。
- **LibreOffice は svgBlip（ベクター側）を描画するため、PowerPoint と
  結果が食い違う**。今回の欠落は LibreOffice 変換 PDF ではすべて「正常」に
  見えており、実機以外での QA は偽陰性を出す。

## 2. 判明した事実

### 2-1. svgBlip の PNG フォールバックは壊れていても表示に影響しない

pptxgenjs は SVG 画像を svgBlip + PNG フォールバックの組で書くが、
フォールバック「PNG」の中身は SVG バイト列のコピーのままである。
当初これを欠落の原因と仮説し Chromium canvas でラスタライズする後処理を
入れた（1946be4）が、**ラスタライズ前の成果物（run 28859844013）を実機で
開いても全アイコンが正常表示された**。M365 PowerPoint は svgBlip を優先し、
フォールバックをデコードしない。仮説は誤りで、後処理は b41c2b9 で削除した。

### 2-2. 欠落の真因は walker の捕捉範囲（210d6a4 で修正）

| 欠落していたもの | 実装 | walker が落とした理由 |
|---|---|---|
| cover の co-branding lockup | `background: var(--brand-ms-lockup) …` の div | CSS background-image は走査対象外 |
| splash / closing / feature ::media:: のロゴマーク | `background: var(--brand-logo-mark) …` の div | 同上 |
| cover の 3D タイル群 | `aria-hidden="true"` コンテナ内の `<img>` | aria-hidden を UI 要素と同列にスキップ |

修正: url() 背景画像を picture として捕捉（background-size contain/cover を
pptxgenjs `sizing` に反映）、aria-hidden スキップをテキストに限定。

### 2-3. 残存する差異（実機スクリーンショットで確認）

1. **cover のグラデーション背景が出ない**: `.brand-cover` の
   `linear-gradient(...)` は backgroundColor でも url() でもないため落ちる。
   単色背景のみになる。ADR-0010 の検出条件 3
   （グラデーション背景 → ラスタライズ）が既にこれを想定しているが未実装。
2. **テキストの折返しが再現されず、タイル領域へ被る**: フォントは EOT
   全字埋め込みで同一だが、ブラウザと PowerPoint ではテキストレイアウト
   エンジンが異なり、字送り・折返し位置が微妙にずれる。cover タイトルの
   折返し行数が変わり、右 1/3 のタイル領域まで文字が伸びた。
   既存 ADR / requirements に対応する決定がない（新規ギャップ）。

## 3. 教訓

- PPTX の視覚 QA は PowerPoint 実機（COM 自動化）で行う。LibreOffice は
  svgBlip・フォント代替の挙動が異なり判定に使えない。
- 「見た目から推測できない」だけでなく「走査対象に入っていない」ものも
  黙って消える。generic-pptx-walker の Layer 3（ラスタライズ敗者復活 +
  理由ログ）が保証しようとしている「黙って消えない」性質の必要性を
  今回の事故が裏付けた。

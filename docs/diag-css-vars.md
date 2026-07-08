# --diag-* CSS 変数契約

Diag\* コンポーネントは実色を持たず、以下の CSS 変数のみを参照する
（`components/fills.js` の FILLS トークン）。変数の**名前と意味**は本パッケージが
規定し、**値（実色）**は消費側テーマの CSS が単一ソースとして宣言する
（tech-slide ADR-0011 D4）。

| 変数 | 意味 |
|---|---|
| `--tech-bg` | スライド背景。図の `background` トークン |
| `--tech-accent` | アクセント 1 色。図の `accent` トークン |
| `--diag-zone-outer` | 外側ゾーン（グルーピング枠）の塗り |
| `--diag-zone-inner` | 内側ゾーンの塗り |
| `--diag-node-external` | 外部システムノードの塗り |
| `--diag-emphasis` | 強調ノードの塗り |
| `--diag-cat-<hue>` | 区分色（soft 塗り）。hue は `blue` / `green` / `purple` / `orange` / `yellow` / `red` / `pink` の 7 種（ADR-0020）。アーキテクチャ図等でレイヤー・所有者・環境などの**区分**を塗り分ける。gray 相当は中立トークン（zone-outer / node-external）が担う |
| `--diag-cat-<hue>-strong` | 区分色の強め塗り。同一区分内の強調に使う |
| `--diag-icon-set` | `dark` を宣言すると octicons を白版（`/icons/octicons-dark/`）へ差し替える（`components/icons.js`） |
| `--diag-icon-plate` | ブランドロゴ用の下敷き（dark テーマでの視認性確保。変換器は roundRect として再現） |

規則:

- コンポーネントの `fill` prop はトークン名のみ受け付ける。生色コード（hex 等）は受けない。
- 消費側テーマは上記変数を `:root` ないしテーマ CSS で全て定義すること。
  未定義の変数は透明にフォールバックし、図が欠けて見える。
- 変数の追加・意味変更は本パッケージの ADR を伴う（契約変更）。
- red / yellow の区分色は error・注意喚起の意味色と色相が重なるため、
  同一図内に意味色が現れない場合に限って区分色として使う（ADR-0020）。

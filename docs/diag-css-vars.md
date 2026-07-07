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
| `--diag-icon-set` | `dark` を宣言すると octicons を白版（`/icons/octicons-dark/`）へ差し替える（`components/icons.js`） |
| `--diag-icon-plate` | ブランドロゴ用の下敷き（dark テーマでの視認性確保。変換器は roundRect として再現） |

規則:

- コンポーネントの `fill` prop はトークン名のみ受け付ける。生色コード（hex 等）は受けない。
- 消費側テーマは上記変数を `:root` ないしテーマ CSS で全て定義すること。
  未定義の変数は透明にフォールバックし、図が欠けて見える。
- 変数の追加・意味変更は本パッケージの ADR を伴う（契約変更）。

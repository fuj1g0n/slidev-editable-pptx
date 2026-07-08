// 図コンポーネント共通の塗りトークン → CSS 変数（DESIGN.md のデザイントークン）。
// 実色は themes/tech/styles/index.css が単一ソース。生色コードは受けない。
export const FILLS = {
  background: 'var(--tech-bg)',
  zoneOuter: 'var(--diag-zone-outer)',
  zoneInner: 'var(--diag-zone-inner)',
  nodeExternal: 'var(--diag-node-external)',
  emphasis: 'var(--diag-emphasis)',
  accent: 'var(--tech-accent)',
  transparent: 'transparent',
  // 区分色（ADR-0020）: 7 色相 × soft / strong
  catBlue: 'var(--diag-cat-blue)',
  catBlueStrong: 'var(--diag-cat-blue-strong)',
  catGreen: 'var(--diag-cat-green)',
  catGreenStrong: 'var(--diag-cat-green-strong)',
  catPurple: 'var(--diag-cat-purple)',
  catPurpleStrong: 'var(--diag-cat-purple-strong)',
  catOrange: 'var(--diag-cat-orange)',
  catOrangeStrong: 'var(--diag-cat-orange-strong)',
  catYellow: 'var(--diag-cat-yellow)',
  catYellowStrong: 'var(--diag-cat-yellow-strong)',
  catRed: 'var(--diag-cat-red)',
  catRedStrong: 'var(--diag-cat-red-strong)',
  catPink: 'var(--diag-cat-pink)',
  catPinkStrong: 'var(--diag-cat-pink-strong)',
}

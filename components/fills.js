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
}

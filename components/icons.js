// アイコン URL のテーマ適応。dark テーマは :root に --diag-icon-set: dark を宣言し、
// 単色 octicon を白版（/icons/octicons-dark/）へ差し替える（ADR-0004）。
// ブランド・製品ロゴは改変禁止のため差し替えず、CSS の下敷き（--diag-icon-plate）で救う。
export function resolveIconSrc(src) {
  if (!src || typeof window === 'undefined') return src
  const set = getComputedStyle(document.documentElement)
    .getPropertyValue('--diag-icon-set')
    .trim()
  if (set === 'dark') return src.replace('/icons/octicons/', '/icons/octicons-dark/')
  return src
}

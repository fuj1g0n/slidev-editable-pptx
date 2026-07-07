#!/usr/bin/env node
// 図の例外経路（drawio → SVG）の埋め込み条件を検証する。
// 対象: slides/public/figures/*.svg と figures/*.drawio の対応
//
// エラー条件（スケール・可搬性を壊すもの）:
// - .drawio 原本が figures/ に無い（テキストがソースの原則）
// - viewBox が無い（拡大縮小で劣化・ずれの原因）
// - foreignObject を含む（PowerPoint の SVG レンダラで文字が消える）
// - http(s) の外部参照を含む（閲覧環境依存になる）
// - <text> があるのに @font-face 埋め込みが無い / 許可外フォントを使う
// 警告条件:
// - ラスタ画像 (data:image/png 等) を含む（引き延ばしで劣化する）
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const FIG_SVG_DIR = 'slides/public/figures';
const FIG_SRC_DIR = 'figures';
const ALLOWED_FONTS = new Set(['OctoBiz', 'UDEV Gothic']);

let errors = 0;
const err = (msg) => {
  console.error(`NG ${msg}`);
  errors++;
};

const svgs = existsSync(FIG_SVG_DIR)
  ? readdirSync(FIG_SVG_DIR).filter((f) => f.endsWith('.svg'))
  : [];
const srcs = existsSync(FIG_SRC_DIR)
  ? readdirSync(FIG_SRC_DIR).filter((f) => f.endsWith('.drawio'))
  : [];

for (const f of svgs) {
  const p = path.join(FIG_SVG_DIR, f);
  const svg = readFileSync(p, 'utf8');
  const base = f.replace(/\.svg$/, '');

  if (!existsSync(path.join(FIG_SRC_DIR, `${base}.drawio`)))
    err(`${p}: 原本 ${FIG_SRC_DIR}/${base}.drawio が無い`);
  if (!/<svg[^>]*viewBox=/.test(svg))
    err(`${p}: viewBox が無い（scripts/figure-normalize.mjs を通す）`);
  if (svg.includes('<foreignObject'))
    err(`${p}: foreignObject を含む（drawio ラベルを html=0 にして再エクスポート）`);
  if (svg.includes('light-dark('))
    err(`${p}: light-dark() を含む（PowerPoint 非対応。figure-normalize.mjs を通す）`);
  for (const m of svg.matchAll(/(?:xlink:)?href="(https?:[^"]*)"/g))
    err(`${p}: 外部参照 ${m[1]}`);

  const hasText = /<text[\s>]/.test(svg);
  if (hasText) {
    if (!svg.includes('@font-face'))
      err(`${p}: <text> があるのにフォント埋め込みが無い（figure-normalize.mjs を通す）`);
    for (const m of svg.matchAll(/font-family[:=]\s*["']?([^;"',<]+)/g)) {
      const fam = m[1].trim();
      if (!ALLOWED_FONTS.has(fam)) err(`${p}: 許可外フォント ${fam}`);
    }
  }
  if (/<image[\s>]/.test(svg))
    console.warn(`警告 ${p}: ラスタ画像を含む。引き延ばし時に劣化するためベクタ化を推奨`);
}

for (const f of srcs) {
  const base = f.replace(/\.drawio$/, '');
  if (!svgs.includes(`${base}.svg`))
    err(`${FIG_SRC_DIR}/${f}: エクスポート済み SVG (${FIG_SVG_DIR}/${base}.svg) が無い`);
}

if (errors) {
  console.error(`lint:figures 失敗: ${errors} 件`);
  process.exit(1);
}
console.log(`lint:figures OK（SVG ${svgs.length} 件 / 原本 ${srcs.length} 件）`);

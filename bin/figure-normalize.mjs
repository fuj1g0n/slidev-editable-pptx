#!/usr/bin/env node
// drawio からエクスポートした SVG を、スライド・PPTX に安全に埋め込める形へ正規化する。
// 使い方: node scripts/figure-normalize.mjs slides/public/figures/foo.svg
//
// - foreignObject や外部参照を検出したらエラー（drawio 側で直す。ラベルは html=0 にする）
// - light-dark() CSS 関数（PowerPoint 非対応）を light 側の値へ畳み込む
// - viewBox を保証する（無ければ width/height から合成）
// - <text> があれば使用フォント（OctoBiz / UDEV Gothic）のサブセット woff2 を
//   @font-face data URI で埋め込む。PowerPoint の SVG レンダラで表示できる方式
//   （D2 時代に実機検証済み）。
import { readFileSync, writeFileSync } from 'node:fs';
import subsetFont from 'subset-font';

const FONTS = {
  OctoBiz: [
    { weight: 'normal', file: 'slides/public/fonts/OctoBiz-Regular.ttf' },
    { weight: 'bold', file: 'slides/public/fonts/OctoBiz-Bold.ttf' },
  ],
  'UDEV Gothic': [
    { weight: 'normal', file: 'slides/public/fonts/UDEVGothic-Regular.ttf' },
    { weight: 'bold', file: 'slides/public/fonts/UDEVGothic-Bold.ttf' },
  ],
};

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/figure-normalize.mjs <svg>');
  process.exit(1);
}
let svg = readFileSync(file, 'utf8');
const errors = [];

if (svg.includes('<foreignObject')) {
  errors.push(
    'foreignObject を含む。drawio のラベルを「書式付きテキスト」無効 (html=0) にして再エクスポートする',
  );
}
for (const m of svg.matchAll(/(?:xlink:)?href="(https?:[^"]*)"/g)) {
  errors.push(`外部参照を含む: ${m[1]}（data URI で埋め込むか除去する）`);
}
if (errors.length) {
  for (const e of errors) console.error(`NG ${file}: ${e}`);
  process.exit(1);
}

// light-dark(a, b) を a に畳み込む（入れ子の括弧に対応）
function foldLightDark(s) {
  let out = s;
  for (let i; (i = out.indexOf('light-dark(')) !== -1; ) {
    const start = i + 'light-dark('.length;
    let depth = 1;
    let comma = -1;
    let j = start;
    for (; j < out.length && depth > 0; j++) {
      const c = out[j];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ',' && depth === 1 && comma === -1) comma = j;
    }
    const light = out.slice(start, comma === -1 ? j - 1 : comma).trim();
    out = out.slice(0, i) + light + out.slice(j);
  }
  return out;
}
svg = foldLightDark(svg).replace(/color-scheme:\s*light dark;?\s*/g, '');

// viewBox を保証する
const svgTag = svg.match(/<svg[^>]*>/)[0];
if (!/viewBox=/.test(svgTag)) {
  const w = svgTag.match(/width="(\d+(?:\.\d+)?)(?:px)?"/)?.[1];
  const h = svgTag.match(/height="(\d+(?:\.\d+)?)(?:px)?"/)?.[1];
  if (!w || !h) {
    console.error(`NG ${file}: viewBox も width/height も無く、寸法を決められない`);
    process.exit(1);
  }
  svg = svg.replace(/<svg/, `<svg viewBox="0 0 ${w} ${h}"`);
  console.log(`viewBox: 0 0 ${w} ${h} を付与`);
}

// フォント埋め込み（使用ファミリのみ・全 <text> の字形をサブセット）
if (!svg.includes('@font-face')) {
  const chars = new Set();
  for (const m of svg.matchAll(/<text[^>]*>(.*?)<\/text>/gs)) {
    for (const c of m[1].replace(/<[^>]*>/g, '')) chars.add(c);
  }
  const families = new Set();
  for (const m of svg.matchAll(/font-family[:=]\s*["']?([^;"',<]+)/g)) {
    families.add(m[1].trim());
  }
  if (chars.size > 0) {
    const unknown = [...families].filter((f) => !FONTS[f]);
    if (unknown.length) {
      console.error(`NG ${file}: 許可外フォント ${unknown.join(', ')}（OctoBiz / UDEV Gothic のみ）`);
      process.exit(1);
    }
    const text = [...chars].join('');
    const faces = [];
    for (const fam of families) {
      for (const f of FONTS[fam]) {
        const woff2 = await subsetFont(readFileSync(f.file), text, { targetFormat: 'woff2' });
        faces.push(
          `@font-face{font-family:"${fam}";font-weight:${f.weight};` +
            `src:url("data:font/woff2;base64,${woff2.toString('base64')}") format("woff2");}`,
        );
      }
    }
    svg = svg.replace(/(<svg[^>]*>)/, `$1<style>${faces.join('')}</style>`);
    console.log(`fonts: ${[...families].join(', ')} サブセット埋め込み ${chars.size} 字`);
  }
}

writeFileSync(file, svg);
console.log(`OK ${file}`);

// 図（Vue コンポーネント）のジオメトリ lint。slides/**/*.md の <Diag> ブロックを
// 静的に解析し、DESIGN.md の余白規範を検査する:
//   1. 要素はキャンバス（Diag の w×h）からはみ出さない
//   2. 親子（完全包含）の内側余白は MIN_INSET px 以上
//   3. 兄弟要素は重ならず、間隔 MIN_GAP px 以上。
//      例外: straddle="<相手id>" を持つ要素は、その相手の縁に意図的に跨って配置できる
//   4. 同一親の下で同じ帯（y,h が一致）に横に並ぶ要素は等間隔（差 GAP_TOL px 以内）で、
//      親がボックスの場合は行の左右余白が釣り合う（差 BALANCE_TOL px 以内）。
//      straddle 先が異なる要素は別グループとして扱う。
//      ただし DiagIcon のみの行は近接要素への注釈（アンカー配置）なのでバランス検査の対象外。
//      縦に並ぶ列（x,w が一致）も等間隔とする（上下バランスはラベル帯があるため対象外）
// 対象は矩形を持つ DiagBox / DiagChevron / DiagIcon / DiagCycle / DiagCallout /
// DiagBlockArrow / DiagBadge / DiagCylinder / DiagPolygon。
// DiagText / DiagBrace とキャプション（枠なしの補助テキスト）は対象外。
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SLIDES = join(ROOT, 'slides');
const MIN_INSET = 12; // 親ゾーンと子要素の内側余白
const MIN_GAP = 8; // 兄弟要素どうしの間隔
const GAP_TOL = 2; // 行・列内のギャップの許容差
const BALANCE_TOL = 4; // 行の左右余白の許容差
const EPS = 0.5;
const round = (v) => Math.round(v * 10) / 10;

const mdFiles = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name));
    else if (e.name.endsWith('.md')) mdFiles.push(join(dir, e.name));
  }
})(SLIDES);

const parseAttrs = (s) => {
  const attrs = {};
  for (const m of s.matchAll(/:?([a-zA-Z-]+)="([^"]*)"/g)) {
    const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    attrs[key] = /^-?\d+(\.\d+)?$/.test(m[2]) ? Number(m[2]) : m[2];
  }
  return attrs;
};

const errors = [];

for (const file of mdFiles) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  let canvas = null; // { w, h, line }
  let items = []; // { name, id, x, y, w, h, line }

  const flush = () => {
    if (!canvas) return;
    const err = (msg) => errors.push(`${rel}: ${msg}`);
    const inside = (p, q) =>
      p.x >= q.x - EPS && p.y >= q.y - EPS && p.x + p.w <= q.x + q.w + EPS && p.y + p.h <= q.y + q.h + EPS;
    for (const a of items) {
      if (a.x < -EPS || a.y < -EPS || a.x + a.w > canvas.w + EPS || a.y + a.h > canvas.h + EPS)
        err(`L${a.line} ${a.id}: キャンバス (${canvas.w}x${canvas.h}) からはみ出している`);
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const [a, b] = [items[i], items[j]];
        if (a.straddle === b.id || b.straddle === a.id) continue; // 意図的な跨り配置
        if (inside(a, b) || inside(b, a)) {
          const [c, z] = inside(a, b) ? [a, b] : [b, a]; // c = 子, z = 親
          const inset = Math.min(c.x - z.x, c.y - z.y, z.x + z.w - (c.x + c.w), z.y + z.h - (c.y + c.h));
          if (inset < MIN_INSET - EPS)
            err(`L${c.line} ${c.id}: 親 ${z.id} との内側余白が ${round(inset)}px（最低 ${MIN_INSET}px）`);
          continue;
        }
        const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
        const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
        if (dx < -EPS && dy < -EPS) {
          err(`L${a.line} ${a.id} と L${b.line} ${b.id}: 包含関係でないのに重なっている`);
          continue;
        }
        const gap = Math.max(dx, dy);
        if (gap < MIN_GAP - EPS)
          err(`L${a.line} ${a.id} と L${b.line} ${b.id}: 間隔が ${round(gap)}px（最低 ${MIN_GAP}px）`);
      }
    }
    // 4. 行・列の整列（等間隔と左右バランス）
    const parentOf = (it) => {
      let best = null;
      for (const p of items) {
        if (p === it || !inside(it, p)) continue;
        if (!best || p.w * p.h < best.w * best.h) best = p;
      }
      return best; // null = キャンバス直下
    };
    const groups = new Map();
    for (const it of items) {
      const pKey = items.indexOf(parentOf(it));
      for (const key of [
        `r:${pKey}:${it.straddle ?? ''}:${it.y}:${it.h}`,
        `c:${pKey}:${it.straddle ?? ''}:${it.x}:${it.w}`,
      ]) {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(it);
      }
    }
    for (const [key, g] of groups) {
      if (g.length < 2) continue;
      const isRow = key.startsWith('r:');
      g.sort((a, b) => (isRow ? a.x - b.x : a.y - b.y));
      const gaps = [];
      for (let i = 1; i < g.length; i++)
        gaps.push(isRow ? g[i].x - (g[i - 1].x + g[i - 1].w) : g[i].y - (g[i - 1].y + g[i - 1].h));
      const spread = Math.max(...gaps) - Math.min(...gaps);
      if (gaps.length > 1 && spread > GAP_TOL + EPS)
        err(
          `L${g[0].line} ${isRow ? '行' : '列'} [${g.map((i) => i.id).join(', ')}]: ギャップが不均等 (${gaps.map(round).join(', ')}px, 許容差 ${GAP_TOL}px)`,
        );
      if (isRow) {
        // アイコンのみの行は近接要素に紐づく注釈なので左右バランスの対象外
        if (g.some((i) => i.name === 'Icon')) continue;
        const par = parentOf(g[0]);
        if (par) {
          const left = g[0].x - par.x;
          const right = par.x + par.w - (g[g.length - 1].x + g[g.length - 1].w);
          if (Math.abs(left - right) > BALANCE_TOL + EPS)
            err(
              `L${g[0].line} 行 [${g.map((i) => i.id).join(', ')}]: 親 ${par.id} 内の左右余白が不均衡 (左 ${round(left)}px / 右 ${round(right)}px, 許容差 ${BALANCE_TOL}px)`,
            );
        }
      }
    }
  };

  lines.forEach((line, idx) => {
    const n = idx + 1;
    const open = line.match(/<Diag\s([^>]*)>/);
    if (open) {
      const at = parseAttrs(open[1]);
      canvas = { w: at.w, h: at.h, line: n };
      items = [];
      return;
    }
    if (/<\/Diag>/.test(line)) {
      flush();
      canvas = null;
      return;
    }
    if (!canvas) return;
    const tag = line.match(/<Diag(Box|Chevron|Icon|Cycle|Callout|BlockArrow|Badge|Cylinder|Polygon)\s([^>]*?)\/?>/);
    if (!tag) return;
    const at = parseAttrs(tag[2]);
    // size を矩形の一辺とする部品と、その既定値（size prop が文字サイズの部品は含めない）
    const SIZE_BASED = { Icon: 32, Cycle: 120, Badge: 28 };
    const isSizeBased = tag[1] in SIZE_BASED;
    const size = at.size ?? SIZE_BASED[tag[1]];
    const rw = isSizeBased ? size : at.w;
    const rh = isSizeBased ? size : at.h;
    if ([at.x, at.y, rw, rh].some((v) => typeof v !== 'number')) return;
    items.push({ name: tag[1], id: at.id ?? at.label ?? `(${tag[1]})`, x: at.x, y: at.y, w: rw, h: rh, straddle: at.straddle, line: n });
  });
}

if (errors.length) {
  for (const e of errors) console.error(`NG ${e}`);
  console.error(`図ジオメトリ lint: ${errors.length} 件のエラー`);
  process.exit(1);
}
console.log('図ジオメトリ lint: OK');

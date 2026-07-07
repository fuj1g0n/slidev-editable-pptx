// 公式アイコンセット（Azure / Microsoft Entra）とブランドロゴを取得して
// slides/public/icons/ に展開する。
// - Azure Architecture Icons V23（claim-0019）
// - Microsoft Entra architecture icons Oct 2023（claim-0022）
// - ブランドロゴ: simple-icons（CC0、claim-0020）と Wikimedia Commons の
//   パブリックドメインロゴ（Windows / Windows 365、claim-0023）→ brands/
// 展開先は gitignore 対象。バージョンマーカーが一致すればスキップする（冪等）。
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';

const ROOT = process.cwd();
const DEST = join(ROOT, 'slides', 'public', 'icons');
const MARKER = join(DEST, '.version');
const VERSION = 'azure=V23 entra=Oct2023 brands=si16.25.0+commons-pd+dev4';

// 単体ファイルで取得するブランドロゴ。simple-icons は単色（fill 無指定）なので
// 公式ブランドカラーを fill として注入する。
const SIMPLE_ICONS = 'https://cdn.jsdelivr.net/npm/simple-icons@16.25.0/icons';
const BRAND_FILES = [
  {
    file: 'windows.svg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Windows_logo_-_2021.svg',
  },
  { file: 'apple.svg', url: `${SIMPLE_ICONS}/apple.svg`, color: '#1a1a2e' },
  { file: 'ubuntu.svg', url: `${SIMPLE_ICONS}/ubuntu.svg`, color: '#E95420' },
  { file: 'git.svg', url: `${SIMPLE_ICONS}/git.svg`, color: '#F05032' },
  { file: 'docker.svg', url: `${SIMPLE_ICONS}/docker.svg`, color: '#2496ED' },
  { file: 'terraform.svg', url: `${SIMPLE_ICONS}/terraform.svg`, color: '#844FBA' },
  { file: 'typescript.svg', url: `${SIMPLE_ICONS}/typescript.svg`, color: '#3178C6' },
  {
    // Java 公式マスコット Duke（BSD、claim-0024）。原本はページサイズの
    // 余白が大きいため viewBox を実絵の範囲にトリムする。
    file: 'duke.svg',
    url: 'https://raw.githubusercontent.com/openjdk/duke/master/vector/Wave.svg',
    viewBox: '188 192 230 411',
  },
  { file: 'dotnet.svg', url: `${SIMPLE_ICONS}/dotnet.svg`, color: '#512BD4' },
  { file: 'python.svg', url: `${SIMPLE_ICONS}/python.svg`, color: '#3776AB' },
  {
    file: 'vscode.svg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Visual_Studio_Code_1.35_icon.svg',
  },
  {
    file: 'visual-studio.svg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Visual_Studio_Icon_2022.svg',
  },
  {
    file: 'windows-365.svg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f9/Windows365-logo.svg',
  },
  {
    // AWS ロゴ（Apache-2.0、claim-0025）
    file: 'aws.svg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg',
  },
  {
    // Microsoft Azure ロゴ（PD、claim-0025）
    file: 'azure.svg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Microsoft_Azure.svg',
  },
  {
    // Google Cloud ロゴ（PD、claim-0025）
    file: 'gcp.svg',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/01/Google-cloud-platform.svg',
  },
];

const SOURCES = [
  {
    name: 'azure',
    url: 'https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V23.zip',
    // Azure_Public_Service_Icons/Icons/<category>/<file>.svg → azure/<category>/<file>.svg
    map(path) {
      const m = path.match(/^Azure_Public_Service_Icons\/Icons\/(.+\.svg)$/);
      if (!m) return null;
      return m[1]
        .toLowerCase()
        .replaceAll(' + ', '-')
        .replaceAll(' ', '-');
    },
  },
  {
    name: 'entra',
    url: 'https://download.microsoft.com/download/3/1/a/31a56038-856a-4489-88e4-ee5a1c4352be/Microsoft%20Entra%20architecture%20icons%20-%20Oct%202023.zip',
    // color/BW の SVG のみ → entra/color/<file>.svg, entra/bw/<file>.svg
    map(path) {
      const m = path.match(/^[^/]+\/Microsoft Entra (color|BW) icons SVG\/(.+\.svg)$/);
      if (!m) return null;
      const file = m[2].toLowerCase().replaceAll(' ', '-');
      return `${m[1].toLowerCase()}/${file}`;
    },
  },
];

if (existsSync(MARKER) && readFileSync(MARKER, 'utf8').trim() === VERSION) {
  console.log(`icons up to date (${VERSION})`);
  process.exit(0);
}

// azure/entra/brands のみ消す（octicons/ は diagram-icons.mjs が管理する）
for (const src of SOURCES) rmSync(join(DEST, src.name), { recursive: true, force: true });
rmSync(join(DEST, 'brands'), { recursive: true, force: true });

// Wikimedia は UA なしのリクエストを 429 で拒むことがあるため、UA を付けてリトライする
const UA = 'tech-slide-fetch-icons/1.0 (https://github.com/fuj1g0n-demo-01/tech-slide)';
async function fetchWithRetry(url) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.status !== 429) return res;
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  return fetch(url, { headers: { 'user-agent': UA } });
}

for (const src of SOURCES) {
  console.log(`fetching ${src.url}`);
  const res = await fetchWithRetry(src.url);
  if (!res.ok) {
    console.error(`download failed: ${res.status} ${src.url}`);
    process.exit(1);
  }
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
  let count = 0;
  for (const [path, data] of Object.entries(zip)) {
    const rel = src.map(path);
    if (!rel || data.length === 0) continue;
    const out = join(DEST, src.name, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, data);
    count++;
  }
  console.log(`  ${src.name}: ${count} svgs`);
}

mkdirSync(join(DEST, 'brands'), { recursive: true });
for (const { file, url, color, viewBox } of BRAND_FILES) {
  console.log(`fetching ${url}`);
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    console.error(`download failed: ${res.status} ${url}`);
    process.exit(1);
  }
  let svg = await res.text();
  if (color) svg = svg.replace('<svg ', `<svg fill="${color}" `);
  if (viewBox) {
    svg = svg.replace(/<svg([^>]*)>/, (_, attrs) => {
      const rest = attrs.replace(/\s(?:width|height|viewBox)="[^"]*"/g, '');
      return `<svg${rest} viewBox="${viewBox}">`;
    });
  }
  writeFileSync(join(DEST, 'brands', file), svg);
}
console.log(`  brands: ${BRAND_FILES.length} svgs`);

writeFileSync(MARKER, VERSION + '\n');
console.log('done');

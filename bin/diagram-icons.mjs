#!/usr/bin/env node
// Vue コンポーネント図で使う概念アイコン（Octicons）を @iconify-json/octicon
// から抽出して単色 SVG として書き出す。色は DESIGN.md の foreground トークン。
// dark テーマ用に白の octicons-dark/ も併せて生成する（切替は --diag-icon-set。ADR-0004）。
// 出力先: slides/public/icons/octicons{,-dark}/（gitignore 対象。npm run fetch:icons が呼ぶ）。
// 追加したいアイコンは ICONS に octicon 名で足す（DESIGN.md の許可リスト参照）。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
// セットごとの出力先と色。light は DESIGN.md tokens.color.foreground、dark は白
const SETS = [
  { dest: join(ROOT, 'slides', 'public', 'icons', 'octicons'), color: '#1a1a2e' },
  { dest: join(ROOT, 'slides', 'public', 'icons', 'octicons-dark'), color: '#ffffff' },
];

const ICONS = [
  'person-24', // 著者 / Coding Agent / 利用者
  'repo-24', // git リポジトリ
  'gear-24', // ビルド
  'shield-check-24', // 検証ゲート / Advanced Security
  'package-24', // 成果物 / Packages
  'mark-github-16', // GitHub（サービス全体）
  'issue-opened-24', // Issues
  'project-24', // Projects
  'codespaces-24', // Codespaces
  'copilot-24', // Copilot
  'workflow-24', // Actions
  'comment-discussion-24', // Discussions
  'tag-24', // Releases
  'code-24', // コード開発
  'git-pull-request-24', // Pull Request
  'cloud-24', // アプリ運用基盤（クラウド/オンプレ）
  'device-desktop-24', // 物理マシン（開発端末）
  'file-24', // 単一ファイル（Markdown など）
  'file-media-24', // 生成物（HTML / PDF）
];

const { icons } = require('@iconify-json/octicon/icons.json');
for (const { dest, color } of SETS) {
  mkdirSync(dest, { recursive: true });
  for (const name of ICONS) {
    const icon = icons[name];
    if (!icon) {
      console.error(`octicon not found: ${name}`);
      process.exit(1);
    }
    const size = name.endsWith('-16') ? 16 : 24;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
      icon.body.replaceAll('currentColor', color) +
      '</svg>\n';
    writeFileSync(join(dest, `octicon-${name}.svg`), svg);
  }
  console.log(`diagram icons: ${ICONS.length} 個を ${dest} に出力`);
}

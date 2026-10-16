// 生成 README 用的动画终端演示 assets/demo.svg、三种主题示例卡和 social preview（mock 数据）
import { mkdtempSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from '../src/app.js';
import { esc } from '../src/card-core.js';
import { svgToPng, writeCard } from '../src/card.js';

const ROOT = resolve(import.meta.dirname, '..'); const A = join(ROOT, 'assets'); mkdirSync(A, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'feast-assets-')); const f = join(dir, 's.json');
process.env.NO_COLOR = '1';
const cap = []; const r = await run(['demo', '--mock', '--out', dir, '--file', f], s => cap.push(...String(s).split('\n')));
for (const t of ['pr', 'receipt']) writeCard(r.ctx, A, `theme-${t}`, t);
writeCard(r.ctx, A, 'theme-git', 'git');

// —— 动画终端：逐行出现的 SVG（纯 CSS 动画，GitHub README 可直接播放）——
const script = [
  ['$ npx github:Jasonin2099/mcd-team-feast demo --mock', '#FFC72C', 0.6],
  ...cap.filter(l => !/账单卡|HTML:|确认无误/.test(l)).slice(0, 26).map(l => [l, /^\s*\+/.test(l) ? '#7EE787' : /^\s*-/.test(l) ? '#FF7B72' : /^commit|人均/.test(l) ? '#FFC72C' : '#C9D1D9', 0.18]),
  ['$ feast blame', '#FFC72C', 0.8],
];
const bl = []; await run(['blame', '--mock', '--file', f], s => bl.push(...String(s).split('\n')));
script.push(...bl.filter(Boolean).slice(1, 9).map(l => [l, l.startsWith('💸') || l.startsWith('🔥') || l.startsWith('🥗') ? '#FFC72C' : '#C9D1D9', 0.18]));
script.push(['$ feast order --confirm 35579a   # 不带确认码绝不下单 ✅', '#7EE787', 0.8]);
const lh = 19, W = 860, VIS = 22, H = 40 + VIS * lh + 20; let t = 0; const total = script.reduce((s, x) => s + x[2], 0) + 4;
const rows = script.map(([txt, col, d], i) => { t += d; const p = (t / total * 100).toFixed(2); return `<text class="l" style="animation-name:a${i}" x="18" y="${40 + i * lh}" fill="${col}" xml:space="preserve">${esc(txt)}</text><style>@keyframes a${i}{0%,${p}%{opacity:0}${(+p + 0.01).toFixed(2)}%,100%{opacity:1}}</style>`; });
const scrollKF = script.map((_, i) => { const tt = script.slice(0, i + 1).reduce((s, x) => s + x[2], 0); return `${(tt / total * 100).toFixed(2)}%{transform:translateY(${-Math.max(0, i - VIS + 1) * lh}px)}`; }).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>.l{opacity:0;animation-duration:${total}s;animation-iteration-count:infinite;animation-timing-function:steps(1)}#s{animation:sc ${total}s infinite steps(1)}@keyframes sc{0%{transform:translateY(0)}${scrollKF}100%{transform:translateY(${-Math.max(0, script.length - VIS) * lh}px)}}</style>
<rect width="${W}" height="${H}" rx="12" fill="#0D1117"/><rect width="${W}" height="30" rx="12" fill="#161B22"/><rect y="18" width="${W}" height="12" fill="#161B22"/>
<circle cx="20" cy="15" r="5.5" fill="#FF5F56"/><circle cx="38" cy="15" r="5.5" fill="#FFBD2E"/><circle cx="56" cy="15" r="5.5" fill="#27C93F"/>
<text x="${W / 2}" y="20" fill="#8B949E" font-size="12" text-anchor="middle" font-family="monospace">mcd-team-feast — zsh</text>
<clipPath id="c"><rect x="0" y="32" width="${W}" height="${H - 36}"/></clipPath>
<g clip-path="url(#c)"><g id="s" font-family="'DejaVu Sans Mono','Noto Sans Mono CJK SC',Menlo,Consolas,monospace" font-size="13.5">${rows.join('\n')}</g></g>
</svg>`;
writeFileSync(join(A, 'demo.svg'), svg);

console.log('assets ok:', A);

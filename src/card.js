import { yuan } from './money.js';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 中文按 2 列宽估算，用于等宽对齐
const width = s => [...String(s)].reduce((w, c) => w + (c.charCodeAt(0) > 255 ? 2 : 1), 0);
const padEnd = (s, n) => s + ' '.repeat(Math.max(0, n - width(s)));
const clip = (s, n) => { let out = '', w = 0; for (const c of s) { const cw = c.charCodeAt(0) > 255 ? 2 : 1; if (w + cw > n - 1) return out + '…'; out += c; w += cw; } return out; };

export function receiptLines({ team, bill, plan, mode, now }) {
  const hash = createHash('sha1').update(JSON.stringify(team.picks) + team.createdAt).digest('hex');
  const L = [];
  L.push(['y', `commit ${hash}`]);
  L.push(['d', `Author: ${team.organizer} <team@1024.feast>`]);
  L.push(['d', `Date:   ${now?.date || team.createdAt.slice(0, 10)} ${now?.time || ''}  ${now?.festival || ''}`]);
  L.push(['n', '']);
  L.push(['w', `    feat(${team.store?.storeCode || 'store'}): ${team.title}`]);
  L.push(['d', `    📍 ${team.store?.storeName || ''}`]);
  L.push(['n', '']);
  for (const p of bill.people) {
    L.push(['g', `  + ${clip(p.who, 12)}  ${clip(p.items.join(' '), 34)}`, `¥${yuan(p.pay)}`]);
  }
  L.push(['n', '']);
  for (const a of plan.applied) L.push(['r', `  - 🎟  ${clip(a.title, 36)}`, a.discount != null ? `-¥${yuan(a.discount)}` : '']);
  const couponOff = plan.applied.reduce((s, a) => s + (a.discount || 0), 0);
  const promo = plan.applied.some(a => a.discount == null) ? 0 : plan.discount - couponOff;
  if (promo > 0) L.push(['r', '  - 🏷  门店活动价 / 促销优惠', `-¥${yuan(promo)}`]);
  if (!plan.applied.length) L.push(['d', '  - 🎟  (暂无可用优惠券，可先在麦麦省领券)']);
  L.push(['n', '']);
  L.push(['d', ` ${bill.people.length} people changed, ${bill.people.reduce((s, p) => s + p.items.length, 0)} items(+), ${plan.applied.length} coupons(-)`]);
  L.push(['w', ` 原价 ¥${yuan(plan.subtotal)}  优惠 -¥${yuan(plan.discount)}  实付 ¥${yuan(plan.total)}`]);
  L.push(['y', ` 人均 ¥${yuan(bill.avg)}  ·  省下 ${plan.subtotal ? Math.round(plan.discount * 100 / plan.subtotal) : 0}%`]);
  L.push(['n', '']);
  L.push(['d', `$ git push origin feast  # ${mode === 'mock' ? 'mock 演示数据' : 'via 麦当劳 MCP'} · mcd-team-feast`]);
  return L;
}

const COLORS = { y: '#FFC72C', g: '#7EE787', r: '#FF7B72', w: '#E6EDF3', d: '#8B949E', n: '#E6EDF3' };

export function renderSVG(ctx) {
  const lines = receiptLines(ctx);
  const lh = 24, top = 70, W = 780, H = top + lines.length * lh + 30;
  const body = lines.map(([c, t, r], i) => `<text x="28" y="${top + i * lh}" fill="${COLORS[c]}" xml:space="preserve">${esc(t)}</text>` +
    (r ? `<text x="${W - 32}" y="${top + i * lh}" fill="${COLORS[c]}" text-anchor="end">${esc(r)}</text>` : '')).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="14" fill="#0D1117"/>
  <rect width="${W}" height="38" rx="14" fill="#161B22"/><rect y="24" width="${W}" height="14" fill="#161B22"/>
  <circle cx="24" cy="19" r="6" fill="#FF5F56"/><circle cx="44" cy="19" r="6" fill="#FFBD2E"/><circle cx="64" cy="19" r="6" fill="#27C93F"/>
  <text x="${W / 2}" y="24" fill="#8B949E" font-size="13" text-anchor="middle" font-family="monospace">~/1024-feast — git log -1 --stat</text>
  <rect x="${W - 64}" y="8" width="44" height="22" rx="4" fill="#DA291C"/><text x="${W - 42}" y="24" fill="#FFC72C" font-size="15" font-weight="bold" text-anchor="middle" font-family="sans-serif">M</text>
  <g font-family="'DejaVu Sans Mono','Noto Sans Mono CJK SC','Noto Sans CJK SC',Menlo,Consolas,monospace" font-size="15">
  ${body}
  </g>
</svg>`;
}

export function renderHTML(ctx) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(ctx.team.title)} · 麦麦拼单</title>
<style>body{margin:0;background:#010409;display:flex;justify-content:center;padding:24px}</style></head>
<body>${renderSVG(ctx)}</body></html>`;
}

function findChrome() {
  const c = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  return c.find(p => existsSync(p));
}

// 输出 svg + html，若本机有 Chrome 则额外截图 png
export function writeCard(ctx, outDir = '.', base = 'feast-receipt') {
  const svg = renderSVG(ctx);
  const svgPath = resolve(outDir, base + '.svg'); writeFileSync(svgPath, svg);
  const htmlPath = resolve(outDir, base + '.html'); writeFileSync(htmlPath, renderHTML(ctx));
  const out = { svg: svgPath, html: htmlPath };
  const chrome = findChrome();
  if (chrome) {
    const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
    const pngPath = resolve(outDir, base + '.png');
    const page = resolve(outDir, `.${base}.tmp.html`);
    writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:transparent}</style>${svg}`);
    try {
      execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
        `--force-device-scale-factor=2`, `--window-size=${w},${h}`, `--screenshot=${pngPath}`, 'file://' + page], { stdio: 'ignore', timeout: 30000 });
      if (existsSync(pngPath)) out.png = pngPath;
    } catch { /* 无头浏览器不可用时静默跳过 */ }
    try { execFileSync('rm', ['-f', page]); } catch {}
  }
  return out;
}

export function renderTerminal(ctx) {
  const ansi = { y: 33, g: 32, r: 31, w: 37, d: 90, n: 0 };
  const color = process.stdout.isTTY && !process.env.NO_COLOR;
  return receiptLines(ctx).map(([c, t, r]) => { const s = r ? padEnd(t, 56) + r.padStart(9) : t; return color ? `\x1b[${ansi[c]}m${s}\x1b[0m` : s; }).join('\n');
}

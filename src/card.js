import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderSVG, receiptLines, esc, padEnd, THEMES } from './card-core.js';
export { renderSVG, receiptLines, THEMES };

export function renderHTML(ctx, theme) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(ctx.team.title)} · 麦麦拼单</title>
<style>body{margin:0;background:#010409;display:flex;justify-content:center;padding:24px}</style></head>
<body>${renderSVG(ctx, theme)}</body></html>`;
}

export function findChrome() {
  const c = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  return c.find(p => existsSync(p));
}

export function svgToPng(svg, pngPath) {
  const chrome = findChrome(); if (!chrome) return null;
  const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
  const page = pngPath + '.tmp.html';
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:transparent}</style>${svg}`);
  try {
    execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
      '--force-device-scale-factor=2', `--window-size=${w},${h}`, `--screenshot=${pngPath}`, 'file://' + page], { stdio: 'ignore', timeout: 30000 });
  } catch { /* 无头浏览器不可用时静默跳过 */ }
  rmSync(page, { force: true });
  return existsSync(pngPath) ? pngPath : null;
}

// 输出 svg + html，若本机有 Chrome 则额外导出 png
export function writeCard(ctx, outDir = '.', base = 'feast-receipt', theme = 'git') {
  const svg = renderSVG(ctx, theme);
  const out = { svg: resolve(outDir, base + '.svg'), html: resolve(outDir, base + '.html') };
  writeFileSync(out.svg, svg); writeFileSync(out.html, renderHTML(ctx, theme));
  const png = svgToPng(svg, resolve(outDir, base + '.png')); if (png) out.png = png;
  return out;
}

export function renderTerminal(ctx) {
  const ansi = { y: 33, g: 32, r: 31, w: 37, d: 90, n: 0 };
  const color = process.stdout.isTTY && !process.env.NO_COLOR;
  return receiptLines(ctx).map(([c, t, r]) => { const s = r ? padEnd(t, 56) + r.padStart(9) : t; return color ? `\x1b[${ansi[c]}m${s}\x1b[0m` : s; }).join('\n');
}

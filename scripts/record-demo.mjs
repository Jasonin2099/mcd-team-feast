import puppeteer from 'puppeteer-core';
const BASE = (process.env.WEB || 'http://127.0.0.1:8000') + '/?sync=' + encodeURIComponent((process.env.SYNC || 'http://127.0.0.1:8787'));
const W = 390, H = 760; const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
async function client(name) { const ctx = await b.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 }); await p.evaluateOnNewDocument(() => { localStorage.feastLang = 'zh'; }); p.on('dialog', d => d.accept()); return p; }
const click = (p, s) => p.evaluate(s => document.querySelector(s)?.click(), s);
const scrollTo = (p, s) => p.evaluate(s => { const e = document.querySelector(s); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - 60, behavior: 'instant' }); }, s);
const H_ = await client(), A = await client(), B = await client();
let f = 0; const pages = [H_, A, B];
async function snap(n = 1) { for (let k = 0; k < n; k++) { await Promise.all(pages.map((p, i) => p.screenshot({ path: `/tmp/rec/f${String(f).padStart(4, '0')}-${i}.png` }))); f++; } }
for (const p of pages) await p.goto(BASE, { waitUntil: 'load' });
await wait(600); await snap(3);
await click(H_, '#start'); await wait(300); await H_.type('#fMe', '老王', { delay: 60 }); await snap(2);
await click(H_, '#goLive'); await H_.waitForFunction(() => document.querySelector('#modeChip.live')); await wait(300); await snap(3);
const url = await H_.evaluate(() => location.href);
await Promise.all([A.goto(url, { waitUntil: 'load' }), B.goto(url, { waitUntil: 'load' })]); await wait(800); await snap(2);
await A.$eval('#fMe', e => e.value = ''); await B.$eval('#fMe', e => e.value = '');
await A.type('#fMe', '小李', { delay: 50 }); await B.type('#fMe', 'Mia', { delay: 50 }); await snap(1);
await click(A, '#joinBtn'); await click(B, '#joinBtn'); await wait(700); await snap(2);
for (const p of pages) await scrollTo(p, '#listCard');
await snap(2);
const steps = [[H_, 'BM001'], [A, 'BM002'], [B, 'SN001'], [A, 'DR001'], [H_, 'DR002'], [B, 'DS001'], [A, 'DR001']];
for (const [p, c] of steps) { await click(p, `.item[data-c="${c}"]`); await wait(450); await snap(1); }
await click(A, '#doneBtn'); await wait(400); await snap(2); await click(B, '#doneBtn'); await wait(400); await snap(2);
await click(H_, '[data-dl="10"]'); await wait(400); await snap(2);
for (const p of pages) await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
await click(H_, '#lockBtn'); await wait(700); await snap(4);
await click(H_, '#billBtn'); await click(A, '#billBtn'); await click(B, '#billBtn'); await wait(1200); await snap(6);
await b.close(); console.log('frames', f);

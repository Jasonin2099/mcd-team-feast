// 录 README 的实时拼单演示：三个客户端（团长/小李/Mia）逐步截图 + frames.json（每帧的步骤标题和停留时长）
// 用法：CHROME=<chrome 路径> node scripts/record-demo.mjs [输出目录]，再 python scripts/compose-demo.py <输出目录>
// 需 npm i --no-save puppeteer-core；默认在本机起网页静态服务和同步服务（:8788），录完关掉
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve } from './serve.mjs';

const OUT = path.resolve(process.argv[2] || 'shots/rec'); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const SYNC = 'http://127.0.0.1:8788';
const sync = spawn(process.execPath, ['server/sync-server.js'], { env: { ...process.env, PORT: '8788', DATA: '' }, stdio: 'ignore' });
const web = await serve(); const BASE = web.url + '/?sync=' + encodeURIComponent(SYNC);
const W = 390, H = 760; const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
async function client() {
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.evaluateOnNewDocument(() => { localStorage.feastLang = 'zh'; }); p.on('dialog', d => d.accept()); return p;
}
const click = async (p, s) => { await p.waitForSelector(s, { timeout: 8000 }); await p.evaluate(s => document.querySelector(s).click(), s); };
const tap = async (p, s) => { await p.$eval(s, e => e.scrollIntoView({ block: 'center' })); await p.tap(s); }; // 真实点按：昵称框失焦 → 自动建房
const scrollTo = (p, s) => p.evaluate(s => { const e = document.querySelector(s); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - 60, behavior: 'instant' }); }, s);
const H_ = await client(), A = await client(), B = await client(); const pages = [H_, A, B];
const frames = []; let step = '';
async function snap(n = 1, ms = 650) {
  const i = frames.length; await Promise.all(pages.map((p, k) => p.screenshot({ path: path.join(OUT, `f${String(i).padStart(4, '0')}-${k}.png`) })));
  frames.push({ step, ms: ms * n });
}

step = '① 开团，填名字就自动开启实时同步';
for (const p of pages) await p.goto(BASE, { waitUntil: 'load' });
await H_.waitForSelector('#start'); await wait(600); await snap(1, 1950);
await click(H_, '#start'); await wait(300); await H_.type('#fMe', '老王', { delay: 60 });
await tap(H_, '.item[data-c="ST001"]'); await H_.waitForFunction(() => document.querySelector('#modeChip.live')); await wait(400);
await H_.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await snap(1, 1950);
const url = await H_.evaluate(() => location.href);

step = '② 成员打开链接、填昵称加入';
await Promise.all([A.goto(url, { waitUntil: 'load' }), B.goto(url, { waitUntil: 'load' })]); await A.waitForSelector('#joinBtn'); await B.waitForSelector('#joinBtn'); await wait(800);
await A.$eval('#fMe', e => e.value = ''); await B.$eval('#fMe', e => e.value = '');
await A.type('#fMe', '小李', { delay: 50 }); await B.type('#fMe', 'Mia', { delay: 50 }); await snap(1, 1300);
await click(A, '#joinBtn'); await click(B, '#joinBtn'); await wait(800); await snap(1, 1300);

step = '③ 7 个品类一键跳转，三端实时同步';
for (const p of pages) await scrollTo(p, '#listCard'); await wait(200); await snap(1, 1300);
for (const [p, c] of [[A, 'BM002'], [B, 'CK001'], [A, 'DR001']]) { await click(p, `.item[data-c="${c}"]`); await wait(450); await snap(); }
// Mia 用品类跳转条直达麦咖啡
await scrollTo(B, '.cats'); await wait(200); await snap(1, 1300);
await click(B, '.cats [data-jump="6"]'); await wait(300); await snap(1, 1300);
await click(B, '.item[data-c="MC002"]'); await wait(450); await snap(1, 1300);
await scrollTo(B, '#listCard'); await click(H_, '.item[data-c="DR002"]'); await wait(450); await snap(1, 1950);

step = '④ 选好了 + 截止倒计时';
await click(A, '#doneBtn'); await wait(400); await click(B, '#doneBtn'); await wait(400); await snap(1, 1300);
await click(H_, '[data-dl="10"]'); await wait(400); for (const p of pages) await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await snap(1, 1950);

step = '⑤ 团长确认锁单 → 最终分账';
await click(H_, '#lockBtn'); await wait(700); await snap(1, 1950);
for (const p of pages) await click(p, '#billBtn'); await wait(1200); await snap(1, 3900);

fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify({ labels: ['团长 · 老王', '成员 · 小李', '成员 · Mia'], frames }, null, 1));
await b.close(); web.close(); sync.kill(); console.log('frames', frames.length, '→', OUT);

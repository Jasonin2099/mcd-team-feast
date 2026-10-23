import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve } from './serve.mjs';
// 用法：CHROME=<chrome 路径> node scripts/web-qa-multi.mjs [前缀]  （需 npm i --no-save puppeteer-core）
// 默认在本机起网页静态服务 + 同步服务（:8787）；给 SYNC / WEB 可改测远端
const SYNC = process.env.SYNC || 'http://127.0.0.1:8787'; const REMOTE = !SYNC.includes('127.0.0.1');
const web = process.env.WEB ? { url: process.env.WEB, close() {} } : await serve();
const BASE = web.url + '/?sync=' + encodeURIComponent(SYNC);
// 本地同步服务由脚本管理；Windows 上 kill 不会触发 SIGTERM 落盘，所以重启前等过 5s 的定时保存
const DATA = path.join(os.tmpdir(), 'feast-qa-rooms.json'); let sync = null;
const startSync = () => { sync = spawn(process.execPath, ['server/sync-server.js'], { env: { ...process.env, PORT: new URL(SYNC).port, DATA }, stdio: 'ignore' }); };
const stopSync = () => new Promise(r => { if (!sync || sync.exitCode !== null) return r(); sync.once('exit', r); sync.kill(); });
if (!REMOTE) { fs.rmSync(DATA, { force: true }); startSync(); }
const OUT = (process.env.OUT || 'shots') + '/' + (process.argv[2] || 'room'); fs.mkdirSync(path.dirname(OUT), { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));
if (!REMOTE) await wait(500);
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? '✓ ' : '✗ ') + m); };
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
async function client(scheme = 'light') { const ctx = await b.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 1 }); await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]); p.on('pageerror', e => fails.push('pageerror ' + e.message)); p.on('dialog', d => d.accept()); await p.evaluateOnNewDocument(() => { try { localStorage.feastLang = 'zh'; } catch {} }); return p; }
// 真实鼠标点击（会让昵称框失焦 → 自动建房）；先滚到屏幕中间，免得被底部操作栏挡住
const tap = async (p, sel) => { await p.$eval(sel, e => e.scrollIntoView({ block: 'center' })); await p.click(sel); };
const click = async (p, sel) => { await p.waitForSelector(sel, { timeout: 8000 }); await p.evaluate(s => document.querySelector(s).click(), sel); };
const until = async (p, fn, arg, ms = 5000, msg = '') => { try { await p.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); return true; } catch { return false; } };

const H = await client(); await H.goto(BASE, { waitUntil: 'load' });
await click(H, '#start'); await wait(300);
await H.type('#fMe', '老王'); await tap(H, '.item[data-c="BM001"]'); // 昵称失焦即自动建房间
ok(await until(H, () => /#r=/.test(location.hash) && document.querySelector('#modeChip.live'), null, 6000), 'host created room, chip live');
const url = await H.evaluate(() => location.href); console.log(url);
ok(await H.evaluate(() => document.querySelectorAll('#listCard .person').length === 1 && /巨无霸/.test(document.getElementById('listCard').textContent)), 'host local pick carried into room');

const A = await client('dark'), B = await client();
await Promise.all([A.goto(url, { waitUntil: 'load' }), B.goto(url, { waitUntil: 'load' })]);
await wait(1000);
await A.screenshot({ path: OUT + '-join-412-dark.png' });
for (const [p, n] of [[A, '小李'], [B, 'Mia']]) { await p.$eval('#fMe', el => el.value = ''); await p.type('#fMe', n); await click(p, '#joinBtn'); }
ok(await until(H, () => document.querySelectorAll('#listCard .person').length === 3, null, 5000), 'host sees 3 members');
// 并发点单
await Promise.all([
  (async () => { for (const c of ['BM002', 'DR001', 'DR001']) { await click(A, `.item[data-c="${c}"]`); await wait(60); } })(),
  (async () => { for (const c of ['SN001', 'DS001']) { await click(B, `.item[data-c="${c}"]`); await wait(60); } })(),
  (async () => { await click(H, '.item[data-c="DR002"]'); })(),
]);
const want = () => { const t = document.getElementById('listCard').textContent; return /麦辣鸡腿堡/.test(t) && /×2/.test(t) && /麦乐鸡/.test(t) && /麦旋风/.test(t) && /麦咖啡/.test(t); };
for (const [p, n] of [[H, 'host'], [A, 'A'], [B, 'B']]) ok(await until(p, want, null, 6000), `${n} sees everyone's concurrent picks`);
ok(await until(H, () => document.querySelectorAll('#listCard .dot.on').length === 3, null, 4000), 'presence: 3 online');
await click(A, '#doneBtn');
ok(await until(H, () => /· 1 人选好/.test(document.querySelector('#listCard .rc-presence').textContent), null, 4000), 'host sees A done');
await click(H, '[data-dl="10"]');
ok(await until(B, () => /还剩 (09|10):/.test(document.querySelector('.cd').textContent), null, 4000), 'countdown visible to members'); console.log(await B.$eval('.cd', e => e.textContent), await H.$eval('.cd', e => e.textContent));
await H.screenshot({ path: OUT + '-host-412.png', fullPage: true });
await B.screenshot({ path: OUT + '-member-412.png' });
// 掉线重连：B 断网 → 主机看到离线；恢复后回来
await B.close();
ok(await until(H, () => document.querySelectorAll('#listCard .dot.on').length === 2, null, 5000), 'host sees B go offline');
// 服务器重启 → 客户端自动重连、数据保留
if (!REMOTE) { await wait(5500); await stopSync();
ok(await until(H, () => !document.querySelector('#modeChip.live'), null, 6000), 'chip leaves live on server loss');
startSync();
ok(await until(H, () => document.querySelector('#modeChip.live') && document.querySelectorAll('#listCard .person').length === 3, null, 20000), 'reconnected after server restart, state persisted');
ok(await until(A, () => document.querySelector('#modeChip.live'), null, 20000), 'member reconnected'); }
// 锁单
await click(H, '#lockBtn');
ok(await until(A, () => document.querySelector('.a-menu.locked') && document.querySelector('.item[disabled]') && !document.querySelector('#listCard .qty'), null, 5000), 'member read-only after lock');
const r = await A.evaluate(async () => { const id = location.hash.slice(3); const c = JSON.parse(localStorage.getItem('feastRoom:' + id)); const res = await fetch(new URLSearchParams(location.search).get('sync') + '/rooms/' + id + '/op', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'picks', mid: c.mid, key: c.key, picks: [] }) }); return res.status; });
ok(r === 423, 'server rejects member edit after lock (423)');
await A.screenshot({ path: OUT + '-locked-member-412-dark.png' });
await click(A, '#billBtn'); await wait(800);
ok(await A.evaluate(() => /最终分账/.test(document.body.textContent) && !!document.querySelector('.preview svg')), 'member sees final split');
await A.screenshot({ path: OUT + '-final-bill-412-dark.png' });
await click(H, '#unlockBtn');
ok(await until(A, () => /还没锁单/.test(document.body.textContent), null, 5000), 'member bill banner flips after unlock');
await click(H, '#lockBtn'); await wait(300); await click(H, '#billBtn'); await wait(800);
await H.screenshot({ path: OUT + '-host-bill-412.png' });
// 新客户端在锁单时打开：不能加入
const C = await client(); await C.goto(url, { waitUntil: 'load' }); await wait(800);
ok(await C.evaluate(() => document.getElementById('joinBtn')?.disabled === true), 'late joiner blocked while locked');
// 离线回退：同步服务不可达
const D = await client(); await D.goto(web.url + '/?sync=' + encodeURIComponent('http://127.0.0.1:1'), { waitUntil: 'load' });
await click(D, '#start'); await wait(200); await D.type('#fMe', 'X'); await tap(D, '.item[data-c="BM001"]');
ok(await until(D, () => /连不上/.test(document.getElementById('toast').textContent) && document.getElementById('toast').classList.contains('on'), null, 12000) && await D.evaluate(() => !/#r=/.test(location.hash) && document.querySelector('#modeChip').classList.contains('warn')), 'fallback to link mode when sync is down (friendly DNS/network message)');
await b.close(); await stopSync(); web.close();
console.log(fails.length ? 'FAILS:\n' + fails.join('\n') : 'MULTI-CLIENT OK');

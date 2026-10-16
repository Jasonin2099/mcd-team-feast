import puppeteer from 'puppeteer-core';
import { spawn, execSync } from 'node:child_process';
const BASE = 'http://127.0.0.1:18923/?sync=' + encodeURIComponent('http://127.0.0.1:8787');
const OUT = 'shots/' + (process.argv[2] || 'room');
const wait = ms => new Promise(r => setTimeout(r, ms));
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? '✓ ' : '✗ ') + m); };
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
async function client(scheme = 'light') { const ctx = await b.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 1 }); await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]); p.on('pageerror', e => fails.push('pageerror ' + e.message)); p.on('dialog', d => d.accept()); await p.evaluateOnNewDocument(() => { try { localStorage.feastLang = 'zh'; } catch {} }); return p; }
const click = (p, sel) => p.evaluate(s => document.querySelector(s).click(), sel);
const until = async (p, fn, arg, ms = 5000, msg = '') => { try { await p.waitForFunction(fn, { timeout: ms, polling: 100 }, arg); return true; } catch { return false; } };

const H = await client(); await H.goto(BASE, { waitUntil: 'load' });
await click(H, '#start'); await wait(300);
await H.type('#fMe', '老王'); await click(H, '.item[data-c="BM001"]'); await wait(100);
await click(H, '#goLive');
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
ok(await until(H, () => /1 人选好|· 1 /.test(document.querySelector('#listCard .card-h').textContent), null, 4000), 'host sees A done');
await click(H, '[data-dl="10"]');
ok(await until(B, () => /还剩 (09|10):/.test(document.querySelector('.cd').textContent), null, 4000), 'countdown visible to members'); console.log(await B.$eval('.cd', e => e.textContent), await H.$eval('.cd', e => e.textContent));
await H.screenshot({ path: OUT + '-host-412.png', fullPage: true });
await B.screenshot({ path: OUT + '-member-412.png' });
// 掉线重连：B 断网 → 主机看到离线；恢复后回来
await B.close();
ok(await until(H, () => document.querySelectorAll('#listCard .dot.on').length === 2, null, 5000), 'host sees B go offline');
// 服务器重启 → 客户端自动重连、数据保留
execSync('pkill -f "[s]erver/sync-server.js" || true'); await wait(400);
ok(await until(H, () => !document.querySelector('#modeChip.live'), null, 6000), 'chip leaves live on server loss');
spawn('node', ['server/sync-server.js'], { cwd: '.', env: { ...process.env, PORT: '8787', DATA: '/tmp/feast-rooms.json' }, detached: true, stdio: 'ignore' }).unref();
ok(await until(H, () => document.querySelector('#modeChip.live') && document.querySelectorAll('#listCard .person').length === 3, null, 20000), 'reconnected after server restart, state persisted');
ok(await until(A, () => document.querySelector('#modeChip.live'), null, 20000), 'member reconnected');
// 锁单
await click(H, '#lockBtn');
ok(await until(A, () => document.querySelector('.a-menu.locked') && document.querySelector('.item[disabled]') && !document.querySelector('#listCard .qty'), null, 5000), 'member read-only after lock');
const r = await A.evaluate(async () => { const id = location.hash.slice(3); const c = JSON.parse(localStorage.getItem('feastRoom:' + id)); const res = await fetch('http://127.0.0.1:8787/rooms/' + id + '/op', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'picks', mid: c.mid, key: c.key, picks: [] }) }); return res.status; });
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
const D = await client(); await D.goto('http://127.0.0.1:18923/?sync=' + encodeURIComponent('http://127.0.0.1:1'), { waitUntil: 'load' });
await click(D, '#start'); await wait(200); await D.type('#fMe', 'X'); await click(D, '#goLive'); await wait(1500);
ok(await D.evaluate(() => !/#r=/.test(location.hash) && /离线/.test(document.querySelector('.chip').textContent) && /连不上/.test(document.getElementById('toast').textContent)), 'fallback to link mode when sync is down');
await b.close();
console.log(fails.length ? 'FAILS:\n' + fails.join('\n') : 'MULTI-CLIENT OK');

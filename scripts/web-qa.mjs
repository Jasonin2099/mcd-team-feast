import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { serve } from './serve.mjs';
// 用法：CHROME=<chrome 路径> node scripts/web-qa.mjs [前缀]  （需 npm i --no-save puppeteer-core）
// 不给 BASE 时自己起静态服务；?sync=off 走纯链接模式，不会去线上同步服务开房间
let BASE = process.env.BASE, srv;
if (!BASE) { srv = await serve(); BASE = srv.url + '/index.html?sync=off'; }
const OUT = process.env.OUT || 'shots'; fs.mkdirSync(OUT, { recursive: true }); const prefix = process.argv[2] || 'after';
const b64e = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const oldLink = BASE + '#' + b64e(JSON.stringify({ t: '旧链接团', o: '老王', p: [['老王', 'BM001', 1], ['小李', 'DR002', 2]] }));
const longName = '超级无敌长名字的全栈工程师兼产品经理兼运维兼测试同学-' + 'x'.repeat(20);
const many = []; for (let i = 0; i < 40; i++) for (const c of ['BM001', 'SN002', 'DR002', 'DS003']) many.push([i === 0 ? longName : `同事${i}号(部门${i % 7})`, c, 1 + (i % 3)]);
const stress = BASE + '#' + b64e(JSON.stringify({ t: '一个非常非常长的团名用来测试换行和截断效果的场景', o: longName, p: many }));
const problems = [];
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
async function check(p, label) {
  const r = await p.evaluate(() => {
    const txt = document.body.innerText; const bad = [];
    if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(txt)) bad.push('bad text: ' + (txt.match(/.{0,30}(undefined|NaN|\[object Object\]).{0,30}/) || [''])[0]);
    const de = document.documentElement; if (de.scrollWidth > de.clientWidth + 1) bad.push(`h-overflow ${de.scrollWidth}>${de.clientWidth}`);
    const els = [...document.querySelectorAll('button, a, h1, h2, h3, input, .stat, .badge, .item')].filter(e => { const s = getComputedStyle(e); const rc = e.getBoundingClientRect(); return rc.width > 0 && rc.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]') && !(e.closest('details:not([open])') && !e.closest('summary')) && !e.closest('.nav') && !e.closest('.bar') && !e.closest('.appbar'); });
    const R = els.map(e => [e, e.getBoundingClientRect()]);
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const [a, ra] = R[i], [c, rc] = R[j]; if (a.contains(c) || c.contains(a)) continue;
      const ox = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), oy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
      if (ox > 2 && oy > 2) { bad.push(`overlap: ${a.tagName}.${a.className}「${(a.textContent || '').trim().slice(0, 12)}」 × ${c.tagName}.${c.className}「${(c.textContent || '').trim().slice(0, 12)}」`); if (bad.length > 8) return bad; }
    }
    // elements wider than viewport
    for (const e of document.querySelectorAll('body *')) { const rc = e.getBoundingClientRect(); if (rc.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('pre') && !(e.parentElement && e.parentElement.closest('svg')) && !(e.parentElement && e.parentElement.closest('.steps')) && !e.closest('[hidden]') && rc.width > 0) { bad.push('wide: ' + e.tagName + '.' + e.className); break; } }
    return bad;
  });
  r.forEach(x => problems.push(`[${label}] ${x}`));
}
// 固定/吸顶栏检查：顶部栏占比、内容是否被遮住（顶部首个内容 / 底部最后一个内容）
async function chrome(p, label) {
  const r = await p.evaluate(async () => {
    const bad = []; const vh = innerHeight;
    const bars = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); return (s.position === 'sticky' || s.position === 'fixed') && !e.closest('[hidden]') && e.getBoundingClientRect().height > 0 && s.display !== 'none' && !e.classList.contains('toast') && e.id !== 'overlay' && e.id !== 'themePop' && !e.classList.contains('a-list'); });
    const tops = bars.filter(e => e.getBoundingClientRect().top < 5), bots = bars.filter(e => e.getBoundingClientRect().bottom > vh - 5);
    const topH = Math.max(0, ...tops.map(e => e.getBoundingClientRect().bottom)), botH = Math.max(0, ...bots.map(e => vh - e.getBoundingClientRect().top));
    if (topH > vh * 0.12) bad.push(`top chrome too tall ${Math.round(topH)}px (${Math.round(topH / vh * 100)}%)`);
    if (topH + botH > vh * 0.25) bad.push(`chrome total ${Math.round(topH + botH)}px`);
    const content = [...document.querySelectorAll('main:not([hidden]) .card, main:not([hidden]) section, main:not([hidden]) button, main:not([hidden]) a, main:not([hidden]) footer')].filter(e => !bars.some(b => b.contains(e)) && e.getBoundingClientRect().height > 0);
    scrollTo({top:0,behavior:'instant'}); await new Promise(r => setTimeout(r, 50));
    const first = Math.min(...content.map(e => e.getBoundingClientRect().top));
    if (first < topH - 1) bad.push(`content starts under top bar (${Math.round(first)} < ${Math.round(topH)})`);
    scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'}); await new Promise(r => setTimeout(r, 80));
    const clipB = e => { let b = Infinity; for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowY; if (o !== 'visible') b = Math.min(b, a.getBoundingClientRect().bottom); } return b; };
    const vis = content.filter(e => getComputedStyle(e).visibility !== 'hidden' && !(e.closest('details:not([open])') && !e.closest('summary') && e.tagName !== 'DETAILS') && e.getBoundingClientRect().top < clipB(e));
    vis.forEach(e => { e._b = Math.min(e.getBoundingClientRect().bottom, clipB(e)); });
    const last = Math.max(...vis.map(e => e._b));
    const barTop = vh - botH;
    if (last > barTop + 1) { const el = vis.find(e => e._b === last); bad.push(`y=${scrollY}/${document.documentElement.scrollHeight} content hidden behind bottom bar: ${el.tagName}.${el.className}「${(el.textContent || '').trim().slice(0, 10)}」 bottom ${Math.round(last)} > ${Math.round(barTop)}`); }
    scrollTo(0, 0);
    return bad;
  });
  r.forEach(x => problems.push(`[${label}] ${x}`));
}
async function page(w, h, scheme, lang = 'zh') {
  const p = await b.newPage(); p.on('pageerror', e => problems.push(`[${w}-${scheme}] pageerror ${e.message}`));
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  await p.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
  await p.evaluateOnNewDocument(l => { localStorage.clear(); localStorage.feastLang = l; }, lang);
  return p;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
for (const [w, h] of [[360, 780], [412, 915], [1440, 900]]) for (const scheme of ['dark', 'light']) {
  const L = `${w}-${scheme}`; const p = await page(w, h, scheme);
  await p.goto(BASE, { waitUntil: 'networkidle0' }); await wait(400);
  await p.screenshot({ path: `${OUT}/${prefix}-home-${L}.png` }); await check(p, L + ' home'); await chrome(p, L + ' home');
  // first-fold: start button & sample card visible
  const fold = await p.evaluate(() => { const s = document.getElementById('start').getBoundingClientRect(); const c = document.querySelector('.sample').getBoundingClientRect(); return { start: s.bottom <= innerHeight, card: c.top < innerHeight, prim: [...document.querySelectorAll('#home .btn.primary')].filter(b => b.getBoundingClientRect().top < innerHeight).length }; });
  if (!fold.start || !fold.card || fold.prim !== 1) problems.push(`[${L}] fold ${JSON.stringify(fold)}`);
  { const hh = await p.evaluate(() => document.documentElement.scrollHeight); for (let y = 0; y < hh; y += 500) { await p.evaluate(y => scrollTo({ top: y, behavior: "instant" }), y); await wait(60); } await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await wait(700); const unrev = await p.evaluate(() => document.querySelectorAll(".reveal:not(.in)").length); if (unrev) problems.push(`[${L}] ${unrev} reveal elements never shown`); await check(p, L + " homefull"); }
  if (w !== 412) await p.screenshot({ path: `${OUT}/${prefix}-homefull-${L}.png`, fullPage: true });
  await p.evaluate(() => scrollTo(0, 700)); await wait(100);
  await p.evaluate(() => document.getElementById('start').click()); await wait(300);
  await chrome(p, L + ' order-empty'); await p.screenshot({ path: `${OUT}/${prefix}-order-empty-${L}.png` });
  await p.type('#fMe', '测试员'); await p.click('.item[data-c="BM001"]'); await p.click('.item[data-c="DR002"]'); await wait(200);
  await p.screenshot({ path: `${OUT}/${prefix}-order-${L}.png` }); await check(p, L + ' order'); await chrome(p, L + ' order');
  const ord = await p.evaluate(() => document.getElementById('listCard').getBoundingClientRect().top < document.querySelector('.a-menu').getBoundingClientRect().top || innerWidth >= 900);
  if (!ord) problems.push(`[${L}] list card is below menu`);
  // bar buttons fit
  const bar = await p.evaluate(() => [...document.querySelectorAll('.bar .btn')].map(e => { const r = e.getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight && e.scrollWidth <= e.clientWidth + 2; }));
  if (bar.includes(false)) problems.push(`[${L}] bar buttons don't fit ${bar}`);
  await p.evaluate(() => scrollTo(0, 400)); await wait(100);
  await p.evaluate(() => document.getElementById('billBtn').click()); await wait(500);
  await p.screenshot({ path: `${OUT}/${prefix}-bill-${L}.png` }); await check(p, L + ' bill'); await chrome(p, L + ' bill');
  const bar2 = await p.evaluate(() => [...document.querySelectorAll('.bar .btn')].map(e => { const r = e.getBoundingClientRect(); return r.right <= innerWidth && e.scrollWidth <= e.clientWidth + 2; }));
  if (bar2.includes(false)) problems.push(`[${L}] bill bar buttons don't fit ${bar2}`);
  // back restores order scroll, then home scroll
  await p.goBack(); await wait(300); const y1 = await p.evaluate(() => scrollY); const maxY = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); const onOrder = await p.$('#fMe');
  await p.goBack(); await wait(300); const y2 = await p.evaluate(() => scrollY); const onHome = await p.$('#start');
  if (!onOrder || Math.abs(y1 - Math.min(400, maxY)) > 5) problems.push(`[${L}] back→order scroll ${y1} order=${!!onOrder}`);
  if (!onHome || Math.abs(y2 - 700) > 5) problems.push(`[${L}] back→home scroll ${y2} home=${!!onHome}`);
  await p.close();
}
// old link compat
{ const p = await page(412, 915, 'light'); await p.goto(oldLink, { waitUntil: 'networkidle0' }); await wait(300);
  const s = await p.evaluate(() => ({ t: window.__feast.state.t, n: window.__feast.state.p.length, onApp: !document.getElementById('app').hidden }));
  if (s.t !== '旧链接团' || s.n !== 2 || !s.onApp) problems.push('old link ' + JSON.stringify(s));
  await p.goBack(); await wait(200); if (!(await p.$('#start'))) problems.push('old link: back did not go to home');
  await p.close(); }
// stress
for (const w of [360, 1440]) { const p = await page(w, 900, 'dark'); await p.goto(stress, { waitUntil: 'networkidle0' }); await wait(400);
  await check(p, `stress-${w} order`); await chrome(p, `stress-${w} order`); await p.screenshot({ path: `${OUT}/${prefix}-stress-order-${w}.png`, fullPage: false });
  await p.click('#billBtn'); await wait(800); await check(p, `stress-${w} bill`); await chrome(p, `stress-${w} bill`); await p.screenshot({ path: `${OUT}/${prefix}-stress-bill-${w}.png` });
  const len = await p.evaluate(() => location.href.length); console.log('stress url length', len, 'old-format length', stress.length);
  await p.close(); }
// languages + gold theme
for (const lang of ['en', 'ja']) { const p = await page(360, 780, 'light', lang); await p.goto(BASE, { waitUntil: 'networkidle0' }); await wait(300); await check(p, lang + ' home'); await p.screenshot({ path: `${OUT}/${prefix}-home-360-${lang}.png` });
  await p.click('#start'); await wait(200); await check(p, lang + ' order'); await p.close(); }
{ const p = await page(412, 915, 'light'); await p.evaluateOnNewDocument(() => { localStorage.feastTheme = 'gold'; }); await p.goto(BASE, { waitUntil: 'networkidle0' }); await wait(300); await p.screenshot({ path: `${OUT}/${prefix}-home-412-gold.png` }); await p.close(); }
// wechat overlay + download
{ const p = await page(412, 915, 'light'); await p.setUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile MicroMessenger/8.0.40');
  await p.goto(BASE, { waitUntil: 'networkidle0' }); await p.click('#start'); await wait(200); await p.click('#sampleBtn'); await wait(200); await p.click('#billBtn'); await wait(500);
  await p.click('#imgBtn'); await wait(1200); const ov = await p.evaluate(() => !document.getElementById('overlay').hidden && !!document.querySelector('#overlay img')?.naturalWidth);
  if (!ov) problems.push('wechat overlay missing'); await p.screenshot({ path: `${OUT}/${prefix}-wechat-overlay-412.png` });
  await p.goBack(); await wait(200); if (!(await p.evaluate(() => document.getElementById('overlay').hidden))) problems.push('overlay not closed by back'); await p.close(); }
{ const p = await page(1440, 900, 'light'); const dl = path.join(os.tmpdir(), 'feast-qa-dl'); fs.rmSync(dl, { recursive: true, force: true }); fs.mkdirSync(dl, { recursive: true });
  const s = await p.createCDPSession(); await s.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  await p.goto(BASE, { waitUntil: 'networkidle0' }); await p.click('#start'); await wait(200); await p.click('#sampleBtn'); await wait(200); await p.click('#billBtn'); await wait(500);
  for (const th of ['git', 'pr', 'receipt']) { await p.click(`[data-th="${th}"]`); await wait(300); await p.click('#imgBtn'); await wait(1500); }
  const st = await p.evaluate(() => document.getElementById('imgBtn').dataset.state || 'idle');
  const files = fs.readdirSync(dl); if (files.length < 3) problems.push('downloads: ' + files.join(',')); console.log('downloads', files, st); await p.close(); }
await b.close(); srv?.close();
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'ALL CHECKS PASSED');

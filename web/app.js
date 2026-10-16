import { MOCK } from '../src/mock.js';
import { localPrice } from '../src/providers.js';
import { mergeItems, bestCoupons, splitBill, addPick } from '../src/feast.js';
import { renderSVG, fontCSS, FONT_FILES } from '../src/card-core.js';
import { I18N } from './i18n.js';
import { Room, createRoom } from './sync.js';
import qrcode from './vendor/qrcode.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const Y = f => (f / 100).toFixed(2);
const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');
const REPO = 'https://github.com/Jasonin2099/mcd-team-feast';
const isWeChat = /MicroMessenger/i.test(navigator.userAgent);

// ---------- 语言 ----------
let LANG = (() => { try { return localStorage.feastLang; } catch { return null; } })() || ((navigator.language || '').startsWith('ja') ? 'ja' : (navigator.language || '').startsWith('zh') ? 'zh' : 'en');
const t = k => I18N[LANG][k] ?? I18N.zh[k];

// ---------- 状态编码（兼容旧链接 {t,o,p:[[who,code,qty]]}；新链接 v2 用名字索引更短） ----------
const b64e = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
export function encodeState(st) {
  const names = [...new Set(st.p.map(x => x[0]))];
  return b64e(JSON.stringify({ v: 2, t: st.t, o: st.o, n: names, p: st.p.map(([w, c, q]) => [names.indexOf(w), c, q]) }));
}
export function decodeState(h) {
  const o = JSON.parse(b64d(h));
  const p = o.v === 2 ? o.p.map(([i, c, q]) => [o.n[i], c, q]) : (o.p || []);
  return { t: String(o.t ?? ''), o: String(o.o ?? ''), p: p.filter(x => x && typeof x[0] === 'string' && MOCK.menu.some(m => m.code === x[1]) && x[2] > 0).map(([w, c, q]) => [w, c, Math.min(99, q | 0)]) };
}
const DEFAULT = () => ({ t: LANG === 'zh' ? '1024 程序员节下午茶' : LANG === 'ja' ? '1024 おやつ会' : 'Programmer’s Day snacks', o: '', p: [] });
const SAMPLE = [['老王(后端)', 'BM001', 1], ['老王(后端)', 'DR001', 1], ['小李(前端)', 'BM002', 1], ['小李(前端)', 'DS001', 1], ['阿杰(算法)', 'BM003', 1], ['阿杰(算法)', 'DR002', 1], ['Mia(产品)', 'SN001', 1], ['Mia(产品)', 'DR003', 1], ['大刘(运维)', 'SN002', 2], ['大刘(运维)', 'DS003', 1]];
let state = null, hadLink = false, room = null;
const ridOf = h => (/^#?r=([A-Za-z0-9_-]{8})$/.exec(h || '') || [])[1];
if (ridOf(location.hash)) { hadLink = true; }
else if (location.hash.length > 1) { try { state = decodeState(location.hash.slice(1)); hadLink = true; } catch { state = null; } }
const lastHash = (() => { try { return localStorage.feastLast; } catch { return null; } })();

// ---------- 计算 ----------
function teamOf(st) {
  const tm = { title: st.t || DEFAULT().t, organizer: st.o || st.p[0]?.[0] || '—', store: MOCK.stores[0], createdAt: '2026-10-24T07:00:00.000Z', picks: [] };
  for (const [w, c, q] of st.p) addPick(tm, MOCK.menu, w, c, q);
  return tm;
}
const kmap = Object.fromEntries(MOCK.menu.map(m => [m.name, m.kcal]));
async function compute(st) {
  const team = teamOf(st); const items = mergeItems(team.picks);
  if (!items.length) return null;
  const { best, tried } = await bestCoupons(async (i, c) => localPrice(MOCK.menu, i, c), items, MOCK.coupons);
  const bill = splitBill(team.picks, { discount: best.discount, organizer: team.organizer, kcalOf: n => kmap[n] });
  return { team, best, tried, bill };
}

// ---------- 反馈 ----------
let toastTimer;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2200); }
async function act(btn, fn) {
  if (btn.dataset.state === 'loading') return;
  const label = btn.innerHTML; btn.dataset.state = 'loading'; btn.disabled = true; btn.querySelector('span') ? (btn.querySelector('span').textContent = t('loading')) : (btn.textContent = t('loading'));
  try { const msg = await fn(); btn.dataset.state = 'ok'; btn.innerHTML = '✓ <span>' + esc(t('done')) + '</span>'; if (msg) toast(msg); }
  catch (e) { btn.dataset.state = 'fail'; btn.innerHTML = '<span>' + esc(t('failed')) + '</span>'; toast(e?.message && e.message !== 'x' ? e.message : t('failed')); console.warn(e); }
  finally { btn.disabled = false; setTimeout(() => { btn.innerHTML = label; delete btn.dataset.state; }, 1600); }
}
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); return; } catch {}
  const ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
  const ok = document.execCommand('copy'); ta.remove(); if (!ok) throw new Error(t('copyFail'));
}

// ---------- 视图与历史：home → app(order) → app(bill)，各自记住滚动位置 ----------
// 每个历史条目一个 key（history.state.k），滚动位置存 sessionStorage；Tab 用 replaceState，下钻用 pushState
let cur = 'home'; let homeLang = null;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const scrollStore = (() => { try { return JSON.parse(sessionStorage.getItem('feast-scroll') || '{}'); } catch { return {}; } })();
const tabScroll = {};
const newKey = () => Math.random().toString(36).slice(2, 10);
let curKey = history.state?.k || newKey();
let tab = 'order';
function saveScroll() { scrollStore[curKey] = scrollY; try { sessionStorage.setItem('feast-scroll', JSON.stringify(scrollStore)); } catch {} }
addEventListener('scroll', () => requestAnimationFrame(saveScroll), { passive: true });
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
function animate(kind) { const el = cur === 'home' ? $('home') : document.querySelector('#app .wrap.app'); if (!el) return; if (reduce.matches) return; el.classList.remove('nv-push', 'nv-back', 'nv-tab'); void el.offsetWidth; el.classList.add('nv-' + kind); }
function show(v, tb = tab, y = 0, kind) {
  cur = v; tab = tb;
  $('home').hidden = v !== 'home'; $('app').hidden = v !== 'app'; document.body.classList.toggle('in-app', v === 'app');
  if (v === 'home') { if (homeLang !== LANG) renderHome(); } else renderApp();
  scrollTo(0, y); requestAnimationFrame(() => scrollTo(0, y));
  if (kind) animate(kind);
}
const url = () => location.pathname + (state && cur !== 'home' ? '#' + encodeState(state) : location.hash);
function go(v, tb = 'order') { saveScroll(); curKey = newKey(); history.pushState({ v, tab: tb, k: curKey }, '', location.pathname + location.search + hashFor()); show(v, tb, 0, 'push'); }
function switchTab(tb) { tabScroll[tab] = scrollY; history.replaceState({ ...(history.state || {}), v: 'app', tab: tb, k: curKey }, '', location.href); show('app', tb, tabScroll[tb] || 0, 'tab'); }
addEventListener('popstate', e => { const s = e.state || { v: 'home' }; if (s.ov) return; curKey = s.k || newKey(); show(s.v, s.tab || 'order', scrollStore[curKey] || 0, 'back'); });
const hashFor = () => room ? '#r=' + room.id : state ? '#' + encodeState(state) : '';
function saveHash() {
  if (room) { history.replaceState({ ...(history.state || {}), k: curKey }, '', location.pathname + location.search + '#r=' + room.id); try { localStorage.feastLast = 'r=' + room.id; } catch {} return; }
  if (!state) return;
  const h = '#' + encodeState(state);
  history.replaceState({ ...(history.state || {}), k: curKey }, '', location.pathname + location.search + h);
  try { localStorage.feastLast = h.slice(1); } catch {}
}

// ---------- 首页 ----------
let sampleSVG = '';
async function buildSample() {
  const r = await compute({ t: '1024 程序员节下午茶', o: '老王(后端)', p: SAMPLE });
  sampleSVG = renderSVG({ team: r.team, bill: r.bill, plan: r.best, mode: 'mock', now: MOCK.now }, narrow ? 'receipt' : 'git');
}
function renderHome() {
  homeLang = LANG;
  const cmp = t('cmp'), faq = t('faq');
  $('home').innerHTML = `
  <div class="wrap">
    <section class="hero">
      <div>
        <p class="eyebrow">${esc(t('eyebrow'))}</p>
        <h1>${esc(t('h1a'))}<br>${esc(t('h1b'))}</h1>
        <p class="lead">${esc(t('lead'))}</p>
        <div class="hero-cta">
          <button class="btn primary big" id="start">${esc(t('start'))}</button>
          ${lastHash && !hadLink ? `<button class="link" id="resume">${esc(t('resume'))} →</button>` : ''}
        </div>
        <p style="margin:16px 0 0"><span class="badge">🔒 ${esc(t('privacy'))}</span></p>
      </div>
      <figure class="sample${narrow ? ' clip' : ''}" style="margin:0"><div class="sample-in">${sampleSVG}</div><figcaption class="cap">${esc(t('sampleCap'))}</figcaption></figure>
    </section>
    <img class="hero-art" src="assets/hero.webp" width="1280" height="714" alt="mcd-team-feast pixel art" loading="lazy">
  </div>
  <section class="block"><div class="wrap">
    <h2>${esc(t('howT'))}</h2>
    <div class="grid3 steps">${[1, 2, 3].map(i => `<div class="card"><span class="step-n">${i}</span><h3>${esc(t('how' + i + 't'))}</h3><p>${esc(t('how' + i + 'd'))}</p></div>`).join('')}</div>
  </div></section>
  <section class="block"><div class="wrap">
    <h2>${esc(t('cmpT'))}</h2>
    <div class="cmp"><div class="h"></div><div class="h">${esc(t('cmpA'))}</div><div class="h b">${esc(t('cmpB'))}</div>
      ${cmp.map(([l, a, b]) => `<div class="l">${esc(l)}</div><div class="a">${esc(a)}</div><div class="b">${esc(b)}</div>`).join('')}</div>
  </div></section>
  <section class="block"><div class="wrap">
    <h2>${esc(t('themesT'))}</h2>
    <div class="grid3 themes">
      <figure><img src="assets/theme-git.png" alt="git log" loading="lazy" width="1560" height="1000"><figcaption>${esc(t('thGit'))}</figcaption></figure>
      <figure><img src="assets/real-pr.png" alt="GitHub PR" loading="lazy" width="1640" height="1100"><figcaption>${esc(t('thPr'))}</figcaption></figure>
      <figure><img src="assets/theme-receipt.png" alt="receipt" loading="lazy" width="920" height="2040" style="max-height:260px;object-fit:contain"><figcaption>${esc(t('thReceipt'))}</figcaption></figure>
    </div>
  </div></section>
  <section class="block"><div class="wrap">
    <h2>${esc(t('devT'))}</h2>
    <p class="muted" style="margin-top:-12px">${esc(t('devD'))}</p>
    <details><summary>${esc(t('devTry'))}</summary><div><pre>npx github:Jasonin2099/mcd-team-feast demo --mock --theme all</pre></div></details>
    <details><summary>${esc(t('devReal'))}</summary><div><pre>export MCD_MCP_TOKEN=…   # open.mcd.cn/mcp
alias feast="npx -y github:Jasonin2099/mcd-team-feast"
feast stores 福州路 --city 上海
feast new --store 1450441 --title "1024"
feast pick 小李 脆薯饼
feast checkout --theme all
feast order --confirm &lt;code&gt;</pre></div></details>
    <details><summary>${esc(t('devMcp'))}</summary><div><pre>{
  "mcpServers": {
    "mcd-team-feast": {
      "command": "npx",
      "args": ["-y", "github:Jasonin2099/mcd-team-feast", "mcp"],
      "env": { "MCD_MCP_TOKEN": "\${MCD_MCP_TOKEN}" }
    }
  }
}</pre><a class="link" href="${REPO}" target="_blank" rel="noopener">GitHub →</a></div></details>
  </div></section>
  <section class="block"><div class="wrap">
    <h2>${esc(t('faqT'))}</h2>
    ${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><div>${esc(a)}</div></details>`).join('')}
  </div></section>
  <footer><div class="wrap">${esc(t('footer'))}<br><a href="${REPO}" target="_blank" rel="noopener">github.com/Jasonin2099/mcd-team-feast</a></div></footer>`;
  $('start').onclick = () => { if (room) { room.close(); room = null; } if (!state) state = DEFAULT(); go('app', 'order'); };
  $('resume')?.addEventListener('click', () => { const rid = ridOf(lastHash); if (rid) { enterRoom(rid); go('app', 'order'); return; } try { state = decodeState(lastHash); } catch { state = DEFAULT(); } go('app', 'order'); });
}

// ---------- 拼单 ----------
let me = (() => { try { return localStorage.feastWho || ''; } catch { return ''; } })();
function addItem(code, delta) {
  const i = state.p.findIndex(([w, c]) => w === me && c === code);
  if (i >= 0) { state.p[i][2] += delta; if (state.p[i][2] <= 0) state.p.splice(i, 1); } else if (delta > 0) state.p.push([me, code, 1]);
}
function renderApp() {
  if (!state) state = DEFAULT();
  $('app').innerHTML = `
  <header class="appbar"><div class="wrap">
    <button class="icon-btn back" id="back" aria-label="${esc(t('back'))}">‹</button>
    <div class="title" id="apptitle"></div>
    <div class="seg" role="tablist">
      <button role="tab" data-tab="order" aria-pressed="${tab === 'order'}">${esc(t('tabOrder'))}</button>
      <button role="tab" data-tab="bill" aria-pressed="${tab === 'bill'}">${esc(t('tabBill'))}</button>
    </div>
  </div></header>
  <div class="wrap app" id="appbody"></div>
  <div class="bar"><div class="wrap" id="appbar"></div></div>`;
  $('back').onclick = () => history.back();
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { if (b.dataset.tab === tab) return; switchTab(b.dataset.tab); });
  tab === 'order' ? renderOrder() : renderBill();
}
function renderOrder() {
  if (room) return renderRoomOrder();
  $('apptitle').textContent = state.t || t('appTitle');
  const counts = Object.fromEntries(state.p.filter(x => x[0] === me).map(x => [x[1], x[2]]));
  let cat = '';
  $('appbody').innerHTML = `<div class="order-grid">
  <div class="card a-team">
    <div class="card-h"><h3>${esc(t('teamT'))}</h3><span class="chip off">🔗 ${esc(t('modeLink'))}</span></div>
    <div class="row">
      <label class="field"><span>${esc(t('teamName'))}</span><input type="text" id="fTitle" maxlength="40" value="${esc(state.t)}"></label>
      <label class="field"><span>${esc(t('organizer'))}</span><input type="text" id="fOrg" maxlength="24" value="${esc(state.o)}"></label>
    </div>
    <div class="syncbox"><button class="btn primary sm" id="goLive"><span>⚡ ${esc(t('goLive'))}</span></button><p class="hint">${esc(t('goLiveD'))}</p><p class="hint">🔒 ${esc(t('privacy'))}</p></div>
  </div>
  <div class="card a-me">
    <div class="card-h"><h3>${esc(t('meT'))}</h3></div>
    <input type="text" id="fMe" maxlength="24" placeholder="${esc(t('mePh'))}" value="${esc(me)}">
  </div>
  <div class="card a-list" id="listCard"></div>
  <div class="card a-menu">
    <div class="card-h"><h3>${esc(t('menuT'))}</h3><span class="muted small">${esc(t('menuHint'))}</span></div>
    <div class="menu" id="menu">${MOCK.menu.map(m => (m.category !== cat ? `<div class="cat">${esc(cat = m.category)}</div>` : '') +
      `<button class="item" data-c="${m.code}"><b>${esc(m.name)}</b><small>¥${m.price.toFixed(2)} · ${m.kcal} kcal</small>${counts[m.code] ? `<span class="q">${counts[m.code]}</span>` : ''}</button>`).join('')}</div>
  </div>
  </div></div>`;
  renderList();
  $('appbar').innerHTML = `<button class="btn" id="inviteBtn"><span>${esc(t('invite'))}</span></button><button class="btn primary" id="billBtn"><span>${esc(t('toBill'))} →</span></button>`;
  $('fTitle').oninput = e => { state.t = e.target.value; $('apptitle').textContent = state.t || t('appTitle'); saveHash(); };
  $('fOrg').oninput = e => { state.o = e.target.value; saveHash(); };
  $('fMe').oninput = e => { me = e.target.value.trim(); try { localStorage.feastWho = me; } catch {} };
  $('menu').onclick = e => {
    const el = e.target.closest('.item'); if (!el) return;
    if (!me) { toast(t('needName')); $('fMe').focus(); return; }
    addItem(el.dataset.c, 1); saveHash();
    const n = state.p.find(x => x[0] === me && x[1] === el.dataset.c)?.[2] || 0;
    let q = el.querySelector('.q'); if (!q) { q = document.createElement('span'); q.className = 'q'; el.appendChild(q); } q.textContent = n;
    renderList();
  };
  $('inviteBtn').onclick = e => act(e.currentTarget, async () => { saveHash(); await copyText(location.href); return location.href.length > 1800 ? fmt(t('longLink'), { n: location.href.length }) : t('copied'); });
  $('billBtn').onclick = () => go('app', 'bill');
  $('goLive').onclick = e => act(e.currentTarget, goLive);
}
function renderList() {
  if (room) return renderRoomList();
  const groups = new Map();
  state.p.forEach(([w, c, q], i) => { if (!groups.has(w)) groups.set(w, []); groups.get(w).push({ c, q, i }); });
  const n = state.p.reduce((s, x) => s + x[2], 0);
  $('listCard').innerHTML = `<div class="card-h"><h3>${esc(t('listT'))}</h3><span class="muted small">${groups.size} ${esc(t('people'))} · ${n} ${esc(t('items'))}</span></div>` +
    (groups.size ? [...groups].map(([w, arr]) => {
      const sub = arr.reduce((s, x) => s + MOCK.menu.find(m => m.code === x.c).price * 100 * x.q, 0);
      return `<div class="person"><div class="person-h"><span class="n">${esc(w)}</span><span>¥${Y(sub)}</span></div>` + arr.map(x => { const m = MOCK.menu.find(mm => mm.code === x.c);
        return `<div class="line"><span class="nm">${esc(m.name)}</span><span class="pr">¥${(m.price * x.q).toFixed(2)}</span><span class="qty"><button data-i="${x.i}" data-d="-1" aria-label="-">−</button><span>${x.q}</span><button data-i="${x.i}" data-d="1" aria-label="+">+</button></span></div>`; }).join('') + '</div>';
    }).join('') + `<p style="margin:10px 0 0;text-align:right"><button class="link" id="clearBtn">${esc(t('clear'))}</button></p>`
    : `<div class="empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><b>${esc(t('emptyT'))}</b><span class="bal">${esc(t('emptyD')).replace('&lt;wbr&gt;', '<wbr>')}</span><br><button class="link" id="sampleBtn" style="margin-top:10px">${esc(t('trySample'))}</button></div>`);
  $('listCard').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'sampleBtn') { state.p = SAMPLE.map(x => [...x]); if (!state.o) state.o = '老王(后端)'; saveHash(); renderOrder(); return; }
    if (b.id === 'clearBtn') { if (confirm(t('confirmClear'))) { state.p = []; saveHash(); renderOrder(); } return; }
    if (b.dataset.i != null) { const i = +b.dataset.i; state.p[i][2] += +b.dataset.d; if (state.p[i][2] <= 0) state.p.splice(i, 1); saveHash(); renderOrder(); }
  };
}


// ---------- 实时拼单房间（服务器只存昵称 + 点单，24h 过期）----------
function roomToState(s) {
  const seen = {}, p = [];
  for (const m of s.members) {
    let n = m.name; seen[n] = (seen[n] || 0) + 1; if (seen[n] > 1) n = `${n} (${seen[n]})`; m._n = n;
    for (const [c, q] of m.picks) if (MOCK.menu.some(x => x.code === c)) p.push([n, c, q]);
  }
  return { t: s.t, o: s.members.find(m => m.mid === s.host)?._n || s.o || '', p };
}
let shape = '', billRev = -1, cdTimer = 0;
function enterRoom(id) {
  room?.close(); room = new Room(id); state = { t: '', o: '', p: [] }; shape = ''; billRev = -1;
  room.addEventListener('state', () => {
    state = roomToState(room.state); if (room.me) me = room.me._n;
    if (cur !== 'app') return;
    if (tab === 'order') refreshRoom(); else if (room.state.rev !== billRev) { billRev = room.state.rev; renderBill(); }
  });
  room.addEventListener('status', () => { if (cur === 'app' && tab === 'order') { const c = $('modeChip'); if (c) c.outerHTML = chipHTML(); if (room.status === 'gone') renderRoomOrder(); } else if (cur === 'app') renderBill(); });
  room.connect();
  try { localStorage.feastLast = 'r=' + id; } catch {}
}
function chipHTML() {
  const st = room.status; const cls = st === 'live' ? 'live' : st === 'gone' ? 'bad' : 'wait';
  return `<span class="chip ${cls}" id="modeChip" role="status">${st === 'live' ? '● ' : ''}${esc(t('st_' + st))}</span>`;
}
async function goLive() {
  const name = (me || state.o || '').trim();
  if (!name) { $('fMe')?.focus(); throw new Error(t('needName')); }
  const mine = state.p.filter(x => x[0] === name).map(x => [x[1], x[2]]);
  let j; try { j = await createRoom({ t: state.t, name, picks: mine }); } catch (e) { throw new Error(t('syncDown')); }
  enterRoom(j.id); room.apply(j.state); saveHash(); renderApp();
  return t('liveOn');
}
const priceOf = c => MOCK.menu.find(m => m.code === c)?.price || 0;
const nameOf = c => MOCK.menu.find(m => m.code === c)?.name || c;
function fmtLeft(ms) { const s = Math.max(0, Math.round(ms / 1000)); const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
function tickCd() {
  const s = room?.state; document.querySelectorAll('.cd').forEach(el => {
    if (!s?.deadline) { el.textContent = t('noDeadline'); el.classList.remove('late'); return; }
    const left = s.deadline - Date.now(); const hm = new Date(s.deadline).toLocaleTimeString(LANG === 'en' ? 'en-US' : LANG === 'ja' ? 'ja-JP' : 'zh-CN', { hour: '2-digit', minute: '2-digit' });
    el.textContent = left > 0 ? fmt(t('cdLeft'), { at: hm, left: fmtLeft(left) }) : fmt(t('cdOver'), { at: hm }); el.classList.toggle('late', left <= 0);
  });
}
function renderRoomOrder() {
  const s = room.state, joined = !!room.me, locked = !!s?.locked, host = room.isHost;
  shape = [!!s, joined, locked, host, room.status === 'gone'].join();
  $('apptitle').textContent = s?.t || t('appTitle');
  if (room.status === 'gone') {
    $('appbody').innerHTML = `<div class="card empty"><b>${esc(t('st_gone'))}</b>${esc(t('goneD'))}</div>`;
    $('appbar').innerHTML = `<button class="btn primary" id="toLink"><span>${esc(t('toLink'))}</span></button>`;
    $('toLink').onclick = () => { const st = { ...state }; room.close(); room = null; state = st; saveHash(); renderApp(); }; return;
  }
  if (!s) { $('appbody').innerHTML = `<div class="card empty"><b>${chipHTML()}</b></div>`; $('appbar').innerHTML = ''; return; }
  const myCounts = Object.fromEntries(room.me?.picks || []);
  let cat = '';
  $('appbody').innerHTML = `<div class="order-grid">
  <div class="card a-team">
    <div class="card-h"><h3>${esc(t('teamT'))}</h3>${chipHTML()}</div>
    ${host ? `<label class="field"><span>${esc(t('teamName'))}</span><input type="text" id="fTitle" maxlength="40" value="${esc(s.t)}"></label>`
      : `<p class="room-t"><b>${esc(s.t || t('appTitle'))}</b><span class="muted small"> · ${esc(t('organizer'))} ${esc(state.o)}</span></p>`}
    <div class="dl"><span class="cd">${esc(t('noDeadline'))}</span>${host && !locked ? `<span class="dl-b"><button class="pill" data-dl="10">+10′</button><button class="pill" data-dl="30">+30′</button><button class="pill" data-dl="0">${esc(t('dlClear'))}</button></span>` : ''}</div>
    ${locked ? `<p class="lockbar">🔒 ${esc(t(host ? 'lockedHost' : 'lockedMember'))}</p>` : ''}
    <p class="hint">🔒 ${esc(t('privacyLive'))}</p>
  </div>
  <div class="card a-me">
    ${joined ? `<div class="card-h"><h3>${esc(t('meT'))}</h3>${host ? `<span class="badge">${esc(t('hostTag'))}</span>` : ''}</div>
      <input type="text" id="fMe" maxlength="24" value="${esc(room.me.name)}" ${locked ? 'disabled' : ''}>`
    : `<div class="card-h"><h3>${esc(t('joinT'))}</h3></div><div class="join"><input type="text" id="fMe" maxlength="24" placeholder="${esc(t('mePh'))}" value="${esc(me)}" ${locked ? 'disabled' : ''}><button class="btn primary" id="joinBtn" ${locked ? 'disabled' : ''}><span>${esc(t('join'))}</span></button></div>${locked ? `<p class="hint">${esc(t('lockedJoin'))}</p>` : ''}`}
  </div>
  <div class="card a-list" id="listCard"></div>
  <div class="card a-menu${locked ? ' locked' : ''}">
    <div class="card-h"><h3>${esc(t('menuT'))}</h3><span class="muted small">${esc(t(locked ? 'menuLocked' : 'menuHint'))}</span></div>
    <div class="menu" id="menu">${MOCK.menu.map(m => (m.category !== cat ? `<div class="cat">${esc(cat = m.category)}</div>` : '') +
      `<button class="item" data-c="${m.code}" ${locked ? 'disabled' : ''}><b>${esc(m.name)}</b><small>¥${m.price.toFixed(2)} · ${m.kcal} kcal</small>${myCounts[m.code] ? `<span class="q">${myCounts[m.code]}</span>` : ''}</button>`).join('')}</div>
  </div></div>`;
  renderRoomList(); renderRoomBar(); tickCd(); clearInterval(cdTimer); cdTimer = setInterval(() => { if (!room || cur !== 'app') return clearInterval(cdTimer); tickCd(); }, 1000);
  let tt; $('fTitle') && ($('fTitle').oninput = e => { $('apptitle').textContent = e.target.value || t('appTitle'); clearTimeout(tt); tt = setTimeout(() => room.op('meta', { t: e.target.value }).catch(err => toast(errMsg(err))), 400); });
  let rn; if (joined) $('fMe').oninput = e => { const v = e.target.value.trim(); if (!v) return; try { localStorage.feastWho = v; } catch {} clearTimeout(rn); rn = setTimeout(() => room.op('rename', { name: v }).catch(err => toast(errMsg(err))), 500); };
  else { $('fMe').oninput = e => { me = e.target.value.trim(); }; $('joinBtn').onclick = e => act(e.currentTarget, async () => { const v = $('fMe').value.trim(); if (!v) { $('fMe').focus(); throw new Error(t('needName')); } try { localStorage.feastWho = v; } catch {} await room.join(v); return fmt(t('joined'), { who: v }); }); $('fMe').onkeydown = e => { if (e.key === 'Enter') $('joinBtn').click(); }; }
  document.querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => { const m = +b.dataset.dl; const d = room.state.deadline; b.disabled = true; try { await room.op('deadline', { at: m ? (d && d > Date.now() ? d : Date.now()) + m * 60e3 : null }); } catch (err) { toast(errMsg(err)); } finally { b.disabled = false; } });
  $('menu').onclick = e => {
    const el = e.target.closest('.item'); if (!el || room.state.locked) return;
    if (!room.me) { toast(t('joinFirst')); $('fMe').focus(); return; }
    roomAdd(el.dataset.c, 1);
  };
}
function roomAdd(code, d) {
  const map = new Map(room.me.picks); const n = (map.get(code) || 0) + d;
  if (n > 0) map.set(code, Math.min(99, n)); else map.delete(code);
  room.setPicks([...map]).catch(e => toast(errMsg(e)));
}
function errMsg(e) { return e?.status === 423 ? t('isLocked') : e?.status === 404 ? t('st_gone') : t('syncFail'); }
function refreshRoom() {
  if (!$('listCard') || !room) return renderApp();
  const s = room.state; const now = [!!s, !!room.me, !!s?.locked, room.isHost, room.status === 'gone'].join();
  if (now !== shape) return renderRoomOrder();
  $('apptitle').textContent = (document.activeElement?.id === 'fTitle' ? $('fTitle').value : s.t) || t('appTitle');
  if ($('fTitle') && document.activeElement?.id !== 'fTitle') $('fTitle').value = s.t;
  const p = document.querySelector('.room-t b'); if (p) p.textContent = s.t || t('appTitle');
  const mc = Object.fromEntries(room.me?.picks || []);
  document.querySelectorAll('#menu .item').forEach(el => { let q = el.querySelector('.q'); const n = mc[el.dataset.c]; if (n) { if (!q) { q = document.createElement('span'); q.className = 'q'; el.appendChild(q); } q.textContent = n; } else q?.remove(); });
  renderRoomList(); renderRoomBar(); tickCd();
}
function renderRoomList() {
  const s = room.state; if (!s) return;
  const people = s.members; const n = people.reduce((a, m) => a + m.picks.reduce((x, [, q]) => x + q, 0), 0);
  const total = people.reduce((a, m) => a + m.picks.reduce((x, [c, q]) => x + Math.round(priceOf(c) * 100) * q, 0), 0);
  const online = people.filter(m => m.online).length, done = people.filter(m => m.done).length;
  const agg = new Map(); people.forEach(m => m.picks.forEach(([c, q]) => agg.set(c, (agg.get(c) || 0) + q)));
  const status = m => !m.picks.length ? ['none', t('psNone')] : m.done ? ['done', t('psDone')] : ['busy', t('psBusy')];
  const mine = m => m.mid === room.creds?.mid && !s.locked;
  $('listCard').innerHTML = `<div class="card-h"><h3>${esc(t('listT'))}</h3><span class="muted small">${fmt(t('presence'), { on: online, all: people.length, done })}</span></div>
  <div class="sum"><div><span>${esc(t('sumOrig'))}</span><b>¥${Y(total)}</b></div><div><span>${esc(t('sumItems'))}</span><b>${n}</b></div><div><span>${esc(t('psDone'))}</span><b>${done}/${people.length}</b></div></div>` +
  people.map(m => { const [k, lab] = status(m); const sub = m.picks.reduce((x, [c, q]) => x + Math.round(priceOf(c) * 100) * q, 0);
    return `<div class="person"><div class="person-h"><span class="n"><i class="dot ${m.online ? 'on' : ''}" title="${esc(t(m.online ? 'online' : 'offline'))}"></i>${esc(m._n || m.name)}${m.mid === s.host ? ` <small class="tag">${esc(t('hostTag'))}</small>` : ''}${m.mid === room.creds?.mid ? ` <small class="tag me">${esc(t('meTag'))}</small>` : ''}</span><span class="ps ${k}">${esc(lab)}</span><span class="sub">¥${Y(sub)}</span></div>` +
      m.picks.map(([c, q]) => `<div class="line"><span class="nm">${esc(nameOf(c))}</span><span class="pr">¥${(priceOf(c) * q).toFixed(2)}</span>${mine(m) ? `<span class="qty"><button data-c="${c}" data-d="-1" aria-label="-">−</button><span>${q}</span><button data-c="${c}" data-d="1" aria-label="+">+</button></span>` : `<span class="qn">×${q}</span>`}</div>`).join('') + '</div>'; }).join('') +
  (agg.size ? `<details class="agg"><summary>${esc(t('aggT'))}</summary><div>${[...agg].map(([c, q]) => `<div class="line"><span class="nm">${esc(nameOf(c))}</span><span class="qn">×${q}</span></div>`).join('')}</div></details>` : '');
  $('listCard').onclick = e => { const b = e.target.closest('button[data-c]'); if (b && room.me) roomAdd(b.dataset.c, +b.dataset.d); };
}
function renderRoomBar() {
  const s = room.state, host = room.isHost, me_ = room.me; let h = '';
  if (s.locked) h = host ? `<button class="btn" id="unlockBtn"><span>${esc(t('unlock'))}</span></button><button class="btn primary" id="billBtn"><span>${esc(t('toBill'))} →</span></button>`
    : `<button class="btn primary" id="billBtn"><span>${esc(t('finalBill'))} →</span></button>`;
  else h = `<button class="btn" id="inviteBtn"><span>${esc(t('inviteQr'))}</span></button>` + (host ? `<button class="btn primary" id="lockBtn"><span>${esc(t('lock'))}</span></button>`
    : me_ ? `<button class="btn ${me_.done ? '' : 'primary'}" id="doneBtn" ${me_.picks.length ? '' : 'disabled'}><span>${esc(t(me_.done ? 'undoDone' : 'imDone'))}</span></button>` : '');
  $('appbar').innerHTML = h;
  $('billBtn') && ($('billBtn').onclick = () => go('app', 'bill'));
  $('inviteBtn') && ($('inviteBtn').onclick = showInvite);
  $('doneBtn') && ($('doneBtn').onclick = e => act(e.currentTarget, async () => { await room.op('done', { done: !room.me.done }); return ''; }));
  $('lockBtn') && ($('lockBtn').onclick = e => { const left = s.members.filter(m => !m.done && m.mid !== s.host && m.picks.length).length; if (!s.members.some(m => m.picks.length)) { toast(t('lockEmpty')); return; } if (left && !confirm(fmt(t('lockConfirm'), { n: left }))) return; act(e.currentTarget, async () => { await room.op('lock'); return t('lockedOk'); }); });
  $('unlockBtn') && ($('unlockBtn').onclick = e => act(e.currentTarget, async () => { await room.op('unlock'); return t('unlockedOk'); }));
}
function showInvite() {
  const url = location.origin + location.pathname + location.search + '#r=' + room.id;
  const q = qrcode(0, 'M'); q.addData(url); q.make();
  const ov = $('overlay');
  ov.innerHTML = `<div class="invite"><div class="qr">${q.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div><p class="muted small">${esc(t('scanJoin'))}</p><code>${esc(url)}</code><div class="row2"><button class="btn primary" id="cpLink"><span>${esc(t('invite'))}</span></button><button class="btn" id="ovClose"><span>${esc(t('closeOv'))}</span></button></div></div>`;
  ov.hidden = false; history.pushState({ ...(history.state || {}), ov: 1 }, '', location.href);
  $('cpLink').onclick = e => act(e.currentTarget, async () => { await copyText(url); return t('copied'); });
  $('ovClose').onclick = () => history.back();
  addEventListener('popstate', () => { ov.hidden = true; ov.innerHTML = ''; }, { once: true });
}

// ---------- 账单 ----------
const narrow = matchMedia('(max-width: 600px)').matches;
let cardTheme = narrow ? 'receipt' : 'git', lastSVG = '', lastMsg = '', lastCtx = null;
// 导出时把子集字体内嵌进 SVG，保证 PNG/SVG 在任何设备上字形一致
let fontCSSP = null;
const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
function getFontCSS() { return fontCSSP ||= Promise.all(Object.entries(FONT_FILES).map(async ([k, f]) => { const r = await fetch('web/fonts/' + f); if (!r.ok) throw new Error('font'); return [k, b64(await r.arrayBuffer())]; })).then(e => fontCSS(Object.fromEntries(e))).catch(e => { fontCSSP = null; throw e; }); }
async function exportSVG() { let css = ''; try { css = await getFontCSS(); } catch {} return renderSVG(lastCtx, cardTheme, { fontCSS: css }); }
async function renderBill() {
  $('apptitle').textContent = state.t || t('appTitle');
  const r = await compute(state);
  if (!r) { $('appbody').innerHTML = `<div class="card empty"><b>${esc(t('emptyT'))}</b>${esc(t('billEmpty'))}</div>`; $('appbar').innerHTML = `<button class="btn primary" id="b2">‹ ${esc(t('tabOrder'))}</button>`; $('b2').onclick = () => history.back(); return; }
  lastCtx = { team: r.team, bill: r.bill, plan: r.best, mode: 'mock', now: MOCK.now }; lastSVG = renderSVG(lastCtx, cardTheme);
  const url = location.origin + location.pathname;
  lastMsg = [fmt(t('msgHead'), { t: r.team.title }), fmt(t('msgLine'), { paid: Y(r.best.total), off: Y(r.best.discount), avg: Y(r.bill.avg) }),
    ...r.bill.people.map(p => fmt(t('msgPay'), { who: p.who, org: r.team.organizer, pay: Y(p.pay), items: p.items.join('、') })), fmt(t('msgFoot'), { url })].join('\n');
  const q = s => /[\s()（）'"]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
  const cli = ['alias feast="npx -y github:Jasonin2099/mcd-team-feast"', 'feast stores <keyword> --city <city>', `feast new --store <code> --title ${q(r.team.title)} --by ${q(r.team.organizer)}`,
    ...r.team.picks.map(p => `feast pick ${q(p.who)} ${q(p.name)} ${p.qty}`), 'feast checkout --theme all'].join('\n');
  const banner = room?.state ? `<p class="lockbar ${room.state.locked ? '' : 'soft'}">${room.state.locked ? '🔒 ' + esc(t('billFinal')) : '⏳ ' + esc(t('billLive'))}</p>` : '';
  $('appbody').innerHTML = `${banner}
  <div class="tabs" style="padding-top:0"><div class="seg" id="themes">${['git', 'pr', 'receipt'].map(k => `<button data-th="${k}" aria-pressed="${k === cardTheme}">${esc(t({ git: 'thGit', pr: 'thPr', receipt: 'thReceipt' }[k]))}</button>`).join('')}</div></div>
  <div class="cols"><div class="card preview" style="padding:12px">${lastSVG}</div>
  <div><div class="card">
    <div class="stats">
      <div class="stat"><span>${esc(t('sumPaid'))}</span><b>¥${Y(r.best.total)}</b></div>
      <div class="stat"><span>${esc(t('sumAvg'))}</span><b>¥${Y(r.bill.avg)}</b></div>
      <div class="stat"><span>${esc(t('sumOff'))}</span><b>¥${Y(r.best.discount)}</b></div>
      <div class="stat"><span>${esc(t('headcount'))}</span><b>${r.bill.people.length}</b></div>
      <div class="stat wide"><span>${esc(t('sumCoupons'))}</span><b>${esc(r.best.combo.map(c => c.title).join(' + ') || t('noCoupon'))}</b></div>
    </div>
    <p class="hint">${esc(fmt(t('tried'), { n: r.tried.length }))} · ${esc(t('mockNote'))}</p>
  </div>
  <details><summary>${esc(t('devT'))} · ${esc(t('devCli'))}</summary><div><pre>${esc(cli)}</pre><button class="link" id="svgBtn">⬇ ${esc(t('svg'))}</button></div></details></div></div>`;
  $('appbar').innerHTML = `<button class="btn primary" id="imgBtn"><span>${esc(t('saveImg'))}</span></button><button class="btn" id="msgBtn"><span>${esc(t('copyMsg'))}</span></button><button class="btn" id="shareBtn" style="flex:0 0 auto"><span>${esc(t('share'))}</span></button>`;
  document.querySelector('.preview').onclick = () => zoomSVG(lastSVG);
  $('themes').onclick = e => { const b = e.target.closest('button'); if (!b) return; cardTheme = b.dataset.th; renderBill(); };
  $('imgBtn').onclick = e => act(e.currentTarget, saveImage);
  $('msgBtn').onclick = e => act(e.currentTarget, async () => { await copyText(lastMsg); return t('copied'); });
  $('shareBtn').onclick = e => act(e.currentTarget, shareIt);
  $('svgBtn').onclick = async () => download('feast-receipt.svg', new Blob([await exportSVG()], { type: 'image/svg+xml' }));
}
function svgToPngBlob(svg) {
  return new Promise((res, rej) => {
    const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/); const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const x = c.getContext('2d'); x.scale(2, 2); x.drawImage(img, 0, 0); c.toBlob(b => b ? res(b) : rej(new Error('x')), 'image/png'); };
    img.onerror = () => rej(new Error('x'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function zoomSVG(svg) {
  const ov = $('overlay'); ov.innerHTML = `<div class="zoom">${svg}</div><button class="btn" id="ovClose">${esc(t('closeOv'))}</button>`;
  ov.hidden = false; history.pushState({ ...(history.state || {}), ov: 1 }, '', location.href);
  $('ovClose').onclick = () => history.back();
  addEventListener('popstate', () => { ov.hidden = true; ov.innerHTML = ''; }, { once: true });
}
function showOverlay(blob) {
  const ov = $('overlay'); const u = URL.createObjectURL(blob);
  ov.innerHTML = `<img src="${u}" alt="receipt"><p>${esc(t('longPress'))}</p><button class="btn" id="ovClose">${esc(t('closeOv'))}</button>`;
  ov.hidden = false; history.pushState({ ...(history.state || {}), ov: 1 }, '', location.href);
  const close = () => { ov.hidden = true; ov.innerHTML = ''; URL.revokeObjectURL(u); };
  $('ovClose').onclick = () => history.back();
  addEventListener('popstate', close, { once: true });
}
async function saveImage() {
  const blob = await svgToPngBlob(await exportSVG());
  if (isWeChat || /iPhone|iPad/.test(navigator.userAgent)) { showOverlay(blob); return t('imgReady'); }
  download(`feast-receipt-${cardTheme}.png`, blob); return t('imgReady');
}
async function shareIt() {
  saveHash(); const data = { title: '麦麦拼单 · ' + (state.t || ''), text: lastMsg, url: location.href };
  if (navigator.share) {
    try { const blob = await svgToPngBlob(await exportSVG()); const f = new File([blob], 'feast-receipt.png', { type: 'image/png' }); if (navigator.canShare?.({ files: [f] })) data.files = [f]; } catch {}
    try { await navigator.share(data); return t('done'); } catch (e) { if (e.name === 'AbortError') return ''; }
  }
  await copyText(lastMsg + '\n' + location.href); return t('copied');
}

// ---------- 外观、语言、Star ----------
function applyLang() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : LANG;
  document.querySelectorAll('#langs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.l === LANG));
  document.querySelectorAll('[data-i]').forEach(el => { el.textContent = t(el.dataset.i); });
  document.title = LANG === 'zh' ? '麦麦拼单 · 一个链接，全组拼麦当劳' : LANG === 'ja' ? '麦麦拼单 · リンクひとつで、みんなでマック' : 'mcd-team-feast · One link, lunch for the whole team';
}
$('langs').onclick = e => { const l = e.target.dataset.l; if (!l || l === LANG) return; LANG = l; try { localStorage.feastLang = l; } catch {} applyLang(); show(cur, tab); };
const THEMES = ['auto', 'light', 'dark', 'gold'];
function closeSheet() { const sh = $('themePop'); if (sh.hidden) return; sh.classList.remove('on'); setTimeout(() => { sh.hidden = true; }, reduce.matches ? 0 : 180); }
$('themeBtn').onclick = e => {
  e.stopPropagation(); const sh = $('themePop');
  const curT = (() => { try { return localStorage.feastTheme || 'auto'; } catch { return 'auto'; } })();
  sh.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(t('thAuto'))}"><i class="grab"></i>${THEMES.map(k => `<button data-k="${k}" aria-pressed="${k === curT}">${esc(t({ auto: 'thAuto', light: 'thLight', dark: 'thDark', gold: 'thGold' }[k]))}<span>${k === curT ? '✓' : ''}</span></button>`).join('')}</div>`;
  sh.hidden = false; requestAnimationFrame(() => sh.classList.add('on'));
  history.pushState({ ...(history.state || {}), ov: 1 }, '', location.href);
  addEventListener('popstate', closeSheet, { once: true });
};
$('themePop').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { const k = b.dataset.k; try { localStorage.feastTheme = k; } catch {} if (k === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = k; } if (b || e.target === $('themePop')) history.back(); };
fetch('https://api.github.com/repos/Jasonin2099/mcd-team-feast').then(r => r.ok ? r.json() : null).then(j => { if (j && Number.isFinite(j.stargazers_count)) $('stars').textContent = j.stargazers_count; }).catch(() => {});

// ---------- 启动 ----------
applyLang();
await buildSample();
{ const rid = ridOf(location.hash); if (rid) enterRoom(rid); }
if (hadLink) { history.replaceState({ v: 'home', k: newKey() }, '', location.pathname + location.search); history.pushState({ v: 'app', tab: 'order', k: curKey }, '', location.pathname + location.search + hashFor()); show('app', 'order', scrollStore[curKey] || 0); }
else { history.replaceState({ v: 'home', k: curKey }, '', location.pathname + location.search); show('home', 'order', scrollStore[curKey] || 0); }
window.__feast = { encodeState, decodeState, get state() { return state; } };

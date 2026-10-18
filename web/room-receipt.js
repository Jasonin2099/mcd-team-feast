// 房间页「拼单小票」：只列 人 + 菜品 + 数量，不含价格。离屏渲染 → snapDOM 导出 1080px PNG。
// 纯函数（布局规则、HTML）可在 Node 里测试；snapDOM 点击时才懒加载（web/vendor/snapdom.js）。

const svg = b => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
export const ICONS = {
  'image-down': svg('<path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19 3 3v-5.5"/><path d="m17 22 3-3"/><circle cx="9" cy="9" r="2"/>'),
  'loader-circle': svg('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  'rotate-ccw': svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  hamburger: svg('<path d="M12 16H4a2 2 0 1 1 0-4h16a2 2 0 1 1 0 4h-4.25"/><path d="M5 12a2 2 0 0 1-2-2 9 7 0 0 1 18 0 2 2 0 0 1-2 2"/><path d="M5 16a2 2 0 0 0-2 2 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 2 2 0 0 0-2-2q0 0 0 0"/><path d="m6.67 12 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2"/>'),
  calendar: svg('<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>'),
  users: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>'),
};
export const BTN_ICON = { idle: 'image-down', loading: 'loader-circle', ok: 'check', fail: 'rotate-ccw' };
const ic = n => `<span class="ic">${ICONS[n]}</span>`;
const escH = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * 截断/分列规则。输入：成员数组（{picks:[[code,q]...]}，只算有点单的）。
 * 输出：{ mode:'single'|'cols2'|'compact', maxLines, aggMax, lines:[每人显示的菜品行数], more:[每人「另 N 项」] }
 */
export function rcLayout(members) {
  const M = members.filter(m => m.picks?.length);
  const mode = M.length > 24 ? 'compact' : M.length > 8 ? 'cols2' : 'single';
  const maxLines = mode === 'single' ? 6 : mode === 'cols2' ? 4 : 0;
  const aggMax = mode === 'compact' ? 30 : 12;
  const lines = M.map(m => mode === 'compact' ? 0 : m.picks.length > maxLines ? maxLines - 1 : m.picks.length);
  const more = M.map((m, i) => mode === 'compact' ? 0 : m.picks.length - lines[i]);
  return { mode, maxLines, aggMax, count: M.length, lines, more };
}

const pad = n => String(n).padStart(2, '0');
export const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const ymd = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
export const rcFilename = (roomId, d = new Date()) => `feast-${String(roomId).replace(/[^A-Za-z0-9_-]/g, '')}-${ymd(d)}.png`;

/** state：房间 state；nameOf：code→菜名；t：i18n；fmt：模板替换 */
export function receiptHTML(state, { nameOf = c => c, t = k => k, fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]), now = new Date(), url = 'jasonin2099.github.io/mcd-team-feast' } = {}) {
  const M = state.members.filter(m => m.picks?.length);
  const L = rcLayout(M);
  const who = m => m._n || m.name;
  const cnt = m => m.picks.reduce((x, [, q]) => x + q, 0);
  const total = M.reduce((a, m) => a + cnt(m), 0);
  const agg = new Map(); M.forEach(m => m.picks.forEach(([c, q]) => agg.set(c, (agg.get(c) || 0) + q)));
  const aggRows = [...agg].sort((a, b) => b[1] - a[1]), aggShow = aggRows.slice(0, L.aggMax);
  const line = (c, q) => `<div class="rc-l"><span class="nm">${escH(nameOf(c))}</span><span class="q">×${q}</span></div>`;
  const more = n => `<div class="rc-more">${escH(fmt(t('rcMore'), { n }))}</div>`;
  const ppl = L.mode === 'compact'
    ? `<div class="rc-sec">${escH(fmt(t('rcMembers'), { n: M.length }))}</div><div class="rc-names">${M.map(m => escH(who(m))).join(' · ')}</div>`
    : `<div class="rc-ppl${L.mode === 'cols2' ? ' cols2' : ''}">${M.map((m, i) => `<div class="rc-p"><h4><span class="who">${escH(who(m))}</span><span class="cnt">${cnt(m)}${escH(t('rcPcs'))}</span></h4>${m.picks.slice(0, L.lines[i]).map(([c, q]) => line(c, q)).join('')}${L.more[i] ? more(L.more[i]) : ''}</div>`).join('')}</div>`;
  const when = fmtDate(state.lockedAt ? new Date(state.lockedAt) : now);
  return `<div class="rc" id="rc"><div class="rc-wrap"><div class="rc-paper">
<div class="rc-brand">${ic('hamburger')}${escH(t('rcTitle'))}</div>
<div class="rc-title">${escH(state.t || t('appTitle'))}</div>
<div class="rc-meta"><span>${ic('calendar')}${when}</span><span>${ic('users')}${M.length} ${escH(t('people'))}</span></div>
<hr class="rc-hr">${ppl}<hr class="rc-hr">
<div class="rc-agg"><div class="rc-sec">${escH(t('rcAgg'))}</div>${aggShow.map(([c, q]) => line(c, q)).join('')}${aggRows.length > aggShow.length ? `<div class="rc-more">${escH(fmt(t('rcMoreKinds'), { n: aggRows.length - aggShow.length }))}</div>` : ''}</div>
<hr class="rc-hr"><div class="rc-total"><span>${escH(t('rcTotal'))}</span><b>${total}<small>${escH(t('rcPcs'))}</small></b></div>
<div class="rc-foot"><div class="rc-bar"></div>${escH(t('brand'))} · ${escH(url)}<br>${escH(t('rcNote'))}</div>
</div></div></div>`;
}

let snapMod;
const loadSnap = () => (snapMod ||= import('./vendor/snapdom.js'));

/** 离屏渲染并导出 PNG Blob（540 CSS px × scale 2 = 1080px 宽） */
export async function exportReceipt(html) {
  const host = document.createElement('div');
  host.className = 'rc-host'; host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;zoom:1;transform:none';
  host.innerHTML = html; document.body.appendChild(host);
  try {
    const el = host.firstElementChild; const text = el.textContent;
    await document.fonts.ready;
    await Promise.all(['700 30px "Noto Sans SC Sub"', '400 17px "Noto Sans SC Sub"', '700 17px "Noto Sans JP Sub"', '700 17px "Feast Mono"'].map(f => document.fonts.load(f, text).catch(() => {})));
    const { snapdom } = await loadSnap();
    const r = await snapdom(el, { scale: 2, embedFonts: true, backgroundColor: '#da291c' });
    return await r.toBlob({ type: 'png' });
  } finally { host.remove(); }
}

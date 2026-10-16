// 账单卡渲染核心：纯函数、无 Node 依赖，CLI 与网页共用
import qrcode from '../web/vendor/qrcode.js';
export const REPO_URL = 'https://github.com/Jasonin2099/mcd-team-feast';
export const REPO_SHORT = 'github.com/Jasonin2099/mcd-team-feast';
// 仓库二维码（SVG path），水印用
let _qr; function qrPath() { if (_qr) return _qr; const q = qrcode(0, 'M'); q.addData(REPO_URL); q.make(); const n = q.getModuleCount(); let d = ''; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`; return (_qr = { d, n }); }
export function qrSVG(x, y, size, fg = '#111', bg = '#fff') { const { d, n } = qrPath(); const k = size / (n + 2); return `<g transform="translate(${x} ${y})"><rect width="${size}" height="${size}" rx="4" fill="${bg}"/><path transform="translate(${k} ${k}) scale(${k})" d="${d}" fill="${fg}" shape-rendering="crispEdges"/></g>`; }
// 梗签名字号：按显示宽度自适应，保证一行放下
const signFs = (sign, maxW, base) => { const w = width(sign); return Math.max(10, Math.min(base, Math.floor(maxW / (w * 0.6)))); };
export const yuan = f => (f / 100).toFixed(2);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const cw = c => (c.charCodeAt(0) > 255 ? 2 : 1);
export const width = s => [...String(s)].reduce((w, c) => w + cw(c), 0);
export const padEnd = (s, n) => s + ' '.repeat(Math.max(0, n - width(s)));
export const clip = (s, n) => { let out = '', w = 0; for (const c of String(s)) { if (w + cw(c) > n - 1) return out + '…'; out += c; w += cw(c); } return out; };
// 卡片字体（Feast Mono = JetBrains Mono 子集，Feast CJK = Noto Sans Mono CJK SC 子集）；传入 base64 即内嵌到 SVG
export const FONT_FILES = { mono400: 'FeastMono-400.woff2', mono700: 'FeastMono-700.woff2', cjk400: 'FeastCJK-400.woff2' };
export function fontCSS(b64) {
  const f = (fam, w, d) => d ? `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${d}) format('woff2')}` : '';
  return f('Feast Mono', 400, b64.mono400) + f('Feast Mono', 700, b64.mono700) + f('Feast CJK', 400, b64.cjk400);
}
const withFonts = (svg, css) => css ? svg.replace(/^(<svg[^>]*>)/, `$1<defs><style>${css}</style></defs>`) : svg;
// 确定性的 40 位“commit hash”（FNV-1a 变体，够玩不够密码学）
export function fakeHash(str) {
  let out = '';
  for (let k = 0; k < 5; k++) { let h = 0x811c9dc5 ^ k; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } out += h.toString(16).padStart(8, '0'); }
  return out;
}
export const THEMES = ['git', 'pr', 'receipt'];

function summary(ctx) {
  const { team, bill, plan, now } = ctx;
  const couponOff = plan.applied.reduce((s, a) => s + (a.discount || 0), 0);
  const promo = plan.applied.some(a => a.discount == null) ? 0 : plan.discount - couponOff;
  return {
    hash: fakeHash(JSON.stringify(team.picks) + team.createdAt),
    date: `${now?.date || team.createdAt.slice(0, 10)} ${now?.time || ''}`.trim(),
    festival: now?.festival || '', promo,
    saved: plan.subtotal ? Math.round(plan.discount * 100 / plan.subtotal) : 0,
    items: bill.people.reduce((s, p) => s + p.items.length, 0),
    kcal: bill.people.reduce((s, p) => s + (p.kcal || 0), 0),
  };
}

export function receiptLines(ctx) {
  const { team, bill, plan, mode } = ctx; const S = summary(ctx); const L = [];
  L.push(['y', `commit ${S.hash}`]);
  L.push(['d', `Author: ${team.organizer} <team@1024.feast>`]);
  L.push(['d', `Date:   ${S.date}  ${S.festival}`]);
  L.push(['n', '']);
  L.push(['w', `    feat(${team.store?.storeCode || 'store'}): ${team.title}`]);
  L.push(['d', `    📍 ${team.store?.storeName || ''}`]);
  L.push(['n', '']);
  for (const p of bill.people) L.push(['g', `  + ${clip(p.who, 12)}  ${clip(p.items.join(' '), 34)}`, `¥${yuan(p.pay)}`]);
  L.push(['n', '']);
  for (const a of plan.applied) L.push(['r', `  - 🎟  ${clip(a.title, 36)}`, a.discount != null ? `-¥${yuan(a.discount)}` : '']);
  if (S.promo > 0) L.push(['r', '  - 🏷  门店活动价 / 促销优惠', `-¥${yuan(S.promo)}`]);
  if (!plan.applied.length) L.push(['d', '  - 🎟  (暂无可用优惠券，可先在麦麦省领券)']);
  L.push(['n', '']);
  L.push(['d', ` ${bill.people.length} people changed, ${S.items} items(+), ${plan.applied.length} coupons(-)${S.kcal ? `, ${S.kcal} kcal` : ''}`]);
  L.push(['w', ` 原价 ¥${yuan(plan.subtotal)}  优惠 -¥${yuan(plan.discount)}  实付 ¥${yuan(plan.total)}`]);
  L.push(['y', ` 人均 ¥${yuan(bill.avg)}  ·  省下 ${S.saved}%`]);
  L.push(['n', '']);
  L.push(['d', `$ git push origin feast  # ${mode === 'mock' ? 'mock 演示数据' : 'via 麦当劳 MCP'} · mcd-team-feast`]);
  return L;
}

const C = { y: '#FFC72C', g: '#7EE787', r: '#FF7B72', w: '#E6EDF3', d: '#8B949E', n: '#E6EDF3' };
const MONO = `'Feast Mono','Feast CJK','DejaVu Sans Mono','Noto Sans Mono CJK SC','Noto Sans CJK SC',Menlo,Consolas,monospace`;
const SANS = `-apple-system,'Segoe UI','Feast CJK','Noto Sans CJK SC','PingFang SC','Microsoft YaHei',sans-serif`;

function gitTheme(ctx) {
  const lines = receiptLines(ctx);
  const lh = 24, top = 70, W = 780, sign = ctx.sign || '', foot = 96, bodyEnd = top + lines.length * lh, H = bodyEnd + foot;
  const body = lines.map(([c, t, r], i) => `<text x="28" y="${top + i * lh}" fill="${C[c]}" xml:space="preserve">${esc(t)}</text>` +
    (r ? `<text x="${W - 32}" y="${top + i * lh}" fill="${C[c]}" text-anchor="end">${esc(r)}</text>` : '')).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="14" fill="#0D1117"/>
  <rect width="${W}" height="38" rx="14" fill="#161B22"/><rect y="24" width="${W}" height="14" fill="#161B22"/>
  <circle cx="24" cy="19" r="6" fill="#FF5F56"/><circle cx="44" cy="19" r="6" fill="#FFBD2E"/><circle cx="64" cy="19" r="6" fill="#27C93F"/>
  <text x="${W / 2}" y="24" fill="#8B949E" font-size="13" text-anchor="middle" font-family="monospace">~/1024-feast — git log -1 --stat</text>
  <rect x="${W - 64}" y="8" width="44" height="22" rx="4" fill="#DA291C"/><text x="${W - 42}" y="24" fill="#FFC72C" font-size="15" font-weight="bold" text-anchor="middle" font-family="sans-serif">M</text>
  <g font-family="${MONO}" font-size="15">
  ${body}
  </g>
  <line x1="28" x2="${W - 28}" y1="${bodyEnd - 4}" y2="${bodyEnd - 4}" stroke="#30363D"/>
  ${sign ? `<text x="28" y="${bodyEnd + 30}" fill="#D2A8FF" font-family="${MONO}" font-size="${signFs(sign, W - 170, 15)}" xml:space="preserve">// ${esc(sign)}</text>` : ''}
  <text x="28" y="${bodyEnd + 62}" fill="#6E7681" font-family="${MONO}" font-size="12">🍔 mcd-team-feast · ${REPO_SHORT}</text>
  ${qrSVG(W - 92, bodyEnd + 8, 64, '#0D1117', '#E6EDF3')}
</svg>`;
}

function prTheme(ctx) {
  const { team, bill, plan } = ctx; const S = summary(ctx);
  const W = 820, rowH = 30; const rows = [];
  rows.push(['hunk', `@@ -0,0 +1,${S.items} @@ ${team.store?.storeName || ''}`]);
  for (const p of bill.people) rows.push(['add', `${clip(p.who, 12)}  ${clip(p.items.join(' · '), 40)}`, `¥${yuan(p.pay)}`]);
  for (const a of plan.applied) rows.push(['del', `🎟 ${clip(a.title, 40)}`, a.discount != null ? `-¥${yuan(a.discount)}` : '']);
  if (S.promo > 0) rows.push(['del', '🏷 门店活动价 / 促销优惠', `-¥${yuan(S.promo)}`]);
  const top = 190, sign = ctx.sign || '', H = top + rows.length * rowH + 150 + (sign ? 64 : 0) + 40;
  const bg = { hunk: '#DDF4FF', add: '#E6FFEC', del: '#FFEBE9' }, mark = { hunk: '', add: '+', del: '-' }, fg = { hunk: '#57606A', add: '#1A7F37', del: '#CF222E' };
  const body = rows.map(([k, t, r], i) => { const y = top + i * rowH; return `<rect x="24" y="${y}" width="${W - 48}" height="${rowH}" fill="${bg[k]}"/>
    <text x="40" y="${y + 20}" fill="${fg[k]}" font-family="${MONO}" font-size="14">${mark[k]}</text>
    <text x="64" y="${y + 20}" fill="#1F2328" font-family="${MONO}" font-size="14" xml:space="preserve">${esc(t)}</text>
    ${r ? `<text x="${W - 40}" y="${y + 20}" fill="${fg[k]}" font-family="${MONO}" font-size="14" text-anchor="end">${esc(r)}</text>` : ''}`; }).join('\n');
  const fy = top + rows.length * rowH;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${SANS}">
  <rect width="${W}" height="${H}" rx="12" fill="#FFFFFF" stroke="#D0D7DE"/>
  <text x="24" y="50" font-size="24" font-weight="600" fill="#1F2328">${esc(clip(team.title, 40))} <tspan fill="#59636E" font-weight="400">#1024</tspan></text>
  <rect x="24" y="66" width="86" height="28" rx="14" fill="#8250DF"/><text x="67" y="85" font-size="13" fill="#fff" text-anchor="middle" font-weight="600">Merged</text>
  <text x="122" y="85" font-size="14" fill="#59636E"><tspan font-weight="600" fill="#1F2328">${esc(team.organizer)}</tspan> merged ${bill.people.length} commits into <tspan font-family="${MONO}" fill="#0969DA">main</tspan> from <tspan font-family="${MONO}" fill="#0969DA">feast/${esc(team.store?.storeCode || 'store')}</tspan></text>
  <text x="24" y="130" font-size="14" fill="#59636E">📍 ${esc(team.store?.storeName || '')}  ·  ${esc(S.date)} ${esc(S.festival)}</text>
  <rect x="24" y="148" width="${W - 48}" height="${fy - 148 + 1}" rx="6" fill="none" stroke="#D0D7DE"/>
  <rect x="24" y="148" width="${W - 48}" height="42" rx="6" fill="#F6F8FA"/>
  <text x="40" y="174" font-size="14" fill="#1F2328" font-family="${MONO}">feast.lock</text>
  <text x="${W - 40}" y="174" font-size="14" text-anchor="end" font-family="${MONO}"><tspan fill="#1A7F37">+${S.items}</tspan> <tspan fill="#CF222E">−${plan.applied.length + (S.promo > 0 ? 1 : 0)}</tspan></text>
  ${body}
  <text x="24" y="${fy + 44}" font-size="15" fill="#1F2328">原价 ¥${yuan(plan.subtotal)}　优惠 <tspan fill="#CF222E">-¥${yuan(plan.discount)}</tspan>　实付 <tspan font-weight="700">¥${yuan(plan.total)}</tspan></text>
  <rect x="24" y="${fy + 64}" width="${W - 48}" height="56" rx="6" fill="#DAFBE1" stroke="#4AC26B"/>
  <text x="44" y="${fy + 98}" font-size="17" fill="#1A7F37" font-weight="700">✓ All checks passed · 人均 ¥${yuan(bill.avg)} · 省下 ${S.saved}%${S.kcal ? ` · ${S.kcal} kcal` : ''}</text>
  ${sign ? `<g transform="translate(24 ${fy + 136})"><circle cx="14" cy="18" r="14" fill="#FFC72C"/><text x="14" y="23" font-size="14" text-anchor="middle">🍔</text>
    <rect x="38" y="0" width="${W - 48 - 38 - 84}" height="38" rx="6" fill="#F6F8FA" stroke="#D0D7DE"/>
    <text x="52" y="24" font-size="${signFs(sign, W - 48 - 38 - 84 - 28, 14)}" fill="#1F2328" xml:space="preserve">💬 ${esc(sign)}</text></g>` : ''}
  <text x="24" y="${H - 20}" font-size="12" fill="#8C959F">mcd-team-feast · ${REPO_SHORT}</text>
  ${qrSVG(W - 88, H - 88 - 12, 64, '#1F2328', '#F6F8FA')}
</svg>`;
}

function receiptTheme(ctx) {
  const { team, bill, plan, mode } = ctx; const S = summary(ctx);
  const W = 460, X0 = 34, X1 = W - 34; const L = [];
  // 行类型：person 每人一行（粗）/ item 菜品（小、灰、缩进）/ kv 普通 / total 实付 / sep 分隔线 / gap 空隙
  const add = (k, l = '', r = '') => L.push({ k, l, r });
  add('sep');
  for (const p of bill.people) { add('person', clip(p.who, 22), `¥${yuan(p.pay)}`); for (const it of p.items) add('item', clip(it, 30)); add('gap'); }
  L.pop(); add('sep');
  add('kv', '商品原价', `¥${yuan(plan.subtotal)}`);
  for (const a of plan.applied) add('kv', clip(a.title, 24), a.discount != null ? `-¥${yuan(a.discount)}` : '');
  if (S.promo > 0) add('kv', '门店活动价', `-¥${yuan(S.promo)}`);
  add('sep2'); add('total', '实付合计', `¥${yuan(plan.total)}`); add('kv', `人均 · ${bill.people.length} 人`, `¥${yuan(bill.avg)}`); add('sep');
  const H_ = { sep: 18, sep2: 14, gap: 6, person: 26, item: 21, kv: 25, total: 34 };
  let y = 156; const body = L.map(x => {
    const h = H_[x.k]; const base = y + h - 7; y += h;
    if (x.k === 'gap') return '';
    if (x.k === 'sep' || x.k === 'sep2') return `<line x1="${X0}" x2="${X1}" y1="${y - h / 2}" y2="${y - h / 2}" stroke="#2A2A2A" stroke-opacity="${x.k === 'sep' ? .55 : .25}" stroke-width="1" stroke-dasharray="${x.k === 'sep' ? '5 4' : '2 4'}"/>`;
    const st = { person: ['15', '700', '#1A1A1A'], item: ['12.5', '400', '#6B6B6B'], kv: ['14', '400', '#333'], total: ['21', '700', '#111'] }[x.k];
    const lx = x.k === 'item' ? X0 + 14 : X0;
    return `<text x="${lx}" y="${base}" font-size="${st[0]}" font-weight="${st[1]}" fill="${st[2]}" xml:space="preserve">${esc(x.l)}</text>` +
      (x.r ? `<text x="${X1}" y="${base}" font-size="${st[0]}" font-weight="${st[1]}" fill="${x.r.startsWith('-') ? '#C0392B' : st[2]}" text-anchor="end" style="font-variant-numeric:tabular-nums">${esc(x.r)}</text>` : '');
  }).join('\n');
  const sign = ctx.sign || ''; const sy = y + 34; if (sign) y += 44;
  const H = y + 150;
  const bars = Array.from({ length: 44 }, (_, i) => { const w = (parseInt(S.hash[i % 40], 16) % 3) + 1; return `<rect x="${34 + i * 7.4}" y="${H - 112}" width="${w}" height="42" fill="#222"/>`; }).join('');
  let paper = `M0 0 H${W} V${H - 10}`; for (let x = W; x >= 0; x -= 10) paper += ` L${x} ${H - ((x / 10) % 2 ? 0 : 10)}`; paper += ' Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${MONO}">
  <path d="${paper}" fill="#FFFDF7"/>
  <rect x="${W / 2 - 22}" y="24" width="44" height="34" rx="7" fill="#DA291C"/><text x="${W / 2}" y="50" font-size="26" font-weight="700" fill="#FFC72C" text-anchor="middle" font-family="${SANS}">M</text>
  <text x="${W / 2}" y="90" font-size="19" font-weight="700" fill="#111" text-anchor="middle" letter-spacing=".5">${esc(clip(team.title, 28))}</text>
  <text x="${W / 2}" y="114" font-size="12.5" fill="#666" text-anchor="middle">${esc(clip(team.store?.storeName || '', 34))}</text>
  <text x="${W / 2}" y="134" font-size="11.5" fill="#999" text-anchor="middle" letter-spacing=".3">${esc(S.date)} ${esc(S.festival)} · NO.${S.hash.slice(0, 8).toUpperCase()}</text>
  ${body}
  ${sign ? `<text x="${W / 2}" y="${sy}" font-size="${signFs(sign, W - 80, 14)}" fill="#333" text-anchor="middle" font-style="italic" xml:space="preserve">“${esc(sign)}”</text>` : ''}
  ${bars}
  ${qrSVG(W - 84, H - 116, 52, '#222', '#FFFDF7')}
  <text x="${W / 2}" y="${H - 46}" font-size="11.5" fill="#888" text-anchor="middle">谢谢惠顾 · Happy 1024 · ${mode === 'mock' ? 'mock 演示' : 'via 麦当劳 MCP'}</text>
  <text x="${W / 2}" y="${H - 28}" font-size="10.5" fill="#AAA" text-anchor="middle" letter-spacing=".3">🍔 mcd-team-feast · ${REPO_SHORT}</text>
</svg>`;
}

export function renderSVG(ctx, theme = 'git', opts = {}) {
  const svg = theme === 'pr' ? prTheme(ctx) : theme === 'receipt' ? receiptTheme(ctx) : gitTheme(ctx);
  return withFonts(svg, opts.fontCSS);
}

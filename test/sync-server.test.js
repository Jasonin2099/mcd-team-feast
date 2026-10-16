import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server/sync-server.js';

async function withServer(fn) {
  const s = createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${s.address().port}`;
  const post = async (p, b) => { const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return [r.status, await r.json()]; };
  try { await fn(base, post); } finally { s.closeAllConnections(); s.close(); }
}

test('room: create, join, picks, lock/unlock, auth', () => withServer(async (base, post) => {
  const [c, h] = await post('/rooms', { t: '下午茶', name: '老王', picks: [['BM001', 1], ['bad code!', 2]] });
  assert.equal(c, 200); assert.equal(h.state.members[0].picks.length, 1); assert.ok(h.hostKey);
  assert.ok(!JSON.stringify(h.state).includes(h.hostKey) && !JSON.stringify(h.state).includes(h.key), 'keys never in public state');
  const r = `/rooms/${h.id}/op`;
  const [, m] = await post(r, { op: 'join', name: '小李' });
  let [code] = await post(r, { op: 'picks', mid: m.mid, key: 'wrong', picks: [['DR001', 1]] }); assert.equal(code, 403);
  let [, j] = await post(r, { op: 'picks', mid: m.mid, key: m.key, picks: [['DR001', 2]] }); assert.deepEqual(j.state.members[1].picks, [['DR001', 2]]);
  [code] = await post(r, { op: 'lock', mid: m.mid, key: m.key }); assert.equal(code, 403, 'member cannot lock');
  [code] = await post(r, { op: 'lock', hostKey: h.hostKey }); assert.equal(code, 200);
  [code] = await post(r, { op: 'picks', mid: m.mid, key: m.key, picks: [] }); assert.equal(code, 423);
  [code] = await post(r, { op: 'join', name: 'late' }); assert.equal(code, 423);
  [code] = await post(r, { op: 'unlock', hostKey: h.hostKey }); assert.equal(code, 200);
  [code] = await post(r, { op: 'picks', mid: m.mid, key: m.key, picks: [] }); assert.equal(code, 200);
  assert.equal((await (await fetch(base + '/rooms/zzzzzzzz')).json()).error, 'room');
}));

test('room: SSE pushes state and presence', () => withServer(async (base, post) => {
  const [, h] = await post('/rooms', { t: 'x', name: 'A' });
  const ctl = new AbortController();
  const res = await fetch(`${base}/rooms/${h.id}/events?mid=${h.mid}&key=${h.key}`, { signal: ctl.signal });
  const rd = res.body.getReader(); let buf = '';
  const next = async () => { for (;;) { const i = buf.indexOf('\n\n'); if (i >= 0) { const ev = buf.slice(0, i); buf = buf.slice(i + 2); const d = ev.split('\n').find(l => l.startsWith('data: ')); if (d) return JSON.parse(d.slice(6)); continue; } const { value } = await rd.read(); buf += new TextDecoder().decode(value); } };
  const s1 = await next(); assert.equal(s1.members[0].online, true);
  await post(`/rooms/${h.id}/op`, { op: 'join', name: 'B' });
  const s2 = await next(); assert.equal(s2.members.length, 2); assert.equal(s2.members[1].online, false);
  ctl.abort();
}));

test('card: exported SVG embeds subset fonts', async () => {
  const { embeddedFontCSS, renderSVG } = await import('../src/card.js');
  const css = embeddedFontCSS(); assert.ok(css.includes("font-family:'Feast CJK'") && css.includes('base64,'));
  const { MOCK } = await import('../src/mock.js');
  const ctx = { team: { title: 't', organizer: 'a', createdAt: '2026-10-24T07:00:00.000Z', picks: [] }, bill: { people: [{ who: '老王', pay: 100, items: ['巨无霸×1'] }], avg: 100 }, plan: { subtotal: 100, discount: 0, total: 100, applied: [] }, mode: 'mock', now: MOCK.now };
  const svg = renderSVG(ctx, 'receipt', { fontCSS: css });
  assert.match(svg, /^<svg[^>]*><defs><style>@font-face/);
});

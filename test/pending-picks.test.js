// 竞态：建房/加入未完成时点的菜要排队，就绪后补发；失败可重试。用真实同步服务 + 假 EventSource。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server/sync-server.js';

class FakeES { constructor() { this.readyState = 1; } addEventListener() {} close() {} }
FakeES.CLOSED = 2;
const doc = new EventTarget(); doc.visibilityState = 'visible'; doc.querySelector = () => null;
const s = createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${s.address().port}`;
const store = new Map();
Object.assign(globalThis, { EventSource: FakeES, document: doc, localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }, location: { search: '?sync=' + base } });
globalThis.addEventListener ||= () => {}; globalThis.removeEventListener ||= () => {};
const realFetch = globalThis.fetch; let failNext = 0, delayJoin = 0;
globalThis.fetch = async (u, o) => {
  if (failNext && o?.body?.includes('"picks"') && o.body.includes('"op":"picks"')) { failNext--; throw new TypeError('network down'); }
  if (delayJoin && o?.body?.includes('"op":"join"')) await new Promise(r => setTimeout(r, delayJoin));
  return realFetch(u, o);
};
const { Room, createRoom } = await import('../web/sync.js');
const get = async id => (await realFetch(`${base}/rooms/${id}`)).json();
const wait = ms => new Promise(r => setTimeout(r, ms));
test.after(() => { s.closeAllConnections(); s.close(); });

test('加入未完成时点菜：排队，加入成功后补发，数量不丢不重复', async () => {
  const h = await createRoom({ t: 'x', name: '测试A', picks: [['BM001', 1]] });
  const r = new Room(h.id); r.apply(h.state);
  delayJoin = 150; const joining = r.join('测试B');
  assert.equal(r.joining, '测试B');
  r.setPicks([['SN002', 1]]); r.setPicks([['SN002', 2], ['DR001', 1]]); // 加入期间连点、改数量
  assert.ok(r.isPending('SN002') && r.isPending('DR001'));
  await joining; delayJoin = 0; await wait(100);
  const st = await get(h.id); const me = st.members.find(m => m.name === '测试B');
  assert.deepEqual(me.picks, [['SN002', 2], ['DR001', 1]]);
  assert.equal(r.pending, null); assert.ok(!r.isPending('SN002')); r.close();
});

test('发送失败 → 显示未同步；点重试后补发成功', async () => {
  const h = await createRoom({ t: 'x', name: '测试C', picks: [] });
  const r = new Room(h.id); r.apply(h.state);
  failNext = 1;
  await assert.rejects(r.setPicks([['BM002', 3]]));
  assert.ok(r.unsynced(), 'failed → retry shown'); assert.deepEqual(r.pending, [['BM002', 3]], 'local change kept');
  await r.flush();
  assert.ok(!r.unsynced()); assert.equal(r.pending, null);
  assert.deepEqual((await get(h.id)).members[0].picks, [['BM002', 3]]); r.close();
});

test('10 秒还没发出去也显示重试', () => {
  const r = new Room('abcdefgh'); r.setPicks([['BM001', 1]]); // 没有 creds：排队
  assert.ok(!r.unsynced()); assert.ok(r.unsynced(Date.now() + Room.PENDING_MS + 1)); r.close();
});

test('建房期间点的菜：用最新完整点单补发（app.js 逻辑）', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
  assert.match(app, /const latest = state\.p\.filter[\s\S]*room\.setPicks\(latest\)/);
});

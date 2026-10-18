import { test } from 'node:test';
import assert from 'node:assert/strict';

// 极简浏览器桩：EventSource / fetch / document / localStorage
class FakeES { static all = []; constructor(u) { this.url = u; this.readyState = 1; this.l = {}; FakeES.all.push(this); } addEventListener(k, f) { (this.l[k] ||= []).push(f); } emit(k, d) { (this.l[k] || []).forEach(f => f({ data: JSON.stringify(d) })); } close() { this.readyState = 2; this.closed = true; } }
FakeES.CLOSED = 2;
const doc = new EventTarget(); doc.visibilityState = 'visible'; doc.querySelector = () => null;
Object.assign(globalThis, { EventSource: FakeES, document: doc, localStorage: { getItem: () => null, setItem() {} }, location: { search: '?sync=http://s' } });
globalThis.addEventListener ||= () => {}; globalThis.removeEventListener ||= () => {};
let server = { rev: 1 };
globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: 'r', rev: server.rev, members: [{ mid: 'a', name: 'A', picks: [] }] }) });
const { Room } = await import('../web/sync.js');
const st = rev => ({ id: 'r', rev, members: [{ mid: 'a', name: 'A', picks: [] }] });

test('打开房间即订阅推送，收到 state 即「已同步」', () => {
  const r = new Room('abcdefgh'); r.connect();
  assert.equal(FakeES.all.at(-1).url, 'http://s/rooms/abcdefgh/events');
  FakeES.all.at(-1).emit('state', st(3)); assert.equal(r.status, 'live'); assert.equal(r.state.rev, 3); r.close();
});
test('晚到的旧版本不会覆盖新状态', () => {
  const r = new Room('abcdefgh'); r.apply(st(5)); r.apply(st(4)); assert.equal(r.state.rev, 5); r.apply(st(6)); assert.equal(r.state.rev, 6);
});
test('回到前台：立刻拉全量并在断线时重连', async () => {
  const r = new Room('abcdefgh'); r.connect(); const n = FakeES.all.length; FakeES.all.at(-1).emit('state', st(1));
  r.set('reconnecting'); server.rev = 9;
  doc.dispatchEvent(new Event('visibilitychange')); await new Promise(x => setTimeout(x, 10));
  assert.equal(r.state.rev, 9); assert.ok(FakeES.all.length > n, 'reopened stream'); r.close();
});
test('推送静默：超时后兜底拉全量，发现落后就重连', async () => {
  const r = new Room('abcdefgh'); r.connect(); FakeES.all.at(-1).emit('state', st(2)); const n = FakeES.all.length;
  r.lastMsg = Date.now() - Room.STALE_MS - 1; r.lastPoll = 0; server.rev = 7;
  r.watchdog(); await new Promise(x => setTimeout(x, 10));
  assert.equal(r.state.rev, 7); assert.ok(FakeES.all.length > n); r.close();
});
test('UI 不再有实时同步开关文案', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8') + readFileSync(new URL('../web/i18n.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /goLiveD|modeLink|id="goLive"|liveOn/);
});

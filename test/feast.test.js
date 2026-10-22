import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MOCK } from '../src/mock.js';
import { localPrice, findArray, MockProvider } from '../src/providers.js';
import { newTeam, addPick, mergeItems, bestCoupons, usableCoupons, splitBill, findItem } from '../src/feast.js';
import { renderSVG } from '../src/card.js';
import { parseResponse } from '../src/mcp.js';
import { run } from '../src/app.js';

const quiet = () => {};

test('模糊匹配餐品', () => {
  assert.equal(findItem(MOCK.menu, '拿铁').code, 'DR002');
  assert.equal(findItem(MOCK.menu, 'bm001').name, '巨无霸');
});

test('合并相同餐品', () => {
  const t = newTeam({ store: MOCK.stores[0] });
  addPick(t, MOCK.menu, 'a', '中薯条'); addPick(t, MOCK.menu, 'b', '中薯条', 2);
  assert.deepEqual(mergeItems(t.picks), [{ code: 'SN002', name: '中薯条', qty: 3 }]);
});

test('满减不达门槛不可用、整单券不可叠加', () => {
  const items = [{ code: 'DS002', qty: 1 }];
  assert.equal(localPrice(MOCK.menu, items, [MOCK.coupons[0]]), null);
  assert.equal(localPrice(MOCK.menu, [{ code: 'BM001', qty: 5 }], [MOCK.coupons[0], MOCK.coupons[1]]), null);
});

test('自动挑选最优券组合', async () => {
  const items = [{ code: 'BM001', qty: 4 }, { code: 'SN002', qty: 2 }];
  const { best } = await bestCoupons(async (i, c) => localPrice(MOCK.menu, i, c), items, MOCK.coupons);
  assert.equal(best.subtotal, 12400);
  assert.deepEqual(best.combo.map(c => c.id).sort(), ['C1024', 'CFRY']);
  assert.equal(best.total, 12400 - 2400 - 600);
});

test('人均分账总额守恒', () => {
  const t = newTeam({ store: MOCK.stores[0], organizer: 'a' });
  addPick(t, MOCK.menu, 'a', '巨无霸'); addPick(t, MOCK.menu, 'b', '甜筒'); addPick(t, MOCK.menu, 'c', '拿铁');
  const bill = splitBill(t.picks, { discount: 1001, fee: 700, organizer: 'a' });
  assert.equal(bill.people.reduce((s, p) => s + p.pay, 0), bill.total);
  assert.equal(bill.total, 4900 - 1001 + 700);
});

test('兼容 SSE 与 JSON 两种响应', () => {
  assert.deepEqual(parseResponse('{"jsonrpc":"2.0","id":1,"result":{"ok":1}}', 1).result, { ok: 1 });
  const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"x":2}}\n\n';
  assert.deepEqual(parseResponse(sse, 2).result, { x: 2 });
});

test('宽松解析真实返回结构', () => {
  assert.equal(findArray({ data: { list: [1, 2] } }, ['list']).length, 2);
});

test('SVG 账单卡包含关键信息并转义', () => {
  const t = newTeam({ title: '<下午茶>', store: MOCK.stores[0] });
  addPick(t, MOCK.menu, '小李', '巨无霸');
  const plan = { subtotal: 2500, discount: 0, total: 2500, applied: [] };
  const svg = renderSVG({ team: t, bill: splitBill(t.picks), plan, mode: 'mock' });
  assert.match(svg, /&lt;下午茶&gt;/); assert.match(svg, /小李/); assert.match(svg, /¥25.00/);
});

test('demo 全流程（mock）生成账单卡', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'feast-'));
  const r = await run(['demo', '--mock', '--out', dir, '--file', join(dir, 's.json')], quiet);
  assert.ok(existsSync(r.files.svg) && existsSync(r.files.html));
  assert.equal(r.ctx.bill.people.length, 5);
  assert.ok(r.best.discount > 0);
});

test('没有确认码绝不下单', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'feast-'));
  const f = join(dir, 's.json');
  const r = await run(['demo', '--mock', '--out', dir, '--file', f], quiet);
  await assert.rejects(run(['order', '--mock', '--file', f], quiet), /确认码/);
  await assert.rejects(run(['order', '--mock', '--file', f, '--confirm', 'wrong'], quiet), /确认码/);
  const ok = await run(['order', '--mock', '--file', f, '--confirm', r.code], quiet);
  assert.equal(ok.mock, true);
});

test('真实模式缺 token 时给出友好提示', () => {
  const old = process.env.MCD_MCP_TOKEN; delete process.env.MCD_MCP_TOKEN;
  return assert.rejects(run(['stores'], quiet), /MCD_MCP_TOKEN/).finally(() => { if (old) process.env.MCD_MCP_TOKEN = old; });
});

test('partial query prefers the shortest matching name, then menu order', () => {
  const menu = [{ code: 'A', name: '麦乐鸡分享盒 20 块' }, { code: 'B', name: '麦乐鸡 5 块' }, { code: 'C', name: '麦乐鸡 9 块' }];
  assert.equal(findItem(menu, '麦乐鸡').code, 'B');
  assert.equal(findItem(menu, '分享').code, 'A');
});

test('empty or blank query never matches a menu item', () => {
  assert.equal(findItem(MOCK.menu, ''), undefined);
  assert.equal(findItem(MOCK.menu, '   '), undefined);
  assert.equal(findItem(MOCK.menu, undefined), undefined);
  const team = newTeam({ store: MOCK.stores[0] });
  assert.throws(() => addPick(team, MOCK.menu, 'A', ''), /没找到/);
  assert.equal(team.picks.length, 0);
});

test('quantity must be a whole number', () => {
  const team = newTeam({ store: MOCK.stores[0] });
  for (const q of [0, 1.5, NaN, -1]) assert.throws(() => addPick(team, MOCK.menu, 'A', '巨无霸', q), /整数/);
  addPick(team, MOCK.menu, 'A', '巨无霸', 2);
  assert.equal(team.picks[0].qty, 2);
});

test('item coupons for products not in the cart are skipped before pricing', async () => {
  const items = [{ code: 'BM001', qty: 4 }, { code: 'SN002', qty: 2 }];
  assert.deepEqual(usableCoupons(items, MOCK.coupons).map(c => c.id), ['C1024', 'C0050', 'CFRY', 'C88']);
  const live = [{ id: 'X', type: 'item', itemCodes: ['ZZ9', 'SN002'] }, { id: 'Y', type: 'item', itemCodes: ['ZZ9'] }];
  assert.deepEqual(usableCoupons(items, live).map(c => c.id), ['X']);
  let calls = 0;
  const { best } = await bestCoupons(async (i, c) => { calls++; return localPrice(MOCK.menu, i, c); }, items, MOCK.coupons);
  assert.equal(calls, 8); // 不过滤时是 16 组（多出的都含拿铁券，必然无效）
  assert.ok(!best.combo.some(c => c.id === 'CLATTE'));
});

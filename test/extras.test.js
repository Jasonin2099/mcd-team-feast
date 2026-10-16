import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderSVG, THEMES, fakeHash } from '../src/card-core.js';
import { parseNutrition, kcalOf } from '../src/nutrition.js';
import { blame, splitBill, newTeam, addPick } from '../src/feast.js';
import { MOCK } from '../src/mock.js';
import { handle } from '../src/mcp-server.js';
import { run } from '../src/app.js';

const quiet = () => {};
const sample = () => { const t = newTeam({ store: MOCK.stores[0], organizer: 'a' }); addPick(t, MOCK.menu, 'a', '巨无霸'); addPick(t, MOCK.menu, 'b', '甜筒', 2); return t; };

test('三种主题都能渲染合法 SVG', () => {
  const t = sample(); const bill = splitBill(t.picks, { organizer: 'a' });
  for (const th of THEMES) { const svg = renderSVG({ team: t, bill, plan: { subtotal: 3700, discount: 0, total: 3700, applied: [] }, mode: 'mock' }, th); assert.match(svg, /^<svg[\s\S]*<\/svg>$/); assert.match(svg, /¥/); }
});

test('fakeHash 稳定且为 40 位', () => { assert.equal(fakeHash('x'), fakeHash('x')); assert.equal(fakeHash('x').length, 40); });

test('解析 list-nutrition-foods 紧凑表格并匹配热量', () => {
  const foods = parseNutrition('[3]{productName,nutritionDescription,energyKj,energyKcal,protein}:\n  巨无霸,null,2146,513,27\n  可乐中杯,null,616,147,0\n  菠萝派,null,925,221,2');
  assert.equal(foods.length, 3);
  assert.equal(kcalOf(foods, '巨无霸'), 513); assert.equal(kcalOf(foods, '中杯可口可乐'), 147); assert.equal(kcalOf(foods, '不存在的餐'), null); assert.equal(kcalOf(foods, '可乐中杯'), 147);
});

test('blame 排行与热量统计', () => {
  const t = sample(); const bill = splitBill(t.picks, { organizer: 'a', kcalOf: n => ({ 巨无霸: 540, 原味甜筒: 150 })[n] });
  const b = blame(bill); assert.equal(b.spender.who, 'a'); assert.equal(b.kcal.who, 'a'); assert.equal(b.saver.who, 'b');
  assert.equal(bill.people.find(p => p.who === 'b').kcal, 300);
});

test('checkout --theme all 输出三张卡', async () => {
  const d = mkdtempSync(join(tmpdir(), 'feast-')); const lines = [];
  await run(['demo', '--mock', '--theme', 'all', '--out', d, '--file', join(d, 's.json')], s => lines.push(s));
  assert.equal(lines.filter(l => String(l).includes('账单卡[')).length, 3);
  await assert.rejects(run(['checkout', '--mock', '--theme', 'nope', '--file', join(d, 's.json'), '--out', d], quiet), /未知主题/);
});

test('MCP Server：initialize / tools/list / 不暴露下单工具', async () => {
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, { mock: true });
  assert.equal(init.result.serverInfo.name, 'mcd-team-feast');
  const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, { mock: true });
  const names = list.result.tools.map(t => t.name);
  assert.ok(names.includes('feast_checkout')); assert.ok(!names.some(n => /order/.test(n)));
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, { mock: true }), null);
});

test('MCP Server：在 mock 模式完成一次拼单', async () => {
  const d = mkdtempSync(join(tmpdir(), 'feast-')); process.env.FEAST_FILE = join(d, 's.json');
  try {
    const call = (name, args) => handle({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name, arguments: args } }, { mock: true });
    await call('feast_new', { title: 'MCP 团', organizer: '我' });
    await call('feast_pick', { who: '我', item: '巨无霸', qty: 2 });
    const r = await call('feast_checkout', { out: d });
    assert.ok(!r.result.isError, r.result.content[0].text); assert.match(r.result.content[0].text, /人均/);
  } finally { delete process.env.FEAST_FILE; }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rcLayout, receiptHTML, rcFilename } from '../web/room-receipt.js';

const mk = (n, k = 1) => Array.from({ length: n }, (_, i) => ({ name: '同事' + i, picks: Array.from({ length: k }, (_, j) => ['C' + j, 1]) }));

test('小票布局：≤8 人单列，每人最多 6 行（超出 5 行 + 另 N 项）', () => {
  const L = rcLayout([...mk(7, 3), { name: 'x', picks: Array.from({ length: 9 }, (_, j) => ['D' + j, 1]) }]);
  assert.equal(L.mode, 'single'); assert.equal(L.maxLines, 6); assert.equal(L.aggMax, 12);
  assert.deepEqual(L.lines, [3, 3, 3, 3, 3, 3, 3, 5]); assert.equal(L.more[7], 4);
  assert.deepEqual(rcLayout(mk(1, 6)).lines, [6]);
});
test('小票布局：9–24 人两列，每人最多 4 行（3 行 + 另 N 项）', () => {
  for (const n of [9, 12, 24]) assert.equal(rcLayout(mk(n, 2)).mode, 'cols2');
  const L = rcLayout(mk(10, 5)); assert.equal(L.lines[0], 3); assert.equal(L.more[0], 2);
  assert.equal(rcLayout(mk(10, 4)).lines[0], 4);
});
test('小票布局：>24 人只出名单 + 汇总（最多 30 种）', () => {
  const L = rcLayout(mk(40, 3)); assert.equal(L.mode, 'compact'); assert.equal(L.aggMax, 30); assert.ok(L.lines.every(x => x === 0));
});
test('小票布局：没点单的成员不计入', () => {
  assert.equal(rcLayout([...mk(8), { name: 'z', picks: [] }]).mode, 'single');
});
test('小票 HTML：不含价格、合计=件数、转义名字', () => {
  const st = { t: '夜宵<b>', members: [{ name: '<i>a', picks: [['BM001', 2]] }, { name: 'b', picks: [['DR002', 3]] }, { name: 'c', picks: [] }] };
  const h = receiptHTML(st, { t: k => k, now: new Date(2026, 9, 18, 21, 30) });
  assert.doesNotMatch(h, /¥/); assert.match(h, /<b>5<small>/); assert.match(h, /&lt;i&gt;a/); assert.doesNotMatch(h, /<i>a/);
  assert.match(h, /2026-10-18 21:30/); assert.match(h, />2 people</);
});
test('小票文件名 feast-{roomId}-YYYYMMDD.png', () => {
  assert.equal(rcFilename('Ab12_x-9', new Date(2026, 9, 5)), 'feast-Ab12_x-9-20261005.png');
});
test('首屏不加载 snapDOM；账单页保存图片保持原样', () => {
  const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /from '\.\/vendor\/snapdom/);
  assert.match(app, /\$\('imgBtn'\)\.onclick = e => act\(e\.currentTarget, saveImage\)/);
});

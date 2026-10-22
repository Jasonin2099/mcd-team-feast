import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOCK } from '../src/mock.js';
import { findItem } from '../src/feast.js';

test('演示菜单：编码唯一，同品类连续排列（网页/CLI 按相邻项分组）', () => {
  const codes = MOCK.menu.map(m => m.code);
  assert.equal(new Set(codes).size, codes.length);
  const order = MOCK.menu.map(m => m.category).filter((c, i, a) => c !== a[i - 1]);
  assert.equal(new Set(order).size, order.length, `品类被拆开了: ${order.join(' / ')}`);
  assert.deepEqual(order, ['汉堡', '套餐', '炸鸡', '小食', '甜品', '饮品', '麦咖啡']);
});

test('演示菜单：每项都有正价和热量', () => {
  for (const m of MOCK.menu) {
    assert.ok(m.price > 0 && Number.isInteger(Math.round(m.price * 100)), m.code);
    assert.ok(Number.isInteger(m.kcal) && m.kcal >= 0, m.code);
  }
});

test('拿铁换到麦咖啡后仍是 DR002，旧分享链接还能解析', () => {
  const latte = findItem(MOCK.menu, 'DR002');
  assert.equal(latte.category, '麦咖啡');
  assert.equal(findItem(MOCK.menu, '拿铁').code, 'DR002');
});

test('新品类能按名字点到，模糊词不会误中套餐', () => {
  assert.equal(findItem(MOCK.menu, '巨无霸').code, 'BM001');
  assert.equal(findItem(MOCK.menu, '巨无霸套餐').code, 'ST001');
  assert.equal(findItem(MOCK.menu, '麦乐鸡').code, 'SN001');
  assert.equal(findItem(MOCK.menu, '分享盒').code, 'CK003');
  assert.equal(findItem(MOCK.menu, '美式').code, 'MC001');
});

test('券引用的单品都在菜单里', () => {
  for (const c of MOCK.coupons.filter(c => c.type === 'item')) assert.ok(findItem(MOCK.menu, c.itemCode), c.id);
});

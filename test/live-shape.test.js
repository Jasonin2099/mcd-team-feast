// 用与真实麦当劳 MCP 返回结构一致的脱敏样例测试解析逻辑（不发起任何网络请求）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStores, normalizeMenu, normalizeCoupons, buildPriceItems, normalizePrice } from '../src/providers.js';
import { extractJson } from '../src/mcp.js';

test('从“字段说明 + 原始 JSON”文本中提取 JSON', () => {
  const t = '## Response Structure\n- **data**: ...\n## Original Response\n\n{"success":true,"code":200,"data":{"date":"2026-10-24"}}';
  assert.equal(extractJson(t).data.date, '2026-10-24');
});

test('解析 query-nearby-stores', () => {
  const s = normalizeStores({ success: true, data: [{ storeCode: '1450441', storeName: '麦当劳上海福州路餐厅', address: '福州路666号', distance: 235, beCode: '' }] });
  assert.deepEqual(s[0], { storeCode: '1450441', storeName: '麦当劳上海福州路餐厅', address: '福州路666号', distance: 235, beCode: undefined });
});

test('解析 query-meals：去重、分类、随单购价按原价', () => {
  const m = normalizeMenu({ data: {
    categories: [{ name: '人气热卖', meals: [{ code: 'A' }, { code: 'B' }] }, { name: '小食甜品\n/其他', meals: [{ code: 'A' }, { code: 'C' }] }],
    meals: { A: { name: '派', currentPrice: '8.5' }, B: { name: '套餐', currentPrice: '13.2', originalPrice: '22', discountType: '随单购早餐卡优惠' }, C: { name: '脆薯饼', currentPrice: '8.5' } },
  } });
  assert.deepEqual(m.map(x => [x.code, x.price, x.category]), [['A', 8.5, '人气热卖'], ['B', 22, '人气热卖'], ['C', 8.5, '小食甜品 /其他']]);
});

test('解析 query-store-coupons 并把券挂到商品行', () => {
  const cs = normalizeCoupons({ data: [
    { couponId: 'X1', couponCode: 'c1', title: '派立减', products: [{ productCode: 'A' }] },
    { couponId: 'X1', couponCode: 'c2', title: '派立减', products: [{ productCode: 'A' }] },
  ] });
  assert.equal(cs.length, 1); assert.deepEqual(cs[0].codes, ['c1', 'c2']);
  assert.deepEqual(buildPriceItems([{ code: 'A', qty: 2 }], cs), [{ productCode: 'A', quantity: 1 }, { productCode: 'A', quantity: 1, couponId: 'X1', couponCode: 'c1' }]);
  assert.equal(buildPriceItems([{ code: 'Z', qty: 1 }], cs), null);
});

test('解析 calculate-price（单位：分）', () => {
  const p = normalizePrice({ data: { productOriginalPrice: 13950, originalPrice: 13950, discount: 1420, price: 12530 } });
  assert.deepEqual([p.subtotal, p.discount, p.total, p.fee], [13950, 1420, 12530, 0]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localPrice, buildPriceItems, normalizePrice } from '../src/providers.js';
import { renderSVG, receiptLines, fontCSS, width, clip, padEnd } from '../src/card-core.js';
import { MOCK } from '../src/mock.js';
import { newTeam, addPick, splitBill } from '../src/feast.js';

// 小菜单：A ¥12.5，B ¥30
const MENU = [{ code: 'A', name: 'A', price: 12.5 }, { code: 'B', name: 'B', price: 30 }];
const CART = [{ code: 'A', qty: 3 }, { code: 'B', qty: 1 }]; // 3750 + 3000 = 6750 分

test('localPrice: item coupon honours perOrder (default 1)', () => {
  const two = localPrice(MENU, CART, [{ id: 'i', title: 'A -2', type: 'item', itemCode: 'A', amount: 2, perOrder: 2 }]);
  assert.equal(two.discount, 400); assert.equal(two.total, 6750 - 400);
  const one = localPrice(MENU, CART, [{ id: 'i', title: 'A -2', type: 'item', itemCode: 'A', amount: 2 }]);
  assert.equal(one.discount, 200);
  // perOrder larger than the quantity in the cart: only as many as were ordered
  assert.equal(localPrice(MENU, [{ code: 'A', qty: 1 }], [{ id: 'i', title: 'x', type: 'item', itemCode: 'A', amount: 2, perOrder: 5 }]).discount, 200);
  // coupon for something not in the cart is unusable
  assert.equal(localPrice(MENU, [{ code: 'B', qty: 1 }], [{ id: 'i', title: 'x', type: 'item', itemCode: 'A', amount: 2 }]), null);
});

test('localPrice: percent coupon rounds to fen and respects cap', () => {
  assert.equal(localPrice(MENU, CART, [{ id: 'p', title: '88折', type: 'percent', rate: 0.88 }]).discount, 810);
  assert.equal(localPrice(MENU, CART, [{ id: 'p', title: '88折', type: 'percent', rate: 0.88, cap: 5 }]).discount, 500);
  // 12.5 × 0.12 = 1.5 → rounds to 150 fen, no float drift
  assert.equal(localPrice(MENU, [{ code: 'A', qty: 1 }], [{ id: 'p', title: '88折', type: 'percent', rate: 0.88 }]).discount, 150);
});

test('localPrice: threshold is inclusive; item + order-level coupons stack, two order-level do not', () => {
  const at = { id: 't', title: '满67.5减10', type: 'threshold', threshold: 67.5, amount: 10 };
  assert.equal(localPrice(MENU, CART, [at]).discount, 1000);
  assert.equal(localPrice(MENU, CART, [{ ...at, threshold: 67.51 }]), null);
  const item = { id: 'i', title: 'B -3', type: 'item', itemCode: 'B', amount: 3 };
  const both = localPrice(MENU, CART, [item, at]);
  assert.equal(both.discount, 1300);
  assert.deepEqual(both.applied.map((a) => [a.id, a.discount]), [['i', 300], ['t', 1000]]);
  assert.equal(both.total, both.subtotal - both.discount);
  assert.equal(localPrice(MENU, CART, [at, { id: 'p', title: 'x', type: 'percent', rate: 0.9 }]), null);
});

test('buildPriceItems: one unit per coupon, used-up lines dropped, no couponCode when there is none', () => {
  const c = (id, codes) => ({ id, itemCodes: ['A'], ...(codes ? { codes } : {}) });
  assert.deepEqual(buildPriceItems([{ code: 'A', qty: 2 }], [c('X', ['x1']), c('Y')]), [
    { productCode: 'A', quantity: 1, couponId: 'X', couponCode: 'x1' },
    { productCode: 'A', quantity: 1, couponId: 'Y' },
  ]);
  // two coupons but only one unit in the cart
  assert.equal(buildPriceItems([{ code: 'A', qty: 1 }], [c('X'), c('Y')]), null);
  assert.deepEqual(buildPriceItems([{ code: 'A', qty: 1 }, { code: 'B', qty: 2 }]), [{ productCode: 'A', quantity: 1 }, { productCode: 'B', quantity: 2 }]);
});

test('normalizePrice: derived discount includes the fee and never goes negative', () => {
  const p = normalizePrice({ data: { originalPrice: 1000, deliveryFee: 300, price: 1200 } }, [{ id: 'X', title: 't' }]);
  assert.deepEqual([p.subtotal, p.fee, p.total, p.discount], [1000, 300, 1200, 100]);
  assert.deepEqual(p.applied, [{ id: 'X', title: 't' }]);
  assert.equal(normalizePrice({ productOriginalPrice: 1000, price: 1100 }).discount, 0);
  assert.deepEqual(normalizePrice(null), { subtotal: 0, total: 0, fee: 0, discount: 0, applied: [], takeWayList: [] });
});

test('card-core text helpers count CJK as two columns', () => {
  assert.equal(width('巨无霸a'), 7);
  assert.equal(clip('巨无霸套餐', 7), '巨无霸…');
  assert.equal(clip('abc', 7), 'abc');
  assert.equal(width(padEnd('巨无霸', 10)), 10);
  assert.equal(padEnd('toolongtext', 4), 'toolongtext');
});

const ctx = (plan, mode = 'mock') => {
  const t = newTeam({ store: MOCK.stores[0], organizer: 'a' });
  addPick(t, MOCK.menu, 'a', '巨无霸'); addPick(t, MOCK.menu, 'b', '甜筒', 2);
  return { team: t, bill: splitBill(t.picks, { organizer: 'a' }), plan, mode, now: { date: '2026-10-24', time: '12:00', festival: '1024' } };
};
const text = (c) => receiptLines(c).map((l) => l[1]).join('\n');

test('receiptLines: no-coupon hint, store promo line, and live coupons without amounts', () => {
  assert.match(text(ctx({ subtotal: 3700, discount: 0, total: 3700, applied: [] })), /暂无可用优惠券/);
  // discount larger than the coupons explain → the rest is shown as a store promo
  const promo = receiptLines(ctx({ subtotal: 3700, discount: 900, total: 2800, applied: [{ id: 'c', title: '券', discount: 500 }] }));
  assert.deepEqual(promo.find((l) => l[1].includes('促销优惠')).slice(2), ['-¥4.00']);
  // live mode: calculate-price gives no per-coupon amount, so no promo split is guessed
  const live = ctx({ subtotal: 3700, discount: 900, total: 2800, applied: [{ id: 'c', title: '券' }] }, 'live');
  assert.ok(!text(live).includes('促销优惠'));
  assert.match(text(live), /via 麦当劳 MCP/);
});

test('renderSVG: unknown theme falls back to git; fonts are embedded only when given', () => {
  const c = ctx({ subtotal: 3700, discount: 0, total: 3700, applied: [] });
  assert.equal(renderSVG(c, 'nope'), renderSVG(c, 'git'));
  assert.equal(fontCSS({}), '');
  const css = fontCSS({ mono400: 'AAAA' });
  assert.equal((css.match(/@font-face/g) || []).length, 1);
  for (const th of ['git', 'pr', 'receipt']) {
    const svg = renderSVG(c, th, { fontCSS: css });
    assert.match(svg, /^<svg[^>]*><defs><style>@font-face\{font-family:'Feast Mono';font-weight:400;src:url\(data:font\/woff2;base64,AAAA\)/);
    assert.equal(renderSVG(c, th, { fontCSS: '' }), renderSVG(c, th));
  }
});

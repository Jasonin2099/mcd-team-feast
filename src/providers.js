import { MOCK } from './mock.js';
import { McpClient } from './mcp.js';
import { fen } from './money.js';

// 本地计价（mock 模式 & 单元测试用），所有金额以“分”计算避免浮点误差
export function localPrice(menu, items, coupons = []) {
  const byCode = Object.fromEntries(menu.map(m => [m.code, m]));
  let subtotal = 0;
  for (const it of items) subtotal += fen(byCode[it.code].price) * it.qty;
  let discount = 0; const applied = []; let orderLevel = 0;
  for (const c of coupons) {
    let d = 0;
    if (c.type === 'item') {
      const it = items.find(i => i.code === c.itemCode);
      if (it) d = fen(c.amount) * Math.min(it.qty, c.perOrder || 1);
    } else {
      if (orderLevel++) return null; // 整单券不可叠加
      if (c.type === 'threshold' && subtotal >= fen(c.threshold)) d = fen(c.amount);
      if (c.type === 'percent') d = Math.min(Math.round(subtotal * (1 - c.rate)), fen(c.cap ?? Infinity));
    }
    if (d <= 0) return null; // 券不满足条件
    discount += d; applied.push({ id: c.id, title: c.title, discount: d });
  }
  return { subtotal, discount, total: subtotal - discount, applied };
}

export class MockProvider {
  constructor() { this.mode = 'mock'; this.calls = []; }
  log(t, a) { this.calls.push({ tool: t, args: a }); }
  async now() { this.log('now-time-info', {}); return MOCK.now; }
  async stores(keyword) { this.log('query-nearby-stores', { keyword }); return MOCK.stores; }
  async menu(storeCode) { this.log('query-meals', { storeCode }); return MOCK.menu; }
  async coupons(storeCode) { this.log('query-store-coupons', { storeCode }); return MOCK.coupons; }
  async price(storeCode, items, coupons) { this.log('calculate-price', { storeCode, items, coupons: coupons.map(c => c.id) }); return localPrice(MOCK.menu, items, coupons); }
  async createOrder(payload) { this.log('create-order', payload); return { orderId: 'MOCK-' + Date.now(), payUrl: 'https://example.invalid/mock-pay', mock: true }; }
}

// 从各种可能的返回结构中找出数组（真实返回结构以 tools/list 为准，这里做宽松兼容）
export function findArray(obj, keys = []) {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== 'object') return [];
  for (const k of keys) if (Array.isArray(obj[k])) return obj[k];
  for (const v of Object.values(obj)) { const a = findArray(v, keys); if (a.length) return a; }
  return [];
}
const pick = (o, ...ks) => { for (const k of ks) if (o?.[k] != null) return o[k]; };

export class McpProvider {
  constructor(opts) { this.mode = 'live'; this.c = new McpClient(opts); this.calls = []; }
  async call(t, a) { this.calls.push({ tool: t, args: a }); return this.c.call(t, a); }
  async now() { return this.call('now-time-info', {}); }
  async stores(keyword) {
    const r = await this.call('query-nearby-stores', { keyword, address: keyword });
    return findArray(r, ['stores', 'list', 'data']).map(s => ({
      storeCode: pick(s, 'storeCode', 'code', 'id'), storeName: pick(s, 'storeName', 'name'), address: pick(s, 'address', 'addr'), distance: pick(s, 'distance'),
    }));
  }
  async menu(storeCode) {
    const r = await this.call('query-meals', { storeCode });
    return findArray(r, ['meals', 'products', 'items', 'list']).map(m => ({
      code: String(pick(m, 'code', 'productCode', 'mealCode', 'id')), name: pick(m, 'name', 'productName', 'mealName'),
      price: Number(pick(m, 'price', 'salePrice', 'currentPrice') ?? 0), category: pick(m, 'category', 'categoryName') ?? '',
    }));
  }
  async coupons(storeCode) {
    const r = await this.call('query-store-coupons', { storeCode });
    return findArray(r, ['coupons', 'list']).map(c => ({ id: String(pick(c, 'couponId', 'id', 'couponCode')), title: pick(c, 'title', 'couponName', 'name'), type: 'remote', raw: c }));
  }
  async price(storeCode, items, coupons) {
    const r = await this.call('calculate-price', { storeCode, items: items.map(i => ({ productCode: i.code, quantity: i.qty })), couponIds: coupons.map(c => c.id) });
    const y = k => fen(pick(r, ...k) ?? pick(r?.data, ...k) ?? 0);
    const subtotal = y(['productAmount', 'originalAmount', 'subtotal', 'totalAmount']);
    const total = y(['payAmount', 'realAmount', 'total', 'finalAmount']);
    const fee = y(['deliveryFee']);
    return { subtotal, discount: Math.max(0, subtotal + fee - total), total, fee, applied: coupons.map(c => ({ id: c.id, title: c.title })), raw: r };
  }
  async createOrder(payload) { return this.call('create-order', payload); }
}

export function makeProvider({ mock }) { return mock ? new MockProvider() : new McpProvider(); }

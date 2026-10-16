import { MOCK } from './mock.js';
import { McpClient } from './mcp.js';
import { fen } from './money.js';
import { parseNutrition } from './nutrition.js';

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
  async nutrition() { this.log('list-nutrition-foods', {}); return MOCK.menu.map(m => ({ name: m.name, kcal: m.kcal })); }
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

// 到店自取场景：orderType=1, beType=1（真实 schema 来自 tools/list）
const SCENE = { orderType: 1, beType: 1 };
const unwrap = r => (r && typeof r === 'object' && 'data' in r ? r.data : r);

export function normalizeStores(r) {
  return findArray(unwrap(r), ['data', 'stores']).map(s => ({
    storeCode: String(s.storeCode), storeName: s.storeName, address: s.address, distance: s.distance, beCode: s.beCode || undefined,
  }));
}

// query-meals 返回 { categories:[{name, meals:[{code}]}], meals:{code:{name,currentPrice,originalPrice,discountType}} }
export function normalizeMenu(r) {
  const d = unwrap(r) || {}; const detail = d.meals || {}; const seen = new Set(); const out = [];
  for (const cat of d.categories || []) for (const { code } of cat.meals || []) {
    const m = detail[code]; if (!m || seen.has(code)) continue; seen.add(code);
    // “随单购xx卡优惠”价需额外购卡才能享受，拼单场景按原价计
    const price = Number(String(m.discountType || '').includes('随单购') ? (m.originalPrice ?? m.currentPrice) : m.currentPrice);
    out.push({ code: String(code), name: m.name, price, category: String(cat.name).replace(/\s+/g, ' ') });
  }
  return out;
}

// query-store-coupons 返回 data[]：{couponId, couponCode, title, products:[{productCode}]}，同一 couponId 可有多张券码
export function normalizeCoupons(r) {
  const groups = new Map();
  for (const c of findArray(unwrap(r), ['data', 'coupons'])) {
    const id = String(c.couponId);
    const g = groups.get(id) || { id, title: c.title, type: 'item', codes: [], itemCodes: (c.products || []).map(p => String(p.productCode)) };
    if (c.couponCode) g.codes.push(String(c.couponCode)); groups.set(id, g);
  }
  return [...groups.values()];
}

// 把券挂到对应商品行：拆出 1 份带 couponId/couponCode 的商品
export function buildPriceItems(items, coupons = []) {
  const lines = items.map(i => ({ productCode: i.code, quantity: i.qty }));
  for (const c of coupons) {
    const line = lines.find(l => !l.couponId && c.itemCodes?.includes(l.productCode) && l.quantity >= 1);
    if (!line) return null;
    line.quantity -= 1;
    lines.push({ productCode: line.productCode, quantity: 1, couponId: c.id, ...(c.codes?.[0] ? { couponCode: c.codes[0] } : {}) });
  }
  return lines.filter(l => l.quantity > 0);
}

// calculate-price 返回金额单位为“分”
export function normalizePrice(r, coupons = []) {
  const d = unwrap(r) || {};
  const subtotal = Number(d.productOriginalPrice ?? d.originalPrice ?? 0);
  const total = Number(d.price ?? 0);
  const fee = Number(d.deliveryFee ?? d.deliveryPrice ?? 0);
  return { subtotal, total, fee, discount: Math.max(0, Number(d.discount ?? (subtotal + fee - total))), applied: coupons.map(c => ({ id: c.id, title: c.title })), takeWayList: d.takeWayList || [] };
}

export class McpProvider {
  constructor(opts) { this.mode = 'live'; this.c = new McpClient(opts); this.calls = []; this.city = opts?.city; }
  async call(t, a) { this.calls.push({ tool: t, args: a }); return this.c.call(t, a); }
  async now() {
    const d = unwrap(await this.call('now-time-info', {})) || {};
    const [date, time] = String(d.formatted || '').split(' ');
    return { date, time: time?.slice(0, 5), festival: date?.endsWith('-10-24') ? '1024 程序员节' : '' };
  }
  async stores(keyword, city = this.city) {
    const args = { ...SCENE, searchType: 2, ...(keyword ? { keyword } : {}), ...(city ? { city } : {}) };
    delete args.orderType;
    return normalizeStores(await this.call('query-nearby-stores', args));
  }
  async menu(storeCode) { return normalizeMenu(await this.call('query-meals', { storeCode, ...SCENE })); }
  async coupons(storeCode) { return normalizeCoupons(await this.call('query-store-coupons', { storeCode, ...SCENE })); }
  async price(storeCode, items, coupons = []) {
    const lines = buildPriceItems(items, coupons);
    if (!lines) return null;
    return normalizePrice(await this.call('calculate-price', { storeCode, ...SCENE, items: lines }), coupons);
  }
  async nutrition() { return parseNutrition(unwrap(await this.call('list-nutrition-foods', {}))); }
  // 仅在 feast order --confirm <确认码> 时调用
  async createOrder({ storeCode, items, coupons = [], takeWayCode = 'take-in-store' }) {
    return this.call('create-order', { storeCode, ...SCENE, takeWayCode, items: buildPriceItems(items, coupons) });
  }
}

export function makeProvider({ mock, city }) { return mock ? new MockProvider() : new McpProvider({ city }); }

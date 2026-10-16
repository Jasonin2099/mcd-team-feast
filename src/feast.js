import { fen } from './money.js';

export function newTeam({ title = '1024 程序员节下午茶', organizer = 'leader', store }) {
  return { title, organizer, store, createdAt: new Date().toISOString(), picks: [] };
}

export function findItem(menu, q) {
  const s = String(q).trim().toLowerCase();
  return menu.find(m => m.code.toLowerCase() === s) || menu.find(m => m.name.toLowerCase() === s) || menu.find(m => m.name.toLowerCase().includes(s));
}

export function addPick(team, menu, who, query, qty = 1) {
  const item = findItem(menu, query);
  if (!item) throw new Error(`菜单里没找到「${query}」，先 feast menu 看看？`);
  if (!(qty >= 1)) throw new Error('数量至少为 1');
  team.picks.push({ who, code: item.code, name: item.name, price: item.price, qty });
  return item;
}

export function removePicks(team, who) { const n = team.picks.length; team.picks = team.picks.filter(p => p.who !== who); return n - team.picks.length; }

export function mergeItems(picks) {
  const m = new Map();
  for (const p of picks) m.set(p.code, { code: p.code, name: p.name, qty: (m.get(p.code)?.qty || 0) + p.qty });
  return [...m.values()];
}

// 枚举券组合（最多 3 张，整单券至多 1 张），挑应付最低的方案
export async function bestCoupons(priceFn, items, coupons, maxSize = 3) {
  const combos = [[]];
  const rec = (start, cur) => {
    for (let i = start; i < coupons.length; i++) {
      const next = [...cur, coupons[i]];
      if (next.filter(c => c.type !== 'item').length > 1) continue;
      combos.push(next); if (next.length < maxSize) rec(i + 1, next);
    }
  };
  rec(0, []);
  let best = null; const tried = [];
  for (const combo of combos) {
    let r; try { r = await priceFn(items, combo); } catch { r = null; }
    if (!r) continue;
    tried.push({ coupons: combo.map(c => c.id), total: r.total });
    if (!best || r.total < best.total || (r.total === best.total && combo.length < best.combo.length)) best = { ...r, combo };
  }
  return { best, tried };
}

// 人均分账：按每人原价占比分摊优惠，配送费平摊，尾差由发起人兜底
export function splitBill(picks, { discount = 0, fee = 0, organizer, kcalOf } = {}) {
  const people = new Map();
  for (const p of picks) {
    const e = people.get(p.who) || { who: p.who, items: [], gross: 0 };
    e.items.push(`${p.name}×${p.qty}`); e.gross += fen(p.price) * p.qty;
    const k = kcalOf?.(p.name); if (k != null) e.kcal = (e.kcal || 0) + k * p.qty;
    people.set(p.who, e);
  }
  const list = [...people.values()];
  const gross = list.reduce((s, e) => s + e.gross, 0);
  const total = gross - discount + fee;
  for (const e of list) {
    e.discount = gross ? Math.floor(discount * e.gross / gross) : 0;
    e.fee = list.length ? Math.floor(fee / list.length) : 0;
    e.pay = e.gross - e.discount + e.fee;
  }
  const diff = total - list.reduce((s, e) => s + e.pay, 0);
  const org = list.find(e => e.who === organizer) || list[0];
  if (org) org.pay += diff;
  return { people: list, gross, total, avg: list.length ? Math.round(total / list.length) : 0 };
}

// feast blame：谁点得最多 / 最贵 / 热量最高，程序员式甩锅
export function blame(bill) {
  const by = (k) => [...bill.people].sort((a, b) => (b[k] || 0) - (a[k] || 0))[0];
  return {
    spender: by('gross'),
    kcal: bill.people.some(p => p.kcal) ? by('kcal') : null,
    saver: [...bill.people].sort((a, b) => a.gross - b.gross)[0],
    ranking: [...bill.people].sort((a, b) => b.pay - a.pay),
  };
}

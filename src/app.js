import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { pickSign, signContext, cleanSign } from './signatures.js';
import { createHash } from 'node:crypto';
import { makeProvider } from './providers.js';
import { newTeam, addPick, removePicks, mergeItems, bestCoupons, splitBill, blame } from './feast.js';
import { kcalOf } from './nutrition.js';
import { THEMES } from './card.js';
import { writeCard, renderTerminal } from './card.js';
import { yuan } from './money.js';
import { fakeHash, padEnd } from './card-core.js';

const DEMO_PICKS = [
  ['老王(后端)', '巨无霸'], ['老王(后端)', '中杯可口可乐'],
  ['小李(前端)', '麦辣鸡腿堡'], ['小李(前端)', '麦旋风'],
  ['阿杰(算法)', '板烧鸡腿堡'], ['阿杰(算法)', '拿铁'],
  ['Mia(产品)', '麦乐鸡'], ['Mia(产品)', '柠檬红茶'],
  ['大刘(运维)', '中薯条', 2], ['大刘(运维)', '菠萝派'],
];

export function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); if (v !== undefined) opt[k] = v; else if (argv[i + 1] && !argv[i + 1].startsWith('--')) opt[k] = argv[++i]; else opt[k] = true; }
    else pos.push(a);
  }
  return { pos, opt };
}

const fakeShort = s => fakeHash(s).slice(0, 8);
const padName = s => padEnd(String(s).slice(0, 10), 12);
const stateFile = opt => opt.file || process.env.FEAST_FILE || '.feast.json';
const load = opt => { const f = stateFile(opt); if (!existsSync(f)) throw new Error('还没有开团，先运行: feast new --store <门店编码>'); return JSON.parse(readFileSync(f, 'utf8')); };
const save = (opt, s) => writeFileSync(stateFile(opt), JSON.stringify(s, null, 2));
export const planCode = (team, plan) => createHash('sha1').update(JSON.stringify([team.store?.storeCode, mergeItems(team.picks), plan.combo.map(c => c.id)])).digest('hex').slice(0, 6);

async function checkout(p, team, opt, out) {
  const storeCode = team.store.storeCode;
  const [menu, coupons, now] = [team.menu, await p.coupons(storeCode), await p.now().catch(() => null)];
  const items = mergeItems(team.picks);
  if (!items.length) throw new Error('还没人点餐，先 feast pick <名字> <餐品>');
  const { best, tried } = await bestCoupons((its, cs) => p.price(storeCode, its, cs), items, coupons);
  // 分账以“实付”为准：各人菜单价之和与实付的差额即为可分摊的优惠（菜单价可能已是活动价，避免重复扣减）
  const menuGross = team.picks.reduce((s, x) => s + Math.round(x.price * 100) * x.qty, 0);
  const fee = best.fee || 0;
  const foods = await p.nutrition().catch(() => []);
  const bill = splitBill(team.picks, { discount: Math.max(0, menuGross + fee - best.total), fee, organizer: team.organizer, kcalOf: foods.length ? n => kcalOf(foods, n) : undefined });
  const ctx = { team, bill, plan: best, mode: p.mode, now };
  // 梗签名：--sign "<文字>" / --sign random / --sign none；默认按场景挑一句
  const sg = opt.sign === true ? 'random' : opt.sign;
  ctx.sign = sg === 'none' ? '' : sg && sg !== 'random' ? cleanSign(sg) : pickSign(signContext(ctx), 'zh', sg === 'random' ? (Math.random() * 2 ** 31) | 0 : 0);
  out(renderTerminal(ctx));
  if (ctx.sign) out(`✍️  梗签名：${ctx.sign}`);
  const dir = opt.out || '.'; mkdirSync(dir, { recursive: true });
  const themes = opt.theme === 'all' ? THEMES : [opt.theme || 'git'];
  if (!themes.every(t => THEMES.includes(t))) throw new Error(`未知主题 ${opt.theme}，可选: ${THEMES.join(' / ')} / all`);
  let files;
  for (const t of themes) {
    const f = writeCard(ctx, dir, t === 'git' ? 'feast-receipt' : `feast-receipt-${t}`, t); files = files || f;
    out(`\n🧾 账单卡[${t}]: ${f.png || f.svg}${f.png ? '' : '  (装了 Chrome 可自动导出 PNG)'}`);
  }
  out(`🔍 已比较 ${tried.length} 种用券组合，最优: ${best.combo.map(c => c.title).join(' + ') || '不用券'}`);
  const code = planCode(team, best);
  out(`\n✅ 确认无误后下单（不会自动下单）：feast order --confirm ${code}${p.mode === 'mock' ? ' --mock' : ''}`);
  return { ctx, files, code, best, tried, menu };
}

export async function run(argv, out = console.log) {
  const { pos, opt } = parseArgs(argv);
  const cmd = pos[0] || 'help';
  const mock = !!opt.mock || process.env.FEAST_MOCK === '1';
  if (cmd === 'help' || opt.help) return out(HELP);
  if (cmd === 'mcp') { const { serve } = await import('./mcp-server.js'); return serve({ mock }); }
  const p = makeProvider({ mock, city: opt.city });

  switch (cmd) {
    case 'stores': {
      const list = await p.stores(pos[1] || opt.near || '');
      list.forEach(s => out(`${s.storeCode}\t${s.storeName}\t${s.address || ''}`));
      return list;
    }
    case 'new': {
      const stores = (opt.near || !opt.store || p.mode === 'mock') ? await p.stores(opt.near || '') : [];
      const store = opt.store ? (stores.find(s => s.storeCode === opt.store) || { storeCode: opt.store, storeName: opt.store }) : stores[0];
      if (!store) throw new Error('没找到门店，用 --store 指定门店编码');
      const team = newTeam({ title: opt.title, organizer: opt.by || opt.organizer || process.env.USER || 'leader', store });
      team.menu = await p.menu(store.storeCode);
      save(opt, team);
      out(`🍔 开团成功：「${team.title}」@ ${store.storeName}\n把这行发到群里 → 大家用 feast pick <名字> <餐品> 报名`);
      return team;
    }
    case 'menu': {
      const team = load(opt);
      let cat = '';
      for (const m of team.menu) { if (m.category !== cat) out(`\n[${cat = m.category}]`); out(`  ${m.code.padEnd(8)} ${m.name}  ¥${Number(m.price).toFixed(2)}`); }
      return team.menu;
    }
    case 'pick': {
      const [, who, q, qty] = pos;
      if (!who || !q) throw new Error('用法: feast pick <名字> <餐品名或编码> [数量]');
      const team = load(opt); const item = addPick(team, team.menu, who, q, Number(qty || 1)); save(opt, team);
      out(`👍 ${who} +1 ${item.name}×${qty || 1}`); return team;
    }
    case 'drop': { const team = load(opt); const n = removePicks(team, pos[1]); save(opt, team); out(`🗑  删除 ${pos[1]} 的 ${n} 项`); return team; }
    case 'list': {
      const team = load(opt);
      const bill = splitBill(team.picks, { organizer: team.organizer });
      bill.people.forEach(e => out(`${e.who}: ${e.items.join('、')}  ¥${yuan(e.gross)}`));
      out(`共 ${bill.people.length} 人，原价合计 ¥${yuan(bill.gross)}`); return bill;
    }
    case 'checkout': return checkout(p, load(opt), opt, out);
    case 'order': {
      const team = load(opt);
      const coupons = await p.coupons(team.store.storeCode);
      const items = mergeItems(team.picks);
      const { best } = await bestCoupons((its, cs) => p.price(team.store.storeCode, its, cs), items, coupons);
      const code = planCode(team, best);
      if (opt.confirm !== code) throw new Error(`为防误下单，必须带上当前方案的确认码：feast order --confirm ${code}（先 feast checkout 核对账单）`);
      const r = await p.createOrder({ storeCode: team.store.storeCode, items, coupons: best.combo, takeWayCode: opt.takeway || 'take-in-store' });
      out(`🎉 下单成功${p.mode === 'mock' ? '（mock，未真实下单）' : ''}：${JSON.stringify(r)}`); return r;
    }
    case 'demo': {
      opt.file = opt.file || '.feast-demo.json';
      await run(['new', '--title', opt.title || '1024 程序员节下午茶', '--by', '老王(后端)', '--file', opt.file, ...(mock ? ['--mock'] : [])], out);
      const team = load(opt);
      for (const [who, q, n] of DEMO_PICKS) addPick(team, team.menu, who, q, n || 1);
      save(opt, team);
      return checkout(p, team, opt, out);
    }
    case 'blame': {
      const team = load(opt);
      const foods = opt.kcal === false ? [] : await p.nutrition().catch(() => []);
      const bill = splitBill(team.picks, { organizer: team.organizer, kcalOf: foods.length ? n => kcalOf(foods, n) : undefined });
      if (!bill.people.length) throw new Error('还没人点餐');
      const b = blame(bill);
      out('$ git blame feast.lock\n');
      b.ranking.forEach((e, i) => out(`${fakeShort(e.who)} (${padName(e.who)} ${String(i + 1).padStart(2)}) ¥${yuan(e.gross).padStart(7)}${e.kcal ? `  ${String(e.kcal).padStart(4)} kcal` : ''}  ${e.items.join(' ')}`));
      out(`\n💸 钱包贡献榜首: ${b.spender.who}  ¥${yuan(b.spender.gross)}`);
      if (b.kcal) out(`🔥 热量担当: ${b.kcal.who}  ${b.kcal.kcal} kcal（记得起身走走，别久坐写代码）`);
      out(`🥗 最克制: ${b.saver.who}  ¥${yuan(b.saver.gross)}`);
      return b;
    }
    case 'diff': {
      const team = load(opt);
      out(`diff --feast a/群接龙.txt b/feast.lock\n--- a/群接龙.txt\n+++ b/feast.lock\n@@ ${team.store?.storeName || ''} @@`);
      for (const pk of team.picks) out(`+ ${pk.who}: ${pk.name}×${pk.qty}  ¥${(pk.price * pk.qty).toFixed(2)}`);
      out(`- 30 条群消息、3 次 @全体成员、1 个被漏掉的同事`);
      return team.picks;
    }
    case 'tools': { const t = await p.c.listTools(); t.forEach(x => out(`${x.name}\t${JSON.stringify(x.inputSchema?.properties || {})}`)); return t; }
    default: throw new Error(`未知命令 ${cmd}\n${HELP}`);
  }
}

export const HELP = `🍔 麦麦拼单 mcd-team-feast —— 1024 程序员节团餐/下午茶协调器

用法: feast <命令> [选项]          (加 --mock 无需 token 体验)
  demo                       一键演示：开团 → 5 人点餐 → 自动用券 → 分账 → 账单卡
  stores [关键词] [--city 城市] 查门店（如 stores 人民广场 --city 上海）
  new --store <编码> [--title 标题] [--by 发起人]   开团
  menu                       看菜单
  pick <名字> <餐品> [数量]    报名点餐（餐品名支持模糊匹配）
  drop <名字>                 删除某人的选择
  list                       查看当前团
  checkout [--out 目录] [--theme git|pr|receipt|all] [--sign 文字|random|none]  凑单+最优券+人均分账，生成账单卡（带梗签名）
  blame                      git blame 式排行：谁花得最多、谁热量最高
  diff                       看看拼单相比群接龙改了什么
  mcp                        以 MCP Server(stdio) 方式运行，供 Claude/Cursor/WorkBuddy 调用
  order --confirm <确认码> [--takeway take-in-store|eat-in]  真正下单（必须带确认码）
  tools                      列出 MCP 工具及参数（需 token）

环境变量: MCD_MCP_TOKEN（必需，真实模式）  MCD_MCP_URL（默认 https://mcp.mcd.cn）`;

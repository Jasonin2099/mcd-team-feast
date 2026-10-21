// 麦麦拼单 MCP Server（stdio，零依赖）。让 Claude / Cursor / WorkBuddy 用一句话“帮我们组拼一单麦当劳”。
// 只暴露开团/点餐/结算等工具；真正下单不在此暴露，需用户在终端执行 feast order --confirm。
import { createInterface } from 'node:readline';
import { run } from './app.js';
import { VERSION } from './version.js';

const TOOLS = [
  { name: 'feast_stores', description: '查询麦当劳门店（城市+关键词），返回门店编码', inputSchema: { type: 'object', properties: { keyword: { type: 'string' }, city: { type: 'string' } } } },
  { name: 'feast_new', description: '开一个拼单团：指定门店编码、团名、发起人', inputSchema: { type: 'object', properties: { store: { type: 'string', description: '门店编码' }, title: { type: 'string' }, organizer: { type: 'string' }, near: { type: 'string' }, city: { type: 'string' } } } },
  { name: 'feast_menu', description: '查看当前团所在门店的菜单', inputSchema: { type: 'object', properties: {} } },
  { name: 'feast_pick', description: '为某位成员点餐（餐品名支持模糊匹配）', inputSchema: { type: 'object', required: ['who', 'item'], properties: { who: { type: 'string' }, item: { type: 'string' }, qty: { type: 'integer', minimum: 1 } } } },
  { name: 'feast_drop', description: '删除某位成员的全部选择', inputSchema: { type: 'object', required: ['who'], properties: { who: { type: 'string' } } } },
  { name: 'feast_list', description: '查看当前团的点餐情况', inputSchema: { type: 'object', properties: {} } },
  { name: 'feast_checkout', description: '合并订单、调用 calculate-price 挑选最优券、人均分账并生成账单卡（只计价，不下单）', inputSchema: { type: 'object', properties: { theme: { type: 'string', enum: ['git', 'pr', 'receipt', 'all'] }, out: { type: 'string' } } } },
  { name: 'feast_blame', description: 'git blame 式排行：谁花得最多、谁热量最高', inputSchema: { type: 'object', properties: {} } },
];

function toArgv(name, a, mock) {
  const f = (k, v) => (v == null || v === '' ? [] : [`--${k}`, String(v)]);
  const base = { feast_stores: ['stores', ...(a.keyword ? [a.keyword] : []), ...f('city', a.city)],
    feast_new: ['new', ...f('store', a.store), ...f('title', a.title), ...f('by', a.organizer), ...f('near', a.near), ...f('city', a.city)],
    feast_menu: ['menu'], feast_pick: ['pick', a.who, a.item, String(a.qty || 1)], feast_drop: ['drop', a.who], feast_list: ['list'],
    feast_checkout: ['checkout', ...f('theme', a.theme), ...f('out', a.out)], feast_blame: ['blame'] }[name];
  if (!base) throw new Error(`未知工具 ${name}`);
  return mock ? [...base, '--mock'] : base;
}

export async function handle(msg, { mock }) {
  const { id, method, params } = msg;
  const ok = result => ({ jsonrpc: '2.0', id, result });
  if (method === 'initialize') return ok({ protocolVersion: params?.protocolVersion || '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'mcd-team-feast', version: VERSION } });
  if (method === 'tools/list') return ok({ tools: TOOLS });
  if (method === 'tools/call') {
    const lines = [];
    try { await run(toArgv(params.name, params.arguments || {}, mock), s => lines.push(String(s).replace(/\x1b\[[0-9;]*m/g, ''))); return ok({ content: [{ type: 'text', text: lines.join('\n') }] }); }
    catch (e) { return ok({ content: [{ type: 'text', text: '❌ ' + e.message }], isError: true }); }
  }
  if (method === 'ping') return ok({});
  if (id === undefined) return null; // 通知
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

export function serve({ mock = false } = {}) {
  const rl = createInterface({ input: process.stdin });
  rl.on('line', async line => {
    if (!line.trim()) return;
    let msg; try { msg = JSON.parse(line); } catch { return; }
    const res = await handle(msg, { mock });
    if (res) process.stdout.write(JSON.stringify(res) + '\n');
  });
  return new Promise(r => rl.on('close', r));
}

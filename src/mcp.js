// 极简 MCP Streamable HTTP 客户端（零依赖，Node >= 18 自带 fetch）
export class McpClient {
  constructor({ url = process.env.MCD_MCP_URL || 'https://mcp.mcd.cn', token = process.env.MCD_MCP_TOKEN } = {}) {
    if (!token) throw new Error('缺少 MCD_MCP_TOKEN 环境变量（到 https://open.mcd.cn/mcp 获取），或加 --mock 体验');
    this.url = url; this.token = token; this.id = 0; this.session = null; this.ready = false;
  }
  async rpc(method, params, notify = false) {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${this.token}`,
    };
    if (this.session) headers['mcp-session-id'] = this.session;
    const body = { jsonrpc: '2.0', method, ...(params ? { params } : {}) };
    if (!notify) body.id = ++this.id;
    const res = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body) });
    const sid = res.headers.get('mcp-session-id'); if (sid) this.session = sid;
    if (notify) return null;
    if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const text = await res.text();
    const msg = parseResponse(text, body.id);
    if (msg.error) throw new Error(`MCP 错误 ${msg.error.code}: ${msg.error.message}`);
    return msg.result;
  }
  async init() {
    if (this.ready) return;
    await this.rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'mcd-team-feast', version: '0.2.0' } });
    await this.rpc('notifications/initialized', undefined, true);
    this.ready = true;
  }
  async listTools() { await this.init(); return (await this.rpc('tools/list', {})).tools; }
  async call(name, args = {}) {
    await this.init();
    const r = await this.rpc('tools/call', { name, arguments: args });
    if (r.isError) throw new Error(`工具 ${name} 返回错误: ${contentText(r)}`);
    if (r.structuredContent) return r.structuredContent;
    const t = contentText(r);
    return extractJson(t);
  }
}
export function contentText(r) { return (r.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n'); }
export function parseResponse(text, id) {
  const t = text.trim();
  if (t.startsWith('{')) return JSON.parse(t);
  // SSE: 取 data: 行里 id 匹配的消息
  const msgs = t.split(/\n\n+/).map(ev => ev.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n')).filter(Boolean).map(d => JSON.parse(d));
  return msgs.find(m => m.id === id) || msgs[msgs.length - 1] || {};
}

// 文本里常是“字段说明 + 原始 JSON”，取最后一个 {"success" 开头的 JSON
export function extractJson(t) {
  try { return JSON.parse(t); } catch {}
  const i = t.lastIndexOf('{"success"');
  if (i >= 0) { try { return JSON.parse(t.slice(i)); } catch {} }
  return { text: t };
}

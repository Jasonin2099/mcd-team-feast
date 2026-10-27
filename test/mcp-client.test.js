// McpClient against a stubbed fetch: headers, session id, notifications, error paths.
// No network and no real credentials — the "token" below is a placeholder string.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { McpClient, contentText, extractJson } from '../src/mcp.js';
import { handle } from '../src/mcp-server.js';
import { fen, yuan } from '../src/money.js';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// fake MCP endpoint: records every request, answers by method
function stub(answer) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, headers: init.headers, body });
    const r = answer(body, calls.length);
    return new Response(r.text ?? JSON.stringify({ jsonrpc: '2.0', id: body.id, ...r }), { status: r.status ?? 200, headers: r.headers ?? {} });
  };
  return calls;
}
const okInit = (b) => (b.method === 'initialize' ? { result: { protocolVersion: '2025-03-26' }, headers: { 'mcp-session-id': 'sess-1' } } : null);

test('missing token throws a helpful error (no env fallback in tests)', () => {
  const saved = process.env.MCD_MCP_TOKEN; delete process.env.MCD_MCP_TOKEN;
  try { assert.throws(() => new McpClient({ url: 'http://x' }), /MCD_MCP_TOKEN/); }
  finally { if (saved !== undefined) process.env.MCD_MCP_TOKEN = saved; }
});

test('init handshake, bearer header, session id reused, notification has no id', async () => {
  const calls = stub((b) => okInit(b) ?? (b.method === 'tools/list' ? { result: { tools: [{ name: 'a' }] } } : { result: {} }));
  const c = new McpClient({ url: 'http://mcp.test', token: 'placeholder' });
  assert.deepEqual(await c.listTools(), [{ name: 'a' }]);
  assert.deepEqual(calls.map((x) => x.body.method), ['initialize', 'notifications/initialized', 'tools/list']);
  assert.equal(calls[0].headers.authorization, 'Bearer placeholder');
  assert.equal(calls[0].headers['mcp-session-id'], undefined);
  assert.equal(calls[1].body.id, undefined);
  assert.equal(calls[2].headers['mcp-session-id'], 'sess-1');
  assert.match(calls[2].headers.accept, /text\/event-stream/);
  await c.listTools(); // init only once
  assert.equal(calls.filter((x) => x.body.method === 'initialize').length, 1);
});

test('call() prefers structuredContent, else extracts JSON from text', async () => {
  stub((b) => okInit(b) ?? (b.params?.name === 's'
    ? { result: { structuredContent: { success: true, n: 1 }, content: [{ type: 'text', text: 'ignored' }] } }
    : { result: { content: [{ type: 'text', text: '字段说明…\n{"success":true,"data":{"n":2}}' }] } }));
  const c = new McpClient({ url: 'http://mcp.test', token: 'placeholder' });
  assert.deepEqual(await c.call('s'), { success: true, n: 1 });
  assert.deepEqual(await c.call('t'), { success: true, data: { n: 2 } });
});

test('call() surfaces tool errors, RPC errors and HTTP errors', async () => {
  stub((b) => okInit(b) ?? (b.params?.name === 'bad' ? { result: { isError: true, content: [{ type: 'text', text: '库存不足' }] } }
    : b.params?.name === 'rpc' ? { error: { code: -32602, message: 'bad params' } }
    : { status: 401, text: 'unauthorized' }));
  const c = new McpClient({ url: 'http://mcp.test', token: 'placeholder' });
  await assert.rejects(c.call('bad'), /工具 bad 返回错误: 库存不足/);
  await assert.rejects(c.call('rpc'), /MCP 错误 -32602: bad params/);
  await assert.rejects(c.call('http'), /MCP HTTP 401: unauthorized/);
});

test('SSE responses are matched by id', async () => {
  stub((b) => okInit(b) ?? { text: `event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\nevent: message\ndata: {"jsonrpc":"2.0","id":${b.id},"result":{"structuredContent":{"ok":3}}}\n\n`, headers: { 'content-type': 'text/event-stream' } });
  const c = new McpClient({ url: 'http://mcp.test', token: 'placeholder' });
  assert.deepEqual(await c.call('x'), { ok: 3 });
});

test('contentText / extractJson edge cases', () => {
  assert.equal(contentText({ content: [{ type: 'text', text: 'a' }, { type: 'image', data: '…' }, { type: 'text', text: 'b' }] }), 'a\nb');
  assert.equal(contentText({}), '');
  assert.deepEqual(extractJson('not json'), { text: 'not json' });
  assert.deepEqual(extractJson('x {"success": broken'), { text: 'x {"success": broken' });
});

test('mcp-server: ping, unknown method, unknown tool', async () => {
  assert.deepEqual(await handle({ jsonrpc: '2.0', id: 5, method: 'ping' }, { mock: true }), { jsonrpc: '2.0', id: 5, result: {} });
  const nf = await handle({ jsonrpc: '2.0', id: 6, method: 'resources/list' }, { mock: true });
  assert.equal(nf.error.code, -32601);
  const bad = await handle({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'feast_order' } }, { mock: true });
  assert.equal(bad.result.isError, true);
  assert.match(bad.result.content[0].text, /未知工具 feast_order/);
});

test('money: fen/yuan round-trip without float drift', () => {
  assert.equal(fen(0.1 + 0.2), 30);
  assert.equal(fen('19.9'), 1990);
  assert.equal(yuan(fen(9.99) * 3), '29.97');
  assert.equal(yuan(fen(12.34) + fen(0.66)), '13.00');
  assert.equal(yuan(5), '0.05');
});

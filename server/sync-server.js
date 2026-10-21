#!/usr/bin/env node
// 麦麦拼单 · 实时拼单房间服务（零依赖：Node http + Server-Sent Events）
// 只存昵称 + 点了什么，房间 24 小时后自动删除。不碰麦当劳账号、不下单。
// 用法：PORT=8787 DATA=/var/lib/feast-sync/rooms.json node server/sync-server.js
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PORT = +process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';
const DATA = process.env.DATA || '';
const TTL = +process.env.TTL_MS || 24 * 3600e3;
const ORIGINS = (process.env.ORIGINS || 'https://jasonin2099.github.io').split(',');
const LIMITS = { rooms: 5000, members: 40, picks: 60, qty: 99, name: 24, title: 40, body: 16384 };
const CODE = /^[A-Za-z0-9_-]{1,24}$/;

const rooms = new Map(); // id -> room
const conns = new Map(); // id -> Set<{res, mid}>
let dirty = false;

const id = n => randomBytes(n).toString('base64url');
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
const eq = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function load() {
  if (!DATA) return;
  try { for (const r of JSON.parse(readFileSync(DATA, 'utf8'))) if (Date.now() - r.created < TTL) rooms.set(r.id, r); } catch {}
}
function save() {
  if (!DATA || !dirty) return; dirty = false;
  try { mkdirSync(dirname(DATA), { recursive: true }); writeFileSync(DATA + '.tmp', JSON.stringify([...rooms.values()])); renameSync(DATA + '.tmp', DATA); } catch (e) { console.error('save', e.message); }
}
function sweep() {
  for (const [k, r] of rooms) if (Date.now() - r.created >= TTL) { rooms.delete(k); for (const c of conns.get(k) || []) c.res.end(); conns.delete(k); dirty = true; }
}

export function publicState(r) {
  const online = new Set([...(conns.get(r.id) || [])].map(c => c.mid));
  return {
    id: r.id, t: r.t, o: r.o, created: r.created, expires: r.created + TTL, deadline: r.deadline, locked: r.locked, lockedAt: r.lockedAt || null, sign: r.sign || '', rev: r.rev, host: r.hostMid,
    members: Object.entries(r.members).map(([mid, m]) => ({ mid, name: m.name, picks: m.picks, done: m.done, online: online.has(mid), joined: m.joined })),
  };
}
function broadcast(r) {
  r.rev++; dirty = true;
  const data = `event: state\ndata: ${JSON.stringify(publicState(r))}\n\n`;
  for (const c of conns.get(r.id) || []) c.res.write(data);
}

function cors(req, res) {
  const o = req.headers.origin;
  if (o && (ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
function body(req) {
  return new Promise((ok, no) => {
    let s = ''; req.setEncoding('utf8');
    req.on('data', d => { s += d; if (s.length > LIMITS.body) { no(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { no(new Error('bad json')); } });
  });
}
// 简单限流：每 IP 每分钟 240 次写
const hits = new Map();
function limited(req) {
  const ip = req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.socket.remoteAddress;
  const now = Date.now(), h = hits.get(ip) || { n: 0, t: now };
  if (now - h.t > 60e3) { h.n = 0; h.t = now; }
  h.n++; hits.set(ip, h); return h.n > 240;
}
function picksOf(arr) {
  if (!Array.isArray(arr)) throw new Error('picks');
  const out = new Map();
  for (const p of arr.slice(0, LIMITS.picks)) { const [c, q] = p || []; if (!CODE.test(c)) continue; const n = Math.max(0, Math.min(LIMITS.qty, q | 0)); if (n) out.set(c, n); }
  return [...out];
}

async function op(r, b) {
  const m = r.members[b.mid];
  const isHost = eq(b.hostKey, r.hostKey);
  const isMe = m && eq(b.key, m.key);
  switch (b.op) {
    case 'join': {
      if (r.locked) return [423, { error: 'locked' }];
      const name = clean(b.name, LIMITS.name); if (!name) return [400, { error: 'name' }];
      // 同名回到原位置需要 key，否则新建
      if (Object.keys(r.members).length >= LIMITS.members) return [429, { error: 'full' }];
      const mid = id(6), key = id(12);
      r.members[mid] = { name, key, picks: [], done: false, joined: Date.now() };
      broadcast(r); return [200, { mid, key }];
    }
    case 'rename': if (!isMe) return [403, { error: 'auth' }]; { const n = clean(b.name, LIMITS.name); if (!n) return [400, { error: 'name' }]; m.name = n; } break;
    case 'picks': if (!isMe) return [403, { error: 'auth' }]; if (r.locked) return [423, { error: 'locked' }]; m.picks = picksOf(b.picks); if (!m.picks.length) m.done = false; break;
    case 'done': if (!isMe) return [403, { error: 'auth' }]; if (r.locked) return [423, { error: 'locked' }]; m.done = !!b.done; break;
    case 'leave': if (!isMe) return [403, { error: 'auth' }]; if (r.locked) return [423, { error: 'locked' }]; if (b.mid === r.hostMid) return [400, { error: 'host' }]; delete r.members[b.mid]; break;
    case 'meta': if (!isHost) return [403, { error: 'host' }]; if (b.t != null) r.t = clean(b.t, LIMITS.title); if (b.o != null) r.o = clean(b.o, LIMITS.name); if (b.sign != null) r.sign = clean(String(b.sign).replace(/[<>]/g, ''), 96); break;
    case 'deadline': if (!isHost) return [403, { error: 'host' }]; r.deadline = b.at == null ? null : Math.min(Math.max(+b.at || 0, Date.now()), r.created + TTL); break;
    case 'lock': if (!isHost) return [403, { error: 'host' }]; r.locked = true; r.lockedAt = Date.now(); break;
    case 'unlock': if (!isHost) return [403, { error: 'host' }]; r.locked = false; break;
    case 'kick': if (!isHost) return [403, { error: 'host' }]; if (b.who !== r.hostMid) delete r.members[b.who]; break;
    default: return [400, { error: 'op' }];
  }
  broadcast(r); return [200, { ok: true, rev: r.rev }];
}

export function createServer() {
  return http.createServer(async (req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const u = new URL(req.url, 'http://x');
    const path = u.pathname.replace(/^\/feast-sync/, '');
    try {
      if (path === '/health') return send(res, 200, { ok: true, rooms: rooms.size });
      if (req.method === 'POST' && path === '/rooms') {
        if (limited(req)) return send(res, 429, { error: 'rate' });
        if (rooms.size >= LIMITS.rooms) return send(res, 503, { error: 'busy' });
        const b = await body(req);
        const name = clean(b.name, LIMITS.name); if (!name) return send(res, 400, { error: 'name' });
        const rid = id(6), hostKey = id(16), mid = id(6), key = id(12);
        const r = { id: rid, t: clean(b.t, LIMITS.title), o: name, created: Date.now(), deadline: null, locked: false, rev: 0, hostKey, hostMid: mid, members: {} };
        r.members[mid] = { name, key, picks: picksOf(b.picks || []), done: false, joined: Date.now() };
        rooms.set(rid, r); dirty = true;
        return send(res, 200, { id: rid, hostKey, mid, key, state: publicState(r) });
      }
      const m = path.match(/^\/rooms\/([A-Za-z0-9_-]{8})(\/events|\/op)?$/);
      if (!m) return send(res, 404, { error: 'not found' });
      const r = rooms.get(m[1]);
      if (!r) return send(res, 404, { error: 'room' });
      if (!m[2] && req.method === 'GET') return send(res, 200, publicState(r));
      if (m[2] === '/op' && req.method === 'POST') {
        if (limited(req)) return send(res, 429, { error: 'rate' });
        const [code, out] = await op(r, await body(req));
        return send(res, code, code === 200 ? { ...out, state: publicState(r) } : out);
      }
      if (m[2] === '/events' && req.method === 'GET') {
        const mid = u.searchParams.get('mid') || '';
        const key = u.searchParams.get('key') || '';
        const who = r.members[mid] && eq(key, r.members[mid].key) ? mid : null; // 只有带对 key 才算“在线”
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
        res.write('retry: 2000\n\n');
        const c = { res, mid: who };
        if (!conns.has(r.id)) conns.set(r.id, new Set());
        conns.get(r.id).add(c);
        const wasOnline = who && [...conns.get(r.id)].filter(x => x.mid === who).length > 1;
        if (who && !wasOnline) broadcast(r); else res.write(`event: state\ndata: ${JSON.stringify(publicState(r))}\n\n`);
        const hb = setInterval(() => res.write(': hb\n\n'), 20e3);
        req.on('close', () => {
          clearInterval(hb); const set = conns.get(r.id); set?.delete(c);
          if (who && rooms.has(r.id) && ![...(set || [])].some(x => x.mid === who)) broadcast(r);
        });
        return;
      }
      send(res, 405, { error: 'method' });
    } catch (e) { send(res, 400, { error: e.message }); }
  });
}

// pathToFileURL：Windows 路径（C:\…）和含空格/中文的路径也能正确判断是否被直接运行
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  load();
  setInterval(sweep, 60e3); setInterval(save, 5e3);
  setInterval(() => hits.clear(), 10 * 60e3);
  const s = createServer(); s.listen(PORT, HOST, () => console.log(`feast-sync on ${HOST}:${PORT}`));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { dirty = true; save(); process.exit(0); });
}

// 实时拼单房间客户端：EventSource 收状态，fetch POST 发操作。断线自动重连。
// 同步服务地址：?sync= 参数 > window.FEAST_SYNC_URL > <meta name="feast-sync"> ；自建时改这里即可
export const SYNC_URL = (() => { try { return (new URLSearchParams(location.search).get('sync') || globalThis.FEAST_SYNC_URL || document.querySelector('meta[name="feast-sync"]')?.content || '').replace(/\/+$/, ''); } catch { return ''; } })();
const ck = id => 'feastRoom:' + id;
export const loadCreds = id => { try { return JSON.parse(localStorage.getItem(ck(id)) || 'null'); } catch { return null; } };
export const saveCreds = (id, c) => { try { localStorage.setItem(ck(id), JSON.stringify(c)); } catch {} };

async function req(path, body) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(SYNC_URL + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal } : { signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'http ' + r.status); e.status = r.status; throw e; }
    return j;
  } finally { clearTimeout(tm); }
}
export async function createRoom({ t, name, picks }) {
  const j = await req('/rooms', { t, name, picks });
  saveCreds(j.id, { mid: j.mid, key: j.key, hostKey: j.hostKey });
  return j;
}

export class Room extends EventTarget {
  constructor(id) { super(); this.id = id; this.creds = loadCreds(id); this.state = null; this.status = 'connecting'; this.es = null; this.tries = 0; this.pending = null; this.pendingTimer = 0; }
  get isHost() { return !!this.creds?.hostKey; }
  get me() { return this.state?.members.find(m => m.mid === this.creds?.mid) || null; }
  set(st) { this.status = st; this.dispatchEvent(new Event('status')); }
  connect() {
    this.close(false);
    const q = this.creds ? `?mid=${encodeURIComponent(this.creds.mid)}&key=${encodeURIComponent(this.creds.key)}` : '';
    const es = this.es = new EventSource(`${SYNC_URL}/rooms/${this.id}/events${q}`);
    es.addEventListener('state', e => { this.tries = 0; this.apply(JSON.parse(e.data)); if (this.status !== 'live') this.set('live'); });
    es.onerror = async () => {
      if (this.es !== es) return;
      if (es.readyState === EventSource.CLOSED) { // 服务器返回非 200：查一下房间是否还在
        try { await req(`/rooms/${this.id}`); } catch (err) { if (err.status === 404) { this.set('gone'); return; } }
        this.tries++; this.set('reconnecting'); clearTimeout(this.rt); this.rt = setTimeout(() => this.connect(), Math.min(15000, 1000 * 2 ** this.tries));
      } else this.set('reconnecting');
    };
    // 回到前台时立刻重连（手机切后台常被断）
    if (!this._vis) { this._vis = () => { if (document.visibilityState === 'visible' && this.status !== 'live' && this.status !== 'gone') this.connect(); }; document.addEventListener('visibilitychange', this._vis); addEventListener('online', this._vis); }
  }
  apply(s) {
    // 自己还没发出去的改动优先，避免回弹
    if (this.pending && this.creds) { const m = s.members.find(x => x.mid === this.creds.mid); if (m) m.picks = this.pending; }
    this.state = s; this.dispatchEvent(new Event('state'));
  }
  close(full = true) { if (this.es) { this.es.close(); this.es = null; } clearTimeout(this.rt); if (full && this._vis) { document.removeEventListener('visibilitychange', this._vis); removeEventListener('online', this._vis); this._vis = null; } }
  async op(op, extra = {}) {
    const c = this.creds || {};
    const j = await req(`/rooms/${this.id}/op`, { op, mid: c.mid, key: c.key, hostKey: c.hostKey, ...extra });
    if (j.state) this.apply(j.state);
    return j;
  }
  async join(name) {
    const j = await req(`/rooms/${this.id}/op`, { op: 'join', name });
    this.creds = { mid: j.mid, key: j.key }; saveCreds(this.id, this.creds); this.connect(); return j;
  }
  // 本地立即生效，250ms 合并后发送
  setPicks(picks) {
    this.pending = picks; const m = this.me; if (m) m.picks = picks;
    this.dispatchEvent(new Event('state'));
    clearTimeout(this.pendingTimer);
    return new Promise((ok, no) => { this.pendingTimer = setTimeout(async () => { const p = this.pending; try { await this.op('picks', { picks: p }); if (this.pending === p) this.pending = null; ok(); } catch (e) { this.pending = null; no(e); } }, 250); });
  }
}

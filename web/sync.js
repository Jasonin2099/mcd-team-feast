// 实时拼单房间客户端：EventSource 收状态，fetch POST 发操作。断线自动重连。
// 同步服务地址：?sync= 参数 > window.FEAST_SYNC_URL > <meta name="feast-sync"> ；自建时改这里即可
// ?sync=off 关闭实时同步，只用链接分享（离线演示、QA 不碰线上服务）
export const SYNC_URL = (() => { try { const q = new URLSearchParams(location.search).get('sync'); if (q === 'off') return ''; return (q || globalThis.FEAST_SYNC_URL || document.querySelector('meta[name="feast-sync"]')?.content || '').replace(/\/+$/, ''); } catch { return ''; } })();
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
  static STALE_MS = 10000; static POLL_MS = 5000; static PENDING_MS = 10000;
  constructor(id) { super(); this.id = id; this.creds = loadCreds(id); this.state = null; this.status = 'connecting'; this.es = null; this.tries = 0; this.pending = null; this.pendingTimer = 0; }
  get isHost() { return !!this.creds?.hostKey; }
  get me() { return this.state?.members.find(m => m.mid === this.creds?.mid) || null; }
  set(st) { this.status = st; this.dispatchEvent(new Event('status')); }
  // 订阅：打开房间即连 SSE；断线指数退避重连；回前台/网络恢复立刻重连并拉一次全量。
  // 兜底：STALE_MS 内没收到任何推送，就每 POLL_MS 拉一次全量；拉到更新的版本说明推送流静默断了，立刻重连。
  connect() {
    this.close(false);
    if (this.status !== 'connecting') this.set(this.state ? 'reconnecting' : 'connecting');
    const q = this.creds ? `?mid=${encodeURIComponent(this.creds.mid)}&key=${encodeURIComponent(this.creds.key)}` : '';
    const es = this.es = new EventSource(`${SYNC_URL}/rooms/${this.id}/events${q}`);
    this.lastMsg = Date.now();
    const alive = () => { this.lastMsg = Date.now(); this.tries = 0; if (this.status !== 'live') this.set('live'); };
    es.addEventListener('state', e => { alive(); this.apply(JSON.parse(e.data)); });
    es.addEventListener('ping', alive);
    es.onerror = async () => {
      if (this.es !== es) return;
      if (es.readyState === EventSource.CLOSED) { // 服务器返回非 200：查一下房间是否还在
        try { await req(`/rooms/${this.id}`); } catch (err) { if (err.status === 404) { this.set('gone'); return; } }
        this.retry();
      } else this.set('reconnecting');
    };
    if (!this._vis) {
      this._vis = () => { if (document.visibilityState !== 'visible' || this.status === 'gone') return; this.refresh(); if (this.status !== 'live' || this.stale()) this.connect(); };
      this._off = () => this.status !== 'gone' && this.set('reconnecting');
      document.addEventListener('visibilitychange', this._vis); addEventListener('online', this._vis); addEventListener('offline', this._off);
    }
    if (!this.wd) this.wd = setInterval(() => this.watchdog(), 1000);
  }
  stale() { return Date.now() - (this.lastMsg || 0) > Room.STALE_MS; }
  // 退避 1s、2s、4s… 封顶 15s。之前首次就等 2s（2 ** 1），再加上先查房间是否还在的那次请求，断线后约 2.7s 才重连。
  static retryDelay(tries) { return Math.min(15000, 1000 * 2 ** (tries - 1)); }
  retry() { this.tries++; this.set('reconnecting'); clearTimeout(this.rt); this.rt = setTimeout(() => this.connect(), Room.retryDelay(this.tries)); }
  watchdog() {
    if (this.status === 'gone' || typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (Date.now() - (this.lastMsg || 0) > Room.STALE_MS && Date.now() - (this.lastPoll || 0) >= Room.POLL_MS) this.refresh(true);
  }
  /** 拉全量最新状态（兜底 / 回前台 / 重连后） */
  async refresh(check = false) {
    this.lastPoll = Date.now();
    try {
      const s = await req(`/rooms/${this.id}`);
      // 兜底拉到的比推送的新 → 推送流已经断了却没报错，重开连接
      const behind = check && this.state && s.rev > this.state.rev;
      this.apply(s); if (behind) this.connect();
      return s;
    }
    catch (err) { if (err.status === 404) this.set('gone'); return null; }
  }
  apply(s) {
    if (!s) return;
    if (this.state && typeof s.rev === 'number' && s.rev < this.state.rev) return; // 晚到的旧状态不覆盖新的
    const m = this.creds && s.members.find(x => x.mid === this.creds.mid);
    this.confirmed = m ? m.picks.map(p => [...p]) : [];
    // 自己还没发出去的改动优先，避免回弹
    if (this.pending && m) m.picks = this.pending;
    this.state = s; this.dispatchEvent(new Event('state'));
  }
  close(full = true) {
    if (this.es) { this.es.close(); this.es = null; } clearTimeout(this.rt);
    if (full) { clearInterval(this.wd); this.wd = 0; if (this._vis) { document.removeEventListener('visibilitychange', this._vis); removeEventListener('online', this._vis); removeEventListener('offline', this._off); this._vis = null; } }
  }
  async op(op, extra = {}) {
    const c = this.creds || {};
    const j = await req(`/rooms/${this.id}/op`, { op, mid: c.mid, key: c.key, hostKey: c.hostKey, ...extra });
    if (j.state) this.apply(j.state);
    return j;
  }
  async join(name) {
    this.joining = name; this.dispatchEvent(new Event('state'));
    try {
      const j = await req(`/rooms/${this.id}/op`, { op: 'join', name });
      this.creds = { mid: j.mid, key: j.key }; saveCreds(this.id, this.creds); this.connect();
      if (this.pending) this.flush().catch(() => {}); // 加入过程中点的菜，加入成功后补发
      return j;
    } finally { this.joining = null; this.dispatchEvent(new Event('state')); }
  }
  // 本地立即生效，250ms 合并后发送。picks 是「我的完整点单」，服务器整体替换，所以补发不会重复、也不会丢数量。
  setPicks(picks) {
    this.pending = picks; this.pendingSince ||= Date.now(); this.failed = false;
    const m = this.me; if (m) m.picks = picks;
    this.dispatchEvent(new Event('state'));
    clearTimeout(this.pendingTimer);
    if (!this.creds) return Promise.resolve(); // 还没加入：等 join 成功后 flush
    return new Promise((ok, no) => { this.pendingTimer = setTimeout(() => this.flush().then(ok, no), 250); });
  }
  async flush() {
    const p = this.pending; if (!p || !this.creds) return;
    clearTimeout(this.pendingTimer); this.failed = false; this.dispatchEvent(new Event('state'));
    try {
      await this.op('picks', { picks: p });
      if (this.pending === p) { this.pending = null; this.pendingSince = 0; this.confirmed = p.map(x => [...x]); }
      this.dispatchEvent(new Event('state'));
    } catch (e) {
      if (e.status === 423 || e.status === 404 || e.status === 403) { this.pending = null; this.pendingSince = 0; } // 已锁单/房间没了：本地改动作废
      else this.failed = true;
      this.dispatchEvent(new Event('state')); throw e;
    }
  }
  /** 这道菜我本地的数量还没被服务器确认 */
  isPending(code) {
    if (!this.pending) return false;
    const q = (a, c) => (a || []).find(x => x[0] === c)?.[1] || 0;
    return q(this.pending, code) !== q(this.confirmed, code);
  }
  /** 发送失败，或 10s 还没发出去 → 显示「未同步，点此重试」 */
  unsynced(now = Date.now()) { return !!this.pending && (this.failed || now - this.pendingSince > Room.PENDING_MS); }
}

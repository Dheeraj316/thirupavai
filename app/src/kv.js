// Small key-value layer for sessions, OTP codes and rate limits. Redis in production; in-memory for development and tests.
import { cfg } from './config.js';

class MemoryKV {
  constructor() { this.m = new Map(); this.timer = setInterval(() => this.sweep(), 30000); this.timer.unref(); }
  sweep() { const n = Date.now(); for (const [k, v] of this.m) if (v.exp && v.exp <= n) this.m.delete(k); }
  live(k) { const v = this.m.get(k); if (!v) return null; if (v.exp && v.exp <= Date.now()) { this.m.delete(k); return null; } return v; }
  async get(k) { return this.live(k)?.val ?? null; }
  async set(k, val, ttl) { this.m.set(k, { val: String(val), exp: ttl ? Date.now() + ttl * 1000 : 0 }); }
  async del(k) { this.m.delete(k); }
  async incr(k, ttl) { const v = this.live(k); const n = (v ? Number(v.val) : 0) + 1; this.m.set(k, { val: String(n), exp: v ? v.exp : (ttl ? Date.now() + ttl * 1000 : 0) }); return n; }
  async ttl(k) { const v = this.live(k); return v && v.exp ? Math.max(0, Math.ceil((v.exp - Date.now()) / 1000)) : -1; }
  async ping() { return true; }
  async close() { clearInterval(this.timer); }
}

class RedisKV {
  constructor(url) { this.url = url; }
  async init() {
    const { default: Redis } = await import('ioredis');
    // enableAutoPipelining: commands issued in the same moment (thousands of simultaneous requests) travel to Redis in one packet
    this.r = new Redis(this.url, { maxRetriesPerRequest: 2, enableReadyCheck: true, lazyConnect: false, enableAutoPipelining: true, tls: this.url.startsWith('rediss://') ? {} : undefined });
    this.r.on('error', (e) => console.error('[redis]', e.message));
    return this;
  }
  async get(k) { return this.r.get(k); }
  async set(k, val, ttl) { return ttl ? this.r.set(k, String(val), 'EX', ttl) : this.r.set(k, String(val)); }
  async del(k) { return this.r.del(k); }
  // counter that expires `ttl` seconds after its FIRST increment. One atomic step: with a separate INCR then EXPIRE, a dropped connection in
  // between would leave a counter with no expiry, and that mobile number or IP would stay rate-limited forever.
  async incr(k, ttl) {
    if (!ttl) return this.r.incr(k);
    const res = await this.r.multi().set(k, 0, 'EX', ttl, 'NX').incr(k).exec();
    const err = res.find(([e]) => e); if (err) throw err[0];
    return res[1][1];
  }
  async ttl(k) { return this.r.ttl(k); }
  async ping() { return (await this.r.ping()) === 'PONG'; }
  async close() { await this.r.quit().catch(() => {}); }
}

export async function openKV() {
  if (cfg.redisUrl) return new RedisKV(cfg.redisUrl).init();
  return new MemoryKV();
}

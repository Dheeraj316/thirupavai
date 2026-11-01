// A tiny Redis-protocol (RESP2) server for LOCAL testing only, so several server processes can share sessions / OTPs / rate limits on a
// machine without Redis. It implements just the commands the app uses: PING INFO CLIENT SELECT GET SET(EX,NX) DEL INCR EXPIRE TTL MULTI EXEC DISCARD QUIT.
// It proves the app's Redis code path and cluster behaviour; it says nothing about real Redis performance.
//   node test/redis-lite.js [port=6390]      then   REDIS_URL=redis://127.0.0.1:6390 node server.js
import net from 'node:net';

const port = Number(process.argv[2] || process.env.REDIS_PORT || 6390);
const store = new Map();                                       // key -> { v: string, exp: ms | 0 }
const live = (k) => { const e = store.get(k); if (!e) return null; if (e.exp && e.exp <= Date.now()) { store.delete(k); return null; } return e; };
setInterval(() => { for (const k of store.keys()) live(k); }, 30000).unref();

const bulk = (s) => (s === null ? '$-1\r\n' : `$${Buffer.byteLength(s)}\r\n${s}\r\n`);
const int = (n) => `:${n}\r\n`, ok = '+OK\r\n', err = (m) => `-ERR ${m}\r\n`;
function run(c) {
  const cmd = String(c[0] || '').toUpperCase(), a = c.slice(1);
  switch (cmd) {
    case 'PING': return a[0] ? bulk(a[0]) : '+PONG\r\n';
    case 'INFO': return bulk('# Server\r\nredis_version:7.2.0\r\nloading:0\r\nrole:master\r\n');
    case 'CLIENT': case 'SELECT': return ok;                       // HELLO is left unknown on purpose: the client then falls back to RESP2
    case 'GET': return bulk(live(a[0])?.v ?? null);
    case 'SET': {
      let exp = 0, nx = false;
      for (let i = 2; i < a.length; i++) { const o = String(a[i]).toUpperCase(); if (o === 'EX') exp = Date.now() + Number(a[++i]) * 1000; else if (o === 'PX') exp = Date.now() + Number(a[++i]); else if (o === 'NX') nx = true; }
      if (nx && live(a[0])) return '$-1\r\n';
      store.set(a[0], { v: String(a[1]), exp }); return ok;
    }
    case 'DEL': { let n = 0; for (const k of a) if (live(k)) { store.delete(k); n++; } return int(n); }
    case 'INCR': { const e = live(a[0]); const n = (e ? Number(e.v) : 0) + 1; if (!Number.isInteger(n)) return err('value is not an integer'); store.set(a[0], { v: String(n), exp: e ? e.exp : 0 }); return int(n); }
    case 'EXPIRE': { const e = live(a[0]); if (!e) return int(0); e.exp = Date.now() + Number(a[1]) * 1000; return int(1); }
    case 'TTL': { const e = live(a[0]); return int(!e ? -2 : e.exp ? Math.max(0, Math.ceil((e.exp - Date.now()) / 1000)) : -1); }
    default: return err(`unknown command '${cmd}'`);
  }
}

function parse(buf) {                                          // one RESP array of bulk strings, or null if incomplete
  if (buf[0] !== 0x2a) { const i = buf.indexOf('\r\n'); if (i < 0) return null; return { cmd: buf.toString('utf8', 0, i).trim().split(/\s+/), used: i + 2 }; }   // inline command
  let p = buf.indexOf('\r\n'); if (p < 0) return null; const n = Number(buf.toString('utf8', 1, p)); p += 2; const out = [];
  for (let i = 0; i < n; i++) {
    if (p >= buf.length) return null; const q = buf.indexOf('\r\n', p); if (q < 0) return null; const len = Number(buf.toString('utf8', p + 1, q)); const s = q + 2;
    if (buf.length < s + len + 2) return null; out.push(buf.toString('utf8', s, s + len)); p = s + len + 2;
  }
  return { cmd: out, used: p };
}

net.createServer((sock) => {
  let buf = Buffer.alloc(0), queue = null; sock.setNoDelay(true);
  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]); let reply = '';
    for (;;) {
      const r = parse(buf); if (!r) break; buf = buf.subarray(r.used); const name = String(r.cmd[0] || '').toUpperCase();
      if (name === 'QUIT') { sock.end(ok); return; }
      if (name === 'MULTI') { queue = []; reply += ok; }
      else if (name === 'DISCARD') { queue = null; reply += ok; }
      else if (name === 'EXEC') { if (!queue) reply += err('EXEC without MULTI'); else { const rs = queue.map(run); queue = null; reply += `*${rs.length}\r\n${rs.join('')}`; } }
      else if (queue) { queue.push(r.cmd); reply += '+QUEUED\r\n'; }
      else reply += run(r.cmd);
    }
    if (reply) sock.write(reply);
  });
  sock.on('error', () => {});
}).listen(port, '127.0.0.1', () => console.log(`READY redis://127.0.0.1:${port}`));

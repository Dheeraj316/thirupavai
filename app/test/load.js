// Load test. Usage:
//   node test/load.js [baseUrl ...] [--users 10000] [--concurrency 10000] [--browse-seconds 15] [--browse-connections 1000] [--offset 0]
//   --offset N shifts the customer numbers, so several generator processes can run side by side (one process opening 10,000 sockets in a burst is itself a bottleneck).
// 1) LOGIN STORM — N distinct customers each do: request OTP -> verify OTP -> read session -> read catalogue, all at once.
// 2) BROWSE FLOOD — many connections hammering the home page and the catalogue for a fixed time.
// Run it against a server started with the limits raised (they exist to stop abuse from ONE address, and a load test is one address):
//   OTP_PER_IP=100000000 API_RATE_PER_MIN=100000000 OTP_DAILY_CAP=100000000 OTP_PER_MOBILE=100 node server.js
// Pass/fail: error rate under 0.5% and p99 under 3 s for every step. Exit code 1 when a limit is missed.
import http from 'node:http';
import https from 'node:https';
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? Number(args[i + 1]) : d; };
// Several base URLs = several server instances behind a load balancer. Each customer's requests are spread across ALL of them (OTP on one,
// verify on another, session read on a third), which also proves that sessions and codes really live in the shared store, not in any one instance.
const URLS = args.filter((a) => /^https?:/.test(a));
const BASES = (URLS.length ? URLS : ['http://127.0.0.1:8100']).map((u) => new URL(u));
const BASE = BASES[0];
const USERS = flag('users', 10000), CONC = flag('concurrency', USERS), BROWSE_S = flag('browse-seconds', 15), BROWSE_C = flag('browse-connections', 1000);
const OFFSET = flag('offset', 0);
const MAX_ERR = 0.005, MAX_P99 = 3000;

// A machine has ~16,000 outgoing ports per source address. On loopback we spread customers over several source addresses (127.0.0.10, .11, ...), like many real users coming from many addresses.
const LOOP = /^(127.|localhost$)/.test(BASE.hostname); const N_AG = LOOP ? 12 : 1;
const TLS = BASE.protocol === 'https:'; const lib = TLS ? https : http;   // Render and any real host serve https; local servers are plain http
const agents = Array.from({ length: N_AG }, (_, k) => new lib.Agent({ keepAlive: true, maxSockets: Math.ceil(CONC / N_AG) + 1, maxFreeSockets: Math.ceil(CONC / N_AG) + 1, ...(LOOP ? { localAddress: '127.0.0.' + (10 + k) } : {}) }));
function call(method, path, body, cookie, ag = agents[0], base = BASE) {
  return new Promise((resolve) => {
    const t0 = performance.now(); const data = body ? JSON.stringify(body) : null;
    const r = lib.request({ host: base.hostname, port: base.port || (TLS ? 443 : 80), method, path, agent: ag, timeout: 30000, headers: { 'x-tp': '1', ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}), ...(cookie ? { cookie } : {}) } }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => {
        let json = null; try { json = JSON.parse(Buffer.concat(chunks).toString()); } catch { /* not JSON */ }
        resolve({ status: res.statusCode, ms: performance.now() - t0, json, cookie: (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ') });
      });
    });
    r.on('timeout', () => { r.destroy(); resolve({ status: 0, ms: performance.now() - t0, json: null, err: 'timeout' }); });
    r.on('error', (e) => resolve({ status: 0, ms: performance.now() - t0, json: null, err: e.code || e.message }));
    if (data) r.write(data); r.end();
  });
}

const pct = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0);
const steps = {}; const errKinds = {};
const note = (step, r, okStatus = 200) => {
  const s = (steps[step] ||= { ms: [], ok: 0, bad: 0 }); s.ms.push(r.ms);
  if (r.status === okStatus) s.ok++; else { s.bad++; const k = `${step}: ${r.status || r.err}`; errKinds[k] = (errKinds[k] || 0) + 1; }
  return r.status === okStatus;
};

async function oneCustomer(i) {
  const mobile = '9' + String(100000000 + OFFSET + i);                     // 10 digits, starts with 9, unique per customer
  const ag = agents[i % agents.length]; const at = (k) => BASES[(i + k) % BASES.length];
  const o = await call('POST', '/api/auth/otp', { mobile }, null, ag, at(0)); if (!note('request OTP', o)) return;
  const code = o.json?.demoCode; if (!code) { note('request OTP (no demo code - is OTP_MODE=demo?)', { status: 500, ms: 0 }); return; }
  const v = await call('POST', '/api/auth/verify', { mobile, code }, null, ag, at(1)); if (!note('verify OTP -> session', v)) return;
  const s = await call('GET', '/api/session', null, v.cookie, ag, at(2)); if (note('read session', s) && s.json?.user?.mobile !== '+91 ' + mobile) note('session belongs to the right customer', { status: 500, ms: 0 });
  await call('GET', '/api/catalog', null, v.cookie, ag, at(3)).then((r) => note('read catalogue', r));
}

async function loginStorm() {
  console.log(`\n== LOGIN STORM: ${USERS} customers, up to ${CONC} in flight at once -> ${BASES.map((b) => b.origin).join(' ')}`);
  let next = 0; const t0 = performance.now(); let lastTick = t0;
  const worker = async () => { for (;;) { const i = next++; if (i >= USERS) return; await oneCustomer(i); } };
  const ticker = setInterval(() => { const done = steps['verify OTP -> session']?.ok || 0; process.stdout.write(`\r  signed in so far: ${done}/${USERS}   `); }, 1000);
  await Promise.all(Array.from({ length: Math.min(CONC, USERS) }, worker)); clearInterval(ticker);
  const secs = (performance.now() - t0) / 1000; const logins = steps['verify OTP -> session']?.ok || 0;
  console.log(`\r  ${logins}/${USERS} customers fully signed in over ${secs.toFixed(1)} s  ->  ${(logins / secs).toFixed(0)} sign-ins/s sustained`);
  return report();
}

function report() {
  let pass = true;
  console.log('\n  step'.padEnd(46) + 'ok'.padStart(8) + 'failed'.padStart(8) + 'p50'.padStart(9) + 'p95'.padStart(9) + 'p99'.padStart(9) + 'max'.padStart(9));
  for (const [name, s] of Object.entries(steps)) {
    const total = s.ok + s.bad, rate = s.bad / total, p99 = pct(s.ms, 99); const good = rate <= MAX_ERR && p99 <= MAX_P99; pass &&= good;
    console.log(('  ' + name).padEnd(44) + String(s.ok).padStart(8) + String(s.bad).padStart(8) + (pct(s.ms, 50).toFixed(0) + 'ms').padStart(9) + (pct(s.ms, 95).toFixed(0) + 'ms').padStart(9) + (p99.toFixed(0) + 'ms').padStart(9) + (Math.max(...s.ms).toFixed(0) + 'ms').padStart(9) + (good ? '' : '   <-- MISSES LIMIT'));
  }
  for (const [k, n] of Object.entries(errKinds)) console.log(`  ! ${n} x ${k}`);
  return pass;
}

async function browseFlood() {
  const { default: autocannon } = await import('autocannon');
  console.log(`\n== BROWSE FLOOD: ${BROWSE_C} connections for ${BROWSE_S} s (home page + catalogue)`);
  const res = await autocannon({ url: BASE.origin, connections: BROWSE_C, duration: BROWSE_S, timeout: 30, requests: [{ method: 'GET', path: '/' }, { method: 'GET', path: '/api/catalog' }, { method: 'GET', path: '/js/app.js' }] });
  const bad = res.errors + res.timeouts + res.non2xx; const total = res['2xx'] + bad; const rate = total ? bad / total : 1;
  console.log(`  ${(res.requests.total / BROWSE_S).toFixed(0)} req/s   p50 ${res.latency.p50} ms   p97.5 ${res.latency.p97_5} ms   p99 ${res.latency.p99} ms   max ${res.latency.max} ms   errors ${res.errors}, timeouts ${res.timeouts}, non-2xx ${res.non2xx}   throughput ${(res.throughput.average / 1048576).toFixed(1)} MB/s`);
  const good = rate <= MAX_ERR && res.latency.p99 <= MAX_P99 * 2; console.log(good ? '  within limits' : '  <-- MISSES LIMIT'); return good;
}

const okLogin = await loginStorm(); const okBrowse = BROWSE_S > 0 ? await browseFlood() : true;
agents.forEach((a) => a.destroy());
console.log(`\n${okLogin && okBrowse ? 'PASS' : 'FAIL'} — ${USERS} customers, ${CONC} in flight`);
process.exit(okLogin && okBrowse ? 0 : 1);

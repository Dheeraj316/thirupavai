// Raw speed of individual endpoints (each hammered by 100 connections for 5 s). Usage: node test/endpoints.js [baseUrl]
// Use it to see which step of a flow is the slow one; test/load.js measures the whole sign-in flow.
import autocannon from 'autocannon';

const url = process.argv[2] || 'http://127.0.0.1:8100';
const json = { 'x-tp': '1', 'content-type': 'application/json' };
const run = async (name, opts) => {
  const r = await autocannon({ url, connections: 100, duration: 5, ...opts });
  console.log(name.padEnd(36), String(Math.round(r.requests.average)).padStart(7), 'req/s   p50', String(r.latency.p50).padStart(4), 'ms   p99', String(r.latency.p99).padStart(4), 'ms   non-2xx', r.non2xx);
};
let n = 0; const fresh = () => '7' + String(100000000 + (n++ % 899999999));
await run('GET /healthz', { requests: [{ method: 'GET', path: '/healthz' }] });
await run('GET /api/session (no cookie)', { requests: [{ method: 'GET', path: '/api/session' }] });
await run('GET /api/catalog', { requests: [{ method: 'GET', path: '/api/catalog' }] });
await run('GET / (home page, compressed)', { headers: { 'accept-encoding': 'br, gzip' }, requests: [{ method: 'GET', path: '/' }] });
await run('POST /api/auth/otp', { headers: json, requests: [{ method: 'POST', path: '/api/auth/otp', setupRequest: (req) => { req.body = JSON.stringify({ mobile: fresh() }); return req; } }] });

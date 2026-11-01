// k6 load test for the STAGING site (run it from a cloud machine or k6 Cloud, not from a laptop: one machine cannot open 10,000 connections).
//   k6 run -e BASE=https://thirupavai-staging.onrender.com -e VUS=10000 test/k6-login-storm.js
// Staging must run with OTP_MODE=demo (so the API returns the code) and these limits raised for the duration of the test, because every virtual
// customer comes from the same few addresses and the abuse guards would (rightly) block them:
//   OTP_PER_IP=100000000  API_RATE_PER_MIN=100000000  OTP_DAILY_CAP=100000000  OTP_PER_MOBILE=100
// Never run this against production: it would create thousands of fake customers and (with SMS on) send thousands of SMS.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://127.0.0.1:8100';
const VUS = Number(__ENV.VUS || 10000);
const signIn = new Trend('signin_total_ms', true);

export const options = {
  scenarios: {
    rush: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '30s', target: VUS }, { duration: '60s', target: VUS }, { duration: '15s', target: 0 }] },
  },
  thresholds: {
    http_req_failed: ['rate<0.005'],                 // under 0.5% errors
    http_req_duration: ['p(95)<1500', 'p(99)<3000'], // 95% under 1.5 s, 99% under 3 s
    checks: ['rate>0.995'],
  },
};

const H = { 'content-type': 'application/json', 'x-tp': '1' };
export default function () {
  const mobile = '9' + String(100000000 + (__VU * 1000 + __ITER) % 899999999).padStart(9, '0');
  const t0 = Date.now();
  const o = http.post(`${BASE}/api/auth/otp`, JSON.stringify({ mobile }), { headers: H, tags: { step: 'otp' } });
  if (!check(o, { 'otp sent': (r) => r.status === 200 && !!r.json('demoCode') })) return;
  const v = http.post(`${BASE}/api/auth/verify`, JSON.stringify({ mobile, code: o.json('demoCode') }), { headers: H, tags: { step: 'verify' } });
  if (!check(v, { 'signed in': (r) => r.status === 200 })) return;
  const s = http.get(`${BASE}/api/session`, { tags: { step: 'session' } });                   // k6 keeps the cookie per virtual customer
  check(s, { 'session is theirs': (r) => r.json('user.mobile') === '+91 ' + mobile });
  http.get(`${BASE}/api/catalog`, { tags: { step: 'catalog' } });
  http.get(`${BASE}/`, { headers: { 'accept-encoding': 'br, gzip' }, tags: { step: 'home' } });
  signIn.add(Date.now() - t0);
  sleep(1 + Math.random() * 4);                                                                // a person reads the page before the next click
}

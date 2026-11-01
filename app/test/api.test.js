// End-to-end API tests: real routes, real SQL (embedded PGlite), in-memory KV. Run with `npm test`.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ADMIN = '9000000001';
Object.assign(process.env, {
  NODE_ENV: 'test', STATIC_DIR: path.join(here, '..', '..', 'site'), SEED_ADMIN_MOBILE: ADMIN,
  OTP_MODE: 'demo', PAYMENTS_MODE: 'mock', API_RATE_PER_MIN: '100000', OTP_PER_IP: '100000',
});
// by default the suite runs on embedded PGlite; TEST_DATABASE_URL points it at a real Postgres (see test/pg-server.js)
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; else delete process.env.DATABASE_URL;
if (process.env.TEST_REDIS_URL) process.env.REDIS_URL = process.env.TEST_REDIS_URL; else delete process.env.REDIS_URL;

const { cfg } = await import('../src/config.js');
const { openKV } = await import('../src/kv.js');
const { openDB, db } = await import('../src/db.js');
const { buildApp } = await import('../src/app.js');

let app, kv, n = Math.floor(Math.random() * 8e6);      // random start so repeated runs on a persistent database never reuse a customer
const H = { 'x-tp': '1' };
const post = (url, payload, headers = H, extra = {}) => app.inject({ method: 'POST', url, payload, headers, ...extra });
const call = (method, url, payload, headers = H) => app.inject({ method, url, payload, headers });
const nextMobile = () => '98' + String(10000000 + ++n);           // a fresh valid mobile for every test user

async function login(mobile = nextMobile()) {
  const o = await post('/api/auth/otp', { mobile }); assert.equal(o.statusCode, 200, o.body);
  const v = await post('/api/auth/verify', { mobile, code: o.json().demoCode }); assert.equal(v.statusCode, 200, v.body);
  const sid = v.cookies.find((c) => c.name === 'tp_sid');
  return { mobile, headers: { ...H, cookie: 'tp_sid=' + sid.value }, cookie: sid };
}
const bag = (items, extra = {}) => ({
  items, address: { line: '12 Temple Street, Mylapore', city: 'Chennai', pin: '600004' }, customer: { name: 'Asha Raman', email: 'asha@example.com' },
  delivery: 'Standard', coupon: '', key: crypto.randomUUID(), ...extra,
});
async function buy(u, items, extra = {}, vpa = 'asha@upi') {
  const b = bag(items, extra); const i = await post('/api/checkout/intent', b, u.headers); if (i.statusCode !== 200) return { intent: i };
  const p = await post('/api/checkout/pay', { intentId: i.json().intentId, vpa }, u.headers);
  return { intent: i, pay: p, order: p.json().order, body: b };
}
const stockOf = async (id) => (await db.query('SELECT stock FROM products WHERE id=$1', [id])).rows[0].stock;

before(async () => {
  const real = await openKV(); const ns = 't' + Date.now() + ':';                // own key namespace per run, so counters left in a shared Redis by an earlier run cannot interfere
  kv = { get: (k) => real.get(ns + k), set: (k, v, t) => real.set(ns + k, v, t), del: (k) => real.del(ns + k), incr: (k, t) => real.incr(ns + k, t), ttl: (k) => real.ttl(ns + k), ping: () => real.ping(), close: () => real.close() };
  await openDB(); app = await buildApp({ kv }); await app.ready();
  // deterministic stock for the tests: p5 plentiful, p1 exactly one left
  await db.query("UPDATE products SET stock=50 WHERE id='p5'"); await db.query("UPDATE products SET stock=1 WHERE id='p1'");
});
after(async () => { await app.close(); await db.close(); await kv.close(); });

describe('health and catalogue', () => {
  it('answers health and readiness', async () => {
    assert.equal((await app.inject('/healthz')).statusCode, 200);
    assert.equal((await app.inject('/readyz')).statusCode, 200);
  });
  it('serves the storefront with security headers and sensible caching', async () => {
    const r = await app.inject('/'); assert.equal(r.statusCode, 200); assert.match(r.headers['content-type'], /text\/html/);
    assert.equal(r.headers['x-content-type-options'], 'nosniff'); assert.equal(r.headers['cache-control'], 'no-cache');
    const js = await app.inject('/js/data.js'); assert.equal(js.statusCode, 200); assert.match(js.headers['cache-control'], /max-age=300/);
  });
  it('tells the browser which mode it is in', async () => {
    const r = await app.inject('/config.js'); assert.match(r.body, /window\.TP_CONFIG=/); assert.match(r.body, /"api":true/); assert.doesNotMatch(r.body, /secret/i);
  });
  it('serves the catalogue with an ETag and answers 304 when nothing changed', async () => {
    const a = await app.inject('/api/catalog'); assert.equal(a.statusCode, 200); assert.ok(a.json().length >= 10);
    const b = await app.inject({ url: '/api/catalog', headers: { 'if-none-match': a.headers.etag } }); assert.equal(b.statusCode, 304);
  });
  it('returns JSON 404 for unknown API paths and plain 404 for unknown pages', async () => {
    assert.equal((await app.inject('/api/nope')).json().ok, false);
    assert.equal((await app.inject('/nope')).statusCode, 404);
  });
});

describe('request guards', () => {
  it('refuses state-changing requests that lack the anti-CSRF header', async () => {
    const r = await post('/api/auth/otp', { mobile: '9812345678' }, {}); assert.equal(r.statusCode, 403);
  });
  it('rejects malformed JSON and oversized bodies without a 500', async () => {
    const m = await app.inject({ method: 'POST', url: '/api/auth/otp', headers: { ...H, 'content-type': 'application/json' }, payload: '{bad' }); assert.equal(m.statusCode, 400);
    const big = await post('/api/tickets', { message: 'x'.repeat(100000) }); assert.equal(big.statusCode, 413);
  });
  it('throttles one IP that floods the API, and nobody else', async () => {
    const keep = cfg.ipLimit; cfg.ipLimit = 5;
    try {
      const codes = []; for (let i = 0; i < 8; i++) codes.push((await app.inject({ url: '/api/session', remoteAddress: '10.9.9.9' })).statusCode);
      assert.deepEqual(codes.slice(0, 5), [200, 200, 200, 200, 200]); assert.ok(codes.slice(5).every((c) => c === 429), codes.join());
      assert.equal((await app.inject({ url: '/api/session', remoteAddress: '10.9.9.10' })).statusCode, 200);
    } finally { cfg.ipLimit = keep; }
  });
});

describe('sign-in with a mobile OTP', () => {
  it('rejects numbers that are not Indian mobiles', async () => {
    for (const m of ['', '12345', '5123456789', 'abcdefghij']) assert.equal((await post('/api/auth/otp', { mobile: m })).statusCode, 400, m);
  });
  it('signs in with the right code, sets an HttpOnly cookie, and remembers the session', async () => {
    const u = await login(); assert.equal(u.cookie.httpOnly, true); assert.equal(u.cookie.sameSite, 'Lax');
    const s = await call('GET', '/api/session', undefined, u.headers); assert.equal(s.json().user.mobile, '+91 ' + u.mobile);
    assert.equal((await call('GET', '/api/session')).json().user, null);
  });
  it('stores the code hashed, never in clear text', async () => {
    const mobile = nextMobile(); const o = await post('/api/auth/otp', { mobile });
    const stored = await kv.get('otp:' + mobile); assert.ok(stored); assert.ok(!stored.includes(o.json().demoCode));
  });
  it('a code works once', async () => {
    const mobile = nextMobile(); const o = await post('/api/auth/otp', { mobile }); const code = o.json().demoCode;
    assert.equal((await post('/api/auth/verify', { mobile, code })).statusCode, 200);
    assert.equal((await post('/api/auth/verify', { mobile, code })).statusCode, 400);
  });
  it('locks the number after three wrong codes, even for the right code afterwards', async () => {
    const mobile = nextMobile(); const o = await post('/api/auth/otp', { mobile }); const good = o.json().demoCode; const wrong = good === '111111' ? '222222' : '111111';
    assert.equal((await post('/api/auth/verify', { mobile, code: wrong })).statusCode, 400);
    assert.equal((await post('/api/auth/verify', { mobile, code: wrong })).statusCode, 400);
    assert.equal((await post('/api/auth/verify', { mobile, code: wrong })).statusCode, 429);
    assert.equal((await post('/api/auth/verify', { mobile, code: good })).statusCode, 429);
    assert.equal((await post('/api/auth/otp', { mobile })).statusCode, 429);
  });
  it('limits how many codes one number can request', async () => {
    const mobile = nextMobile(); const codes = [];
    for (let i = 0; i < cfg.otp.perMobile + 2; i++) codes.push((await post('/api/auth/otp', { mobile })).statusCode);
    assert.equal(codes.filter((c) => c === 200).length, cfg.otp.perMobile); assert.ok(codes.slice(cfg.otp.perMobile).every((c) => c === 429), codes.join());
  });
  it('logs out and kills the session on the server', async () => {
    const u = await login(); assert.equal((await post('/api/auth/logout', {}, u.headers)).statusCode, 200);
    assert.equal((await call('GET', '/api/session', undefined, u.headers)).json().user, null);
  });
  it('lets a signed-in customer save their name', async () => {
    const u = await login(); assert.equal((await call('PATCH', '/api/me', { name: 'Asha Raman' }, u.headers)).statusCode, 200);
    assert.equal((await call('GET', '/api/session', undefined, u.headers)).json().user.name, 'Asha Raman');
    assert.equal((await db.query('SELECT name FROM users WHERE mobile=$1', [u.mobile])).rows[0].name, 'Asha Raman');
  });
});

describe('checkout and orders', () => {
  it('needs a signed-in customer', async () => {
    assert.equal((await post('/api/checkout/intent', bag([{ id: 'p5', qty: 1 }]))).statusCode, 401);
    assert.equal((await call('GET', '/api/orders/mine')).statusCode, 401);
  });
  it('validates the address, the name and the bag', async () => {
    const u = await login();
    assert.equal((await post('/api/checkout/intent', bag([]), u.headers)).statusCode, 400);
    assert.equal((await post('/api/checkout/intent', bag([{ id: 'p5', qty: 1 }], { address: { line: 'x', pin: '12' } }), u.headers)).statusCode, 400);
    assert.equal((await post('/api/checkout/intent', bag([{ id: 'p5', qty: 1 }], { customer: { name: '' } }), u.headers)).statusCode, 400);
    assert.equal((await post('/api/checkout/intent', bag([{ id: 'nope', qty: 1 }]), u.headers)).statusCode, 409);
    assert.equal((await post('/api/checkout/intent', bag([{ id: 'p5', qty: 99 }]), u.headers)).statusCode, 409);
  });
  it('prices on the server, ignoring any price the browser sends', async () => {
    const u = await login(); const cat = new Map((await app.inject('/api/catalog')).json().map((r) => [r.id, r]));
    const sent = bag([{ id: 'p5', qty: 2, addons: ['fall', 'gift', 'bogus'], price: 1 }], { coupon: 'festive5', delivery: 'Express' });
    const i = await post('/api/checkout/intent', sent, u.headers); assert.equal(i.statusCode, 200);
    const sub = cat.get('p5').price * 2 + 450 + 250, disc = Math.round(sub * 0.05);
    assert.deepEqual(i.json().totals, { sub, discount: disc, delivery: 350, total: sub - disc + 350 });
  });
  it('turns a paid checkout into one order, takes the stock, and numbers it from 100001', async () => {
    const u = await login(); const before = await stockOf('p5');
    const r = await buy(u, [{ id: 'p5', qty: 2 }]); assert.equal(r.pay.statusCode, 200, r.pay.body);
    assert.match(r.order.id, /^TPV-\d{6}$/); assert.equal(r.order.stage, 0); assert.equal(r.order.payment.status, 'Captured'); assert.equal(r.order.customer.mobile, '+91 ' + u.mobile);
    assert.equal(await stockOf('p5'), before - 2);
    const mine = (await call('GET', '/api/orders/mine', undefined, u.headers)).json().orders; assert.equal(mine.length, 1); assert.equal(mine[0].id, r.order.id);
  });
  it('is idempotent: double-clicking Pay creates one order and takes stock once', async () => {
    const u = await login(); const b = bag([{ id: 'p5', qty: 1 }]); const before = await stockOf('p5');
    const i1 = await post('/api/checkout/intent', b, u.headers), i2 = await post('/api/checkout/intent', b, u.headers); assert.equal(i1.json().intentId, i2.json().intentId);
    const [a, c] = await Promise.all([post('/api/checkout/pay', { intentId: i1.json().intentId, vpa: 'a@upi' }, u.headers), post('/api/checkout/pay', { intentId: i1.json().intentId, vpa: 'a@upi' }, u.headers)]);
    assert.equal(a.statusCode, 200); assert.equal(c.statusCode, 200); assert.equal(a.json().order.id, c.json().order.id);
    assert.equal(await stockOf('p5'), before - 1);
    assert.equal((await call('GET', '/api/orders/mine', undefined, u.headers)).json().orders.length, 1);
  });
  it('a failed payment leaves no order and no stock change', async () => {
    const u = await login(); const before = await stockOf('p5');
    const r = await buy(u, [{ id: 'p5', qty: 1 }], {}, 'fail@upi'); assert.equal(r.pay.statusCode, 402);
    assert.equal(await stockOf('p5'), before); assert.equal((await call('GET', '/api/orders/mine', undefined, u.headers)).json().orders.length, 0);
  });
  it('sells the last saree to one buyer only, however many try at once', async () => {
    const buyers = await Promise.all(Array.from({ length: 12 }, () => login()));
    await Promise.all(buyers.map(async (u) => { const i = await post('/api/checkout/intent', bag([{ id: 'p1', qty: 1 }]), u.headers); u.intent = i.json().intentId; }));
    const res = await Promise.all(buyers.map((u) => post('/api/checkout/pay', { intentId: u.intent, vpa: 'a@upi' }, u.headers)));
    const ok = res.filter((r) => r.statusCode === 200), lost = res.filter((r) => r.statusCode === 409);
    assert.equal(ok.length, 1, res.map((r) => r.statusCode).join()); assert.equal(lost.length, 11); assert.equal(await stockOf('p1'), 0);
    assert.equal((await db.query("SELECT count(*)::int AS c FROM orders o JOIN users u ON u.id = o.user_id WHERE u.mobile = ANY($1) AND o.items @> '[{\"id\":\"p1\"}]'", [buyers.map((b) => b.mobile)])).rows[0].c, 1);
    assert.equal((await post('/api/checkout/intent', bag([{ id: 'p1', qty: 1 }]), buyers[0].headers)).statusCode, 409);   // now sold out
  });
  it('takes many simultaneous orders for a popular saree without overselling', async () => {
    await db.query("UPDATE products SET stock=10 WHERE id='p5'");
    const buyers = await Promise.all(Array.from({ length: 25 }, () => login()));
    const res = await Promise.all(buyers.map((u) => buy(u, [{ id: 'p5', qty: 1 }]).then((r) => r.pay?.statusCode ?? r.intent.statusCode)));
    assert.equal(res.filter((c) => c === 200).length, 10, res.join()); assert.equal(await stockOf('p5'), 0);
    await db.query("UPDATE products SET stock=50 WHERE id='p5'");
  });
  it('keeps orders private to their owner', async () => {
    const a = await login(), b = await login(); const r = await buy(a, [{ id: 'p5', qty: 1 }]);
    assert.equal((await call('GET', '/api/orders/' + r.order.id, undefined, a.headers)).statusCode, 200);
    assert.equal((await call('GET', '/api/orders/' + r.order.id, undefined, b.headers)).statusCode, 404);
    assert.equal((await call('GET', '/api/orders/mine', undefined, b.headers)).json().orders.length, 0);
  });
  it('lets a guest track by order number plus the last four digits, with details masked', async () => {
    const u = await login(); const r = await buy(u, [{ id: 'p5', qty: 1 }]);
    const ok = await call('GET', `/api/track/${r.order.id}?m=${u.mobile.slice(-4)}`); assert.equal(ok.statusCode, 200);
    assert.equal(ok.json().order.address.line, ''); assert.notEqual(ok.json().order.customer.mobile, '+91 ' + u.mobile); assert.equal(ok.json().order.customer.name, 'Asha');
    assert.equal((await call('GET', `/api/track/${r.order.id}?m=0000`)).statusCode, 404);
    assert.equal((await call('GET', `/api/track/TPV-999999?m=${u.mobile.slice(-4)}`)).statusCode, 404);
  });
});

describe('Razorpay webhook (the safety net when the customer closes the tab)', () => {
  const secret = 'whsec_test'; const sign = (raw) => crypto.createHmac('sha256', secret).update(raw).digest('hex');
  it('rejects an unsigned or wrongly signed call', async () => {
    cfg.payments.razorpay.webhookSecret = secret;
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', order_id: 'x' } } } });
    const post1 = (sig) => app.inject({ method: 'POST', url: '/api/payments/webhook', headers: { 'content-type': 'application/json', 'x-razorpay-signature': sig }, payload: raw });
    assert.equal((await post1('')).statusCode, 401); assert.equal((await post1('deadbeef')).statusCode, 401); assert.equal((await post1(sign(raw))).statusCode, 200);
  });
  it('creates the order from a signed capture event, once, even if Razorpay retries', async () => {
    cfg.payments.razorpay.webhookSecret = secret; const u = await login(); const before = await stockOf('p5');
    const i = (await post('/api/checkout/intent', bag([{ id: 'p5', qty: 1 }]), u.headers)).json();
    const ref = (await db.query('SELECT gateway_ref FROM intents WHERE id=$1', [i.intentId])).rows[0].gateway_ref;
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_abc', order_id: ref } } } });
    for (let k = 0; k < 3; k++) assert.equal((await app.inject({ method: 'POST', url: '/api/payments/webhook', headers: { 'content-type': 'application/json', 'x-razorpay-signature': sign(raw) }, payload: raw })).statusCode, 200);
    const mine = (await call('GET', '/api/orders/mine', undefined, u.headers)).json().orders; assert.equal(mine.length, 1); assert.equal(mine[0].payment.ref, 'pay_abc'); assert.equal(await stockOf('p5'), before - 1);
  });
});

describe('admin: roles, orders, catalogue', () => {
  let admin, order, customer;
  before(async () => { admin = await login(ADMIN); customer = await login(); order = (await buy(customer, [{ id: 'p5', qty: 1 }])).order; });
  const staffMember = async (role) => { const u = await login(); const r = await call('POST', '/api/admin/staff', { mobile: u.mobile, role }, admin.headers); assert.equal(r.statusCode, 200, r.body); return u; };

  it('keeps customers and strangers out of the admin API', async () => {
    assert.equal((await call('GET', '/api/admin/bootstrap')).statusCode, 401);
    assert.equal((await call('GET', '/api/admin/bootstrap', undefined, customer.headers)).statusCode, 403);
    assert.equal((await call('PATCH', '/api/admin/products/p5', { price: 1 }, customer.headers)).statusCode, 403);
    assert.equal((await post('/api/admin/orders/' + order.id + '/advance', {}, customer.headers)).statusCode, 403);
  });
  it('shows the Super Admin everything, unmasked', async () => {
    const b = (await call('GET', '/api/admin/bootstrap', undefined, admin.headers)).json(); assert.equal(b.role, 'Super Admin');
    const o = b.orders.find((x) => x.id === order.id); assert.equal(o.customer.mobile, '+91 ' + customer.mobile); assert.ok(b.products.length >= 10); assert.ok(b.audit.length >= 1);
  });
  it('masks personal details for roles that may not see them', async () => {
    const cs = await staffMember('Customer Support'); const b = (await call('GET', '/api/admin/bootstrap', undefined, cs.headers)).json();
    const o = b.orders.find((x) => x.id === order.id); assert.notEqual(o.customer.mobile, '+91 ' + customer.mobile); assert.equal(o.address.line, '•••••••');
    assert.equal((await post(`/api/admin/orders/${order.id}/advance`, {}, cs.headers)).statusCode, 403);          // view only
    assert.equal((await call('GET', '/api/admin/bootstrap', undefined, (await staffMember('Product Manager')).headers)).statusCode, 403);   // no order access
  });
  it('walks an order through its stages, enforcing the packing checklist', async () => {
    const adv = (to) => post(`/api/admin/orders/${order.id}/advance`, to == null ? {} : { to }, admin.headers);
    assert.equal((await adv()).json().order.stage, 1); assert.equal((await adv()).json().order.stage, 2);
    assert.equal((await adv()).statusCode, 400);                                                                      // checklist incomplete
    assert.equal((await call('PATCH', '/api/admin/orders/' + order.id, { qc: [0, 1, 2, 3, 4] }, admin.headers)).statusCode, 200);
    const shipped = (await adv()).json().order; assert.equal(shipped.stage, 3); assert.match(shipped.awb, /^AWB-/); assert.equal(shipped.history.length, 4);
    assert.equal((await adv(6)).json().order.stage, 6); assert.equal((await adv()).json().order.stage, 6);           // delivered; further advances are no-ops
    assert.equal((await adv(2)).json().order.stage, 6);                                                               // never goes backwards
  });
  it('will not move an order whose payment is still pending', async () => {
    const u = await login(); const r = await buy(u, [{ id: 'p5', qty: 1 }], {}, 'pending@upi'); assert.equal(r.order.payment.status, 'Pending');
    const res = await post(`/api/admin/orders/${r.order.id}/advance`, {}, admin.headers); assert.equal(res.statusCode, 400);
  });
  it('lets only roles with refund rights refund, and a Finance Manager needs no order-edit rights to do it', async () => {
    const fin = await staffMember('Finance Manager'), om = await staffMember('Order Manager');
    assert.equal((await call('PATCH', '/api/admin/orders/' + order.id, { payment: { status: 'Refunded' } }, om.headers)).statusCode, 403);
    assert.equal((await call('PATCH', '/api/admin/orders/' + order.id, { qc: [0] }, fin.headers)).statusCode, 403);
    assert.equal((await call('PATCH', '/api/admin/orders/' + order.id, { payment: { status: 'Refunded' } }, fin.headers)).statusCode, 200);
    assert.equal((await call('GET', '/api/orders/' + order.id, undefined, admin.headers)).json().order.payment.status, 'Refunded');
    assert.equal((await call('PATCH', '/api/admin/orders/' + order.id, {}, admin.headers)).statusCode, 400);
  });
  it('edits price, stock and visibility, and the storefront sees it at once', async () => {
    const r = await call('PATCH', '/api/admin/products/p6', { price: 31000, stock: 3, active: false, name: 'Renamed in admin' }, admin.headers); assert.equal(r.statusCode, 200, r.body);
    const row = (await app.inject('/api/catalog')).json().find((x) => x.id === 'p6'); assert.equal(row.price, 31000); assert.equal(row.stock, 3); assert.equal(row.active, false); assert.equal(row.ovr.name, 'Renamed in admin');
    assert.equal((await post('/api/checkout/intent', bag([{ id: 'p6', qty: 1 }]), customer.headers)).statusCode, 409);   // hidden products cannot be bought
    assert.equal((await call('PATCH', '/api/admin/products/p6', { price: 5 }, admin.headers)).statusCode, 400);
    assert.equal((await call('PATCH', '/api/admin/products/zzz', { price: 5000 }, admin.headers)).statusCode, 404);
    await call('PATCH', '/api/admin/products/p6', { active: true }, admin.headers);
  });
  it('lets the Super Admin edit role access live, but never lock themselves out', async () => {
    const cs = await staffMember('Customer Support');
    assert.equal((await call('GET', '/api/admin/bootstrap', undefined, cs.headers)).statusCode, 200);
    const m = (await call('GET', '/api/admin/bootstrap', undefined, admin.headers)).json().roles;
    m['Customer Support'].orders = 'none'; m['Super Admin'].orders = 'none'; m['Super Admin'].roles = 'none';
    assert.equal((await call('PUT', '/api/admin/roles', { matrix: m }, admin.headers)).statusCode, 200);
    assert.equal((await call('GET', '/api/admin/bootstrap', undefined, cs.headers)).statusCode, 403);                       // took effect immediately
    const after = (await call('GET', '/api/admin/bootstrap', undefined, admin.headers)).json(); assert.equal(after.roles['Super Admin'].orders, 'full'); assert.equal(after.roles['Super Admin'].roles, 'full');
    assert.equal((await call('PUT', '/api/admin/roles', { matrix: m }, cs.headers)).statusCode, 403);
    m['Customer Support'].orders = 'view'; await call('PUT', '/api/admin/roles', { matrix: m }, admin.headers);
  });
  it('records who did what in the audit trail', async () => {
    const a = (await call('GET', '/api/admin/bootstrap', undefined, admin.headers)).json().audit.map((x) => x.action);
    for (const want of ['Order created', 'Role permissions edited', 'Refund']) assert.ok(a.includes(want), want + ' missing from ' + a.join('|'));
  });
});

describe('support tickets', () => {
  it('takes a ticket from a guest, shows it to support, records the reply and resolves it', async () => {
    assert.equal((await post('/api/tickets', { name: 'A', subject: '', message: 'x', contact: '123' })).statusCode, 400);
    const t = await post('/api/tickets', { name: 'Asha Raman', contact: '9876500001', subject: 'Where is my saree?', message: 'Order TPV-100001 has not moved.' }); assert.equal(t.statusCode, 200);
    const admin = await login(ADMIN); const b = (await call('GET', '/api/admin/bootstrap', undefined, admin.headers)).json();
    const mine = b.tickets.find((x) => x.id === t.json().id); assert.equal(mine.status, 'New'); assert.equal(mine.contact, '9876500001');
    assert.equal((await post(`/api/admin/tickets/${t.json().id}/reply`, { text: 'It ships tomorrow.' }, admin.headers)).statusCode, 200);
    assert.equal((await post(`/api/admin/tickets/${t.json().id}/resolve`, {}, admin.headers)).statusCode, 200);
    const after = (await call('GET', '/api/admin/bootstrap', undefined, admin.headers)).json().tickets.find((x) => x.id === t.json().id);
    assert.equal(after.status, 'Resolved'); assert.equal(after.msgs.at(-1).from, 'us');
    assert.equal((await post('/api/admin/tickets/T-missing/reply', { text: 'hi' }, admin.headers)).statusCode, 404);
  });
  it('accepts an email as the contact (newsletter, notify-me) and rejects junk', async () => {
    assert.equal((await post('/api/tickets', { channel: 'Newsletter', contact: 'asha@example.com' })).statusCode, 200);
    assert.equal((await post('/api/tickets', { channel: 'Notify me', contact: 'not-a-contact' })).statusCode, 400);
  });
  it('limits how often one contact can submit, so a form cannot be used to flood the inbox', async () => {
    const codes = []; for (let i = 0; i < 8; i++) codes.push((await post('/api/tickets', { channel: 'Newsletter', contact: 'flood@example.com' })).statusCode);
    assert.equal(codes.filter((c) => c === 200).length, 6, codes.join());
  });
  it('masks customer contact details for roles that may not see them', async () => {
    const admin = await login(ADMIN); const cs = await login(); await call('POST', '/api/admin/staff', { mobile: cs.mobile, role: 'Customer Support' }, admin.headers);
    const t = (await call('GET', '/api/admin/bootstrap', undefined, cs.headers)).json().tickets.find((x) => x.contact && x.channel === 'Web form');
    assert.ok(t); assert.doesNotMatch(String(t.contact), /9876500001/); assert.match(t.name, /•••/);
  });
});

describe('what staff are told, and what they are not', () => {
  let admin, customer, order;
  before(async () => { admin = await login(ADMIN); customer = await login(); order = (await buy(customer, [{ id: 'p5', qty: 1 }])).order; });
  const staffAs = async (role) => { const u = await login(); await call('POST', '/api/admin/staff', { mobile: u.mobile, role }, admin.headers); return u; };

  it('masks the customer in every admin response, not just the first list', async () => {
    const om = await staffAs('Order Manager');
    const adv = await post(`/api/admin/orders/${order.id}/advance`, {}, om.headers); assert.equal(adv.statusCode, 200);
    assert.notEqual(adv.json().order.customer.mobile, '+91 ' + customer.mobile); assert.equal(adv.json().order.address.line, '•••••••');
    const one = await call('GET', '/api/orders/' + order.id, undefined, om.headers); assert.notEqual(one.json().order.customer.mobile, '+91 ' + customer.mobile);
    assert.equal((await call('GET', '/api/orders/' + order.id, undefined, customer.headers)).json().order.customer.mobile, '+91 ' + customer.mobile);   // the owner sees their own details
  });
  it('gives a changed bag its own checkout intent instead of reusing a stale one', async () => {
    const u = await login(); const key = crypto.randomUUID();
    const a = (await post('/api/checkout/intent', bag([{ id: 'p5', qty: 1 }], { key }), u.headers)).json();
    const b = (await post('/api/checkout/intent', bag([{ id: 'p5', qty: 2 }], { key }), u.headers)).json();
    const c = (await post('/api/checkout/intent', bag([{ id: 'p5', qty: 1 }], { key }), u.headers)).json();
    assert.notEqual(a.intentId, b.intentId); assert.equal(a.intentId, c.intentId); assert.equal(b.totals.sub, a.totals.sub * 2);
  });
  it('stores the product image order and alt text an admin sets, and refuses paths outside the site assets', async () => {
    const g = [{ img: 'assets/p7_b.webp', pos: '50% 20%', label: 'Detail', alt: 'Close view of the zari border' }, { img: '../../etc/passwd', label: 'x' }, { img: 'https://evil.example/x.jpg', label: 'y' }];
    assert.equal((await call('PATCH', '/api/admin/products/p7', { gallery: g }, admin.headers)).statusCode, 200);
    const row = (await app.inject('/api/catalog')).json().find((x) => x.id === 'p7'); assert.equal(row.ovr.gallery.length, 1); assert.equal(row.ovr.gallery[0].alt, 'Close view of the zari border');
  });
  it('confirms a pending test payment only in staging, and only for roles that manage payments', async () => {
    const u = await login(); const r = await buy(u, [{ id: 'p5', qty: 1 }], {}, 'pending@upi');
    const cs = await staffAs('Customer Support'), fin = await staffAs('Finance Manager');
    assert.equal((await post(`/api/admin/orders/${r.order.id}/confirm-payment`, {}, cs.headers)).statusCode, 403);
    assert.equal((await post(`/api/admin/orders/${r.order.id}/confirm-payment`, {}, fin.headers)).statusCode, 200);
    assert.equal((await call('GET', '/api/orders/' + r.order.id, undefined, u.headers)).json().order.payment.status, 'Captured');
  });
  it('refunds a captured payment exactly once, even if two people click at the same moment', async () => {
    const u = await login(); const r = await buy(u, [{ id: 'p5', qty: 1 }]); const fin = await staffAs('Finance Manager');
    const go = () => call('PATCH', '/api/admin/orders/' + r.order.id, { payment: { status: 'Refunded' } }, fin.headers);
    const res = await Promise.all([go(), go()]); assert.deepEqual(res.map((x) => x.statusCode).sort(), [200, 400]);
    const o = (await call('GET', '/api/orders/' + r.order.id, undefined, admin.headers)).json().order; assert.equal(o.payment.status, 'Refunded'); assert.match(o.payment.refund, /^rfnd_/);
    assert.equal((await go()).statusCode, 400);                                                                                // a refunded order cannot be refunded again
  });
  it('gives the dashboard real totals from the database, and no money figures to roles without payment access', async () => {
    const full = (await call('GET', '/api/admin/bootstrap', undefined, admin.headers)).json().stats;
    const count = (await db.query('SELECT count(*)::int AS c FROM orders')).rows[0].c; assert.equal(full.total, count);
    const cap = (await db.query("SELECT COALESCE(sum((totals->>'total')::int),0)::int AS s FROM orders WHERE payment->>'status'='Captured'")).rows[0].s; assert.equal(full.amount.Captured, cap); assert.ok(cap > 0);
    const pm = await staffAs('Customer Support'); const lim = (await call('GET', '/api/admin/bootstrap', undefined, pm.headers)).json().stats;
    assert.equal(lim.total, count); assert.equal(lim.amount.Captured, 0); assert.deepEqual(lim.daily, {});
  });
  it('lists and removes staff, but never the last Super Admin or yourself', async () => {
    const extra = await staffAs('Store Manager');
    const list = (await call('GET', '/api/admin/staff', undefined, admin.headers)).json().staff; assert.ok(list.some((s) => s.mobile === extra.mobile && s.role === 'Store Manager')); assert.ok(list.find((s) => s.mobile === ADMIN).you);
    assert.equal((await call('DELETE', '/api/admin/staff/' + extra.mobile, undefined, extra.headers)).statusCode, 403);          // a Store Manager cannot manage staff
    assert.equal((await call('DELETE', '/api/admin/staff/' + ADMIN, undefined, admin.headers)).statusCode, 400);               // not yourself
    assert.equal((await call('POST', '/api/admin/staff', { mobile: ADMIN, role: 'Store Manager' }, admin.headers)).statusCode, 400);   // not a self-demotion that leaves no owner
    assert.equal((await call('DELETE', '/api/admin/staff/' + extra.mobile, undefined, admin.headers)).statusCode, 200);
    assert.equal((await call('GET', '/api/admin/bootstrap', undefined, extra.headers)).statusCode, 403);                        // access gone at once
  });
});

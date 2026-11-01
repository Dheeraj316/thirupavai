// The Thirupavai server: static storefront + JSON API. Stateless — sessions, OTPs and rate limits live in Redis, data in PostgreSQL.
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import Fastify from 'fastify';
import fstatic from '@fastify/static';
import compress from '@fastify/compress';
import cookie from '@fastify/cookie';
import { cfg } from './config.js';
import { db, STAGES, DEFAULT_ROLES } from './db.js';
import { price } from './pricing.js';
import { sendOtp } from './sms.js';
import { gateway } from './payments.js';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const rid = (n = 9) => crypto.randomBytes(n).toString('base64url');
class HttpError extends Error { constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; } }
const bad = (msg, extra) => new HttpError(400, msg, extra);
const mobileOk = (m) => /^[6-9]\d{9}$/.test(m);
const norm = (m) => String(m || '').replace(/\D/g, '').slice(-10);
const maskMobile = (m) => { const d = String(m || '').replace(/\D/g, ''); return '+91 ' + d.slice(-10, -8) + '••• ••' + d.slice(-3); };

export async function buildApp({ kv }) {
  const app = Fastify({ logger: { level: cfg.prod ? 'warn' : 'error' }, trustProxy: cfg.trustProxy, bodyLimit: 65536, keepAliveTimeout: 65000, connectionTimeout: 30000 });
  await app.register(cookie);
  // dynamic JSON is compressed on the fly at a CPU-cheap level; the site's static files are pre-compressed at build time (scripts/build-public.js)
  await app.register(compress, { global: true, threshold: 1024, encodings: ['br', 'gzip'], brotliOptions: { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 3 } }, zlibOptions: { level: 4 } });
  // JSON bodies are parsed here so the payment webhook can keep its raw text for signature checking
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => { try { done(null, body ? (req.url.startsWith('/api/payments/webhook') ? body : JSON.parse(body)) : {}); } catch (e) { e.statusCode = 400; done(e); } });

  const limit = async (key, max, sec) => (await kv.incr(key, sec)) <= max;      // shared across all instances (OTP, tickets, tracking: the limits that guard SMS spend and abuse)
  // The coarse "too many requests from one address" guard is counted inside each instance: it costs no network round-trip per request,
  // and with N instances the real ceiling is N x the setting, which is fine for a flood guard. Window = the current minute.
  let ipMinute = 0, ipCounts = new Map();
  const ipHit = (ip) => { const m = Math.floor(Date.now() / 60000); if (m !== ipMinute) { ipMinute = m; ipCounts = new Map(); } const n = (ipCounts.get(ip) || 0) + 1; ipCounts.set(ip, n); return n <= cfg.ipLimit; };
  const tooMany = () => new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.');

  // ---------- security headers, API throttling, CSRF guard, session
  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'strict-origin-when-cross-origin').header('X-Frame-Options', 'SAMEORIGIN').header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (cfg.prod) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (!req.url.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    if (!ipHit(req.ip)) throw tooMany();
    if (req.method !== 'GET' && req.method !== 'HEAD' && !req.url.startsWith('/api/payments/webhook') && req.headers['x-tp'] !== '1') throw new HttpError(403, 'Blocked request.');
    const tok = req.cookies?.tp_sid;
    if (tok) { const raw = await kv.get('sess:' + sha(tok)); if (raw) req.user = JSON.parse(raw); }
  });
  app.setErrorHandler((err, req, reply) => {
    if (err.status) return reply.code(err.status).send({ ok: false, error: err.message, ...err.extra });
    if (err.validation || err.statusCode === 400 || err.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') return reply.code(400).send({ ok: false, error: 'Bad request.' });
    if (err.statusCode === 413) return reply.code(413).send({ ok: false, error: 'Request too large.' });
    app.log.error(err); return reply.code(500).send({ ok: false, error: 'Something went wrong on our side. Please try again.' });
  });
  const needUser = (req) => { if (!req.user) throw new HttpError(401, 'Please sign in to continue.'); return req.user; };

  // ---------- health
  app.get('/healthz', async () => ({ ok: true }));
  app.get('/readyz', async (req, reply) => { try { await db.ping(); await kv.ping(); return { ok: true }; } catch (e) { return reply.code(503).send({ ok: false }); } });
  app.get('/config.js', async (req, reply) => reply.type('application/javascript').header('Cache-Control', 'public, max-age=60').send(`window.TP_CONFIG=${JSON.stringify({ api: true, otpMode: cfg.otp.mode, paymentsMode: gateway.mode(), razorpayKeyId: gateway.mode() === 'razorpay' ? cfg.payments.razorpay.keyId : '', business: cfg.business })};`));

  // ---------- auth (mobile OTP)
  app.post('/api/auth/otp', async (req) => {
    const mobile = norm(req.body?.mobile); if (!mobileOk(mobile)) throw bad('Enter a valid 10-digit mobile number.');
    const [locked, okMobile, okIp, okDay] = await Promise.all([kv.get('otplock:' + mobile), limit('rl:otp:m:' + mobile, cfg.otp.perMobile, 600), limit('rl:otp:ip:' + req.ip, cfg.otp.perIp, 600), limit('rl:otp:day:' + new Date().toISOString().slice(0, 10), cfg.otp.dailyCap, 90000)]);
    if (locked) throw new HttpError(429, 'Too many wrong codes. Please try again in a few minutes.');
    if (!okMobile || !okIp) throw tooMany();
    if (!okDay) throw new HttpError(503, 'Sign-in by SMS is temporarily unavailable. Please try again later.');
    const code = String(crypto.randomInt(100000, 1000000));
    await Promise.all([kv.set('otp:' + mobile, sha(cfg.secret + mobile + code), cfg.otp.ttl), kv.del('otptry:' + mobile)]);
    try { await sendOtp(mobile, code); } catch (e) { app.log.error(e); throw new HttpError(502, 'We could not send the SMS right now. Please try again.'); }
    return { ok: true, ttl: cfg.otp.ttl, ...(cfg.otp.mode === 'demo' ? { demoCode: code } : {}) };
  });
  app.post('/api/auth/verify', async (req, reply) => {
    const mobile = norm(req.body?.mobile); const code = String(req.body?.code || '').replace(/\D/g, '');
    if (!mobileOk(mobile) || code.length !== 6) throw bad('Enter the 6-digit code.');
    const [locked, want] = await Promise.all([kv.get('otplock:' + mobile), kv.get('otp:' + mobile)]);
    if (locked) throw new HttpError(429, 'Too many wrong codes. Please try again in a few minutes.');
    if (!want) throw bad('That code has expired. Please request a new one.');
    const ok = crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sha(cfg.secret + mobile + code)));
    if (!ok) {
      const n = await kv.incr('otptry:' + mobile, cfg.otp.ttl);
      if (n >= cfg.otp.maxAttempts) { await kv.del('otp:' + mobile); await kv.set('otplock:' + mobile, '1', cfg.otp.lockSeconds); throw new HttpError(429, 'Too many wrong codes. Please try again in a few minutes.'); }
      throw bad(`That code is not right. ${cfg.otp.maxAttempts - n} attempt${cfg.otp.maxAttempts - n === 1 ? '' : 's'} left.`);
    }
    await Promise.all([kv.del('otp:' + mobile), kv.del('otptry:' + mobile)]);
    // a returning customer costs a read, not a write: last_login is refreshed at most once an hour
    let u = (await db.query('SELECT id, mobile, name, last_login FROM users WHERE mobile=$1', [mobile])).rows[0];
    if (!u) u = (await db.query('INSERT INTO users (mobile, last_login) VALUES ($1, now()) ON CONFLICT (mobile) DO UPDATE SET last_login = now() RETURNING id, mobile, name', [mobile])).rows[0];
    else if (!u.last_login || Date.now() - new Date(u.last_login).getTime() > 3600e3) db.query('UPDATE users SET last_login = now() WHERE id=$1', [u.id]).catch(() => {});
    const token = rid(32); const sess = { uid: u.id, mobile: u.mobile, name: u.name };
    await kv.set('sess:' + sha(token), JSON.stringify(sess), cfg.sessionDays * 86400);
    reply.setCookie('tp_sid', token, { httpOnly: true, secure: cfg.prod, sameSite: 'lax', path: '/', maxAge: cfg.sessionDays * 86400 });
    return { ok: true, user: { mobile: '+91 ' + u.mobile, name: u.name } };
  });
  app.post('/api/auth/logout', async (req, reply) => { const t = req.cookies?.tp_sid; if (t) await kv.del('sess:' + sha(t)); reply.clearCookie('tp_sid', { path: '/' }); return { ok: true }; });
  app.get('/api/session', async (req) => {
    if (!req.user) return { ok: true, user: null };
    const role = await staffRole(req.user.mobile);
    return { ok: true, user: { mobile: '+91 ' + req.user.mobile, name: req.user.name }, role };
  });
  app.patch('/api/me', async (req) => { const u = needUser(req); const name = String(req.body?.name || '').trim().slice(0, 80); await db.query('UPDATE users SET name=$2 WHERE id=$1', [u.uid, name]); await kv.set('sess:' + sha(req.cookies.tp_sid), JSON.stringify({ ...u, name }), cfg.sessionDays * 86400); return { ok: true, name }; });

  // ---------- catalogue (price / stock / visibility); everything else about a saree is static content
  let catCache = { at: 0, rows: null, ver: '' };
  const catalogRows = async () => {
    if (catCache.rows && Date.now() - catCache.at < 3000) return catCache;
    const { rows } = await db.query('SELECT id, price, stock, active, ovr FROM products ORDER BY id');
    const body = JSON.stringify(rows); catCache = { at: Date.now(), rows, ver: 'W/"' + sha(body).slice(0, 16) + '"', body }; return catCache;
  };
  const invalidateCatalog = () => { catCache.at = 0; };
  app.get('/api/catalog', async (req, reply) => {
    const c = await catalogRows();
    reply.header('Cache-Control', 'public, max-age=5, stale-while-revalidate=30').header('ETag', c.ver);
    if (req.headers['if-none-match'] === c.ver) return reply.code(304).send();
    return reply.type('application/json').send(c.body);
  });
  const catalogMap = async () => new Map((await catalogRows()).rows.map((r) => [r.id, r]));

  // ---------- checkout
  const parseCheckout = (b) => {
    const items = Array.isArray(b?.items) ? b.items.slice(0, 20).map((i) => ({ id: String(i.id || ''), qty: Number(i.qty), addons: Array.isArray(i.addons) ? i.addons.map(String) : [] })) : [];
    if (!items.length) throw bad('Your bag is empty.');
    const a = b.address || {}, c = b.customer || {};
    const address = { line: String(a.line || '').trim().slice(0, 200), city: String(a.city || '').trim().slice(0, 60), pin: String(a.pin || '').replace(/\D/g, ''), landmark: String(a.landmark || '').trim().slice(0, 100) };
    if (address.line.length < 6 || address.pin.length !== 6) throw bad('Please enter your full address and a 6-digit PIN code.');
    const name = String(c.name || '').trim().slice(0, 80); if (name.length < 2) throw bad('Please enter your full name.');
    const delivery = b.delivery === 'Express' ? 'Express' : 'Standard';
    return { items, address, customer: { name, email: String(c.email || '').trim().slice(0, 120) }, delivery, coupon: String(b.coupon || '').trim().toUpperCase().slice(0, 20), key: String(b.key || '').slice(0, 64) || rid() };
  };
  app.post('/api/checkout/intent', async (req) => {
    const u = needUser(req); const p = parseCheckout(req.body);
    const priced = price(p.items, await catalogMap(), p.delivery, p.coupon); if (priced.error) throw new HttpError(409, priced.error, { id: priced.id });
    // same bag + same key = same intent (safe to retry); a changed bag can never reuse an old, differently-priced intent
    const id = 'int_' + sha([u.uid, p.key, JSON.stringify(p.items), p.delivery, p.coupon, JSON.stringify(p.address), priced.totals.total].join('|')).slice(0, 24);
    let row = (await db.query('SELECT * FROM intents WHERE id = $1 AND user_id = $2', [id, u.uid])).rows[0];
    if (!row) {
      const created = await gateway.create({ id, amount: priced.totals.total });
      await db.query('INSERT INTO intents (id, user_id, payload, amount, gateway_ref) VALUES ($1,$2,$3::jsonb,$4,$5) ON CONFLICT (id) DO NOTHING', [id, u.uid, JSON.stringify({ ...p, mobile: u.mobile }), priced.totals.total, created.ref]);
      row = (await db.query('SELECT * FROM intents WHERE id=$1', [id])).rows[0]; row.keyId = created.keyId;
    }
    return { ok: true, intentId: id, totals: priced.totals, mode: gateway.mode(), razorpay: gateway.mode() === 'razorpay' ? { orderId: row.gateway_ref, keyId: cfg.payments.razorpay.keyId, amount: row.amount * 100 } : null, orderId: row.order_id };
  });

  // Turn a paid (or pending) intent into an order exactly once, locking the stock rows.
  async function finalize(intentId, payment) {
    return db.tx(async (t) => {
      const it = (await t.query('SELECT * FROM intents WHERE id=$1 FOR UPDATE', [intentId])).rows[0]; if (!it) throw new HttpError(404, 'Checkout session not found.');
      if (it.order_id) return (await t.query('SELECT * FROM orders WHERE id=$1', [it.order_id])).rows[0];
      const p = it.payload; const ids = [...new Set(p.items.map((i) => i.id))].sort();
      const prods = (await t.query('SELECT id, price, stock, active FROM products WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE', [ids])).rows;
      const priced = price(p.items, new Map(prods.map((r) => [r.id, r])), p.delivery, p.coupon);
      if (priced.error) { await t.query("UPDATE intents SET status='needs_refund' WHERE id=$1", [intentId]); throw new HttpError(409, priced.error + (payment.status === 'Captured' ? ' Your payment will be refunded.' : '')); }
      for (const i of priced.items) await t.query('UPDATE products SET stock = stock - $2, updated_at = now() WHERE id=$1', [i.id, i.qty]);
      const seq = (await t.query("SELECT nextval('order_seq') AS n")).rows[0].n; const id = 'TPV-' + seq; const now = Date.now();
      await t.query('INSERT INTO orders (id, key, user_id, customer, address, items, totals, delivery, payment, stage, history, coupon) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9::jsonb,0,$10::jsonb,$11)',
        [id, intentId, it.user_id, JSON.stringify({ ...p.customer, mobile: '+91 ' + p.mobile }), JSON.stringify(p.address), JSON.stringify(priced.items), JSON.stringify(priced.totals), p.delivery, JSON.stringify(payment), JSON.stringify([{ s: STAGES[0], t: now }]), priced.coupon]);
      await t.query("UPDATE intents SET status='paid', order_id=$2 WHERE id=$1", [intentId, id]);
      await t.query("INSERT INTO audit (by, action, detail) VALUES ('system','Order created',$1)", [id + ' · ' + priced.totals.total]);
      invalidateCatalog();
      return (await t.query('SELECT * FROM orders WHERE id=$1', [id])).rows[0];
    });
  }
  app.post('/api/checkout/pay', async (req) => {            // mock gateway only (staging)
    const u = needUser(req); if (gateway.mode() !== 'mock') throw new HttpError(404, 'Not available.');
    const id = String(req.body?.intentId || ''); const it = (await db.query('SELECT * FROM intents WHERE id=$1 AND user_id=$2', [id, u.uid])).rows[0]; if (!it) throw new HttpError(404, 'Checkout session not found.');
    const vpa = String(req.body?.vpa || ''); const out = gateway.mockOutcome(vpa);
    if (out === 'failed') throw new HttpError(402, 'Payment failed at the bank (test). Your bag is unchanged and you have not been charged.');
    const o = await finalize(id, { status: out === 'captured' ? 'Captured' : 'Pending', method: 'UPI', ref: 'pay_' + rid(6), test: true });
    return { ok: true, order: shape(o) };
  });
  app.post('/api/checkout/verify', async (req) => {         // Razorpay browser callback
    const u = needUser(req); const { intentId, orderId, paymentId, signature } = req.body || {};
    const it = (await db.query('SELECT * FROM intents WHERE id=$1 AND user_id=$2', [String(intentId || ''), u.uid])).rows[0]; if (!it) throw new HttpError(404, 'Checkout session not found.');
    if (it.gateway_ref !== orderId || !gateway.verifyCheckout({ orderId, paymentId: String(paymentId || ''), signature: String(signature || '') })) throw new HttpError(400, 'We could not verify this payment.');
    const o = await finalize(it.id, { status: 'Captured', method: 'Razorpay', ref: String(paymentId), test: false });
    return { ok: true, order: shape(o) };
  });
  app.post('/api/payments/webhook', { config: { rawBody: true } }, async (req, reply) => {   // Razorpay server-to-server (the safety net if the browser closes)
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body); const sig = String(req.headers['x-razorpay-signature'] || '');
    if (!gateway.verifyWebhook(raw, sig)) return reply.code(401).send({ ok: false });
    const ev = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; const pay = ev?.payload?.payment?.entity;
    if ((ev.event === 'payment.captured' || ev.event === 'order.paid') && pay?.order_id) {
      const it = (await db.query('SELECT id FROM intents WHERE gateway_ref=$1', [pay.order_id])).rows[0];
      if (it) { try { await finalize(it.id, { status: 'Captured', method: 'Razorpay', ref: pay.id, test: false }); } catch (e) { app.log.error(e); } }
    }
    return { ok: true };
  });
  // ---------- orders
  const shape = (o) => ({ id: o.id, createdAt: new Date(o.created_at).getTime(), customer: o.customer, address: o.address, items: o.items, totals: o.totals, delivery: o.delivery, payment: o.payment, stage: o.stage, history: o.history, awb: o.awb, qc: o.qc, coupon: o.coupon });
  app.get('/api/orders/mine', async (req) => { const u = needUser(req); const { rows } = await db.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [u.uid]); return { ok: true, orders: rows.map(shape) }; });
  app.get('/api/orders/:id', async (req) => {
    const u = needUser(req); const o = (await db.query('SELECT * FROM orders WHERE id=$1', [req.params.id])).rows[0]; if (!o) throw new HttpError(404, 'Order not found.');
    if (o.user_id !== u.uid) {                                // staff may open any order, but only see what their role allows
      if ((await staffLevel(u.mobile, 'orders')) === 'none') throw new HttpError(404, 'Order not found.');
      return { ok: true, order: maskOrder(shape(o), await piiLevel(u.mobile)) };
    }
    return { ok: true, order: shape(o) };
  });
  app.get('/api/track/:id', async (req) => {                // guests: order number + last 4 digits of the mobile
    if (!(await limit('rl:track:' + req.ip, 150, 600))) throw tooMany();           // mobile carriers put many customers behind one IP
    const o = (await db.query('SELECT * FROM orders WHERE id=$1', [req.params.id])).rows[0]; const m = String(req.query.m || '').replace(/\D/g, '');
    if (!o || m.length !== 4 || !String(o.customer.mobile).endsWith(m)) throw new HttpError(404, 'We could not find an order with those details.');
    const s = shape(o); s.customer = { name: String(o.customer.name).split(' ')[0], mobile: maskMobile(o.customer.mobile) }; s.address = { city: o.address.city, pin: o.address.pin, line: '' };
    return { ok: true, order: s };
  });
  const CHANNELS = ['Web form', 'Order help', 'Notify me', 'Visit request', 'Newsletter'];
  app.post('/api/tickets', async (req) => {                 // contact form, order help, back-in-stock, video-consult requests, newsletter
    if (!(await limit('rl:ticket:' + req.ip, 120, 600))) throw tooMany();
    const b = req.body || {}; const channel = CHANNELS.includes(b.channel) ? b.channel : 'Web form';
    const subject = String(b.subject || '').trim().slice(0, 120), text = String(b.message || '').trim().slice(0, 2000), name = String(b.name || '').trim().slice(0, 80);
    const raw = String(b.contact || b.mobile || '').trim(); const mobile = norm(raw), email = raw.includes('@') ? raw.slice(0, 120) : '';
    const contact = mobileOk(mobile) && !email ? mobile : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : '';
    if (!contact) throw bad('Enter a valid 10-digit mobile number or an email address.');
    if (channel === 'Web form' || channel === 'Order help') { if (!subject || text.length < 5 || (channel === 'Web form' && name.length < 2)) throw bad('Please fill in your name, contact and message.'); }
    if (!(await limit('rl:ticket:c:' + contact, 6, 3600))) throw tooMany();
    const id = 'T-' + rid(4); const uid = req.user?.uid ?? null;
    await db.query('INSERT INTO tickets (id, data) VALUES ($1,$2::jsonb)', [id, JSON.stringify({ id, subject: subject || channel, order: String(b.order || '—').slice(0, 20), channel, status: 'New', name, contact, uid, msgs: [{ from: 'cust', t: text || subject || channel, at: Date.now() }] })]);
    return { ok: true, id };
  });

  // ---------- admin (role-checked on the server; the browser only displays what it is sent)
  const rolesCache = { at: 0, m: null };
  const roleMatrix = async () => { if (rolesCache.m && Date.now() - rolesCache.at < 10000) return rolesCache.m; const r = await db.query("SELECT val FROM settings WHERE key='roles'"); rolesCache.m = r.rows[0]?.val || DEFAULT_ROLES; rolesCache.at = Date.now(); return rolesCache.m; };
  const staffCache = new Map();
  async function staffRole(mobile) {
    const c = staffCache.get(mobile); if (c && Date.now() - c.at < 10000) return c.role;
    const r = (await db.query('SELECT role FROM staff WHERE mobile=$1', [mobile])).rows[0]?.role || null; staffCache.set(mobile, { role: r, at: Date.now() }); return r;
  }
  async function staffLevel(mobile, perm) { const role = await staffRole(mobile); if (!role) return 'none'; return ((await roleMatrix())[role] || {})[perm] || 'none'; }
  const need = async (req, perm, lvl = 'view') => {
    const u = needUser(req); const l = await staffLevel(u.mobile, perm);
    if (l === 'none' || (lvl === 'full' && l !== 'full')) throw new HttpError(403, 'Your role cannot do this.');
    return { u, level: l, role: await staffRole(u.mobile) };
  };
  const piiLevel = async (mobile) => ((await roleMatrix())[await staffRole(mobile)] || {}).pii || 'none';
  const maskTicket = (t, pii) => {
    if (pii === 'full') return t; const c = String(t.contact || '');
    return { ...t, name: pii === 'mask' ? String(t.name || '').split(' ')[0] + ' •••' : '—', contact: pii === 'none' ? '—' : c.includes('@') ? '•••@' + c.split('@')[1] : maskMobile(c) };
  };
  const audit = (by, action, detail) => db.query('INSERT INTO audit (by, action, detail) VALUES ($1,$2,$3)', [by, action, String(detail).slice(0, 300)]);
  const maskOrder = (o, pii) => {
    if (pii === 'full') return o; const s = { ...o };
    if (pii === 'mask') { s.customer = { ...o.customer, mobile: maskMobile(o.customer.mobile), email: o.customer.email ? '•••@' + String(o.customer.email).split('@')[1] : '' }; s.address = { ...o.address, line: '•••••••' }; }
    else { s.customer = { name: '—', mobile: '—', email: '' }; s.address = { city: o.address.city, pin: '', line: '' }; }
    return s;
  };
  // dashboard numbers come from the database, not from the 500 orders the console lists
  async function orderStats(withMoney) {
    const [a, b, c] = await Promise.all([
      db.query(`SELECT payment->>'status' AS st, count(*)::int AS n, COALESCE(sum((totals->>'total')::bigint),0)::bigint AS amt FROM orders GROUP BY 1`),
      db.query(`SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS d, COALESCE(sum((totals->>'total')::bigint),0)::bigint AS amt FROM orders WHERE payment->>'status'='Captured' AND created_at > now() - interval '9 days' GROUP BY 1`),
      db.query(`SELECT (count(*) FILTER (WHERE stage<6))::int AS open, (count(*) FILTER (WHERE payment->>'status'='Captured' AND stage<=2))::int AS to_ship FROM orders`),
    ]);
    const count = {}, amount = {}; for (const r of a.rows) { count[r.st] = r.n; amount[r.st] = withMoney ? Number(r.amt) : 0; }
    return { total: a.rows.reduce((s, r) => s + r.n, 0), count, amount, daily: withMoney ? Object.fromEntries(b.rows.map((r) => [r.d, Number(r.amt)])) : {}, open: c.rows[0].open, toShip: c.rows[0].to_ship };
  }
  app.get('/api/admin/bootstrap', async (req) => {
    const { u, role } = await need(req, 'orders'); const m = await roleMatrix(); const pii = (m[role] || {}).pii || 'none';
    const stats = await orderStats(((m[role] || {}).payments || 'none') !== 'none');
    const [o, p, t, a] = await Promise.all([db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 500'), db.query('SELECT id, price, stock, active, ovr FROM products ORDER BY id'), db.query('SELECT data FROM tickets ORDER BY created_at DESC LIMIT 200'), db.query('SELECT extract(epoch from at)*1000 AS t, by, action, detail FROM audit ORDER BY id DESC LIMIT 80')]);
    return { ok: true, role, roles: m, stats, orders: o.rows.map((r) => maskOrder(shape(r), pii)), products: p.rows, tickets: t.rows.map((r) => maskTicket(r.data, pii)), audit: a.rows.map((r) => ({ t: Number(r.t), by: r.by, action: r.action, detail: r.detail })) };
  });
  app.post('/api/admin/orders/:id/advance', async (req) => {
    const { role, u } = await need(req, 'orders', 'full'); const o = (await db.query('SELECT * FROM orders WHERE id=$1', [req.params.id])).rows[0]; if (!o) throw new HttpError(404, 'Order not found.');
    const pii = await piiLevel(u.mobile); const out = (row) => maskOrder(shape(row), pii);
    const to = req.body?.to == null ? Math.min(6, o.stage + 1) : Number(req.body.to); if (!(to > o.stage && to <= 6)) return { ok: true, order: out(o) };
    if (o.payment.status === 'Pending' && to >= 1) throw bad('Payment is still pending for this order.');
    if (o.stage === 2 && to >= 3 && (o.qc || []).length < 5) throw bad('Complete the packing checklist before creating the shipment.');
    const hist = [...o.history]; for (let i = o.stage + 1; i <= to; i++) hist.push({ s: STAGES[i], t: Date.now() });
    const awb = o.awb || (to >= 3 ? String(req.body?.awb || '').trim().slice(0, 40) || 'AWB-' + o.id.slice(4) : null);
    await db.query('UPDATE orders SET stage=$2, history=$3::jsonb, awb=$4 WHERE id=$1', [o.id, to, JSON.stringify(hist), awb]); await audit(role, 'Status → ' + STAGES[to], o.id);
    return { ok: true, order: out((await db.query('SELECT * FROM orders WHERE id=$1', [o.id])).rows[0]) };
  });
  app.post('/api/admin/orders/:id/confirm-payment', async (req) => {   // staging only: stands in for the gateway callback on a "pending" test payment
    if (gateway.mode() !== 'mock') throw new HttpError(404, 'Not available.');
    const { role } = await need(req, 'payments', 'full'); const o = (await db.query('SELECT * FROM orders WHERE id=$1', [req.params.id])).rows[0]; if (!o) throw new HttpError(404, 'Order not found.');
    if (o.payment.status === 'Pending') { await db.query('UPDATE orders SET payment = payment || $2::jsonb WHERE id=$1', [o.id, JSON.stringify({ status: 'Captured' })]); await audit(role, 'Payment confirmed (test callback)', o.id); }
    return { ok: true };
  });
  app.patch('/api/admin/orders/:id', async (req) => {
    // each kind of change is checked against its own permission (a Finance Manager can refund without being able to pack orders)
    const b = req.body || {}; const wantsQc = Array.isArray(b.qc); const wantsRefund = !!b.payment && ['Refunded', 'Refund requested'].includes(b.payment.status);
    if (!wantsQc && !wantsRefund) throw bad('Nothing to change.');
    const qcBy = wantsQc ? (await need(req, 'orders', 'full')).role : null; const refundBy = wantsRefund ? (await need(req, 'refunds', 'full')).role : null;
    const o = (await db.query('SELECT * FROM orders WHERE id=$1', [req.params.id])).rows[0]; if (!o) throw new HttpError(404, 'Order not found.');
    if (wantsQc) await db.query('UPDATE orders SET qc=$2::jsonb WHERE id=$1', [o.id, JSON.stringify([...new Set(b.qc.map(Number).filter((n) => n >= 0 && n < 5))])]);
    if (wantsRefund && b.payment.status === 'Refunded') {
      // claim the refund atomically so two clicks can never send the money back twice, then ask the gateway to do it
      const claim = await db.query(`UPDATE orders SET payment = payment || '{"status":"Refunding"}'::jsonb WHERE id=$1 AND payment->>'status'='Captured' RETURNING payment`, [o.id]);
      if (!claim.rows[0]) throw bad('Only a captured payment can be refunded, and only once.');
      try {
        const rf = await gateway.refund(o.payment.ref, o.totals.total, 'Refund for ' + o.id);
        await db.query('UPDATE orders SET payment = payment || $2::jsonb WHERE id=$1', [o.id, JSON.stringify({ status: 'Refunded', refund: rf.id })]);
        await audit(refundBy, 'Refund', `${o.id} · ₹${o.totals.total} · ${rf.id}`);
      } catch (e) {
        await db.query(`UPDATE orders SET payment = payment || '{"status":"Captured"}'::jsonb WHERE id=$1`, [o.id]); app.log.error(e);
        throw new HttpError(502, 'The payment provider did not accept the refund, so nothing was changed. Please try again, or refund from the Razorpay dashboard.');
      }
    } else if (wantsRefund) {
      await db.query(`UPDATE orders SET payment = payment || '{"status":"Refund requested"}'::jsonb WHERE id=$1 AND payment->>'status'='Captured'`, [o.id]); await audit(refundBy, 'Refund requested', o.id);
    }
    if (wantsQc) await audit(qcBy, 'Packing checklist', o.id);
    return { ok: true };
  });
  app.patch('/api/admin/products/:id', async (req) => {
    const { role } = await need(req, 'catalogue', 'full'); const b = req.body || {}; const id = req.params.id;
    const cur = (await db.query('SELECT * FROM products WHERE id=$1', [id])).rows[0]; if (!cur) throw new HttpError(404, 'Product not found.');
    const priceV = b.price == null ? cur.price : Math.round(Number(b.price)), stockV = b.stock == null ? cur.stock : Math.round(Number(b.stock));
    if (!(priceV >= 100 && priceV <= 5000000) || !(stockV >= 0 && stockV <= 100000)) throw bad('Check the price and stock values.');
    const ovr = { ...cur.ovr }; for (const k of ['name', 'desc', 'alt', 'tag']) if (typeof b[k] === 'string') ovr[k] = b[k].slice(0, 600);
    if (Array.isArray(b.gallery)) {                          // image order + alt text; only paths already inside the site's own assets are accepted
      const g = b.gallery.slice(0, 12).filter((x) => x && /^assets\/[\w./-]{1,120}$/.test(String(x.img)) && !String(x.img).includes('..'));
      if (g.length) ovr.gallery = g.map((x) => ({ img: String(x.img), pos: String(x.pos || '50% 50%').replace(/[^\d%. -]/g, '').slice(0, 24), label: String(x.label || '').slice(0, 40), alt: String(x.alt || '').slice(0, 200) }));
    }
    await db.query('UPDATE products SET price=$2, stock=$3, active=$4, ovr=$5::jsonb, updated_at=now() WHERE id=$1', [id, priceV, stockV, b.active == null ? cur.active : !!b.active, JSON.stringify(ovr)]);
    invalidateCatalog(); await audit(role, b.what || 'Product edited', cur.sku); return { ok: true };
  });
  app.put('/api/admin/roles', async (req) => {
    const { role } = await need(req, 'roles', 'full'); const m = req.body?.matrix; if (!m || typeof m !== 'object') throw bad('Invalid role table.');
    const clean = {}; for (const r of Object.keys(DEFAULT_ROLES)) { clean[r] = {}; for (const p of Object.keys(DEFAULT_ROLES['Super Admin'])) { const v = (m[r] || {})[p]; clean[r][p] = ['none', 'view', 'mask', 'full'].includes(v) ? v : DEFAULT_ROLES[r][p]; } }
    clean['Super Admin'] = DEFAULT_ROLES['Super Admin'];           // locked: nobody can lock the owner out
    await db.query("INSERT INTO settings (key, val) VALUES ('roles',$1::jsonb) ON CONFLICT (key) DO UPDATE SET val=EXCLUDED.val", [JSON.stringify(clean)]); rolesCache.at = 0; await audit(role, 'Role permissions edited', ''); return { ok: true };
  });
  app.post('/api/admin/staff', async (req) => {
    const { role } = await need(req, 'roles', 'full'); const mobile = norm(req.body?.mobile); const r = String(req.body?.role || '');
    if (!mobileOk(mobile) || !DEFAULT_ROLES[r]) throw bad('Enter a valid mobile number and role.');
    const was = (await db.query('SELECT role FROM staff WHERE mobile=$1', [mobile])).rows[0];
    if (was?.role === 'Super Admin' && r !== 'Super Admin' && (await db.query("SELECT count(*)::int AS c FROM staff WHERE role='Super Admin'")).rows[0].c <= 1) throw bad('There must always be at least one Super Admin.');
    await db.query('INSERT INTO staff (mobile, role) VALUES ($1,$2) ON CONFLICT (mobile) DO UPDATE SET role=EXCLUDED.role', [mobile, r]); staffCache.delete(mobile); await audit(role, 'Staff access', mobile.slice(0, 2) + '••••••' + mobile.slice(-2) + ' → ' + r); return { ok: true };
  });
  app.post('/api/admin/tickets/:id/reply', async (req) => {
    const { role } = await need(req, 'support', 'full'); const text = String(req.body?.text || '').trim().slice(0, 2000); if (!text) throw bad('Write a reply first.');
    const t = (await db.query('SELECT data FROM tickets WHERE id=$1', [req.params.id])).rows[0]; if (!t) throw new HttpError(404, 'Ticket not found.');
    const d = t.data; d.msgs.push({ from: 'us', t: text, at: Date.now() }); d.status = 'Answered'; await db.query('UPDATE tickets SET data=$2::jsonb WHERE id=$1', [req.params.id, JSON.stringify(d)]); await audit(role, 'Support reply sent', req.params.id); return { ok: true };
  });
  app.post('/api/admin/tickets/:id/resolve', async (req) => {
    const { role } = await need(req, 'support', 'full'); const t = (await db.query('SELECT data FROM tickets WHERE id=$1', [req.params.id])).rows[0]; if (!t) throw new HttpError(404, 'Ticket not found.');
    const d = t.data; d.status = 'Resolved'; await db.query('UPDATE tickets SET data=$2::jsonb WHERE id=$1', [req.params.id, JSON.stringify(d)]); await audit(role, 'Ticket resolved', req.params.id); return { ok: true };
  });
  // who has staff access (mobile numbers are masked unless the viewer's role may see customer data)
  app.get('/api/admin/staff', async (req) => {
    const { u } = await need(req, 'roles'); const full = (await piiLevel(u.mobile)) === 'full';
    const rows = (await db.query('SELECT mobile, role FROM staff ORDER BY created_at')).rows;
    return { ok: true, staff: rows.map((r) => ({ mobile: r.mobile, shown: full ? '+91 ' + r.mobile : maskMobile(r.mobile), role: r.role, you: r.mobile === u.mobile })) };
  });
  app.delete('/api/admin/staff/:mobile', async (req) => {
    const { role, u } = await need(req, 'roles', 'full'); const mobile = norm(req.params.mobile);
    if (mobile === u.mobile) throw bad('You cannot remove your own access.');
    const r = (await db.query('SELECT role FROM staff WHERE mobile=$1', [mobile])).rows[0]; if (!r) throw new HttpError(404, 'That person is not on the staff list.');
    if (r.role === 'Super Admin' && (await db.query("SELECT count(*)::int AS c FROM staff WHERE role='Super Admin'")).rows[0].c <= 1) throw bad('There must always be at least one Super Admin.');
    await db.query('DELETE FROM staff WHERE mobile=$1', [mobile]); staffCache.delete(mobile); await audit(role, 'Staff access removed', mobile.slice(0, 2) + '••••••' + mobile.slice(-2)); return { ok: true };
  });

  // ---------- the storefront itself
  await app.register(fstatic, {
    root: cfg.staticDir, index: false, wildcard: false, etag: true, lastModified: true, preCompressed: true,
    setHeaders(reply, file) {   // @fastify/static v8+ hands us the Fastify reply, not the raw response
      const p = String(file).replace(/.(br|gz)$/, '');     // judge the file by its real name, not its pre-compressed twin
      if (/\.(webp|jpe?g|png|woff2|svg|ico)$/i.test(p) || /[\\/]vendor[\\/]/.test(p)) reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      else if (/\.(js|css)$/i.test(p)) reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
      else reply.header('Cache-Control', 'no-cache');
    },
  });
  app.get('/', (req, reply) => reply.sendFile('index.html'));        // the plugin's own directory-index lookup does not cope with pre-compressed files
  app.setNotFoundHandler((req, reply) => (req.url.startsWith('/api/') ? reply.code(404).send({ ok: false, error: 'Not found.' }) : reply.code(404).type('text/plain').send('Not found')));
  return app;
}

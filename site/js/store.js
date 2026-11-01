// Tiny reactive store. Offline (the demo) it is backed by localStorage with sample data. When the real server is present
// (js/api.js ONLINE) the bag/wishlist/address stay in the browser and everything else — session, catalogue, orders,
// admin data — is fetched from, and written through, the server.
import { PRODUCTS, byId } from './data.js';
import { ONLINE, MODE, api, ApiError, notifyError } from './api.js';

const KEY = ONLINE ? 'tpv-live-v1' : 'tpv-proto-v1';
const LOCAL = ['cart', 'wish', 'addr', 'pin', 'coupon', 'recent', 'introSeen'];   // the only parts a browser may keep when online
const pick = (o) => Object.fromEntries(LOCAL.filter((k) => o && k in o).map((k) => [k, o[k]]));
export const STAGES = ['Confirmed', 'Processing', 'Packed', 'Dispatched', 'In transit', 'Out for delivery', 'Delivered'];
const listeners = new Set();

const seedOrders = () => {
  const mk = (n, name, city, pin, items, stage, hoursAgo, pay = 'Captured', method = 'UPI') => {
    const sub = items.reduce((s, [id, q]) => s + byId(id).price * q, 0);
    return { id: 'TPV-DEMO-' + String(n).padStart(4, '0'), createdAt: Date.now() - hoursAgo * 3600e3, customer: { name, mobile: '+91 90000 0' + String(1000 + n), email: '' }, address: { line: 'Sample Street ' + n, city, pin }, items: items.map(([id, q]) => ({ id, qty: q, price: byId(id).price })),
      totals: { sub, discount: 0, delivery: 0, total: sub }, delivery: 'Standard', payment: { status: pay, method, ref: 'pay_Demo' + String(n).padStart(2, '0'), test: true }, stage, history: STAGES.slice(0, stage + 1).map((s, i) => ({ s, t: Date.now() - (hoursAgo - i * 5) * 3600e3 })), awb: stage >= 3 ? 'TPV-SAMPLE-' + String(n).padStart(4, '0') : null, qc: [], seed: true };
  };
  return [mk(1, 'Demo Customer', 'Chennai', '600004', [['p1', 1], ['p2', 1]], 4, 60), mk(2, 'Sample Buyer', 'Madurai', '625001', [['p2', 1]], 2, 20), mk(3, 'Test Account', 'Coimbatore', '641001', [['p5', 1]], 0, 5, 'Pending', 'Netbanking'), mk(4, 'Demo Bride', 'Bengaluru', '560001', [['p3', 2], ['p7', 1]], 1, 9), mk(5, 'Trial User', 'Hyderabad', '500001', [['p6', 1]], 5, 80)];
};
const blank = () => (ONLINE
  ? { cart: [], wish: [], orders: [], user: null, coupon: null, overrides: {}, role: null, roles: null, audit: [], tickets: [], seq: 0, introSeen: false, recent: [] }
  : { cart: [], wish: [], orders: seedOrders(), user: null, coupon: null, overrides: {}, role: 'Super Admin', roles: null, audit: [], tickets: seedTickets(), seq: 5, introSeen: false, recent: [] });
const seedTickets = () => [{ id: 'T-1', subject: 'Where is my order?', order: 'TPV-DEMO-0001', channel: 'WhatsApp', status: 'Open', msgs: [{ from: 'cust', t: 'Hi, when will my sarees arrive?' }] }, { id: 'T-2', subject: 'Blouse stitching question', order: 'TPV-DEMO-0002', channel: 'Email', status: 'Waiting', msgs: [{ from: 'cust', t: 'Can the blouse piece be stitched with a boat neck?' }] }];

let S;
try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { S = null; }
if (!S || typeof S !== 'object') S = blank();
S = ONLINE ? { ...blank(), ...pick(S) } : { ...blank(), ...S };

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ONLINE ? pick(S) : S)); } catch { /* private mode */ } };
const emit = (what) => { save(); listeners.forEach((f) => f(what)); };
// keep other open tabs in sync (e.g. shop in one tab, admin in another)
addEventListener('storage', (e) => { if (e.key !== KEY || !e.newValue) return; try { const n = JSON.parse(e.newValue); S = ONLINE ? { ...S, ...pick(n) } : { ...blank(), ...n }; listeners.forEach((f) => f('sync')); } catch { /* ignore */ } });
export const state = () => S;
export const subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const reset = () => { try { localStorage.removeItem(KEY); } catch {} S = blank(); emit('reset'); };

// product helpers (admin overrides are layered on the seed catalogue)
// the shop (staging/live) never shows the prototype's placeholder wording
const SAMPLE_COPY = /\s*Sample (?:product )?copy(?: \(placeholder styling image\))?(?: — final description will use verified product details)?\.?/g;
const shopCopy = (p) => (MODE === 'demo' ? p : { ...p, desc: String(p.desc || '').replace(SAMPLE_COPY, '').trim(), returns: String(p.returns || '').replace(/\s*\(sample\)/g, '') });
export const prod = (id) => { const b = byId(id); if (!b) return null; const o = S.overrides[id]; return shopCopy(o ? { ...b, ...o } : b); };
export const allProducts = () => PRODUCTS.map((p) => prod(p.id));                 // admin sees everything
export const products = () => allProducts().filter((p) => p.active !== false);   // storefront hides unpublished pieces
export const stockOf = (id) => prod(id).stock;

// ---- bag
const reserved = () => new Set(S.cart.map((c) => c.id));
export const cart = {
  add(id, qty = 1, opts = {}) {
    const p = prod(id); if (!p || p.stock < 1) return { ok: false, msg: 'This piece is sold out.' };
    const ex = S.cart.find((c) => c.id === id);
    const max = p.stock; if (ex) { if (ex.qty >= max) { if ((opts.addons || []).length) { ex.addons = [...new Set([...(ex.addons || []), ...opts.addons])]; emit('cart'); return { ok: true }; } return { ok: false, msg: `Only ${max} available — already in your bag.` }; } ex.qty = Math.min(max, ex.qty + qty); ex.addons = [...new Set([...(ex.addons || []), ...(opts.addons || [])])]; } else S.cart.push({ id, qty: Math.min(max, qty), addons: opts.addons || [] });
    emit('cart'); return { ok: true };
  },
  setQty(id, q) { const c = S.cart.find((x) => x.id === id); if (!c) return; const p = prod(id); c.qty = Math.max(0, Math.min(p.stock, q)); if (!c.qty) S.cart = S.cart.filter((x) => x.id !== id); emit('cart'); },
  remove(id) { S.cart = S.cart.filter((x) => x.id !== id); emit('cart'); },
  clear() { S.cart = []; S.coupon = null; emit('cart'); },
  count: () => S.cart.reduce((s, c) => s + c.qty, 0),
};
const D = MODE === 'demo' ? ' (demo)' : '';
export const COUPONS = { FESTIVE5: { pct: 5, label: 'FESTIVE5 — 5% off' + D }, WELCOME10: { pct: 10, min: 25000, label: 'WELCOME10 — 10% off orders above ₹ 25,000' + D } };   // the server holds the same table and is the one that charges
export const ADDONS = { fall: ['Fall & pico', 450], blouse: ['Blouse stitching', 1800], gift: ['Gift wrap + message card', 250] };
export function totals(shipping = 'Standard') {
  const lines = S.cart.map((c) => { const p = prod(c.id); const add = (c.addons || []).reduce((s, k) => s + (ADDONS[k] ? ADDONS[k][1] : 0), 0); return { ...c, p, unit: p.price, add, line: p.price * c.qty + add }; });
  const sub = lines.reduce((s, l) => s + l.line, 0);
  const cp = S.coupon && COUPONS[S.coupon]; let discount = 0, couponMsg = '';
  if (cp) { if (cp.min && sub < cp.min) couponMsg = `Needs a bag above ₹ ${cp.min.toLocaleString('en-IN')}`; else discount = Math.round(sub * cp.pct / 100); }
  const delivery = shipping === 'Express' ? 350 : 0;
  return { lines, sub, discount, delivery, total: sub - discount + delivery, couponMsg };
}
export const coupon = { apply(code) { code = String(code || '').trim().toUpperCase(); if (!COUPONS[code]) return { ok: false, msg: MODE === 'demo' ? 'That code is not valid in the demo.' : 'That code is not valid.' }; S.coupon = code; emit('cart'); return { ok: true, msg: COUPONS[code].label }; }, clear() { S.coupon = null; emit('cart'); } };

// ---- wishlist / recents / user
export const wish = { has: (id) => S.wish.includes(id), toggle(id) { S.wish = S.wish.includes(id) ? S.wish.filter((x) => x !== id) : [...S.wish, id]; emit('wish'); return S.wish.includes(id); } };
export const recent = (id) => { S.recent = [id, ...S.recent.filter((x) => x !== id)].slice(0, 6); save(); };
const digits = (m) => String(m || '').replace(/\D/g, '').slice(-10);
const setUser = (u, role) => { S.user = u ? { mobile: digits(u.mobile), name: u.name || '' } : null; S.role = role || null; };
const fail = (e) => { if (e instanceof ApiError && e.status === 401 && S.user) { setUser(null); S.orders = []; emit('auth'); } notifyError(e); };
export const auth = {
  login(mobile) { S.user = { mobile, name: 'Demo Customer' }; emit('auth'); },             // offline demo only
  sendOtp: (mobile) => api('POST', '/api/auth/otp', { mobile }),                          // → { ttl, demoCode? } (demoCode only on a staging server)
  async verifyOtp(mobile, code) {
    await api('POST', '/api/auth/verify', { mobile, code });
    const s = await api('GET', '/api/session'); setUser(s.user, s.role); emit('auth');
    loadMyOrders().catch(() => {});
  },
  async logout() {
    if (ONLINE) { try { await api('POST', '/api/auth/logout', {}); } catch { /* the cookie is cleared locally either way */ } S.orders = []; S.tickets = []; S.audit = []; S.roles = null; S.role = null; refreshCatalog().catch(() => {}); }
    S.user = null; emit('auth');
  },
};

// ---- orders (checkout writes, admin and tracking read — one source of truth)
export function placeOrder({ key, customer, address, delivery, payment }) {
  if (key) { const dup = S.orders.find((o) => o.key === key); if (dup) return dup; }   // idempotent: a repeated submit/callback never creates a second order
  const t = totals(delivery); S.seq += 1;
  const items = t.lines.map((l) => ({ id: l.id, qty: l.qty, price: l.unit, addons: l.addons }));
  // reduce stock server-side style: one-of-one pieces become sold out
  items.forEach((i) => { const p = prod(i.id); S.overrides[i.id] = { ...(S.overrides[i.id] || {}), stock: Math.max(0, p.stock - i.qty) }; });
  const o = { key, id: 'TPV-DEMO-' + String(S.seq).padStart(4, '0'), createdAt: Date.now(), customer, address, items, totals: { sub: t.sub, discount: t.discount, delivery: t.delivery, total: t.total }, delivery, payment, stage: 0, history: [{ s: STAGES[0], t: Date.now() }], awb: null, qc: [], coupon: S.coupon };
  S.orders.unshift(o); S.cart = []; S.coupon = null; log('Order created', o.id + ' · ' + t.total); emit('orders'); return o;
}
export const order = (id) => S.orders.find((o) => o.id === id);
export function advance(id, to) {
  if (ONLINE) return serverAct(() => api('POST', `/api/admin/orders/${encodeURIComponent(id)}/advance`, to == null ? {} : { to }).then((r) => upsertOrder(r.order)), false);
  const o = order(id); if (!o) return; const target = to == null ? Math.min(6, o.stage + 1) : to; if (target <= o.stage) return;
  for (let i = o.stage + 1; i <= target; i++) o.history.push({ s: STAGES[i], t: Date.now() });
  o.stage = target; if (target >= 3 && !o.awb) o.awb = 'TPV-SAMPLE-' + o.id.slice(-4); log('Status → ' + STAGES[target], o.id); emit('orders');
}
export function setOrder(id, patch) {
  const o = order(id); if (!o) return;
  if (!ONLINE) { Object.assign(o, patch); emit('orders'); return; }
  const body = {}; if (Array.isArray(patch.qc)) body.qc = patch.qc; if (patch.payment && ['Refunded', 'Refund requested'].includes(patch.payment.status)) body.payment = { status: patch.payment.status };
  if (!Object.keys(body).length) { emit('orders'); return; }
  if (body.qc) { o.qc = body.qc; emit('orders'); }                                                         // tick-boxes respond at once; the server has the final say
  return serverAct(() => api('PATCH', `/api/admin/orders/${encodeURIComponent(id)}`, body));
}
export function setProduct(id, patch, what) {
  if (!ONLINE) { S.overrides[id] = { ...(S.overrides[id] || {}), ...patch }; log(what || 'Product edited', prod(id).sku); emit('products'); return; }
  S.overrides[id] = { ...(S.overrides[id] || {}), ...patch }; emit('products');                           // optimistic; replaced by the server's copy below
  return serverAct(() => api('PATCH', `/api/admin/products/${encodeURIComponent(id)}`, { price: patch.price, stock: patch.stock, active: patch.active, desc: patch.desc, gallery: patch.gallery, what }));
}
export function log(action, detail) { if (ONLINE) return; S.audit.unshift({ t: Date.now(), by: S.role, action, detail }); S.audit = S.audit.slice(0, 80); save(); }   // online, the server writes the audit trail
export const setRole = (r) => { if (ONLINE) return; S.role = r; emit('role'); };
export const setRoles = (m) => {
  if (!ONLINE) { S.roles = m; emit('roles'); return; }
  return serverAct(() => api('PUT', '/api/admin/roles', { matrix: m || {} }));
};

// ---- support tickets (customer side creates, staff side answers)
export async function createTicket({ subject, order: ord, channel = 'Web form', message, name, contact }) {
  if (ONLINE) { const r = await api('POST', '/api/tickets', { subject, order: ord, channel, message, name, contact }); return r.id; }
  const id = 'T-' + (S.tickets.length + 1); S.tickets.unshift({ id, subject: String(subject || channel).slice(0, 60), order: ord || '—', channel, status: 'New', msgs: [{ from: 'cust', t: message || subject }] });
  log('Ticket created', id); emit('tickets'); return id;
}
export function replyTicket(id, text) {
  if (ONLINE) return serverAct(() => api('POST', `/api/admin/tickets/${encodeURIComponent(id)}/reply`, { text }));
  const t = S.tickets.find((x) => x.id === id); t.msgs.push({ from: 'us', t: text }); t.status = 'Answered'; log('Support reply sent', id); emit('tickets');
}
export function resolveTicket(id) {
  if (ONLINE) return serverAct(() => api('POST', `/api/admin/tickets/${encodeURIComponent(id)}/resolve`, {}));
  const t = S.tickets.find((x) => x.id === id); t.status = 'Resolved'; log('Ticket resolved', id); emit('tickets');
}
export const confirmPayment = (id) => serverAct(() => api('POST', `/api/admin/orders/${encodeURIComponent(id)}/confirm-payment`, {}));   // staging only

// ---- server sync (online only)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const upsertOrder = (o) => { const i = S.orders.findIndex((x) => x.id === o.id); if (i >= 0) { if (same(S.orders[i], o)) return false; S.orders[i] = o; } else S.orders.unshift(o); emit('orders'); return true; };
/** run a server write; on any failure tell the user and re-read the truth from the server so the screen never lies */
async function serverAct(fn, reload = true) {
  try { await fn(); } catch (e) { fail(e); reload = true; }
  if (reload && S.role) await loadAdmin().catch(() => {});
}
const catalogToOverrides = (rows) => Object.fromEntries(rows.map((r) => [r.id, { price: r.price, stock: r.stock, active: r.active, ...(r.ovr || {}) }]));
let catalogAt = 0;
/** called on every page open: refreshes price/stock/visibility unless that was done in the last few seconds */
export async function ensureFresh(maxAgeMs = 5000) { if (ONLINE && Date.now() - catalogAt > maxAgeMs) await refreshCatalog(); }
export async function refreshCatalog() {
  if (!ONLINE) return;
  const rows = await api('GET', '/api/catalog', undefined, { cache: 'no-cache' }); const next = catalogToOverrides(rows); catalogAt = Date.now();   // always revalidate (a 304 is cheap): stock must never be a few seconds stale at the moment of paying
  if (!same(S.overrides, next)) { S.overrides = next; emit('products'); }
}
export async function loadMyOrders() {
  if (!ONLINE || !S.user) return;
  const r = await api('GET', '/api/orders/mine'); if (!same(S.orders, r.orders)) { S.orders = r.orders; emit('orders'); }
}
/** one order for the order page; null if it is not the signed-in customer's (or does not exist) */
export async function fetchOrder(id) {
  if (!ONLINE) return order(id) || null;
  try { const r = await api('GET', `/api/orders/${encodeURIComponent(id)}`); upsertOrder(r.order); return r.order; }
  catch (e) { if (e instanceof ApiError && (e.status === 404 || e.status === 401)) return null; throw e; }
}
/** guest tracking: order number + last four digits of the mobile */
export async function trackGuest(id, last4) {
  const r = await api('GET', `/api/track/${encodeURIComponent(id)}?m=${encodeURIComponent(last4)}`); upsertOrder(r.order); return r.order;
}
/** put a freshly paid order in the store and empty the bag */
export function adoptOrder(o) { upsertOrder(o); S.cart = []; S.coupon = null; emit('cart'); }
export async function loadAdmin() {
  const r = await api('GET', '/api/admin/bootstrap');
  S.stats = r.stats; S.role = r.role; S.roles = r.roles; S.orders = r.orders; S.tickets = r.tickets; S.audit = r.audit; S.overrides = catalogToOverrides(r.products); emit('admin');
}
/** first paint: who is signed in, and today's price / stock / visibility */
export async function bootOnline() {
  if (!ONLINE) return;
  const quiet = (p) => p.catch(() => {});
  await Promise.race([Promise.all([quiet(api('GET', '/api/session').then((s) => { setUser(s.user, s.role); })), quiet(refreshCatalog())]), new Promise((r) => setTimeout(r, 5000))]);
  if (S.user) quiet(loadMyOrders());
  setInterval(() => { if (!document.hidden) refreshCatalog().catch(() => {}); }, 60000);                     // prices and stock stay fresh; the server answers 304 when nothing changed
  addEventListener('visibilitychange', () => { if (!document.hidden) refreshCatalog().catch(() => {}); });
}
export const isStaff = () => !!S.role;
export const markIntro = () => { S.introSeen = true; save(); };
export { emit as _emit };

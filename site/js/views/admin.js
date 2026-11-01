// Admin console — shares one store with the shop, so shop orders appear here and status changes show up on the customer's tracking page.
import { state, subscribe, allProducts, prod, order, advance, setOrder, setProduct, setRole, setRoles, log, STAGES, ADDONS, _emit, replyTicket, resolveTicket, confirmPayment, loadAdmin } from '../store.js';
import { ONLINE, T, api, ApiError, notifyError } from '../api.js';
import { signIn } from './misc.js';
import { inr, byId } from '../data.js';
import { h, $, $$, ic, img, toast, esc, money, when, openLayer, closeAll } from '../ui.js';

export const ROLE_LIST = ['Super Admin', 'Store Manager', 'Product Manager', 'Order Manager', 'Customer Support', 'Finance Manager', 'Read-only Auditor'];
const PERMS = [['catalogue', 'Catalogue & prices'], ['orders', 'Orders & dispatch'], ['payments', 'Payments'], ['refunds', 'Refunds'], ['pii', 'Customer data'], ['support', 'Support'], ['audit', 'Audit log'], ['roles', 'Roles']];
const DEFAULTS = {
  'Super Admin': { catalogue: 'full', orders: 'full', payments: 'full', refunds: 'full', pii: 'full', support: 'full', audit: 'full', roles: 'full' },
  'Store Manager': { catalogue: 'full', orders: 'full', payments: 'view', refunds: 'full', pii: 'mask', support: 'full', audit: 'view', roles: 'none' },
  'Product Manager': { catalogue: 'full', orders: 'none', payments: 'none', refunds: 'none', pii: 'none', support: 'none', audit: 'none', roles: 'none' },
  'Order Manager': { catalogue: 'view', orders: 'full', payments: 'view', refunds: 'none', pii: 'mask', support: 'view', audit: 'none', roles: 'none' },
  'Customer Support': { catalogue: 'view', orders: 'view', payments: 'none', refunds: 'none', pii: 'mask', support: 'full', audit: 'none', roles: 'none' },
  'Finance Manager': { catalogue: 'none', orders: 'view', payments: 'full', refunds: 'full', pii: 'mask', support: 'none', audit: 'view', roles: 'none' },
  'Read-only Auditor': { catalogue: 'view', orders: 'view', payments: 'view', refunds: 'view', pii: 'mask', support: 'view', audit: 'view', roles: 'view' },
};
const matrix = () => state().roles || DEFAULTS;
const lvl = (perm) => (matrix()[state().role] || {})[perm] || 'none';
const can = (perm, need = 'view') => { const l = lvl(perm); return need === 'full' ? l === 'full' : l !== 'none'; };
const maskM = (m) => { const d = String(m).replace(/\D/g, ''); return '+91 ' + d.slice(-10, -8) + '••• ••' + d.slice(-3); };
const pii = (v, kind = 'text') => { const l = lvl('pii'); if (l === 'full') return esc(v); if (l === 'none') return '—'; return kind === 'mobile' ? (ONLINE ? esc(v) : maskM(v)) : kind === 'name' ? esc(String(v).split(' ')[0]) + ' •••' : '••••••'; };
const SECTIONS = [['dashboard', 'Dashboard', 'chart', null], ['orders', 'Orders', 'receipt', 'orders'], ['products', 'Products', 'hanger', 'catalogue'], ['payments', 'Payments', 'card', 'payments'], ['support', 'Support', 'chat', 'support'], ['roles', 'Roles & security', 'shield', 'roles']];
const COLS = [['Confirmed', [0]], ['Processing', [1]], ['Packed', [2]], ['With courier', [3, 4, 5]], ['Delivered', [6]]];
const QC = ['Weave and zari inspected', 'Colour matches the product photo', 'Fall & pico stitched (if ordered)', 'Packed in tissue and silk bag', 'Unboxing video recorded'];
const cap = (o) => o.payment.status === 'Captured';
const pillFor = (st) => ({ Captured: 'ok', Pending: 'warn', Failed: 'err', Refunded: 'info' }[st] || 'mute');

// Online, the console is for signed-in staff only; what they may see is decided by the server, never by this page.
async function staffGate(root) {
  const note = (title, body, btn = '') => { root.innerHTML = `<div class="wrap" style="max-width:640px;padding:90px var(--pad)"><h1 class="serif">${title}</h1><p class="muted" style="margin:10px 0 20px">${body}</p>${btn}</div>`; };
  if (!state().user) {
    note('Staff sign-in', 'Sign in with your staff mobile number to open the admin console.', '<button class="btn btn-dark" id="adsi">Sign in</button>');
    $('#adsi', root).onclick = signIn;
    const off = subscribe((w) => { if (w === 'auth' && state().user) { off(); dispatchEvent(new HashChangeEvent('hashchange')); } });
    return { ok: false, cleanup: off };
  }
  try { await loadAdmin(); return { ok: true }; }
  catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 401)) note('No access', 'This mobile number is not on the staff list for the admin console. Ask a Super Admin to add you.', '<a class="btn btn-dark" href="#/">Back to the shop</a>');
    else note('Could not load the console', e.message, '<button class="btn btn-dark" onclick="location.reload()">Try again</button>');
    return { ok: false };
  }
}

export default async function admin(root, route) {
  if (ONLINE) { const g = await staffGate(root); if (!g.ok) return g.cleanup; }
  const section = route.args[0] || 'dashboard'; let drawer = null, drawerFn = null;
  root.innerHTML = `<div class="adm"><aside class="adm-side" aria-label="Admin navigation"><div class="brand">THIRUPAVAI</div><small>ADMIN CONSOLE</small>${SECTIONS.map(([k, n, i, p]) => `<a href="#/admin/${k}" ${k === section ? 'aria-current="page"' : ''} class="${p && !can(p) ? 'lock' : ''}">${ic(i, 20)}${n}</a>`).join('')}<a href="#/" style="margin-top:20px">${ic('home', 20)} View storefront</a></aside>
    <div class="adm-main"><div class="adm-top"><h1 class="serif" id="atitle"></h1><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${ONLINE ? `<span class="muted" style="font-size:14.5px">+91 ${esc(state().user?.mobile || '')}</span><span class="pill ok">${ic('key', 14)} ${esc(state().role || '')}</span>` : `<span class="pill gd">SAMPLE DATA</span><label style="display:flex;gap:8px;align-items:center;border:1px solid rgba(235,211,153,.35);background:rgba(255,255,255,.06);height:42px;padding:0 12px;font-size:14.5px">${ic('key', 16)}<span class="muted">Role</span><select id="role" aria-label="Acting role" style="border:0;background:transparent;font-weight:500">${ROLE_LIST.map((r) => `<option ${r === state().role ? 'selected' : ''}>${r}</option>`).join('')}</select></label>`}</div></div><div id="apage"></div></div></div>`;
  const page = $('#apage', root); if (!ONLINE) $('#role', root).onchange = (e) => { setRole(e.target.value); log('Switched acting role (demo)', e.target.value); };
  const deny = (p) => `<div class="card" style="max-width:560px"><h3>No access</h3><p>The <b>${esc(state().role)}</b> role has no access to <b>${p}</b>.</p><p class="muted" style="font-size:14px;margin-top:8px">${T('In production this is enforced on the server for every request — hiding menu items alone is not security. ', 'This is enforced on the server for every request. ')}A Super Admin can change role access in <a href="#/admin/roles" class="link-arrow">Roles &amp; security</a>.</p></div>`;
  const dr = (html, fn) => { drawerFn = fn || null; if (!drawer) { drawer = h('<aside class="drawer wide" role="dialog" aria-modal="true" aria-label="Details"></aside>'); } drawer.innerHTML = `<header><h2 class="serif" id="dh"></h2><button class="ib" aria-label="Close" id="dx">${ic('x', 24)}</button></header><div class="body"></div>`; $('.body', drawer).innerHTML = html; $('#dx', drawer).onclick = closeAll; if (!drawer.classList.contains('on')) openLayer(drawer); return drawer; };
  const guard = (perm, need, msg) => { if (!can(perm, need)) { toast(msg || `Your role (${state().role}) cannot do this.`); return false; } return true; };

  // ---------------- dashboard
  function dashboard() {
    const S = state(); const ords = S.orders; const capd = ords.filter(cap); const A = ONLINE ? S.stats : null;   // online, the totals come from the database, not from the orders listed here
    const rev = A ? A.amount.Captured || 0 : capd.reduce((s, o) => s + o.totals.total, 0), nPaid = A ? A.count.Captured || 0 : capd.length, nAll = A ? A.total : ords.length, nOpen = A ? A.open : ords.filter((o) => o.stage < 6).length;
    const pend = A ? A.count.Pending || 0 : ords.filter((o) => o.payment.status === 'Pending').length, toShip = A ? A.toShip : ords.filter((o) => cap(o) && o.stage <= 2).length, low = allProducts().filter((p) => p.stock <= 1);
    const days = [...Array(7)].map((_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); return { d, k: d.toDateString(), v: A ? (A.daily[d.toLocaleDateString('en-CA')] || 0) : 0 }; }); if (!A) capd.forEach((o) => { const x = days.find((d) => d.k === new Date(o.createdAt).toDateString()); if (x) x.v += o.totals.total; });
    const mx = Math.max(1, ...days.map((d) => d.v)); const stCount = ['Captured', 'Pending', 'Refunded'].map((k) => [k, A ? A.count[k] || 0 : ords.filter((o) => o.payment.status === k).length]); const tot = Math.max(1, A ? A.total : ords.length);
    const open = S.tickets.filter((t) => t.status !== 'Resolved').length; let acc = 0;
    page.innerHTML = `<div class="kpis"><div class="card kpi"><h3>Sales (captured)</h3><b>${can('payments') ? money(rev) : '—'}</b><small>${nPaid} paid orders</small></div><div class="card kpi"><h3>Orders</h3><b>${can('orders') ? nAll : '—'}</b><small>${nOpen} open</small></div><div class="card kpi"><h3>Payments pending</h3><b>${can('payments') ? pend : '—'}</b><small>awaiting gateway callback</small></div><div class="card kpi"><h3>To dispatch</h3><b>${can('orders') ? toShip : '—'}</b><small>pick · QC · pack</small></div><div class="card kpi"><h3>Low stock</h3><b>${can('catalogue') ? low.length : '—'}</b><small>one-of-one or sold out</small></div></div>
      <div class="grid2"><div class="card"><h3>Revenue · last 7 days</h3>${can('payments') ? `<svg viewBox="0 0 560 190" width="100%" role="img" aria-label="Revenue bar chart"><defs><linearGradient id="barg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3DFA6"/><stop offset="1" stop-color="#9b7a3a"/></linearGradient></defs>${days.map((d, i) => { const hh = d.v / mx * 130; return `<rect x="${24 + i * 76}" y="${150 - hh}" width="48" height="${hh}" fill="${d.v ? 'url(#barg)' : 'rgba(235,211,153,.14)'}"/><text x="${48 + i * 76}" y="170" text-anchor="middle" font-family="Jost" font-size="12" fill="rgba(235,211,153,.62)">${d.d.toLocaleDateString('en-IN', { weekday: 'short' })}</text>${d.v ? `<text x="${48 + i * 76}" y="${144 - hh}" text-anchor="middle" font-family="Jost" font-size="11" fill="#EBD399">${inr(d.v).replace('₹ ', '₹')}</text>` : ''}`; }).join('')}</svg>` : '<p class="muted">Your role cannot view payments.</p>'}</div>
        <div class="card"><h3>Payment states</h3>${can('payments') ? `<div style="display:flex;gap:20px;align-items:center"><svg viewBox="0 0 42 42" width="140" height="140" style="transform:rotate(-90deg)"><circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="6"/>${stCount.map(([k, n], i) => { const pct = n / tot * 100; const el = `<circle cx="21" cy="21" r="15.9" fill="none" stroke="${['#EBD399', '#b3414f', '#6f9bd1'][i]}" stroke-width="6" pathLength="100" stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${-acc}"/>`; acc += pct; return el; }).join('')}</svg><div style="line-height:2">${stCount.map(([k, n], i) => `<div><i style="display:inline-block;width:12px;height:12px;background:${['#EBD399', '#b3414f', '#6f9bd1'][i]};margin-right:8px"></i>${k} · ${n}</div>`).join('')}</div></div><p class="muted" style="font-size:13.5px;margin-top:8px">Status comes from verified gateway callbacks only.</p>` : '<p class="muted">Your role cannot view payments.</p>'}</div></div>
      <div class="grid2"><div class="card"><h3>Recent orders</h3>${can('orders') ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${ords.slice(0, 6).map((o) => `<tr class="click" data-o="${o.id}"><td><b>${o.id}</b></td><td>${pii(o.customer.name, 'name')}</td><td>${money(o.totals.total)}</td><td><span class="pill ${pillFor(o.payment.status)}">${o.payment.status}</span></td><td><span class="pill ${o.stage >= 6 ? 'ok' : 'info'}">${STAGES[o.stage]}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Your role cannot view orders.</p>'}</div>
        <div class="card"><h3>Needs attention</h3><div style="display:grid;gap:10px;font-size:15.5px">${can('catalogue') ? low.map((p) => `<div style="display:flex;justify-content:space-between;gap:10px"><span>${esc(p.name)}</span><span class="pill ${p.stock ? 'warn' : 'err'}">${p.stock ? p.stock + ' left' : 'Sold out'}</span></div>`).join('') || '<span class="muted">No low-stock items.</span>' : ''}${can('payments') && pend ? `<a href="#/admin/payments" class="pill warn" style="white-space:normal">${pend} payment(s) awaiting gateway confirmation</a>` : ''}${can('support') && open ? `<a href="#/admin/support" class="pill info" style="white-space:normal">${open} open support ticket(s)</a>` : ''}</div></div></div>`;
    $$('[data-o]', page).forEach((r) => (r.onclick = () => orderDrawer(r.dataset.o)));
  }

  // ---------------- orders
  let q = '';
  function orders() {
    if (!can('orders')) { page.innerHTML = deny('Orders & dispatch'); return; }
    const list = state().orders.filter((o) => !q || (o.id + o.customer.name + o.address.city).toLowerCase().includes(q.toLowerCase()));
    page.innerHTML = `<div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;flex-wrap:wrap"><input id="oq" type="search" placeholder="Search order, customer, city" aria-label="Search orders" value="${esc(q)}" style="height:44px;padding:0 14px;border:1px solid rgba(235,211,153,.35);background:rgba(255,255,255,.06);color:inherit;width:min(360px,100%)"><span class="muted">${list.length} orders · ${can('orders', 'full') ? 'you can move orders along' : 'view only'}</span></div><div class="kan">${COLS.map(([n, st]) => { const cs = list.filter((o) => st.includes(o.stage)); return `<div class="col"><h4><span>${n}</span><span class="muted">${cs.length}</span></h4>${cs.map((o) => `<div class="kc" tabindex="0" role="button" data-o="${o.id}"><b>${o.id}</b><br><span class="muted">${pii(o.customer.name, 'name')} · ${esc(o.address.city)}</span><br>${money(o.totals.total)} <span class="pill ${pillFor(o.payment.status)}" style="margin-left:6px">${o.payment.status}</span>${o.stage > 2 && o.stage < 6 ? ` <span class="pill info">${STAGES[o.stage]}</span>` : ''}</div>`).join('') || '<span class="muted" style="font-size:14px">None</span>'}</div>`; }).join('')}</div>`;
    $('#oq', page).oninput = (e) => { q = e.target.value; const p = e.target.selectionStart; orders(); const i = $('#oq', page); i.focus(); i.setSelectionRange(p, p); };
    $$('.kc', page).forEach((k) => { k.onclick = () => orderDrawer(k.dataset.o); k.onkeydown = (e) => { if (e.key === 'Enter') orderDrawer(k.dataset.o); }; });
  }
  function orderDrawer(id) {
    const draw = () => {
      const o = order(id); if (!o) return; const full = can('orders', 'full'); const pend = o.payment.status === 'Pending'; const ticked = o.qc || [];
      const d = dr(`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><span class="pill ${o.stage >= 6 ? 'ok' : 'info'}">${STAGES[o.stage]}</span><span class="pill ${pillFor(o.payment.status)}">Payment ${o.payment.status}</span><span class="pill mute">${o.delivery} delivery</span></div>
        <div class="card" style="margin-bottom:14px"><h3>Customer</h3><p><b>${pii(o.customer.name, 'name')}</b> · ${pii(o.customer.mobile, 'mobile')}</p><p class="muted">${lvl('pii') === 'full' ? esc(o.address.line) + ', ' + esc(o.address.city) + ' ' + esc(o.address.pin) : lvl('pii') === 'none' ? '—' : esc(o.address.city) + ' · PIN ' + esc(o.address.pin).slice(0, 3) + '•••'}</p>${lvl('pii') !== 'full' ? `<p class="muted" style="font-size:13px">Customer details are ${lvl('pii') === 'none' ? 'hidden' : 'masked'} for the ${esc(state().role)} role.</p>` : ''}</div>
        <div class="card" style="margin-bottom:14px"><h3>Items</h3>${o.items.map((i) => { const p = prod(i.id); return `<div style="display:flex;gap:12px;align-items:center;padding:6px 0"><div style="width:44px;aspect-ratio:4/5;background:url(${img(p.gallery[0].img)}) ${p.gallery[0].pos}/cover"></div><div style="flex:1"><b style="font-weight:500">${esc(p.name)}</b><br><span class="muted" style="font-size:13.5px">${p.sku} × ${i.qty}${(i.addons || []).length ? ' · ' + i.addons.map((a) => ADDONS[a][0]).join(', ') : ''}</span></div>${money(i.price * i.qty)}</div>`; }).join('')}<div style="text-align:right;margin-top:6px"><b>${money(o.totals.total)}</b></div></div>
        ${o.stage >= 1 && o.stage <= 2 ? `<div class="card" style="margin-bottom:14px"><h3>Packing checklist</h3>${QC.map((q_, i) => `<label class="check" style="padding:6px 0"><input type="checkbox" data-qc="${i}" ${ticked.includes(i) ? 'checked' : ''} ${full ? '' : 'disabled'}><span>${q_}</span></label>`).join('')}</div>` : ''}
        <div class="card" style="margin-bottom:14px"><h3>Fulfilment</h3><div style="display:flex;gap:10px;flex-wrap:wrap" id="acts"></div><p class="muted" style="font-size:13.5px;margin-top:10px">${o.awb ? 'AWB ' + o.awb + ' — shipment already created, so it cannot be created twice.' : 'Shipment is created once, at hand-over to the courier.'}</p></div>
        <div class="card"><h3>History</h3>${o.history.slice().reverse().map((x) => `<div style="padding:5px 0;border-top:1px solid rgba(235,211,153,.16)"><b style="font-weight:500">${x.s}</b> <span class="muted">· ${when(x.t)}</span></div>`).join('')}</div>`, draw);
      $('#dh', d).textContent = o.id;
      const acts = $('#acts', d); const next = o.stage + 1; const NAMES = ['', 'Start processing', 'Mark packed', 'Create shipment & hand to courier', 'Mark in transit', 'Out for delivery', 'Mark delivered'];
      if (o.stage < 6) { const b = h(`<button class="btn btn-dark btn-sm" ${!full || pend ? 'disabled' : ''}>${NAMES[next]}</button>`); b.onclick = () => { if (!guard('orders', 'full')) return; if (next === 2 && ticked.length < QC.length) { toast('Complete the packing checklist first.'); return; } if (next === 3 && o.awb) { toast('A shipment already exists for this order.'); return; } advance(o.id); toast(NAMES[next] + ' — done'); }; acts.appendChild(b); }
      if (pend) acts.appendChild(h(`<span class="pill warn" style="white-space:normal">Payment pending — confirm it under Payments before fulfilling.</span>`));
      if (cap(o) && o.stage < 6) { const r = h(`<button class="btn btn-line btn-sm">Refund</button>`); r.onclick = () => refund(o.id); acts.appendChild(r); }
      if (o.payment.status === 'Refunded') acts.appendChild(h(`<span class="pill info">Refunded</span>`));
      $$('[data-qc]', d).forEach((c) => (c.onchange = () => { if (!guard('orders', 'full')) { c.checked = !c.checked; return; } const set = new Set(o.qc || []); c.checked ? set.add(Number(c.dataset.qc)) : set.delete(Number(c.dataset.qc)); setOrder(o.id, { qc: [...set] }); }));
    };
    draw();
  }
  function refund(id) {
    const o = order(id); if (!guard('refunds', 'full', `Refunds need the Finance Manager or Store Manager role. Your role: ${state().role}.`)) return;
    if (o.payment.status !== 'Captured') { toast('Only captured payments can be refunded.'); return; }
    if (!confirm(`Refund ${money(o.totals.total)} for ${o.id} to the original payment method?${T(' (test mode)', '', ' (test mode)')}`)) return;
    if (ONLINE) {                                                    // the server asks the payment provider to send the money back, and says so only if it did
      Promise.resolve(setOrder(o.id, { payment: { status: 'Refunded' } })).then(() => { if (order(id)?.payment.status === 'Refunded') toast(T('', 'Refund sent to the original payment method', 'Refund processed (test mode)')); });
      return;
    }
    o.payment.status = 'Refunded'; log('Refund approved', o.id + ' · ' + o.totals.total); setOrder(o.id, { payment: o.payment }); toast('Refund processed (test mode)');
  }

  // ---------------- products
  function products() {
    if (!can('catalogue')) { page.innerHTML = deny('Catalogue & prices'); return; }
    const list = allProducts();
    page.innerHTML = `<div class="card"><div class="scroll-x"><table class="tbl"><thead><tr><th></th><th>Product</th><th>SKU</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead><tbody>${list.map((p) => `<tr class="click" data-p="${p.id}"><td style="width:56px"><div style="width:44px;aspect-ratio:4/5;background:url(${img(p.gallery[0].img)}) ${p.gallery[0].pos}/cover"></div></td><td><b style="font-weight:500">${esc(p.name)}</b><br><span class="muted" style="font-size:13.5px">${esc(p.fabric)} · ${esc(p.colour)}</span></td><td>${p.sku}</td><td>${money(p.price)}</td><td>${p.stock}</td><td>${p.active === false ? '<span class="pill mute">Hidden</span>' : p.stock < 1 ? '<span class="pill err">Sold out</span>' : p.stock <= 1 ? '<span class="pill warn">Low</span>' : '<span class="pill ok">Live</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
    $$('[data-p]', page).forEach((r) => (r.onclick = () => productDrawer(r.dataset.p)));
  }
  function productDrawer(id) {
    const p = prod(id); const full = can('catalogue', 'full'); let gal = p.gallery.map((g) => ({ ...g }));
    const d = dr(`<p class="muted" style="margin-bottom:12px">${p.sku} · changes appear on the storefront immediately and are written to the audit log.${full ? '' : ' <b>View only for your role.</b>'}</p>
      <div class="card" style="margin-bottom:14px"><h3>Images — drag to reorder (first = primary)</h3><div class="imgs" id="imgs"></div><p class="muted" style="font-size:13.5px;margin-top:8px">Alt text is required for accessibility and SEO.</p><div id="alts" style="margin-top:8px"></div></div>
      <div class="card"><h3>Details</h3><div class="row2"><div class="field"><label for="ppr">Price (₹)</label><input id="ppr" inputmode="numeric" value="${p.price}" ${full ? '' : 'disabled'}><div class="err" id="e-ppr" role="alert"></div></div><div class="field"><label for="pst">Stock</label><input id="pst" inputmode="numeric" value="${p.stock}" ${full ? '' : 'disabled'}><div class="err" id="e-pst" role="alert"></div></div></div><div class="field"><label for="pds">Description</label><textarea id="pds" ${full ? '' : 'disabled'}>${esc(p.desc)}</textarea></div><label class="check" style="margin-bottom:16px"><input type="checkbox" id="pact" ${p.active === false ? '' : 'checked'} ${full ? '' : 'disabled'}><span>Published on the storefront</span></label><button class="btn btn-dark" id="psave" ${full ? '' : 'disabled'}>Save &amp; publish</button></div>`, null);
    $('#dh', d).textContent = p.name;
    const drawImgs = () => {
      const box = $('#imgs', d); box.innerHTML = gal.map((g, i) => `<div class="im" draggable="${full}" data-i="${i}" style="background-image:url(${img(g.img)});background-position:${g.pos}" aria-label="${esc(g.alt || g.label)}">${i === 0 ? '<span class="prim">PRIMARY</span>' : ''}<span class="lb">${esc(g.label)}</span></div>`).join('');
      $('#alts', d).innerHTML = gal.map((g, i) => `<div class="field" style="margin-bottom:8px"><label for="alt${i}">Alt text · ${esc(g.label)}</label><input id="alt${i}" value="${esc(g.alt || '')}" placeholder="Describe the image" ${full ? '' : 'disabled'}></div>`).join('');
      $$('[id^=alt]', d).forEach((inp, i) => (inp.oninput = () => { gal[i].alt = inp.value; }));
      let from = null; $$('.im', box).forEach((el) => { el.ondragstart = (e) => { from = Number(el.dataset.i); el.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; }; el.ondragend = () => el.classList.remove('drag'); el.ondragover = (e) => { e.preventDefault(); el.classList.add('over'); }; el.ondragleave = () => el.classList.remove('over'); el.ondrop = (e) => { e.preventDefault(); const to = Number(el.dataset.i); if (from == null || from === to) return; const [m] = gal.splice(from, 1); gal.splice(to, 0, m); drawImgs(); }; });
      // keyboard reorder: focus a tile and press [ or ]
      $$('.im', box).forEach((el) => { el.tabIndex = 0; el.onkeydown = (e) => { const i = Number(el.dataset.i); if (!full) return; if (e.key === '[' && i > 0) { [gal[i - 1], gal[i]] = [gal[i], gal[i - 1]]; drawImgs(); $$('.im', box)[i - 1].focus(); } if (e.key === ']' && i < gal.length - 1) { [gal[i + 1], gal[i]] = [gal[i], gal[i + 1]]; drawImgs(); $$('.im', box)[i + 1].focus(); } }; });
    };
    drawImgs();
    $('#psave', d).onclick = () => {
      if (!guard('catalogue', 'full')) return; const pr = Number($('#ppr', d).value), st = Number($('#pst', d).value); let ok = true;
      $('#e-ppr', d).textContent = Number.isInteger(pr) && pr > 0 ? '' : (ok = false, 'Enter a whole-number price above zero.'); $('#e-pst', d).textContent = Number.isInteger(st) && st >= 0 ? '' : (ok = false, 'Enter a whole number, zero or more.'); if (!ok) return;
      if (gal.some((g) => !g.alt) && !confirm('Some images have no alt text. Save anyway? (Required before launch)')) return;
      const act = $('#pact', d).checked; if (pr !== p.price) log('Price changed', `${p.sku} · ${p.price} → ${pr}`); if (st !== p.stock) log('Stock changed', `${p.sku} · ${p.stock} → ${st}`); if (act !== (p.active !== false)) log(act ? 'Product published' : 'Product hidden', p.sku);
      setProduct(id, { price: pr, stock: st, desc: $('#pds', d).value, gallery: gal, active: act }, 'Product saved'); toast('Saved — live on the storefront'); closeAll();
    };
  }

  // ---------------- payments
  function payments() {
    if (!can('payments')) { page.innerHTML = deny('Payments'); return; }
    const ords = state().orders; const sum = (st) => (ONLINE ? state().stats?.amount[st] || 0 : ords.filter((o) => o.payment.status === st).reduce((s, o) => s + o.totals.total, 0));
    page.innerHTML = `<div class="kpis"><div class="card kpi"><h3>Captured</h3><b>${money(sum('Captured'))}</b><small>signature-verified</small></div><div class="card kpi"><h3>Pending</h3><b>${ords.filter((o) => o.payment.status === 'Pending').length}</b><small>awaiting callback</small></div><div class="card kpi"><h3>Refunded</h3><b>${money(sum('Refunded'))}</b><small>approved refunds</small></div>${ONLINE ? '' : '<div class="card kpi"><h3>Mismatches</h3><b>0</b><small>orders vs gateway (demo)</small></div>'}</div>
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">Payments</h3><button class="btn btn-line btn-sm" id="csv">Export CSV</button></div><div class="scroll-x"><table class="tbl"><thead><tr><th>Ref</th><th>Order</th><th>Amount</th><th>Method</th><th>Signature</th><th>Webhook</th><th>Status</th><th></th></tr></thead><tbody>${ords.map((o) => { const c = o.payment.status === 'Captured' || o.payment.status === 'Refunded'; return `<tr><td class="muted">${esc(o.payment.ref)}</td><td><b>${o.id}</b></td><td>${money(o.totals.total)}</td><td>${esc(o.payment.method)}</td><td><span class="pill ${c ? 'ok' : 'warn'}">${c ? '✓' : '…'}</span></td><td><span class="pill ${c ? 'ok' : 'warn'}">${c ? '✓' : '…'}</span></td><td><span class="pill ${pillFor(o.payment.status)}">${o.payment.status}</span></td><td style="text-align:right;white-space:nowrap">${o.payment.status === 'Pending' ? `<button class="btn btn-dark btn-sm" data-cb="${o.id}">Simulate gateway callback</button>` : o.payment.status === 'Captured' ? `<button class="btn btn-line btn-sm" data-rf="${o.id}">Refund</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div><p class="muted" style="font-size:13.5px;margin-top:10px">A browser redirect alone never marks an order paid. Repeated callbacks are ignored safely. Refunds need an approving role.</p></div>`;
    $$('[data-cb]', page).forEach((b) => (b.onclick = () => { if (!guard('payments', 'full', 'Only Finance or Super Admin can confirm payments.')) return; if (ONLINE) { confirmPayment(b.dataset.cb); toast('Test callback sent'); return; } const o = order(b.dataset.cb); if (o.payment.status !== 'Pending') { toast('Duplicate callback ignored — already processed.'); return; } o.payment.status = 'Captured'; log('Payment confirmed (callback)', o.id); setOrder(o.id, { payment: o.payment }); toast('Callback verified — payment captured'); }));
    $$('[data-rf]', page).forEach((b) => (b.onclick = () => refund(b.dataset.rf)));
    $('#csv', page).onclick = () => { const rows = [['ref', 'order', 'amount_inr', 'method', 'status', 'created']].concat(ords.map((o) => [o.payment.ref, o.id, o.totals.total, o.payment.method, o.payment.status, new Date(o.createdAt).toISOString()])); const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = T('payments-demo.csv', 'payments.csv'); a.click(); URL.revokeObjectURL(a.href); log('Payments exported', 'CSV · no customer PII'); toast('Exported (no customer data included)'); };
  }

  // ---------------- support
  let tsel = null;
  function support() {
    if (!can('support')) { page.innerHTML = deny('Support'); return; }
    const T = state().tickets; tsel = T.find((t) => t.id === tsel)?.id || T[0]?.id; const t = T.find((x) => x.id === tsel); const full = can('support', 'full'); const o = t && order(t.order);
    page.innerHTML = `<div class="grid2 g-sup"><div class="card"><h3>Inbox · ${T.filter((x) => x.status !== 'Resolved').length} open</h3>${T.map((x) => `<div class="kc" role="button" tabindex="0" data-t="${x.id}" style="${x.id === tsel ? 'border-color:var(--gold);background:rgba(198,161,91,.18)' : ''}"><b>${esc(x.subject)}</b><br><span class="muted" style="font-size:13.5px">${esc(x.order)} · ${esc(x.channel)}</span> <span class="pill ${x.status === 'Resolved' ? 'ok' : x.status === 'New' ? 'info' : 'warn'}" style="float:right">${x.status}</span></div>`).join('') || '<p class="muted">No tickets.</p>'}</div>
      <div class="card">${t ? `<h3>${esc(t.subject)}</h3>${t.contact ? `<p class="muted" style="margin-bottom:8px">${esc(t.name || '')}${t.name ? ' · ' : ''}${esc(t.contact)}</p>` : ''}${o ? `<div class="pill info" style="margin-bottom:10px;white-space:normal">Order ${o.id} · ${STAGES[o.stage]}${o.awb ? ' · AWB ' + o.awb : ''} · ${money(o.totals.total)}</div>` : ''}<div style="display:grid;gap:8px;margin-bottom:12px">${t.msgs.map((m) => `<div style="padding:10px 14px;background:${m.from === 'cust' ? 'rgba(255,255,255,.07)' : 'rgba(111,176,140,.16)'};max-width:85%;${m.from === 'cust' ? '' : 'margin-left:auto'}"><small class="muted">${m.from === 'cust' ? 'Customer' : 'Thirupavai'}</small><br>${esc(m.t)}</div>`).join('')}</div>
        <div class="field"><label for="rep">Reply ${ONLINE ? '<span class="muted" style="margin-left:6px;font-size:13px">saved on the ticket — contact the customer on the number or email above</span>' : '<span class="pill gd" style="margin-left:6px">human sends</span>'}</label><textarea id="rep" ${full ? '' : 'disabled'}></textarea></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-line btn-sm" id="macro" ${full ? '' : 'disabled'}>Insert order-status reply</button><button class="btn btn-dark btn-sm" id="send" ${full ? '' : 'disabled'}>Send</button><button class="btn btn-line btn-sm" id="res" ${full ? '' : 'disabled'}>Mark resolved</button></div>${full ? '' : '<p class="muted" style="margin-top:8px;font-size:13.5px">View only for your role.</p>'}` : '<p class="muted">Select a ticket.</p>'}</div></div>`;
    $$('[data-t]', page).forEach((k) => { k.onclick = () => { tsel = k.dataset.t; support(); }; k.onkeydown = (e) => { if (e.key === 'Enter') k.click(); }; });
    $('#macro', page)?.addEventListener('click', () => { $('#rep', page).value = o ? `Hi! Your order ${o.id} is currently "${STAGES[o.stage]}".${o.awb ? ' The AWB is ' + o.awb + '.' : ''} We will message you at every step.` : 'Hi! Could you share your order number so we can check the status?'; });
    $('#send', page)?.addEventListener('click', () => { if (!guard('support', 'full')) return; const v = $('#rep', page).value.trim(); if (!v) { toast('Write a reply first.'); return; } if (ONLINE) { replyTicket(t.id, v); toast('Reply saved on the ticket'); return; } t.msgs.push({ from: 'us', t: v }); t.status = 'Answered'; log('Support reply sent', t.id); _emit('tickets'); toast('Reply sent (demo)'); });
    $('#res', page)?.addEventListener('click', () => { if (!guard('support', 'full')) return; if (ONLINE) { resolveTicket(t.id); return; } t.status = 'Resolved'; log('Ticket resolved', t.id); _emit('tickets'); });
  }

  // ---------------- roles & security
  function roles() {
    if (!can('roles')) { page.innerHTML = deny('Roles'); return; }
    const M = matrix(); const edit = state().role === 'Super Admin'; const STEPS = { pii: ['none', 'mask', 'full'] }; const cycle = (perm, v) => { const s = STEPS[perm] || ['none', 'view', 'full']; return s[(s.indexOf(v) + 1) % s.length]; };
    const sym = (v) => ({ full: '✓ full', view: 'view', mask: 'masked', none: '—' }[v]);
    page.innerHTML = `<div class="grid2 g-roles"><div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Role access ${edit ? '· click a cell to change' : '· view only'}</h3><span class="muted" style="font-size:13.5px">Super Admin row is locked</span></div><div class="scroll-x"><table class="tbl matrix" style="margin-top:10px"><thead><tr><th>Role</th>${PERMS.map(([, n]) => `<th>${n}</th>`).join('')}</tr></thead><tbody>${ROLE_LIST.map((r) => `<tr><td><b style="font-weight:500">${r}</b>${r === 'Super Admin' ? ` ${ic('lock', 14)}` : ''}</td>${PERMS.map(([k]) => `<td><button class="pill ${M[r][k] === 'full' ? 'ok' : M[r][k] === 'none' ? 'mute' : 'info'}" data-r="${r}" data-k="${k}" ${edit && r !== 'Super Admin' ? '' : 'disabled'} aria-label="${r}, ${k}: ${M[r][k]}">${sym(M[r][k])}</button></td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="muted" style="font-size:13.5px;margin-top:10px">Changes take effect immediately and are audited. In production access is enforced on the server on every request.</p>${edit ? `<button class="btn btn-line btn-sm" id="rst" style="margin-top:8px">Reset to defaults</button>` : ''}</div>
      <div class="card"><h3>Audit log</h3>${can('audit') ? (state().audit.length ? `<div style="max-height:480px;overflow:auto">${state().audit.slice(0, 30).map((a) => `<div style="padding:8px 0;border-top:1px solid rgba(235,211,153,.16)"><b style="font-weight:500">${esc(a.action)}</b> <span class="muted">· ${esc(a.detail || '')}</span><br><span class="muted" style="font-size:13px">${when(a.t)} · ${esc(a.by)}</span></div>`).join('')}</div>` : '<p class="muted">Nothing logged yet. Place an order, edit a product or change a role.</p>') : '<p class="muted">Your role cannot view the audit log.</p>'}</div></div>`;
    $$('[data-r]', page).forEach((b) => (b.onclick = () => { const r = b.dataset.r, k = b.dataset.k; const nm = JSON.parse(JSON.stringify(matrix())); nm[r][k] = cycle(k, nm[r][k]); setRoles(nm); log('Role access changed', `${r} · ${k} → ${nm[r][k]}`); }));
    $('#rst', page)?.addEventListener('click', () => { setRoles(null); log('Role access reset', 'defaults restored'); toast('Defaults restored'); });
    if (ONLINE) staffCard();
  }
  // who can sign in to this console, and as what (online only; the server keeps the list)
  async function staffCard() {
    const box = h(`<div class="card" style="margin-top:18px"><h3>Staff access</h3><div id="stl" class="muted">Loading…</div></div>`); page.appendChild(box);
    const edit = can('roles', 'full'); const field = 'height:44px;padding:0 12px;border:1px solid rgba(235,211,153,.35);background:rgba(255,255,255,.06);color:inherit';
    const draw = async () => {
      let list; try { list = (await api('GET', '/api/admin/staff')).staff; } catch (e) { $('#stl', box).textContent = e.message; return; }
      $('#stl', box).innerHTML = `<div class="scroll-x"><table class="tbl"><thead><tr><th>Mobile</th><th>Role</th><th></th></tr></thead><tbody>${list.map((s) => `<tr><td>${esc(s.shown)}${s.you ? ' <span class="pill info">you</span>' : ''}</td><td>${esc(s.role)}</td><td style="text-align:right">${edit && !s.you ? `<button class="btn btn-line btn-sm" data-rm="${esc(s.mobile)}">Remove</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
        ${edit ? `<form id="stf" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><input id="stm" inputmode="numeric" maxlength="10" placeholder="Mobile number" aria-label="Staff mobile number" style="${field}"><select id="str" aria-label="Role" style="${field}">${ROLE_LIST.map((r) => `<option>${r}</option>`).join('')}</select><button class="btn btn-dark btn-sm" type="submit">Add or change</button></form><div class="err" id="ste" role="alert" style="margin-top:8px"></div><p class="muted" style="font-size:13.5px;margin-top:8px">Staff sign in with their own mobile number and an SMS code, like customers do, and then see only what their role allows.</p>` : ''}`;
      $$('[data-rm]', box).forEach((b) => (b.onclick = async () => { if (!confirm('Remove this person’s staff access?')) return; try { await api('DELETE', '/api/admin/staff/' + b.dataset.rm); draw(); } catch (e) { notifyError(e); } }));
      $('#stf', box)?.addEventListener('submit', async (e) => { e.preventDefault(); try { await api('POST', '/api/admin/staff', { mobile: $('#stm', box).value.trim(), role: $('#str', box).value }); draw(); } catch (er) { $('#ste', box).textContent = er.message; } });
    };
    draw();
  }

  const VIEWS = { dashboard, orders, products, payments, support, roles };
  const draw = () => { const sec = VIEWS[section] ? section : 'dashboard'; $('#atitle', root).textContent = (SECTIONS.find((s) => s[0] === sec) || [])[1]; VIEWS[sec](); if (drawer?.classList.contains('on') && drawerFn) drawerFn(); };
  draw();
  const onData = () => { if (!document.contains(root)) return; const rs = $('#role', root); if (rs) rs.value = state().role; draw(); };
  addEventListener('tpv:data', onData);
  const poll = ONLINE ? setInterval(() => { if (!document.hidden) loadAdmin().catch(() => {}); }, 30000) : 0;   // new orders and tickets appear without a reload
  return () => { removeEventListener('tpv:data', onData); clearInterval(poll); closeAll(); };
}

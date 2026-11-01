import { state, products, wish, auth, order, log, _emit, fetchOrder, trackGuest, loadMyOrders, createTicket } from '../store.js';
import { h, $, $$, ic, card, esc, money, when, modal, closeAll, toast } from '../ui.js';
import { STAGES } from '../store.js';
import { ONLINE, T, biz } from '../api.js';

const PAGES = {
  shipping: ['Shipping & delivery', `<p>Delivery is tracked end to end. Serviceability, fees and dispatch estimates come from the courier integration — the values in this prototype are samples.</p><ul><li>Standard delivery: free in this demo, 3–7 days depending on PIN code.</li><li>Express delivery: ₹ 350 where available.</li><li>We never show live GPS unless the carrier provides authorised data.</li></ul><p class="muted">Placeholder policy text — final wording must match the business’s real practice.</p>`],
  returns: ['Returns & exchanges', `<p>Eligible pieces can be returned within 7 days of delivery, unworn and with tags (sample rule). Stitched blouses, fall &amp; pico and gift add-ons are final sale.</p><p>Refunds go back to the original payment method after the piece passes a quality check, and need Finance approval.</p><p class="muted">Placeholder policy text — to be reviewed with the business and legal counsel.</p>`],
  privacy: ['Privacy policy', `<p>We collect only what an order needs: name, mobile, address and payment reference. Card numbers and CVV are never stored. Customer data is masked in the admin console by role.</p><p>You can ask us to delete your data at any time.</p><p class="muted">Placeholder — a real policy must document data retention, processors and rights under applicable law.</p>`],
  terms: ['Terms of use', `<p>This is a concept prototype. Products, prices and orders are sample data and nothing here is an offer for sale.</p><p class="muted">Placeholder — real terms require legal review.</p>`],
  security: ['Security updates', `<p>No security notices have been published. This page will list only verified, approved notices. Thirupavai does not claim to be “completely secure”; security is a continuing practice.</p>`],
  faqs: ['FAQs', `<details open><summary>Do I need an account to shop?</summary><p>No. Browse, filter and build a bag as a guest. We ask you to sign in only at checkout, and your bag is kept.</p></details><details><summary>Is the 3D viewer a real 360° view?</summary><p>No. It is a simulated cloth preview built from product photos. A real 360° view needs actual 360 capture, which is planned.</p></details><details><summary>Is payment real here?</summary><p>No — this prototype runs in test mode. Try UPI ID <code>success@upi</code>, <code>fail@upi</code> or <code>pending@upi</code>.</p></details><details><summary>Can I buy a one-of-one piece twice?</summary><p>No. Stock is checked again at payment, so two buyers can never get the same one-of-one saree.</p></details>`],
  notfound: ['Page not found', `<p>That page doesn’t exist. <a class="link-arrow" href="#/">Back to home</a></p>`],
};

// The real shop's wording. Drafted from how the system actually behaves (prices, shipping, stock, payments, data handling);
// the business and its lawyer must review the policy pages before launch — see GO-LIVE.md.
const SHOP_PAGES = {
  shipping: ['Shipping & delivery', `<p>Every order is tracked from our workshop to your door. You can follow it under Orders in your account, or with your order number and mobile number.</p><ul><li>Standard delivery: free, usually 3–7 days depending on your PIN code. You will see the estimate at checkout.</li><li>Express delivery: ₹ 350 where available.</li><li>We show the live courier position only when the courier shares it with us.</li></ul>`],
  returns: ['Returns & exchanges', `<p>Eligible pieces can be returned within 7 days of delivery, unworn and with the tags attached. Stitched blouses, fall &amp; pico and gift add-ons are final sale.</p><p>Refunds go back to the original payment method once the piece has passed our quality check.</p>`],
  privacy: ['Privacy policy', `<p>We collect only what an order needs: your name, mobile number, delivery address and payment reference. Card, UPI and bank details are handled by our payment provider and are never stored by us.</p><p>Our staff see your details only as far as their role requires. You can ask us to delete your data at any time from the <a class="link-arrow" href="#/page/contact">contact page</a>.</p>`],
  terms: ['Terms of use', `<p>Prices include GST. A one-of-one piece is sold once: stock is checked again at the moment you pay, and an order is confirmed only after your payment has been verified.</p><p>Delivery estimates are estimates. Returns follow our returns policy. Questions about an order can be sent from the <a class="link-arrow" href="#/page/contact">contact page</a>.</p>`],
  security: PAGES.security,
  faqs: ['FAQs', `<details open><summary>Do I need an account to shop?</summary><p>No. Browse, filter and build a bag as a guest. We ask you to sign in with your mobile number only at checkout, and your bag is kept.</p></details><details><summary>Is the 3D viewer a real 360° view?</summary><p>No. It is an interactive cloth preview built from the product photographs, to show how the saree falls.</p></details><details><summary>Is payment secure?</summary><p>Payments are taken in our payment provider’s secure window. Your card or bank details never reach our servers, and an order is confirmed only after the payment is verified.</p></details><details><summary>Can two people buy the same one-of-one piece?</summary><p>No. Stock is checked again at payment, so a one-of-one saree is only ever sold once.</p></details>`],
  notfound: PAGES.notfound,
};
export default async function misc(root, route) {
  const name = route.path.replace(/^\//, '').split('/')[0] === 'page' ? route.args[0] : route.args[0] || route.path.replace(/^\//, '');
  if (name === 'wishlist') return wishlist(root);
  if (name === 'account') return ONLINE ? accountOnline(root) : account(root);
  if (name === 'contact') return ONLINE ? contactOnline(root) : contact(root);
  const [title, body] = (ONLINE ? SHOP_PAGES : PAGES)[name] || PAGES.notfound;
  root.innerHTML = `<div class="wrap" style="max-width:820px;padding:50px var(--pad) 90px"><div class="crumbs"><a href="#/">Home</a> / ${esc(title)}</div><h1 style="font-size:clamp(40px,6vw,72px);margin:8px 0 22px">${esc(title)}</h1><div class="prose" style="font-size:18px;display:grid;gap:14px">${body}</div></div>`;
  $$('details', root).forEach((d) => { d.style.cssText = 'border-top:1px solid var(--line);padding:14px 0'; $('summary', d).style.cssText = 'font:500 21px var(--serif);cursor:pointer'; });
  $$('li', root).forEach((l) => (l.style.marginLeft = '20px')); $$('code', root).forEach((c) => (c.style.cssText = 'background:#efe3d0;padding:1px 6px'));
}

function wishlist(root) {
  const draw = () => {
    const list = state().wish.map((id) => products().find((p) => p.id === id)).filter(Boolean);
    root.innerHTML = `<div class="wrap" style="padding-bottom:80px"><div class="page-head"><div class="crumbs"><a href="#/">Home</a> / Wishlist</div><h1>Your wishlist</h1></div>${list.length ? `<div class="pgrid" id="wg"></div>` : `<div class="empty"><h3>Nothing saved yet</h3><p class="muted">Tap the heart on any saree to keep it here.</p><p style="margin-top:16px"><a class="btn btn-dark" href="#/shop">Browse sarees</a></p></div>`}</div>`;
    const g = $('#wg', root); list.forEach((p) => g?.appendChild(card(p)));
  };
  draw(); const on = () => draw(); addEventListener('tpv:data', on); const sub = () => draw(); document.addEventListener('click', (e) => { if (e.target.closest('.heart')) setTimeout(draw, 60); });
  return () => removeEventListener('tpv:data', on);
}

export function signIn() { return ONLINE ? signInOnline() : signInDemo(); }
function signInOnline() {
  let mob = '', sent = false;
  const m = modal(`<h2 class="serif" style="font-size:38px">Sign in</h2><p class="muted" style="margin:6px 0 16px">We’ll text a 6-digit code to your mobile number.</p><div class="field"><label for="am">Mobile number</label><input id="am" inputmode="numeric" maxlength="10" autofocus placeholder="10-digit mobile" autocomplete="tel-national"><div class="err" id="ame" role="alert"></div></div><div id="aotp"></div><button class="btn btn-dark btn-block" id="ago">Send code</button>`);
  $('#ago', m).onclick = async () => {
    const b = $('#ago', m), e1 = $('#ame', m); b.disabled = true;
    try {
      if (!sent) {
        mob = $('#am', m).value.trim(); if (!/^[6-9]\d{9}$/.test(mob)) { e1.textContent = 'Enter a valid 10-digit Indian mobile number.'; return; } e1.textContent = '';
        const r = await auth.sendOtp(mob); sent = true;
        $('#aotp', m).innerHTML = `${r.demoCode ? `<div class="pill gd" style="margin-bottom:10px">TEST SERVER — no SMS is sent. Code: <b>${r.demoCode}</b></div>` : ''}<div class="field"><label for="ac">6-digit code</label><input id="ac" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><div class="err" id="ace" role="alert"></div></div>`;
        b.textContent = 'Verify'; $('#ac', m).focus(); return;
      }
      await auth.verifyOtp(mob, $('#ac', m).value.trim()); closeAll(); toast('Signed in');
    } catch (er) { ($('#ace', m) || e1).textContent = er.message; } finally { b.disabled = false; }
  };
}
function signInDemo() {
  let otp = null, mob = '';
  const m = modal(`<h2 class="serif" style="font-size:38px">Sign in</h2><p class="muted" style="margin:6px 0 16px">Mobile OTP (demo — no SMS is sent).</p><div class="field"><label for="am">Mobile number</label><input id="am" inputmode="numeric" maxlength="10" autofocus placeholder="10-digit mobile"><div class="err" id="ame" role="alert"></div></div><div id="aotp"></div><button class="btn btn-dark btn-block" id="ago">Send OTP</button>`);
  $('#ago', m).onclick = () => {
    if (!otp) { mob = $('#am', m).value.trim(); if (!/^[6-9]\d{9}$/.test(mob)) { $('#ame', m).textContent = 'Enter a valid 10-digit Indian mobile number.'; return; } $('#ame', m).textContent = ''; otp = String(Math.floor(100000 + Math.random() * 900000)); $('#aotp', m).innerHTML = `<div class="pill gd" style="margin-bottom:10px">DEMO code: <b>${otp}</b></div><div class="field"><label for="ac">6-digit code</label><input id="ac" inputmode="numeric" maxlength="6"><div class="err" id="ace" role="alert"></div></div>`; $('#ago', m).textContent = 'Verify'; $('#ac', m).focus(); return; }
    if ($('#ac', m).value.trim() !== otp) { $('#ace', m).textContent = 'That code is not right.'; return; } auth.login(mob); closeAll(); toast('Signed in'); location.reload();
  };
}

function account(root) {
  const draw = () => {
    const s = state(); const mine = s.user ? s.orders.filter((o) => !o.seed || o.customer.mobile.replace(/\D/g, '').endsWith(s.user.mobile.slice(-4))) : [];
    root.innerHTML = `<div class="wrap" style="padding-bottom:80px"><div class="page-head"><div class="crumbs"><a href="#/">Home</a> / Account</div><h1>${s.user ? 'Your account' : 'Account'}</h1></div>
      <div class="co" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)"><div class="panel"><h2 class="serif">${s.user ? 'Your orders' : 'Track an order'}</h2>
        ${s.user ? `<p class="muted" style="margin-bottom:12px">Signed in as +91 ${esc(s.user.mobile)} · <button style="text-decoration:underline" id="so">Sign out</button></p>` : `<p class="muted" style="margin-bottom:12px">You can track any order by its number without signing in. <button style="text-decoration:underline" id="si">Sign in</button> to see all your orders.</p>`}
        <form id="trk" style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap"><input id="oid" placeholder="Order number, e.g. TPV-DEMO-0001" aria-label="Order number" style="flex:1;min-width:200px;height:50px;padding:0 14px;border:1px solid #cdb99b"><button class="btn btn-dark" type="submit">Track</button></form><div class="err" id="trkerr" role="alert" style="color:var(--err)"></div>
        ${s.user ? (mine.length ? `<div>${mine.map((o) => `<a href="#/order/${o.id}" style="display:flex;justify-content:space-between;gap:12px;padding:14px 0;border-top:1px solid var(--line);flex-wrap:wrap"><span><b style="font-weight:600">${o.id}</b><br><span class="muted" style="font-size:14px">${when(o.createdAt)} · ${o.items.length} item${o.items.length > 1 ? 's' : ''}</span></span><span style="text-align:right">${money(o.totals.total)}<br><span class="pill ${o.stage >= 6 ? 'ok' : 'info'}">${STAGES[o.stage]}</span></span></a>`).join('')}</div>` : `<p class="muted">No orders yet.</p>`) : ''}</div>
        <div class="panel"><h2 class="serif">Saved addresses</h2>${s.addr ? `<p>${esc(s.addr.name)}<br>${esc(s.addr.line)}<br>${esc(s.addr.city)} ${esc(s.addr.pin)}</p><p class="muted" style="font-size:14px;margin-top:10px">Addresses stay private and are never shown publicly.</p>` : `<p class="muted">Your address is saved here after your first checkout.</p>`}<h2 class="serif" style="margin-top:22px">Data &amp; privacy</h2><p class="muted" style="font-size:15px">You can ask to delete your data at any time. <a class="link-arrow" href="#/page/contact">Contact us</a></p></div></div></div>`;
    $('#si', root)?.addEventListener('click', signIn); $('#so', root)?.addEventListener('click', () => { auth.logout(); draw(); });
    $('#trk', root).onsubmit = (e) => { e.preventDefault(); const id = $('#oid', root).value.trim().toUpperCase(); if (order(id)) location.hash = '#/order/' + id; else $('#trkerr', root).textContent = 'No order with that number in this demo.'; };
  };
  draw();
}

function contact(root) {
  root.innerHTML = `<div class="wrap" style="max-width:760px;padding:50px var(--pad) 90px"><div class="crumbs"><a href="#/">Home</a> / Contact</div><h1 style="font-size:clamp(40px,6vw,72px);margin:8px 0 12px">Contact us</h1><p class="muted" style="margin-bottom:22px">Messages here create a support ticket you can see in the admin console. (Demo — no email is sent.)</p>
    <form class="panel" id="cf" novalidate><div class="field"><label for="cn">Your name</label><input id="cn"><div class="err" id="e-cn" role="alert"></div></div><div class="field"><label for="cm">Mobile or email</label><input id="cm"><div class="err" id="e-cm" role="alert"></div></div><div class="field"><label for="co">Order number (optional)</label><input id="co" placeholder="TPV-DEMO-0001"></div><div class="field"><label for="cx">How can we help?</label><textarea id="cx"></textarea><div class="err" id="e-cx" role="alert"></div></div><button class="btn btn-dark" type="submit">Send message</button><div id="cok" role="status" style="margin-top:14px"></div></form></div>`;
  $('#cf', root).onsubmit = (e) => {
    e.preventDefault(); const v = (i) => $('#' + i, root).value.trim(); const set = (i, m) => { $('#e-' + i, root).textContent = m; return !m; }; let ok = true;
    ok = set('cn', v('cn') ? '' : 'Please enter your name.') && ok; ok = set('cm', /^([6-9]\d{9}|[^@\s]+@[^@\s]+\.[^@\s]+)$/.test(v('cm')) ? '' : 'Enter a 10-digit mobile or a valid email.') && ok; ok = set('cx', v('cx').length > 5 ? '' : 'Tell us a little more.') && ok; if (!ok) return;
    const s = state(); const id = 'T-' + (s.tickets.length + 1); s.tickets.unshift({ id, subject: v('cx').slice(0, 60), order: v('co') || '—', channel: 'Web form', status: 'New', msgs: [{ from: 'cust', t: v('cx') }] }); log('Ticket created', id); _emit('tickets');
    $('#cok', root).innerHTML = `<span class="pill ok">Thank you — ticket ${id} was created (demo).</span>`; e.target.reset();
  };
}

// ---------- the real shop's account and contact pages (server-backed)
function accountOnline(root) {
  const draw = () => {
    const s = state(); const mine = s.user ? s.orders : [];
    root.innerHTML = `<div class="wrap" style="padding-bottom:80px"><div class="page-head"><div class="crumbs"><a href="#/">Home</a> / Account</div><h1>${s.user ? 'Your account' : 'Account'}</h1></div>
      <div class="co" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)"><div class="panel"><h2 class="serif">${s.user ? 'Your orders' : 'Track an order'}</h2>
        ${s.user ? `<p class="muted" style="margin-bottom:12px">Signed in as +91 ${esc(s.user.mobile)} · <button style="text-decoration:underline" id="so">Sign out</button></p>` : `<p class="muted" style="margin-bottom:12px">Track any order with its number and the last 4 digits of the mobile number it was placed with. <button style="text-decoration:underline" id="si">Sign in</button> to see all your orders.</p>`}
        <form id="trk" style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap"><input id="oid" placeholder="Order number, e.g. TPV-100001" aria-label="Order number" style="flex:1;min-width:200px;height:50px;padding:0 14px;border:1px solid #cdb99b">${s.user ? '' : '<input id="om" inputmode="numeric" maxlength="4" placeholder="Last 4 digits of mobile" aria-label="Last 4 digits of the mobile number" style="width:180px;height:50px;padding:0 14px;border:1px solid #cdb99b">'}<button class="btn btn-dark" type="submit">Track</button></form><div class="err" id="trkerr" role="alert" style="color:var(--err)"></div>
        ${s.user ? (mine.length ? `<div>${mine.map((o) => `<a href="#/order/${esc(o.id)}" style="display:flex;justify-content:space-between;gap:12px;padding:14px 0;border-top:1px solid var(--line);flex-wrap:wrap"><span><b style="font-weight:600">${esc(o.id)}</b><br><span class="muted" style="font-size:14px">${when(o.createdAt)} · ${o.items.length} item${o.items.length > 1 ? 's' : ''}</span></span><span style="text-align:right">${money(o.totals.total)}<br><span class="pill ${o.stage >= 6 ? 'ok' : 'info'}">${STAGES[o.stage]}</span></span></a>`).join('')}</div>` : `<p class="muted">No orders yet.</p>`) : ''}</div>
        <div class="panel"><h2 class="serif">Saved address</h2>${s.addr ? `<p>${esc(s.addr.name)}<br>${esc(s.addr.line)}<br>${esc(s.addr.city)} ${esc(s.addr.pin)}</p><p class="muted" style="font-size:14px;margin-top:10px">Saved on this device only, and never shown publicly.</p>` : `<p class="muted">Your address is remembered on this device after your first checkout.</p>`}<h2 class="serif" style="margin-top:22px">Data &amp; privacy</h2><p class="muted" style="font-size:15px">You can ask us to delete your data at any time. <a class="link-arrow" href="#/page/contact">Contact us</a></p></div></div></div>`;
    $('#si', root)?.addEventListener('click', signIn);
    $('#so', root)?.addEventListener('click', async () => { await auth.logout(); draw(); });
    $('#trk', root).onsubmit = async (e) => {
      e.preventDefault(); const id = $('#oid', root).value.trim().toUpperCase(); const err = $('#trkerr', root); err.textContent = ''; if (!id) return;
      try {
        if (state().user) { if (await fetchOrder(id)) { location.hash = '#/order/' + id; return; } err.textContent = 'We could not find that order on your account.'; return; }
        const m = ($('#om', root)?.value || '').replace(/\D/g, ''); if (m.length !== 4) { err.textContent = 'Enter the last 4 digits of the mobile number used for the order.'; return; }
        await trackGuest(id, m); location.hash = '#/order/' + id;
      } catch (er) { err.textContent = er.message; }
    };
  };
  draw(); if (state().user) loadMyOrders().catch(() => {});
  const on = () => { if (document.contains(root) && !document.activeElement?.closest('#trk')) draw(); }; addEventListener('tpv:data', on);
  return () => removeEventListener('tpv:data', on);
}

function contactOnline(root) {
  const reach = [biz.supportEmail && `<a class="link-arrow" href="mailto:${esc(biz.supportEmail)}">${esc(biz.supportEmail)}</a>`, biz.supportPhone && esc(biz.supportPhone)].filter(Boolean).join(' · ');
  root.innerHTML = `<div class="wrap" style="max-width:760px;padding:50px var(--pad) 90px"><div class="crumbs"><a href="#/">Home</a> / Contact</div><h1 style="font-size:clamp(40px,6vw,72px);margin:8px 0 12px">Contact us</h1><p class="muted" style="margin-bottom:22px">Send us a message and our team will reply by phone or email.${reach ? ' You can also reach us at ' + reach + '.' : ''}</p>
    <form class="panel" id="cf" novalidate><div class="field"><label for="cn">Your name</label><input id="cn" autocomplete="name"><div class="err" id="e-cn" role="alert"></div></div><div class="field"><label for="cm">Mobile or email</label><input id="cm" autocomplete="email"><div class="err" id="e-cm" role="alert"></div></div><div class="field"><label for="co">Order number (optional)</label><input id="co" placeholder="TPV-100001"></div><div class="field"><label for="cx">How can we help?</label><textarea id="cx"></textarea><div class="err" id="e-cx" role="alert"></div></div><button class="btn btn-dark" type="submit">Send message</button><div id="cok" role="status" style="margin-top:14px"></div></form></div>`;
  $('#cf', root).onsubmit = async (e) => {
    e.preventDefault(); const v = (i) => $('#' + i, root).value.trim(); const set = (i, m) => { $('#e-' + i, root).textContent = m; return !m; }; let ok = true;
    ok = set('cn', v('cn') ? '' : 'Please enter your name.') && ok; ok = set('cm', /^([6-9]\d{9}|[^@\s]+@[^@\s]+\.[^@\s]+)$/.test(v('cm')) ? '' : 'Enter a 10-digit mobile or a valid email.') && ok; ok = set('cx', v('cx').length > 5 ? '' : 'Tell us a little more.') && ok; if (!ok) return;
    const btn = $('button[type=submit]', root); btn.disabled = true;
    try { const id = await createTicket({ name: v('cn'), contact: v('cm'), order: v('co') || '—', message: v('cx'), subject: v('cx').slice(0, 60), channel: 'Web form' }); $('#cok', root).innerHTML = `<span class="pill ok">Thank you — we have your message (reference ${esc(id)}).</span>`; e.target.reset(); }
    catch (er) { $('#cok', root).innerHTML = `<span class="pill err" style="white-space:normal">${esc(er.message)}</span>`; } finally { btn.disabled = false; }
  };
}

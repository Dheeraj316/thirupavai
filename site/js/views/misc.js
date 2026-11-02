import { state, products, wish, auth, order, log, _emit, fetchOrder, trackGuest, loadMyOrders, createTicket } from '../store.js';
import { h, $, $$, ic, card, esc, money, when, modal, closeAll, toast } from '../ui.js';
import { STAGES } from '../store.js';
import { ONLINE, T, biz } from '../api.js';

// ---------- information pages. Two voices: the demo says plainly that it is a prototype; the shop (staging and live) states how the shop really works.
const TOPICS = [['shipping', 'Shipping and delivery'], ['returns', 'Returns and exchanges'], ['privacy', 'Privacy policy'], ['terms', 'Terms of use'], ['faqs', 'FAQs'], ['contact', 'Contact us']];
const PAGES = {
  shipping: ['Shipping and delivery', `<p>Every order is tracked. In this demo the delivery dates, fees and courier details are sample values.</p><ul><li>Standard delivery: free, 3–7 days depending on the PIN code.</li><li>Express delivery: ₹ 350 where available.</li><li>A live courier position is shown only when the courier shares it.</li></ul><p class="fl-fine">Placeholder text. The final wording must match what the business really does.</p>`],
  returns: ['Returns and exchanges', `<p>Eligible pieces can be returned within 7 days of delivery, unworn and with the tags attached. Stitched blouses, fall and pico, and gift add-ons are final sale.</p><p>Refunds go back to the original payment method once the piece has passed a quality check.</p><p class="fl-fine">Placeholder text, to be reviewed with the business and its legal adviser.</p>`],
  privacy: ['Privacy policy', `<p>We collect only what an order needs: name, mobile number, address and a payment reference. Card numbers and CVV are never stored. Customer details are masked in the admin console according to each person’s role.</p><p>You can ask us to delete your data at any time.</p><p class="fl-fine">Placeholder text. A real policy must cover data retention, processors and rights under the applicable law.</p>`],
  terms: ['Terms of use', `<p>This is a concept prototype. Products, prices and orders are sample data, and nothing here is an offer for sale.</p><p class="fl-fine">Placeholder text. Real terms need legal review.</p>`],
  security: ['Security updates', `<p>No security notices have been published. This page will list only verified, approved notices. Thirupavai does not claim to be “completely secure”: security is a continuing practice.</p>`],
  faqs: ['FAQs', `<details open><summary>Do I need an account to shop?</summary><p>No. Browse, filter and build a bag as a guest. We ask you to sign in only at checkout, and your bag is kept.</p></details><details><summary>Is the 3D viewer a real 360° view?</summary><p>No. It is a simulated cloth preview built from the product photographs. A true 360° view needs a real 360° capture.</p></details><details><summary>Is payment real here?</summary><p>No. This prototype runs in test mode. Try the UPI ID <code>success@upi</code>, <code>fail@upi</code> or <code>pending@upi</code>.</p></details><details><summary>Can two people buy the same one-of-one piece?</summary><p>No. Stock is checked again at payment, so a one-of-one saree can only be sold once.</p></details>`],
  notfound: ['Page not found', `<p>That page doesn’t exist. <a class="link-arrow" href="#/">Back to home</a></p>`],
};
// The real shop's wording, drafted from how the system actually behaves (prices, shipping, stock, payments, data handling).
// The business and its lawyer must review the policy pages before launch (see GO-LIVE.md).
const SHOP_PAGES = {
  shipping: ['Shipping and delivery', `<p>Every order is tracked until it reaches you. Follow it under Orders in your account, or with your order number and the mobile number you ordered with.</p><ul><li>Standard delivery is free and usually takes 3–7 days, depending on your PIN code. You will see the estimate at checkout.</li><li>Express delivery costs ₹ 350, where it is available.</li><li>We show the courier’s live position only when the courier shares it with us.</li></ul>`],
  returns: ['Returns and exchanges', `<p>Eligible pieces can be returned within 7 days of delivery, unworn and with the tags attached. Stitched blouses, fall and pico, and gift add-ons are final sale.</p><p>Refunds go back to the original payment method once the piece has passed our quality check. To start a return, write to us from the <a class="link-arrow" href="#/page/contact">contact page</a> with your order number.</p>`],
  privacy: ['Privacy policy', `<p>We collect only what an order needs: your name, mobile number, delivery address and a payment reference. Card, UPI and bank details are handled by our payment provider and are never stored by us.</p><p>Our staff see your details only as far as their role requires. You can ask us to delete your data at any time from the <a class="link-arrow" href="#/page/contact">contact page</a>.</p>`],
  terms: ['Terms of use', `<p>Prices include GST. A one-of-one piece is sold once: stock is checked again at the moment you pay, and an order is confirmed only after your payment has been verified.</p><p>Delivery dates are estimates. Returns follow our returns policy. Questions about an order can be sent from the <a class="link-arrow" href="#/page/contact">contact page</a>.</p>`],
  security: PAGES.security,
  faqs: ['FAQs', `<details open><summary>Do I need an account to shop?</summary><p>No. Browse, filter and build a bag as a guest. We ask you to sign in with your mobile number only at checkout, and your bag is kept.</p></details><details><summary>How do I track my order?</summary><p>Open <a class="link-arrow" href="#/account">your account</a>. Signed in, you will see all your orders. Otherwise enter the order number and the last 4 digits of the mobile number you ordered with.</p></details><details><summary>Is the 3D viewer a real 360° view?</summary><p>No. It is an interactive cloth preview built from the product photographs, to show how the saree falls.</p></details><details><summary>Is payment secure?</summary><p>Payments are taken in our payment provider’s secure window. Your card or bank details never reach our servers, and an order is confirmed only after the payment is verified.</p></details><details><summary>Can two people buy the same one-of-one piece?</summary><p>No. Stock is checked again at payment, so a one-of-one saree is only ever sold once.</p></details>`],
  notfound: PAGES.notfound,
};
const crumbs = (...items) => `<nav class="fl-crumbs" aria-label="Breadcrumb">${items.map(([l, href], i) => `${i ? '<span aria-hidden="true">/</span>' : ''}${href ? `<a href="${href}">${l}</a>` : `<span>${l}</span>`}`).join('')}</nav>`;
const subnav = (cur) => `<nav class="fl-subnav" aria-label="Help and policies">${TOPICS.map(([k, n]) => `<a href="#/page/${k}" ${k === cur ? 'aria-current="page"' : ''}>${n}</a>`).join('')}</nav>`;

export default async function misc(root, route) {
  const name = route.path.replace(/^\//, '').split('/')[0] === 'page' ? route.args[0] : route.args[0] || route.path.replace(/^\//, '');
  if (name === 'wishlist') return wishlist(root);
  if (name === 'account') return accountView(root);
  if (name === 'contact') return contactView(root);
  const [title, body] = (ONLINE ? SHOP_PAGES : PAGES)[name] || PAGES.notfound;
  root.innerHTML = `<div class="wrap fl fl-info">${crumbs(['Home', '#/'], [esc(title)])}<div class="fl-infogrid">${subnav(name)}<article class="fl-prose"><h1 class="fl-h1">${esc(title)}</h1>${body}</article></div></div>`;
}

function wishlist(root) {
  const draw = () => {
    const list = state().wish.map((id) => products().find((p) => p.id === id)).filter(Boolean);
    root.innerHTML = `<div class="wrap fl fl-list">${crumbs(['Home', '#/'], ['Wishlist'])}<header class="fl-pagehead"><h1 class="fl-h1">Your wishlist</h1>${list.length ? `<p class="fl-lede">${list.length} saved saree${list.length > 1 ? 's' : ''}. They stay on this device.</p>` : ''}</header>${list.length ? `<div class="pgrid" id="wg"></div>` : `<div class="fl-empty-in"><h2 class="fl-h2">Nothing saved yet</h2><p class="fl-lede">Tap the heart on any saree to keep it here for later.</p><p><a class="btn btn-gold" href="#/shop">Browse sarees</a></p></div>`}</div>`;
    const g = $('#wg', root); list.forEach((p) => g?.appendChild(card(p)));
  };
  draw(); const on = () => draw(); addEventListener('tpv:data', on);
  const heart = (e) => { if (e.target.closest('.heart')) setTimeout(draw, 60); }; document.addEventListener('click', heart);
  return () => { removeEventListener('tpv:data', on); document.removeEventListener('click', heart); };
}

// ---------- sign in (a small dialog, used by the account page and the admin console)
export function signIn() { return ONLINE ? signInOnline() : signInDemo(); }
function signInOnline() {
  let mob = '', sent = false;
  const m = modal(`<h2 class="serif" style="font-size:34px">Sign in</h2><p class="muted" style="margin:6px 0 16px">We will text a 6-digit code to your mobile number.</p><div class="field"><label for="am">Mobile number</label><input id="am" type="tel" inputmode="numeric" maxlength="10" autofocus placeholder="10-digit mobile number" autocomplete="tel-national" aria-describedby="ame"><div class="err" id="ame" role="alert"></div></div><div id="aotp"></div><button class="btn btn-gold btn-block" id="ago" type="button">Send code</button>`);
  $('#ago', m).onclick = async () => {
    const b = $('#ago', m), e1 = $('#ame', m); b.disabled = true;
    try {
      if (!sent) {
        mob = $('#am', m).value.trim(); if (!/^[6-9]\d{9}$/.test(mob)) { e1.textContent = 'Enter a valid 10-digit Indian mobile number.'; return; } e1.textContent = '';
        const r = await auth.sendOtp(mob); sent = true;
        $('#aotp', m).innerHTML = `${r.demoCode ? `<p class="pill gd" role="status">Test server: no text message is sent. Your code is <b>${r.demoCode}</b></p>` : ''}<div class="field"><label for="ac">6-digit code</label><input id="ac" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" aria-describedby="ace"><div class="err" id="ace" role="alert"></div></div>`;
        b.textContent = 'Verify'; $('#ac', m).focus(); return;
      }
      await auth.verifyOtp(mob, $('#ac', m).value.trim()); closeAll(); toast('Signed in');
    } catch (er) { ($('#ace', m) || e1).textContent = er.message; } finally { b.disabled = false; }
  };
}
function signInDemo() {
  let otp = null, mob = '';
  const m = modal(`<h2 class="serif" style="font-size:34px">Sign in</h2><p class="muted" style="margin:6px 0 16px">Demo sign-in. No text message is sent.</p><div class="field"><label for="am">Mobile number</label><input id="am" type="tel" inputmode="numeric" maxlength="10" autofocus placeholder="10-digit mobile number" aria-describedby="ame"><div class="err" id="ame" role="alert"></div></div><div id="aotp"></div><button class="btn btn-gold btn-block" id="ago" type="button">Send code</button>`);
  $('#ago', m).onclick = () => {
    if (!otp) { mob = $('#am', m).value.trim(); if (!/^[6-9]\d{9}$/.test(mob)) { $('#ame', m).textContent = 'Enter a valid 10-digit Indian mobile number.'; return; } $('#ame', m).textContent = ''; otp = String(Math.floor(100000 + Math.random() * 900000)); $('#aotp', m).innerHTML = `<p class="pill gd" role="status">Demo code: <b>${otp}</b></p><div class="field"><label for="ac">6-digit code</label><input id="ac" type="text" inputmode="numeric" maxlength="6" aria-describedby="ace"><div class="err" id="ace" role="alert"></div></div>`; $('#ago', m).textContent = 'Verify'; $('#ac', m).focus(); return; }
    if ($('#ac', m).value.trim() !== otp) { $('#ace', m).textContent = 'That code is not right.'; return; } auth.login(mob); closeAll(); toast('Signed in'); location.reload();
  };
}

// ---------- account: your orders, track an order, saved address (demo and the real shop share one layout)
function accountView(root) {
  const draw = () => {
    const s = state(); const mine = s.user ? (ONLINE ? s.orders : s.orders.filter((o) => !o.seed || o.customer.mobile.replace(/\D/g, '').endsWith(s.user.mobile.slice(-4)))) : [];
    const rows = mine.map((o) => `<li><a class="fl-orow" href="#/order/${esc(o.id)}"><span class="a"><b>${esc(o.id)}</b><small>${when(o.createdAt)} · ${o.items.length} item${o.items.length > 1 ? 's' : ''}</small></span><span class="z">${money(o.totals.total)}<span class="pill ${o.stage >= 6 ? 'ok' : 'info'}">${STAGES[o.stage]}</span></span></a></li>`).join('');
    root.innerHTML = `<div class="wrap fl fl-acct">${crumbs(['Home', '#/'], ['Account'])}<h1 class="fl-h1">${s.user ? 'Your account' : 'Account'}</h1>
      <div class="fl-two"><div class="fl-stack">
        <section class="fl-card"><h2 class="fl-h3">Track an order</h2><p class="fl-fine fl-trkhelp">${ONLINE ? (s.user ? 'Enter an order number to open it.' : 'Enter the order number and the last 4 digits of the mobile number it was placed with.') : 'Enter an order number to open it. No sign-in needed.'}</p>
          <form id="trk" class="fl-trk" novalidate><div class="field"><label for="oid">Order number</label><input id="oid" type="text" placeholder="${ONLINE ? 'TPV-100001' : 'TPV-DEMO-0001'}" autocomplete="off" autocapitalize="characters" aria-describedby="trkerr"></div>${ONLINE && !s.user ? '<div class="field"><label for="om">Last 4 digits of your mobile</label><input id="om" type="text" inputmode="numeric" maxlength="4" placeholder="1234" autocomplete="off" aria-describedby="trkerr"></div>' : ''}<button class="btn btn-gold fl-btn" type="submit">Track order</button></form><div class="err fl-err" id="trkerr" role="alert"></div></section>
        <section class="fl-card"><h2 class="fl-h3">Your orders</h2>${s.user ? `<p class="fl-fine">Signed in as +91 ${esc(s.user.mobile)}. <button type="button" class="fl-link" id="so">Sign out</button></p>${mine.length ? `<ul class="fl-orows">${rows}</ul>` : `<p class="fl-lede">You haven’t placed an order yet.</p>`}` : `<p class="fl-lede">Sign in to see every order you have placed.</p><p><button type="button" class="btn btn-line" id="si">Sign in</button></p>`}</section></div>
        <div class="fl-stack"><section class="fl-card"><h2 class="fl-h3">Saved address</h2>${s.addr ? `<address class="fl-addr">${esc(s.addr.name)}<br>${esc(s.addr.line)}<br>${esc(s.addr.city)} ${esc(s.addr.pin)}</address><p class="fl-fine">${ONLINE ? 'Saved on this device only, and never shown publicly.' : 'Saved in this browser only.'}</p>` : `<p class="fl-lede">${ONLINE ? 'Your address is remembered on this device after your first order.' : 'Your address is saved here after your first checkout.'}</p>`}</section>
        <section class="fl-card"><h2 class="fl-h3">Your data</h2><p class="fl-lede">You can ask us to delete your data at any time. <a class="link-arrow" href="#/page/contact">Contact us</a></p></section></div></div></div>`;
    $('#si', root)?.addEventListener('click', signIn);
    $('#so', root)?.addEventListener('click', async () => { await auth.logout(); draw(); });
    $('#trk', root).onsubmit = async (e) => {
      e.preventDefault(); const id = $('#oid', root).value.trim().toUpperCase(); const er = $('#trkerr', root); er.textContent = ''; if (!id) { er.textContent = 'Enter an order number.'; return; }
      if (!ONLINE) { if (order(id)) location.hash = '#/order/' + id; else er.textContent = 'No order with that number in this demo.'; return; }
      try {
        if (state().user) { if (await fetchOrder(id)) { location.hash = '#/order/' + id; return; } er.textContent = 'We could not find that order on your account.'; return; }
        const m = ($('#om', root)?.value || '').replace(/\D/g, ''); if (m.length !== 4) { er.textContent = 'Enter the last 4 digits of the mobile number used for the order.'; return; }
        await trackGuest(id, m); location.hash = '#/order/' + id;
      } catch (x) { er.textContent = x.message; }
    };
  };
  draw(); if (ONLINE && state().user) loadMyOrders().catch(() => {});
  const on = () => { if (document.contains(root) && !document.activeElement?.closest('#trk')) draw(); }; addEventListener('tpv:data', on);
  return () => removeEventListener('tpv:data', on);
}

// ---------- contact
function contactView(root) {
  const reach = ONLINE ? [biz.supportEmail && `<a class="link-arrow" href="mailto:${esc(biz.supportEmail)}">${esc(biz.supportEmail)}</a>`, biz.supportPhone && esc(biz.supportPhone)].filter(Boolean) : [];
  root.innerHTML = `<div class="wrap fl fl-info">${crumbs(['Home', '#/'], ['Contact us'])}<div class="fl-infogrid">${subnav('contact')}<article class="fl-prose"><h1 class="fl-h1">Contact us</h1>
    <p class="fl-lede">${ONLINE ? 'Send us a message and our team will reply by phone or email.' : 'Messages sent here create a support ticket you can see in the admin console. This is a demo: no email is sent.'}${reach.length ? ' You can also reach us at ' + reach.join(' · ') + '.' : ''}</p>
    <form class="fl-card fl-form" id="cf" novalidate><div class="field"><label for="cn">Your name</label><input id="cn" type="text" autocomplete="name" aria-describedby="e-cn"><div class="err" id="e-cn" role="alert"></div></div><div class="field"><label for="cm">Mobile number or email</label><input id="cm" type="text" autocomplete="email" aria-describedby="e-cm"><div class="err" id="e-cm" role="alert"></div></div><div class="field"><label for="co">Order number (optional)</label><input id="co" type="text" placeholder="${ONLINE ? 'TPV-100001' : 'TPV-DEMO-0001'}" autocomplete="off"></div><div class="field"><label for="cx">How can we help?</label><textarea id="cx" aria-describedby="e-cx"></textarea><div class="err" id="e-cx" role="alert"></div></div><button class="btn btn-gold fl-btn" type="submit">Send message</button><div id="cok" role="status"></div></form></article></div></div>`;
  $('#cf', root).onsubmit = async (e) => {
    e.preventDefault(); const v = (i) => $('#' + i, root).value.trim(); const set = (i, m) => { $('#e-' + i, root).textContent = m; $('#' + i, root).setAttribute('aria-invalid', !!m); return !m; }; let ok = true;
    ok = set('cn', v('cn') ? '' : 'Please enter your name.') && ok; ok = set('cm', /^([6-9]\d{9}|[^@\s]+@[^@\s]+\.[^@\s]+)$/.test(v('cm')) ? '' : 'Enter a 10-digit mobile number or a valid email address.') && ok; ok = set('cx', v('cx').length > 5 ? '' : 'Tell us a little more so we can help.') && ok; if (!ok) { $('[aria-invalid=true]', root)?.focus(); return; }
    if (!ONLINE) {
      const s = state(); const id = 'T-' + (s.tickets.length + 1); s.tickets.unshift({ id, subject: v('cx').slice(0, 60), order: v('co') || '—', channel: 'Web form', status: 'New', msgs: [{ from: 'cust', t: v('cx') }] }); log('Ticket created', id); _emit('tickets');
      $('#cok', root).innerHTML = `<span class="pill ok">Thank you. Your ticket ${id} was created (demo).</span>`; e.target.reset(); return;
    }
    const btn = $('button[type=submit]', root); btn.disabled = true;
    try { const id = await createTicket({ name: v('cn'), contact: v('cm'), order: v('co') || '—', message: v('cx'), subject: v('cx').slice(0, 60), channel: 'Web form' }); $('#cok', root).innerHTML = `<span class="pill ok">Thank you. We have your message (reference ${esc(id)}).</span>`; e.target.reset(); }
    catch (er) { $('#cok', root).innerHTML = `<span class="pill err">${esc(er.message)}</span>`; } finally { btn.disabled = false; }
  };
}

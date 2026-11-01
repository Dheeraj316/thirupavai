import { state, cart, totals, auth, placeOrder, prod, ADDONS, _emit, adoptOrder, refreshCatalog, loadMyOrders } from '../store.js';
import { ONLINE, LIVE, T, api, ApiError, loadScript } from '../api.js';
import { checkPin, inr } from '../data.js';
import { h, $, $$, ic, img, toast, esc, money } from '../ui.js';

const CITIES = { '600': ['Chennai', 'Tamil Nadu'], '625': ['Madurai', 'Tamil Nadu'], '641': ['Coimbatore', 'Tamil Nadu'], '560': ['Bengaluru', 'Karnataka'], '500': ['Hyderabad', 'Telangana'], '110': ['New Delhi', 'Delhi'], '400': ['Mumbai', 'Maharashtra'], '700': ['Kolkata', 'West Bengal'], '682': ['Kochi', 'Kerala'] };
const BANKS = ['Demo Bank of India', 'Sample State Bank', 'Test Co-operative Bank'];
export default async function checkout(root) {
  const attemptKey = 'chk-' + Math.random().toString(36).slice(2, 10);   // one idempotency key per checkout visit
  let t = totals();
  if (!t.lines.length) { root.innerHTML = `<div class="wrap empty"><h3>Your bag is empty</h3><p class="muted">Add a saree before checking out. Browsing never needs an account.</p><p style="margin-top:16px"><a class="btn btn-dark" href="#/shop">Shop sarees</a></p></div>`; return; }
  const S = state(); const D = { mobile: S.user?.mobile || '', name: S.addr?.name || '', line: S.addr?.line || '', landmark: S.addr?.landmark || '', pin: S.addr?.pin || S.pin || '', city: S.addr?.city || '', st: S.addr?.st || '', delivery: 'Standard', method: 'upi' };
  let step = S.user ? 2 : 1, otp = null, demoCode = null, tries = 0, busy = false, otpTime = 0;
  const STEPS = ['Sign in', 'Address', 'Delivery', 'Payment'];

  root.innerHTML = `<div class="wrap"><div class="page-head" style="padding-bottom:6px"><div class="crumbs"><a href="#/shop">Shop</a> / Checkout</div><h1>Checkout</h1></div><div class="co"><div><div class="steps" id="steps" aria-label="Checkout progress"></div><div class="panel" id="panel"></div></div><aside class="summary" id="sum" aria-label="Order summary"></aside></div></div>`;
  const panel = $('#panel', root);

  function drawSum() {
    t = totals(D.delivery); if (!t.lines.length) { location.hash = '#/checkout'; return; }
    $('#sum', root).innerHTML = `<h2 class="serif">Order summary</h2>${t.lines.map((l) => `<div class="li"><div class="ph" style="background-image:url(${img(l.p.gallery[0].img)});background-position:${l.p.gallery[0].pos}"></div><div style="flex:1"><b>${esc(l.p.name)}</b><small style="color:var(--champ)">Qty ${l.qty} · ${l.p.sku}${(l.addons || []).length ? ' · ' + l.addons.map((a) => ADDONS[a][0]).join(', ') : ''}</small></div><span style="font:500 17px var(--sans)">${money(l.line)}</span></div>`).join('')}
      <div class="sumrows" style="margin-top:14px;border-top:1px solid rgba(198,161,91,.4);padding-top:12px"><div><span>Subtotal</span><span>${money(t.sub)}</span></div>${t.discount ? `<div style="color:#9fe0bd"><span>Discount · ${esc(state().coupon)}${T(' (demo)', '')}</span><span>− ${money(t.discount)}</span></div>` : ''}<div><span>Delivery</span><span>${step < 3 ? 'Selected next' : t.delivery ? money(t.delivery) : T('Free · sample rule', 'Free')}</span></div><div><span>Taxes</span><span>GST included</span></div><div class="tot"><span>TOTAL PAYABLE</span><b class="serif">${money(t.total)}</b></div></div>
      <p style="margin-top:16px;font-size:13.5px;color:#cdb9bd">${T('Sample values. A real order re-validates price, offers and stock on the server before payment.', 'Price, offers and stock are checked again on our server at the moment you pay.')}</p><p style="margin-top:8px"><a href="#/shop" style="color:var(--goldhi);text-decoration:underline;font-size:14px">Continue shopping</a></p>`;
  }
  function drawSteps() { $('#steps', root).innerHTML = STEPS.map((s, i) => `${i ? '<i></i>' : ''}<span class="${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}" ${i + 1 === step ? 'aria-current="step"' : ''}><b>${i + 1 < step ? ic('check', 15, 2.6) : i + 1}</b>${s}</span>`).join(''); }
  const err = (id, m) => { const e = $('#e-' + id, root); if (e) e.textContent = m || ''; const i = $('#' + id, root); if (i) i.setAttribute('aria-invalid', !!m); return !m; };
  const field = (id, label, val, attrs = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(val)}" ${attrs}><div class="err" id="e-${id}" role="alert"></div></div>`;

  function draw() { drawSteps(); drawSum(); [s1, s2, s3, s4][step - 1](); panel.querySelector('h2')?.setAttribute('tabindex', '-1'); panel.querySelector('h2')?.focus({ preventScroll: true }); }

  // ---- 1. sign in with OTP
  function s1() {
    panel.innerHTML = `<h2 class="serif">Sign in to continue</h2><p class="muted" style="margin-bottom:18px">Browsing and your bag never needed an account — we only ask now, and your bag is kept. We verify by mobile OTP; codes are never stored in plain text.</p>
      <form id="f1" novalidate><div class="field"><label for="mob">Mobile number</label><div style="display:flex;gap:10px"><div style="width:74px;height:50px;border:1px solid #cdb99b;background:#f4ecdf;display:flex;align-items:center;justify-content:center;font-weight:500">+91</div><input id="mob" inputmode="numeric" maxlength="10" placeholder="10-digit mobile" value="${esc(D.mobile)}" autocomplete="tel-national" style="flex:1"></div><div class="err" id="e-mob" role="alert"></div></div>
      <button class="btn btn-dark" id="sendotp" type="submit">${otp ? 'Resend OTP' : 'Send OTP'}</button></form><div id="otpbox"></div>`;
    $('#f1', root).onsubmit = (e) => {
      e.preventDefault(); const v = $('#mob', root).value.trim(); if (!/^[6-9]\d{9}$/.test(v)) { err('mob', 'Enter a valid 10-digit Indian mobile number.'); return; } err('mob', '');
      if (otp && Date.now() - otpTime < 8000) { toast('Please wait a few seconds before requesting another code.'); return; }
      D.mobile = v; otpTime = Date.now(); tries = 0;
      if (ONLINE) {                                                    // the server makes, hashes and texts the code; the browser never sees it unless this is a test server
        const b = $('#sendotp', root); b.disabled = true;
        auth.sendOtp(v).then((r) => { demoCode = r.demoCode || null; otp = demoCode || 'sent'; drawOtp(); }).catch((er) => { otpTime = 0; err('mob', er.message); }).finally(() => { b.disabled = false; });
        return;
      }
      otp = String(Math.floor(100000 + Math.random() * 900000)); drawOtp();
    };
    if (otp) drawOtp();
  }
  function drawOtp() {
    $('#otpbox', root).innerHTML = `<div style="margin-top:22px">${ONLINE && !demoCode ? `<p class="muted" style="margin-bottom:12px">We sent a 6-digit code by SMS to +91 ${esc(D.mobile.slice(0, 2))}••••••${esc(D.mobile.slice(-2))}. It stays valid for 5 minutes.</p>` : `<div class="pill gd" style="margin-bottom:10px">${ONLINE ? 'TEST SERVER' : 'DEMO'} — no SMS is sent. Your code: <b style="letter-spacing:.2em">${otp}</b></div>`}<div class="field"><label for="o0">Enter the 6-digit code</label><div class="otp" id="otp">${[0, 1, 2, 3, 4, 5].map((i) => `<input id="o${i}" inputmode="numeric" maxlength="1" aria-label="Digit ${i + 1}" autocomplete="one-time-code">`).join('')}</div><div class="err" id="e-otp" role="alert"></div></div><button class="btn btn-gold" id="verify">Verify &amp; continue</button></div>`;
    const ins = $$('#otp input', root); ins[0].focus();
    ins.forEach((i, k) => { i.oninput = () => { i.value = i.value.replace(/\D/g, ''); if (i.value && ins[k + 1]) ins[k + 1].focus(); if (k === 5 && ins.every((x) => x.value)) $('#verify', root).click(); }; i.onkeydown = (e) => { if (e.key === 'Backspace' && !i.value && ins[k - 1]) ins[k - 1].focus(); }; i.onpaste = (e) => { const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (d.length > 1) { e.preventDefault(); ins.forEach((x, j) => (x.value = d[j] || '')); ins[Math.min(d.length, 5)].focus(); if (d.length === 6) $('#verify', root).click(); } }; });
    $('#verify', root).onclick = () => {
      const code = ins.map((x) => x.value).join(''); if (code.length < 6) { $('#e-otp', root).textContent = 'Enter all 6 digits.'; return; }
      if (ONLINE) {
        const b = $('#verify', root); b.disabled = true;
        auth.verifyOtp(D.mobile, code).then(() => { step = 2; toast('Signed in — your bag was preserved'); draw(); })
          .catch((er) => { $('#e-otp', root).textContent = er.message; if (er.status === 429 || /expired/i.test(er.message)) { otp = null; setTimeout(s1, 1500); } }).finally(() => { b.disabled = false; });
        return;
      }
      if (code !== otp) { tries++; $('#e-otp', root).textContent = tries >= 3 ? 'Too many wrong attempts. Request a new code.' : `That code is not right (${3 - tries} attempt${3 - tries === 1 ? '' : 's'} left).`; if (tries >= 3) { otp = null; setTimeout(s1, 800); } return; }
      auth.login(D.mobile); step = 2; toast('Signed in — your bag was preserved'); draw();
    };
  }

  // ---- 2. address
  function s2() {
    panel.innerHTML = `<h2 class="serif">Delivery address</h2><p class="muted" style="margin-bottom:16px">Signed in as +91 ${esc(state().user?.mobile || D.mobile)} · <button class="muted" style="text-decoration:underline" id="signout">Not you?</button></p><form id="f2" novalidate>
      ${field('nm', 'Full name', D.name, 'autocomplete="name"')}${field('ad', 'Address', D.line, 'autocomplete="street-address"')}${field('lm', 'Landmark (optional)', D.landmark)}
      <div class="row2"><div class="field"><label for="pn">PIN code</label><input id="pn" inputmode="numeric" maxlength="6" value="${esc(D.pin)}" autocomplete="postal-code"><div class="err" id="e-pn" role="alert"></div></div>${field('ct', 'City', D.city, 'autocomplete="address-level2"')}</div>${field('sx', 'State', D.st, 'autocomplete="address-level1"')}<div id="svc" role="status" style="margin-bottom:16px"></div>
      <button class="btn btn-dark" type="submit">Continue to delivery</button></form>`;
    $('#signout', root).onclick = async () => { await auth.logout(); step = 1; otp = null; demoCode = null; draw(); };
    const pn = $('#pn', root), svc = $('#svc', root);
    const chk = () => { const r = checkPin(pn.value.trim()); if (pn.value.trim().length === 6) { svc.innerHTML = r.ok ? `<span class="pill ok">${ic('check', 14, 2.6)} PIN ${pn.value} is serviceable · ${esc(r.zone)}</span>` : `<span class="pill err">${esc(r.msg)}</span>`; const c = CITIES[pn.value.slice(0, 3)]; if (c && !$('#ct', root).value) { $('#ct', root).value = c[0]; $('#sx', root).value = c[1]; } } else svc.innerHTML = ''; return r; };
    pn.oninput = () => { pn.value = pn.value.replace(/\D/g, ''); chk(); }; if (pn.value) chk();
    $('#f2', root).onsubmit = (e) => {
      e.preventDefault(); const v = (id) => $('#' + id, root).value.trim(); let ok = true;
      ok = err('nm', v('nm').length < 2 ? 'Enter the recipient’s full name.' : '') && ok; ok = err('ad', v('ad').length < 6 ? 'Enter the full address.' : '') && ok; ok = err('ct', v('ct') ? '' : 'Enter the city.') && ok; ok = err('sx', v('sx') ? '' : 'Enter the state.') && ok;
      const r = checkPin(v('pn')); ok = err('pn', r.ok ? '' : r.msg) && ok; if (!ok) { $('[aria-invalid=true]', root)?.focus(); return; }
      Object.assign(D, { name: v('nm'), line: v('ad'), landmark: v('lm'), pin: v('pn'), city: v('ct'), st: v('sx') }); state().addr = { name: D.name, line: D.line, landmark: D.landmark, pin: D.pin, city: D.city, st: D.st }; state().pin = D.pin; _emit('addr'); step = 3; draw();
    };
  }

  // ---- 3. delivery
  function s3() {
    const r = checkPin(D.pin); const express = ['6', '5', '4', '1'].includes(D.pin[0]); if (!express && D.delivery === 'Express') D.delivery = 'Standard';
    const opts = [['Standard', 'Standard delivery', `${r.days}–${r.days + 2} days · tracked`, T('Free · sample rule', 'Free'), true], ['Express', 'Express delivery', '1–2 days · tracked', '₹ 350', express]];
    panel.innerHTML = `<h2 class="serif">Delivery method</h2><p class="muted" style="margin-bottom:16px">${T('Rates and dates come from the courier integration — sample values here. ', 'Delivery times are estimates from our courier partner. ')}Delivering to ${esc(D.name)}, ${esc(D.city)} ${esc(D.pin)}.</p><div role="radiogroup" aria-label="Delivery method">${opts.map(([k, n, d, c, on]) => `<div class="opt ${on ? '' : 'off'}" role="radio" tabindex="${on ? 0 : -1}" aria-checked="${D.delivery === k}" aria-disabled="${!on}" data-k="${k}"><span class="rd"></span>${ic('truck', 30)}<div style="flex:1"><div class="serif" style="font-size:28px;line-height:1.1">${n}</div><div class="muted">${on ? d : T('Not available for this PIN code (demo)', 'Not available for this PIN code')}</div></div><b style="font-weight:500">${c}</b></div>`).join('')}</div>
      <div style="display:flex;gap:12px;margin-top:20px"><button class="btn btn-line" id="back">Back</button><button class="btn btn-dark" id="next">Continue to payment</button></div>`;
    $$('.opt', root).forEach((o) => { const pick = () => { if (o.getAttribute('aria-disabled') === 'true') return; D.delivery = o.dataset.k; $$('.opt', root).forEach((x) => x.setAttribute('aria-checked', x === o)); drawSum(); }; o.onclick = pick; o.onkeydown = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pick(); } }; });
    $('#back', root).onclick = () => { step = 2; draw(); }; $('#next', root).onclick = () => { step = 4; draw(); };
  }

  // ---- 4. payment (test mode)
  function s4() {
    if (LIVE) return s4live();
    const tabs = [['upi', 'UPI'], ['card', 'Cards'], ['nb', 'Netbanking']]; t = totals(D.delivery);
    panel.innerHTML = `<h2 class="serif">Payment</h2><div class="testmode" style="margin:6px 0 16px">${ic('shield', 18)} TEST MODE · NO REAL MONEY MOVES · ${ONLINE ? 'STAGING ONLY' : 'DEMO ONLY'}</div>
      <div role="tablist" aria-label="Payment method" style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap">${tabs.map(([k, n]) => `<button class="chip ${D.method === k ? 'on' : ''}" role="tab" aria-selected="${D.method === k}" data-m="${k}" style="height:44px;padding:0 22px">${n}</button>`).join('')}</div><div id="pm"></div>
      <p class="muted" style="font-size:14.5px;margin:6px 0 18px;max-width:560px">Methods shown depend on the chosen provider and merchant account. Success is confirmed only by a server-side signature check — never by the browser redirect alone. Card numbers and CVV are never stored.</p>
      <div id="payerr" role="alert"></div><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn btn-line" id="back">Back</button><button class="btn btn-dark" id="pay" style="flex:1;min-width:220px">${ic('lock', 18)} Pay ${money(t.total)}</button></div>`;
    const pm = $('#pm', root);
    const drawPm = () => {
      $$('[data-m]', root).forEach((b) => { b.classList.toggle('on', b.dataset.m === D.method); b.setAttribute('aria-selected', b.dataset.m === D.method); });
      pm.innerHTML = D.method === 'upi' ? `<div class="field"><label for="upi">UPI ID</label><input id="upi" placeholder="name@bank" autocomplete="off"><div class="hint">Test IDs: <code>success@upi</code> · <code>fail@upi</code> · <code>pending@upi</code></div><div class="err" id="e-upi" role="alert"></div></div>`
        : D.method === 'card' ? `<div class="field"><label for="cn">Card number</label><input id="cn" inputmode="numeric" placeholder="4111 1111 1111 1111" autocomplete="off" maxlength="23"><div class="hint">Test cards: 4111 1111 1111 1111 (approved) · 4000 0000 0000 0002 (declined)</div><div class="err" id="e-cn" role="alert"></div></div><div class="row2"><div class="field"><label for="ce">Expiry (MM/YY)</label><input id="ce" placeholder="12/30" maxlength="5" autocomplete="off"><div class="err" id="e-ce" role="alert"></div></div><div class="field"><label for="cv">CVV</label><input id="cv" type="password" inputmode="numeric" maxlength="4" placeholder="•••" autocomplete="off"><div class="err" id="e-cv" role="alert"></div></div></div>`
        : `<div class="field"><label for="bk">Bank</label><select id="bk">${BANKS.map((b) => `<option>${b}</option>`).join('')}</select><div class="hint">You would be redirected to your bank (simulated here).</div></div>`;
      $('#cn', root)?.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim(); });
    };
    $$('[data-m]', root).forEach((b) => (b.onclick = () => { D.method = b.dataset.m; drawPm(); })); drawPm();
    $('#back', root).onclick = () => { step = 3; draw(); };
    $('#pay', root).onclick = pay;
  }

  // real payments: Razorpay's own window takes the UPI id / card / bank details, so none of it ever reaches this page or our server
  function s4live() {
    t = totals(D.delivery);
    panel.innerHTML = `<h2 class="serif">Payment</h2><p class="muted" style="margin:6px 0 18px;max-width:560px">Pay with UPI, cards, netbanking or wallets. The payment opens in Razorpay’s secure window — your card or bank details never touch our servers. Your order is confirmed only once the payment is verified.</p>
      <div id="payerr" role="alert"></div><div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn btn-line" id="back">Back</button><button class="btn btn-dark" id="pay" style="flex:1;min-width:220px">${ic('lock', 18)} Pay ${money(t.total)}</button></div>`;
    $('#back', root).onclick = () => { step = 3; draw(); }; $('#pay', root).onclick = pay;
  }
  // Razorpay Checkout. Resolves with the confirmed order, or null if the person closed the window without paying.
  async function razorpay(it, onPaid) {
    await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    return new Promise((resolve, reject) => {
      let paid = false;
      const rz = new window.Razorpay({
        key: it.razorpay.keyId, order_id: it.razorpay.orderId, amount: it.razorpay.amount, currency: 'INR', name: 'Thirupavai', description: 'Silk sarees', prefill: { name: D.name, contact: '+91' + D.mobile }, theme: { color: '#260D19' },
        handler: (resp) => { paid = true; onPaid(); api('POST', '/api/checkout/verify', { intentId: it.intentId, orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }).then((r) => resolve(r.order), reject); },
        modal: { ondismiss: () => { if (!paid) resolve(null); } },
      });
      rz.open();
    });
  }
  // The server prices the bag, takes the stock and creates the order. Nothing the browser says about money is trusted.
  async function payOnline(btn, pe, outcome) {
    const idle = () => { busy = false; btn.disabled = false; btn.innerHTML = `${ic('lock', 18)} Pay ${money(totals(D.delivery).total)}`; };
    const say = (m, cls = 'err') => { pe.innerHTML = `<div class="pill ${cls}" style="margin-bottom:12px;white-space:normal;padding:10px 14px">${esc(m)}</div>`; };
    let paid = false;
    try {
      const sc = state();
      const it = await api('POST', '/api/checkout/intent', { items: sc.cart.map((c) => ({ id: c.id, qty: c.qty, addons: c.addons || [] })), address: { line: D.line, landmark: D.landmark, city: D.city, pin: D.pin }, customer: { name: D.name, email: '' }, delivery: D.delivery, coupon: sc.coupon || '', key: attemptKey });
      const o = it.mode === 'mock'
        ? (await api('POST', '/api/checkout/pay', { intentId: it.intentId, vpa: outcome === 'fail' ? 'fail@test' : outcome === 'pending' ? 'pending@test' : 'success@test' })).order
        : await razorpay(it, () => { paid = true; });
      if (!o) { idle(); return; }
      adoptOrder(o); location.hash = '#/order/' + o.id + '?new=1';
    } catch (e) {
      idle();
      if (paid) {                                                    // money moved but we could not confirm yet: the gateway's webhook will still create the order
        say('We have received your payment and are confirming it. Please do not pay again — your order will appear under Your orders within a minute.', 'warn');
        let n = 0; const poll = setInterval(() => { loadMyOrders().catch(() => {}); if (++n >= 8 || !root.isConnected) clearInterval(poll); }, 8000); return;
      }
      if (e instanceof ApiError && e.status === 401) { step = 1; otp = null; demoCode = null; draw(); toast('Please sign in again to finish your order.'); return; }
      if (e instanceof ApiError && e.status === 409) {                // sold out / quantity no longer available: fix the bag from today's stock
        await refreshCatalog().catch(() => {}); const id = e.data?.id; const p = id && prod(id);
        if (p && p.active !== false && p.stock > 0) cart.setQty(id, state().cart.find((c) => c.id === id)?.qty || 1); else if (id) cart.remove(id);
        say(e.message + ' We have updated your bag.'); drawSum(); if (!state().cart.length) setTimeout(() => (location.hash = '#/shop'), 1800); return;
      }
      say(e.message || 'Payment could not be completed. Nothing has been charged.');
    }
  }

  async function pay() {
    if (busy) return; const pe = $('#payerr', root); pe.innerHTML = '';
    // server-side style re-validation of price + stock
    const fresh = totals(D.delivery); for (const l of fresh.lines) { const p = prod(l.id); if (p.stock < l.qty) { pe.innerHTML = `<div class="pill err" style="margin-bottom:12px;white-space:normal">“${esc(p.name)}” just sold out. It was removed from your bag.</div>`; cart.remove(l.id); drawSum(); if (!state().cart.length) setTimeout(() => (location.hash = '#/shop'), 1200); return; } }
    let outcome = 'ok', label = 'UPI';
    if (LIVE) label = 'Razorpay';
    else if (D.method === 'upi') { const v = $('#upi', root).value.trim().toLowerCase(); if (!/^[\w.\-]{2,}@[a-z]{2,}$/.test(v)) { err('upi', 'Enter a valid UPI ID, e.g. success@upi'); return; } err('upi', ''); outcome = v.startsWith('fail') ? 'fail' : v.startsWith('pending') ? 'pending' : 'ok'; label = 'UPI'; }
    else if (D.method === 'card') { const n = $('#cn', root).value.replace(/\s/g, ''), e = $('#ce', root).value, c = $('#cv', root).value; let ok = true; ok = err('cn', /^\d{15,19}$/.test(n) ? '' : 'Enter a valid card number.') && ok; ok = err('ce', /^(0[1-9]|1[0-2])\/\d{2}$/.test(e) ? '' : 'Use MM/YY.') && ok; ok = err('cv', /^\d{3,4}$/.test(c) ? '' : 'Enter the CVV.') && ok; if (!ok) return; outcome = n.startsWith('4000') ? 'fail' : 'ok'; label = 'Card'; $('#cn', root).value = ''; $('#cv', root).value = ''; }
    else { label = 'Netbanking'; }
    busy = true; const btn = $('#pay', root); btn.disabled = true; btn.innerHTML = `<span class="spin"></span> ${ONLINE ? 'PROCESSING…' : 'VERIFYING SIGNATURE…'}`;
    if (ONLINE) return payOnline(btn, pe, outcome);
    await new Promise((r) => setTimeout(r, 1400));
    if (outcome === 'fail') { busy = false; btn.disabled = false; btn.innerHTML = `${ic('lock', 18)} Pay ${money(fresh.total)}`; pe.innerHTML = `<div class="pill err" style="margin-bottom:12px;white-space:normal;padding:10px 14px">Payment failed (test). Nothing was charged and your bag is unchanged — try again or use another method.</div>`; return; }
    const o = placeOrder({ key: attemptKey, customer: { name: D.name, mobile: D.mobile, email: '' }, address: { line: D.line + (D.landmark ? ', ' + D.landmark : ''), city: D.city, pin: D.pin }, delivery: D.delivery, payment: { status: outcome === 'pending' ? 'Pending' : 'Captured', method: label, ref: 'pay_Demo' + Math.random().toString(36).slice(2, 8), test: true } });
    location.hash = '#/order/' + o.id + '?new=1';
  }
  const onData = () => drawSum(); addEventListener('tpv:data', onData);
  draw();
  return () => removeEventListener('tpv:data', onData);
}

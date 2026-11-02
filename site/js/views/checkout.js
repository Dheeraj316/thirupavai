import { state, cart, totals, auth, placeOrder, prod, ADDONS, _emit, adoptOrder, refreshCatalog, loadMyOrders } from '../store.js';
import { ONLINE, LIVE, T, api, ApiError, loadScript } from '../api.js';
import { checkPin, inr } from '../data.js';
import { h, $, $$, ic, img, toast, esc, money } from '../ui.js';

const CITIES = { '600': ['Chennai', 'Tamil Nadu'], '625': ['Madurai', 'Tamil Nadu'], '641': ['Coimbatore', 'Tamil Nadu'], '560': ['Bengaluru', 'Karnataka'], '500': ['Hyderabad', 'Telangana'], '110': ['New Delhi', 'Delhi'], '400': ['Mumbai', 'Maharashtra'], '700': ['Kolkata', 'West Bengal'], '682': ['Kochi', 'Kerala'] };
const BANKS = ['Demo Bank of India', 'Sample State Bank', 'Test Co-operative Bank'];
const wide = () => matchMedia('(min-width:901px)').matches;

export default async function checkout(root) {
  const attemptKey = 'chk-' + Math.random().toString(36).slice(2, 10);   // one idempotency key per checkout visit
  let t = totals();
  if (!t.lines.length) { root.innerHTML = `<div class="wrap fl fl-empty"><h1 class="fl-h2">Your bag is empty</h1><p class="fl-lede">Add a saree and come back to check out. You never need an account to browse.</p><p><a class="btn btn-gold" href="#/shop">Shop sarees</a></p></div>`; return; }
  const S = state(); const D = { mobile: S.user?.mobile || '', name: S.addr?.name || '', line: S.addr?.line || '', landmark: S.addr?.landmark || '', pin: S.addr?.pin || S.pin || '', city: S.addr?.city || '', st: S.addr?.st || '', delivery: 'Standard', method: 'upi' };
  let step = S.user ? 2 : 1, otp = null, demoCode = null, tries = 0, busy = false, otpTime = 0, sumOpen = wide();
  const STEPS = ['Sign in', 'Address', 'Delivery', 'Payment'];

  root.innerHTML = `<div class="wrap fl fl-co"><nav class="fl-crumbs" aria-label="Breadcrumb"><a href="#/shop">Shop</a><span aria-hidden="true">/</span><span>Checkout</span></nav><h1 class="fl-h1">Checkout</h1>
    <div class="fl-grid"><div class="fl-main"><div class="fl-progress" id="steps" aria-label="Checkout progress"></div><section class="fl-card" id="panel"></section></div><aside class="fl-sum summary" id="sum" aria-label="Order summary"></aside></div></div>`;
  const panel = $('#panel', root);

  function drawSum() {
    t = totals(D.delivery); if (!t.lines.length) { location.hash = '#/checkout'; return; }
    const count = t.lines.reduce((n, l) => n + l.qty, 0);
    $('#sum', root).innerHTML = `<details class="fl-det" ${sumOpen ? 'open' : ''}><summary><span>Order summary <small>${count} item${count > 1 ? 's' : ''}</small></span><b>${money(t.total)}</b></summary>
      <ul class="fl-lines">${t.lines.map((l) => `<li class="li"><div class="ph" style="background-image:url(${img(l.p.gallery[0].img)});background-position:${l.p.gallery[0].pos}" role="img" aria-label="${esc(l.p.name)}"></div><div class="nm"><b>${esc(l.p.name)}</b><small>Qty ${l.qty}${(l.addons || []).length ? ' · ' + l.addons.map((a) => ADDONS[a][0]).join(', ') : ''}</small></div><span class="pr">${money(l.line)}</span></li>`).join('')}</ul>
      <dl class="fl-tot sumrows"><div><dt>Subtotal</dt><dd>${money(t.sub)}</dd></div>${t.discount ? `<div class="disc"><dt>Discount · ${esc(state().coupon)}</dt><dd>− ${money(t.discount)}</dd></div>` : ''}<div><dt>Delivery</dt><dd>${step < 3 ? 'Chosen next' : t.delivery ? money(t.delivery) : 'Free'}</dd></div><div><dt>Taxes</dt><dd>GST included</dd></div><div class="tot grand"><dt>Total</dt><dd>${money(t.total)}</dd></div></dl>
      <p class="fl-fine">${T('Sample values. A real order checks price, offers and stock on the server before payment.', 'Price, offers and stock are checked again when you pay.')}</p><p class="fl-fine"><a href="#/shop">Continue shopping</a></p></details>`;
    const d = $('details', root); d.addEventListener('toggle', () => { if (wide() && !d.open) d.open = true; else sumOpen = d.open; });
  }
  function drawSteps() {
    $('#steps', root).innerHTML = `<p class="fl-stepcap"><span>Step ${step} of ${STEPS.length}</span><b>${STEPS[step - 1]}</b></p><ol class="fl-bar">${STEPS.map((s, i) => `<li class="${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}" ${i + 1 === step ? 'aria-current="step"' : ''}><span class="n">${i + 1 < step ? ic('check', 13, 2.8) : i + 1}</span><span class="l">${s}</span></li>`).join('')}</ol>`;
  }
  const err = (id, m) => { const e = $('#e-' + id, root); if (e) e.textContent = m || ''; const i = $('#' + id, root); if (i) i.setAttribute('aria-invalid', !!m); return !m; };
  const field = (id, label, val, attrs = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(val)}" aria-describedby="e-${id}" ${attrs}><div class="err" id="e-${id}" role="alert"></div></div>`;

  function draw() { drawSteps(); drawSum(); [s1, s2, s3, s4][step - 1](); panel.querySelector('h2')?.setAttribute('tabindex', '-1'); panel.querySelector('h2')?.focus({ preventScroll: true }); }

  // ---- 1. sign in with a code sent to the mobile
  function s1() {
    panel.innerHTML = `<h2 class="fl-h2">Sign in</h2><p class="fl-lede">Enter your mobile number and we will text you a 6-digit code. Your bag stays exactly as it is.</p>
      <form id="f1" novalidate><div class="field"><label for="mob">Mobile number</label><div class="fl-phone"><span class="cc" aria-hidden="true">+91</span><input id="mob" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number" value="${esc(D.mobile)}" autocomplete="tel-national" aria-describedby="e-mob"></div><div class="err" id="e-mob" role="alert"></div></div>
      <button class="btn btn-gold fl-btn" id="sendotp" type="submit">${otp ? 'Send a new code' : 'Send code'}</button></form><div id="otpbox" aria-live="polite"></div>`;
    $('#f1', root).onsubmit = (e) => {
      e.preventDefault(); const v = $('#mob', root).value.trim(); if (!/^[6-9]\d{9}$/.test(v)) { err('mob', 'Enter a valid 10-digit Indian mobile number.'); return; } err('mob', '');
      if (otp && Date.now() - otpTime < 8000) { toast('Please wait a few seconds before asking for another code.'); return; }
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
    $('#otpbox', root).innerHTML = `<div class="fl-otpbox">${ONLINE && !demoCode ? `<p class="fl-lede">We sent a 6-digit code to +91 ${esc(D.mobile.slice(0, 2))}••••••${esc(D.mobile.slice(-2))}. It stays valid for 5 minutes.</p>` : `<p class="pill gd fl-testcode" role="status">${ONLINE ? 'Test server' : 'Demo'}: no text message is sent. Your code is <b>${otp}</b></p>`}<div class="field"><label for="o0">Enter the 6-digit code</label><div class="otp" id="otp">${[0, 1, 2, 3, 4, 5].map((i) => `<input id="o${i}" type="text" inputmode="numeric" maxlength="1" aria-label="Digit ${i + 1}" autocomplete="${i ? 'off' : 'one-time-code'}">`).join('')}</div><div class="err" id="e-otp" role="alert"></div></div><button class="btn btn-gold fl-btn" id="verify" type="button">Verify and continue</button></div>`;
    const ins = $$('#otp input', root); ins[0].focus();
    ins.forEach((i, k) => { i.oninput = () => { i.value = i.value.replace(/\D/g, ''); if (i.value && ins[k + 1]) ins[k + 1].focus(); if (k === 5 && ins.every((x) => x.value)) $('#verify', root).click(); }; i.onkeydown = (e) => { if (e.key === 'Backspace' && !i.value && ins[k - 1]) ins[k - 1].focus(); }; i.onpaste = (e) => { const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (d.length > 1) { e.preventDefault(); ins.forEach((x, j) => (x.value = d[j] || '')); ins[Math.min(d.length, 5)].focus(); if (d.length === 6) $('#verify', root).click(); } }; });
    $('#verify', root).onclick = () => {
      const code = ins.map((x) => x.value).join(''); if (code.length < 6) { $('#e-otp', root).textContent = 'Enter all 6 digits.'; return; }
      if (ONLINE) {
        const b = $('#verify', root); b.disabled = true;
        auth.verifyOtp(D.mobile, code).then(() => { step = 2; toast('Signed in. Your bag is unchanged.'); draw(); })
          .catch((er) => { $('#e-otp', root).textContent = er.message; if (er.status === 429 || /expired/i.test(er.message)) { otp = null; setTimeout(s1, 1500); } }).finally(() => { b.disabled = false; });
        return;
      }
      if (code !== otp) { tries++; $('#e-otp', root).textContent = tries >= 3 ? 'Too many wrong attempts. Please ask for a new code.' : `That code is not right (${3 - tries} attempt${3 - tries === 1 ? '' : 's'} left).`; if (tries >= 3) { otp = null; setTimeout(s1, 800); } return; }
      auth.login(D.mobile); step = 2; toast('Signed in. Your bag is unchanged.'); draw();
    };
  }

  // ---- 2. address
  function s2() {
    panel.innerHTML = `<h2 class="fl-h2">Delivery address</h2><p class="fl-lede">Signed in as +91 ${esc(state().user?.mobile || D.mobile)}. <button type="button" class="fl-link" id="signout">Not you?</button></p><form id="f2" novalidate>
      ${field('nm', 'Full name', D.name, 'autocomplete="name"')}${field('ad', 'Address', D.line, 'autocomplete="street-address"')}${field('lm', 'Landmark (optional)', D.landmark)}
      <div class="fl-row"><div class="field"><label for="pn">PIN code</label><input id="pn" type="text" inputmode="numeric" maxlength="6" value="${esc(D.pin)}" autocomplete="postal-code" aria-describedby="e-pn"><div class="err" id="e-pn" role="alert"></div></div>${field('ct', 'City', D.city, 'autocomplete="address-level2"')}</div>${field('sx', 'State', D.st, 'autocomplete="address-level1"')}<div id="svc" class="fl-svc" role="status"></div>
      <button class="btn btn-gold fl-btn" type="submit">Continue to delivery</button></form>`;
    $('#signout', root).onclick = async () => { await auth.logout(); step = 1; otp = null; demoCode = null; draw(); };
    const pn = $('#pn', root), svc = $('#svc', root);
    const chk = () => { const r = checkPin(pn.value.trim()); if (pn.value.trim().length === 6) { svc.innerHTML = r.ok ? `<span class="fl-chip ok">${ic('check', 14, 2.6)} We deliver to ${esc(pn.value)} · ${esc(r.zone)}</span>` : `<span class="fl-chip err">${esc(r.msg)}</span>`; const c = CITIES[pn.value.slice(0, 3)]; if (c && !$('#ct', root).value) { $('#ct', root).value = c[0]; $('#sx', root).value = c[1]; } } else svc.innerHTML = ''; return r; };
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
    const opts = [['Standard', 'Standard delivery', `${r.days}–${r.days + 2} days, tracked`, 'Free', true], ['Express', 'Express delivery', '1–2 days, tracked', '₹ 350', express]];
    panel.innerHTML = `<h2 class="fl-h2">Delivery method</h2><p class="fl-lede">${T('Delivery rates and dates here are samples. ', 'Delivery times are estimates from our courier partner. ')}Sending to ${esc(D.name)}, ${esc(D.city)} ${esc(D.pin)}.</p><div class="fl-opts" role="radiogroup" aria-label="Delivery method">${opts.map(([k, n, d, c, on]) => `<div class="opt ${on ? '' : 'off'}" role="radio" tabindex="${on ? 0 : -1}" aria-checked="${D.delivery === k}" aria-disabled="${!on}" data-k="${k}"><span class="rd" aria-hidden="true"></span><span class="body"><b>${n}</b><span class="d">${on ? d : T('Not available for this PIN code', 'Not available for this PIN code')}</span></span><span class="price">${c}</span></div>`).join('')}</div>
      <div class="fl-actions"><button class="btn btn-line" id="back" type="button">Back</button><button class="btn btn-gold" id="next" type="button">Continue to payment</button></div>`;
    $$('.opt', root).forEach((o) => { const pick = () => { if (o.getAttribute('aria-disabled') === 'true') return; D.delivery = o.dataset.k; $$('.opt', root).forEach((x) => x.setAttribute('aria-checked', x === o)); drawSum(); }; o.onclick = pick; o.onkeydown = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pick(); } }; });
    $('#back', root).onclick = () => { step = 2; draw(); }; $('#next', root).onclick = () => { step = 4; draw(); };
  }

  // ---- 4. payment (test mode)
  function s4() {
    if (LIVE) return s4live();
    const tabs = [['upi', 'UPI'], ['card', 'Card'], ['nb', 'Netbanking']]; t = totals(D.delivery);
    panel.innerHTML = `<h2 class="fl-h2">Payment</h2><p class="testmode" role="note">TEST MODE · no real money moves · ${ONLINE ? 'staging site only' : 'demo only'}</p>
      <div class="fl-seg" role="tablist" aria-label="Payment method">${tabs.map(([k, n]) => `<button type="button" class="chip ${D.method === k ? 'on' : ''}" role="tab" aria-selected="${D.method === k}" data-m="${k}">${n}</button>`).join('')}</div><div id="pm"></div>
      <p class="fl-fine">Card numbers and CVV are never stored. A payment counts only after it is verified on our server.</p>
      <div id="payerr" role="alert"></div><div class="fl-actions fl-pay"><button class="btn btn-line" id="back" type="button">Back</button><button class="btn btn-gold" id="pay" type="button">${ic('lock', 18)} Pay ${money(t.total)}</button></div>`;
    const pm = $('#pm', root);
    const drawPm = () => {
      $$('[data-m]', root).forEach((b) => { b.classList.toggle('on', b.dataset.m === D.method); b.setAttribute('aria-selected', b.dataset.m === D.method); });
      pm.innerHTML = D.method === 'upi' ? `<div class="field"><label for="upi">UPI ID</label><input id="upi" type="text" placeholder="name@bank" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="e-upi"><div class="hint">Test IDs: <code>success@upi</code>, <code>fail@upi</code>, <code>pending@upi</code></div><div class="err" id="e-upi" role="alert"></div></div>`
        : D.method === 'card' ? `<div class="field"><label for="cn">Card number</label><input id="cn" type="text" inputmode="numeric" placeholder="4111 1111 1111 1111" autocomplete="off" maxlength="23" aria-describedby="e-cn"><div class="hint">Test cards: 4111 1111 1111 1111 (approved), 4000 0000 0000 0002 (declined)</div><div class="err" id="e-cn" role="alert"></div></div><div class="fl-row"><div class="field"><label for="ce">Expiry (MM/YY)</label><input id="ce" type="text" inputmode="numeric" placeholder="12/30" maxlength="5" autocomplete="off" aria-describedby="e-ce"><div class="err" id="e-ce" role="alert"></div></div><div class="field"><label for="cv">CVV</label><input id="cv" type="password" inputmode="numeric" maxlength="4" placeholder="•••" autocomplete="off" aria-describedby="e-cv"><div class="err" id="e-cv" role="alert"></div></div></div>`
        : `<div class="field"><label for="bk">Bank</label><select id="bk">${BANKS.map((b) => `<option>${b}</option>`).join('')}</select><div class="hint">You would be taken to your bank to approve the payment (simulated here).</div></div>`;
      $('#cn', root)?.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim(); });
    };
    $$('[data-m]', root).forEach((b) => (b.onclick = () => { D.method = b.dataset.m; drawPm(); })); drawPm();
    $('#back', root).onclick = () => { step = 3; draw(); };
    $('#pay', root).onclick = pay;
  }

  // real payments: Razorpay's own window takes the UPI id / card / bank details, so none of it ever reaches this page or our server
  function s4live() {
    t = totals(D.delivery);
    panel.innerHTML = `<h2 class="fl-h2">Payment</h2><p class="fl-lede">Pay with UPI, a card, netbanking or a wallet. The payment opens in Razorpay’s secure window, so your card or bank details never reach us. Your order is confirmed once the payment is verified.</p>
      <div id="payerr" role="alert"></div><div class="fl-actions fl-pay"><button class="btn btn-line" id="back" type="button">Back</button><button class="btn btn-gold" id="pay" type="button">${ic('lock', 18)} Pay ${money(t.total)}</button></div>`;
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
    const say = (m, cls = 'err') => { pe.innerHTML = `<div class="pill ${cls} fl-alert">${esc(m)}</div>`; };
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
        say('We have received your payment and are confirming it. Please do not pay again. Your order will appear under Your orders within a minute.', 'warn');
        let n = 0; const poll = setInterval(() => { loadMyOrders().catch(() => {}); if (++n >= 8 || !root.isConnected) clearInterval(poll); }, 8000); return;
      }
      if (e instanceof ApiError && e.status === 401) { step = 1; otp = null; demoCode = null; draw(); toast('Please sign in again to finish your order.'); return; }
      if (e instanceof ApiError && e.status === 409) {                // sold out / quantity no longer available: fix the bag from today's stock
        await refreshCatalog().catch(() => {}); const id = e.data?.id; const p = id && prod(id);
        if (p && p.active !== false && p.stock > 0) cart.setQty(id, state().cart.find((c) => c.id === id)?.qty || 1); else if (id) cart.remove(id);
        say(e.message + ' We have updated your bag.'); drawSum(); if (!state().cart.length) setTimeout(() => (location.hash = '#/shop'), 1800); return;
      }
      say(e.message || 'The payment could not be completed. Nothing has been charged.');
    }
  }

  async function pay() {
    if (busy) return; const pe = $('#payerr', root); pe.innerHTML = '';
    // server-side style re-validation of price + stock
    const fresh = totals(D.delivery); for (const l of fresh.lines) { const p = prod(l.id); if (p.stock < l.qty) { pe.innerHTML = `<div class="pill err fl-alert">“${esc(p.name)}” has just sold out and was removed from your bag.</div>`; cart.remove(l.id); drawSum(); if (!state().cart.length) setTimeout(() => (location.hash = '#/shop'), 1200); return; } }
    let outcome = 'ok', label = 'UPI';
    if (LIVE) label = 'Razorpay';
    else if (D.method === 'upi') { const v = $('#upi', root).value.trim().toLowerCase(); if (!/^[\w.\-]{2,}@[a-z]{2,}$/.test(v)) { err('upi', 'Enter a valid UPI ID, for example success@upi'); return; } err('upi', ''); outcome = v.startsWith('fail') ? 'fail' : v.startsWith('pending') ? 'pending' : 'ok'; label = 'UPI'; }
    else if (D.method === 'card') { const n = $('#cn', root).value.replace(/\s/g, ''), e = $('#ce', root).value, c = $('#cv', root).value; let ok = true; ok = err('cn', /^\d{15,19}$/.test(n) ? '' : 'Enter a valid card number.') && ok; ok = err('ce', /^(0[1-9]|1[0-2])\/\d{2}$/.test(e) ? '' : 'Use the format MM/YY.') && ok; ok = err('cv', /^\d{3,4}$/.test(c) ? '' : 'Enter the CVV.') && ok; if (!ok) return; outcome = n.startsWith('4000') ? 'fail' : 'ok'; label = 'Card'; $('#cn', root).value = ''; $('#cv', root).value = ''; }
    else { label = 'Netbanking'; }
    busy = true; const btn = $('#pay', root); btn.disabled = true; btn.innerHTML = `<span class="spin"></span> ${ONLINE ? 'Processing…' : 'Verifying…'}`;
    if (ONLINE) return payOnline(btn, pe, outcome);
    await new Promise((r) => setTimeout(r, 1400));
    if (outcome === 'fail') { busy = false; btn.disabled = false; btn.innerHTML = `${ic('lock', 18)} Pay ${money(fresh.total)}`; pe.innerHTML = `<div class="pill err fl-alert">Payment failed (test). Nothing was charged and your bag is unchanged. Try again or use another method.</div>`; return; }
    const o = placeOrder({ key: attemptKey, customer: { name: D.name, mobile: D.mobile, email: '' }, address: { line: D.line + (D.landmark ? ', ' + D.landmark : ''), city: D.city, pin: D.pin }, delivery: D.delivery, payment: { status: outcome === 'pending' ? 'Pending' : 'Captured', method: label, ref: 'pay_Demo' + Math.random().toString(36).slice(2, 8), test: true } });
    location.hash = '#/order/' + o.id + '?new=1';
  }
  const onData = () => drawSum(); addEventListener('tpv:data', onData);
  draw();
  return () => removeEventListener('tpv:data', onData);
}

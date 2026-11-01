import { prod, products, cart, wish, recent, state, ADDONS, _emit, createTicket } from '../store.js';
import { ONLINE, T } from '../api.js';
import { bySlug, checkPin, inr } from '../data.js';
import { h, $, $$, ic, img, toast, card, modal, esc, closeAll, money } from '../ui.js';
import { drapeViewer, webglOK } from '../cloth.js';
import { tilt } from '../fx.js';

const LIGHTS = [['day', 'Daylight'], ['candle', 'Candlelight'], ['hall', 'Wedding hall'], ['moon', 'Moonlit']];
const LIGHT_THEME = { candle: 'Gold', hall: 'Red', moon: 'Royal blue' };
const bg = (g) => `background-image:url(${img(g.img)});background-position:${g.pos};${g.zoom !== 'cover' ? `background-size:${g.zoom}` : ''}`;
function qrSvg(seed) {
  let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); const n = 25; let r = '';
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#EBD399"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#14070d"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#EBD399"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9); if (!inF && rnd() > 0.52) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="#EBD399"/>`; }
  return `<svg viewBox="0 0 ${n} ${n}" width="190" height="190" role="img" aria-label="Sample QR code (not scannable)" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#14070d"/>${r}${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
}

export default async function product(root, route) {
  const slug = route.args[0]; const base = bySlug(slug);
  if (!base || prod(base.id).active === false) { root.innerHTML = `<div class="wrap empty"><h3>We couldn’t find that saree</h3><p class="muted">It may have been renamed or removed.</p><p style="margin-top:16px"><a class="btn btn-gold" href="#/shop">Browse all sarees</a></p></div>`; return; }
  const p = prod(base.id); recent(p.id);
  const sold = p.stock < 1; const stockTxt = sold ? 'Sold out' : p.stock === 1 ? 'In stock: 1 of 1 (one-of-one piece)' : p.stock <= 3 ? `Only ${p.stock} left` : 'In stock';
  document.title = `${p.name} — Thirupavai${T(' (concept prototype)', '', ' (staging)')}`;
  const ld = h(`<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku, description: p.desc, brand: { '@type': 'Brand', name: 'Thirupavai' }, image: p.gallery.map((g) => new URL(img(g.img), location.href).href), offers: { '@type': 'Offer', priceCurrency: 'INR', price: p.price, availability: sold ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock' } })}</script>`); document.head.appendChild(ld);
  const gl = webglOK();

  root.innerHTML = `<div class="wrap"><div class="page-head" style="padding-bottom:10px"><div class="crumbs"><a href="#/">Home</a> / <a href="#/shop">Sarees</a> / <a href="#/shop?fabric=${encodeURIComponent(p.fabric)}">${esc(p.fabric)}</a> / ${esc(p.name)}</div></div>
  <div class="pdp"><div class="gallery"><div class="thumbs" role="tablist" aria-label="Product images">${p.gallery.map((g, i) => `<button class="thumb" role="tab" style="${bg(g)}" aria-label="${esc(g.alt || g.label)}" aria-current="${i === 0}" data-i="${i}"></button>`).join('')}</div>
      <div>${gl ? `<div class="mode" role="group" aria-label="Viewer mode"><button id="mphoto" aria-pressed="true">Photos</button><button id="m3d" aria-pressed="false">${ic('cube', 14)} 3D drape</button></div>` : ''}
        <div class="mwrap" id="mwrap" style="position:relative"><div class="mainimg" id="pimg" tabindex="0" role="img" aria-label="${esc(p.name)} image viewer — click to enlarge"><div class="ph" id="l0"></div><div class="ph" id="l1" style="opacity:0"></div>${p.tag ? `<span class="pcard" style="position:absolute;left:14px;top:14px;z-index:3"><span class="tag" style="position:static;display:inline-block">${esc(p.tag)}</span></span>` : ''}
          <div class="lens" id="lens"><div id="lensin" style="position:absolute;left:0;top:0;transform-origin:0 0;background-repeat:no-repeat"></div></div><span class="zl">ZOOM 2.4×</span></div>
          <div class="drape-stage" id="dstage" aria-label="Interactive cloth preview"><canvas id="drape"></canvas></div></div>
        <div class="lights" role="group" aria-label="Light studio — see this saree in different light"><span class="eyebrow">Light studio</span>${LIGHTS.map(([k, n]) => `<button type="button" data-l="${k}" aria-pressed="${k === 'day'}">${n}</button>`).join('')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:10px;flex-wrap:wrap"><span class="pill gd" id="lbl"></span><span class="muted" style="font-size:14px">${ic('cube', 16)} <span id="note">${T('Photos only — a true 360° view needs real 360 capture (planned).', 'An interactive preview built from the product photographs — drag the cloth to see it fall.')}</span></span></div></div></div>
    <div class="info"><div class="eyebrow">${esc(p.fabric)} · ${esc(p.weave)} · ${p.occasion.join(', ')}</div><h1 data-split>${esc(p.name)}</h1>
      <div class="muted" style="font-size:15px">SKU ${p.sku} · <span id="stk" style="color:${sold ? 'var(--err)' : p.stock <= 2 ? 'var(--warn)' : 'var(--ok)'};font-weight:500">${stockTxt}</span></div>
      <div class="price" style="margin-top:12px"><span>${inr(p.price)}</span>${p.was ? `<s>${inr(p.was)}</s><span class="pill ok">Save ${inr(p.was - p.price)}</span>` : ''}<small>${T('Inclusive of taxes · sample price', 'Inclusive of taxes')}</small></div>
      <p style="margin-top:14px;max-width:560px">${esc(p.desc)}</p>
      <dl class="specs"><div><dt>Fabric</dt><dd>${esc(p.fabric)}</dd></div><div><dt>Weave</dt><dd>${esc(p.weave)}</dd></div><div><dt>Colour</dt><dd>${esc(p.colour)}</dd></div><div><dt>Length</dt><dd>${esc(p.length)}</dd></div><div><dt>Blouse piece</dt><dd>${esc(p.blouse)}</dd></div><div><dt>Care</dt><dd>${esc(p.care)}</dd></div><div><dt>Returns</dt><dd>${esc(p.returns)}</dd></div><div><dt>Delivery</dt><dd>Tracked · PIN check below</dd></div></dl>
      <div class="eyebrow" style="font-size:12px;margin-bottom:8px">Add-ons (optional)</div><div class="addons">${Object.entries(ADDONS).map(([k, [n, c]]) => `<label class="check"><input type="checkbox" data-add="${k}"><span>${n} <span class="muted">+ ${money(c)}</span></span></label>`).join('')}</div>
      <div class="eyebrow" style="font-size:12px;margin:14px 0 8px">Check delivery</div>
      <form class="pin" id="pinf" novalidate><input id="pin" inputmode="numeric" maxlength="6" placeholder="PIN code" aria-label="PIN code" value="${esc(state().pin || '')}"><button class="btn btn-line btn-sm" type="submit">Check</button><span class="res" id="pinres" role="status"></span></form>
      <div class="cta-row" id="ctarow">${sold ? `<button class="btn btn-gold" id="notify" style="flex:1">Notify me when available</button>` : `<button class="btn btn-gold" id="addbag" style="flex:1;min-width:200px">Add to bag</button>`}
        <button class="btn btn-line" id="wishb" aria-pressed="${wish.has(p.id)}" style="width:56px;padding:0" aria-label="Save to wishlist">${ic('heart', 22)}</button><button class="btn btn-line" id="vc">${ic('video', 20)} Video consult</button></div>
      <button class="passport" id="pass" style="width:100%;text-align:left"><span class="qr">${ic('qr', 28)}</span><span><b style="font-weight:600;letter-spacing:.04em">Authenticity passport</b><br><span class="muted" style="font-size:14.5px">Fibre, weave and Silk Mark / GI details — shown only where certified.</span></span></button>
      ${T('<p class="muted" style="font-size:13.5px;margin-top:14px">Concept prototype — prices, stock and policies are sample values.</p>', '', '<p class="muted" style="font-size:13.5px;margin-top:14px">Staging site — test payments only.</p>')}</div></div>
  <section class="sec" style="padding-bottom:40px"><div class="sec-head reveal"><div><h2>More from this edit</h2></div></div><div class="pgrid" id="rel"></div></section></div>
  ${sold ? '' : `<div class="stickybuy" id="sbuy" aria-hidden="true"><div class="in"><b>${esc(p.name)}</b><span class="pr">${inr(p.price)}</span><button class="btn btn-gold btn-sm" id="sbtn">Add to bag</button></div></div>`}`;

  // ----- gallery state
  let cur = 0, layer = 0; const main = $("#pimg", root), L = [$('#l0', root), $('#l1', root)], lens = $('#lens', root), lin = $('#lensin', root);
  const show = (i, animate = true) => {
    i = (i + p.gallery.length) % p.gallery.length; const g = p.gallery[i]; const next = L[1 - layer], prev = L[layer];
    next.style.cssText = bg(g) + ';opacity:0'; requestAnimationFrame(() => { next.style.opacity = 1; prev.style.opacity = 0; }); layer = 1 - layer; cur = i;
    if (!animate) { next.style.transition = 'none'; prev.style.transition = 'none'; requestAnimationFrame(() => { next.style.transition = prev.style.transition = ''; }); }
    $$('.thumb', root).forEach((t, k) => t.setAttribute('aria-current', k === i)); $('#lbl', root).textContent = `${g.label} · ${i + 1}/${p.gallery.length}`; lin.style.cssText = `position:absolute;left:0;top:0;transform-origin:0 0;background-repeat:no-repeat;${bg(g)}`;
  };
  show(0, false); $$('.thumb', root).forEach((t) => (t.onclick = () => { setMode('photo'); show(Number(t.dataset.i)); }));
  main.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(cur + 1); else if (e.key === 'ArrowLeft') show(cur - 1); else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lightbox(); } });
  tilt($('#mwrap', root), { rx: 3.2, ry: 2.6 });
  // light studio: re-light the photo / drape and re-tint the living backdrop to match
  $$('.lights button', root).forEach((b) => (b.onclick = () => {
    const k = b.dataset.l; $('#mwrap', root).dataset.light = k; $$('.lights button', root).forEach((x) => x.setAttribute('aria-pressed', x === b));
    window.__stage?.theme(k === 'day' ? (p.colour || 'default') : LIGHT_THEME[k]); window.__stage?.kick(.7);
  }));
  const Z = 2.4, R = 100;
  main.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; const b = main.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top; lens.style.left = x - R + 'px'; lens.style.top = y - R + 'px'; lin.style.width = b.width + 'px'; lin.style.height = b.height + 'px'; lin.style.transform = `translate(${R - x * Z}px,${R - y * Z}px) scale(${Z})`; });
  let sx = null; main.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true }); main.addEventListener('touchend', (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 45) show(cur + (dx < 0 ? 1 : -1)); sx = null; }, { passive: true });
  function lightbox() {
    const m = modal(`<div id="lb" style="position:relative"><div style="aspect-ratio:4/5;max-height:72vh;margin:0 auto;background-size:cover;background-position:center" id="lbimg" role="img"></div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><button class="btn btn-line btn-sm" id="lbp">${ic('chevL', 16)} Prev</button><span id="lbt" class="muted"></span><button class="btn btn-line btn-sm" id="lbn">Next ${ic('chevR', 16)}</button></div></div>`); m.querySelector('.box').style.maxWidth = '720px'; let k = cur;
    const draw = () => { const g = p.gallery[k]; const el = $('#lbimg', m); el.style.cssText = bg(g) + ';aspect-ratio:4/5;max-height:72vh;margin:0 auto'; el.setAttribute('aria-label', g.alt || g.label); $('#lbt', m).textContent = `${g.label} · ${k + 1}/${p.gallery.length}`; }; draw();
    $('#lbp', m).onclick = () => { k = (k - 1 + p.gallery.length) % p.gallery.length; draw(); show(k); }; $('#lbn', m).onclick = () => { k = (k + 1) % p.gallery.length; draw(); show(k); };
  }
  main.addEventListener('click', lightbox);

  // ----- 3D drape mode (lazy)
  let stopDrape = null, dead = false, drapeLoading = false;
  async function setMode(m) {
    if (!gl) return; const on = m === '3d'; $('#mphoto', root).setAttribute('aria-pressed', !on); $('#m3d', root).setAttribute('aria-pressed', on); $('#dstage', root).classList.toggle('on', on);
    $('#note', root).textContent = on ? 'Simulated cloth built from the photo — drag to tilt. Not a scan of this saree.' : 'Photos only — a true 360° view needs real 360 capture (planned).';
    if (on && !stopDrape && !drapeLoading) { drapeLoading = true; try { const s = await drapeViewer($('#drape', root), img(p.gallery[Math.min(3, p.gallery.length - 1)].img)); if (dead) s(); else stopDrape = s; } catch { toast('3D preview is not available on this device.'); setMode('photo'); } drapeLoading = false; }
  }
  $('#mphoto', root)?.addEventListener('click', () => setMode('photo')); $('#m3d', root)?.addEventListener('click', () => setMode('3d'));

  // ----- PIN check
  const pinf = $('#pinf', root), pin = $('#pin', root), res = $('#pinres', root);
  const doPin = () => { const r = checkPin(pin.value.trim()); res.style.color = r.ok ? 'var(--ok)' : 'var(--err)'; res.innerHTML = (r.ok ? ic('check', 18, 2.4) + ' ' : '') + esc(r.msg); if (r.ok) { state().pin = pin.value.trim(); _emit('pin'); } };
  pinf.addEventListener('submit', (e) => { e.preventDefault(); doPin(); }); if (pin.value) doPin();

  // ----- buy actions
  const chosen = () => $$('[data-add]', root).filter((c) => c.checked).map((c) => c.dataset.add);
  const add = () => { const r = cart.add(p.id, 1, { addons: chosen() }); if (!r.ok) { toast(r.msg); return; } toast('Added to bag'); window.__openBag?.(); };
  $('#addbag', root)?.addEventListener('click', add); $('#sbtn', root)?.addEventListener('click', add);
  $('#notify', root)?.addEventListener('click', () => modal(`<h2 class="serif" style="font-size:38px">Notify me</h2><p class="muted" style="margin:6px 0 16px">We’ll message you if this piece returns.${T(' (Demo — nothing is stored.)', '')}</p><div class="field"><label for="nm">Mobile or email</label><input id="nm" autofocus><div class="err" id="nme" role="alert"></div></div><button class="btn btn-gold btn-block" id="nmok">Notify me</button>`).querySelector('#nmok').addEventListener('click', async () => {
    if (!ONLINE) { closeAll(); toast('Thanks — noted (demo).'); return; }
    const v = $('#nm').value.trim(); if (!/^([6-9]\d{9}|[^@\s]+@[^@\s]+\.[^@\s]+)$/.test(v)) { $('#nme').textContent = 'Enter a 10-digit mobile or a valid email.'; return; }
    try { await createTicket({ channel: 'Notify me', subject: 'Notify me: ' + p.name, order: p.sku, message: 'Please tell me if ' + p.name + ' (' + p.sku + ') becomes available.', contact: v }); closeAll(); toast('Thank you — we will let you know.'); } catch (e) { $('#nme').textContent = e.message; }
  }));
  const wb = $('#wishb', root); wb.onclick = () => { const on = wish.toggle(p.id); wb.setAttribute('aria-pressed', on); wb.style.background = on ? 'var(--goldhi)' : ''; wb.style.color = on ? '#241018' : ''; toast(on ? 'Saved to wishlist' : 'Removed from wishlist'); }; if (wish.has(p.id)) { wb.style.background = 'var(--goldhi)'; wb.style.color = '#241018'; }
  $('#vc', root).onclick = () => {
    const days = [1, 2, 3].map((d) => new Date(Date.now() + d * 864e5).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })); const slots = ['11:00', '14:30', '17:00', '19:30'];
    const m = modal(`<h2 class="serif" style="font-size:38px">Video consultation</h2><p class="muted" style="margin:6px 0 16px">See ${esc(p.name)} in real light with a stylist.${T(' (Demo — no booking is made.)', ' We will call you on this number to confirm the slot.')}</p>
      <div class="field"><label for="vd">Day</label><select id="vd">${days.map((d) => `<option>${d}</option>`).join('')}</select></div><div class="field"><label for="vt">Time</label><select id="vt">${slots.map((d) => `<option>${d}</option>`).join('')}</select></div>
      <div class="field"><label for="vm">Mobile number</label><input id="vm" inputmode="numeric" maxlength="10" placeholder="10-digit mobile" autofocus><div class="err" id="vme"></div></div><button class="btn btn-gold btn-block" id="vok">Request a slot</button>`);
    $('#vok', m).onclick = async () => {
      const v = $('#vm', m).value.trim(); if (!/^[6-9]\d{9}$/.test(v)) { $('#vme', m).textContent = 'Enter a valid 10-digit Indian mobile number.'; return; }
      const slot = `${$('#vd', m).value}, ${$('#vt', m).value}`;
      if (ONLINE) { try { await createTicket({ channel: 'Visit request', subject: 'Video consult: ' + p.name, order: p.sku, message: `Video consultation for ${p.name} (${p.sku}) — requested slot ${slot}.`, contact: v }); } catch (e) { $('#vme', m).textContent = e.message; return; } }
      closeAll(); toast(`Slot requested: ${slot}${T(' (demo)', '')}`);
    };
  };
  if (ONLINE) $('#pass', root).onclick = () => modal(`<div class="eyebrow">Product passport</div><h2 class="serif" style="font-size:38px;margin:6px 0 12px">${esc(p.name)}</h2><dl style="font-size:15.5px">${[['SKU', p.sku], ['Fabric', p.fabric], ['Weave', p.weave], ['Colour', p.colour], ['Length', p.length], ['Care', p.care]].map(([a, b]) => `<div style="padding:7px 0;border-bottom:1px solid var(--line)"><dt class="muted" style="font-size:12px;letter-spacing:.16em;text-transform:uppercase">${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl><p class="muted" style="font-size:13.5px;margin-top:12px">Certification details such as Silk Mark or GI are shown only where we hold the certificate.</p>`);
  else $('#pass', root).onclick = () => modal(`<div class="eyebrow">Authenticity passport · SAMPLE</div><h2 class="serif" style="font-size:38px;margin:6px 0 12px">${esc(p.name)}</h2><div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start">${qrSvg(p.sku)}<dl style="flex:1;min-width:200px;font-size:15.5px">${[['SKU', p.sku], ['Fibre', 'To be verified and supplied'], ['Weave', p.weave], ['Weaver / region', 'To be supplied'], ['Silk Mark / GI', 'Shown only if certified'], ['Zari', 'Certificate to be supplied']].map(([a, b]) => `<div style="padding:7px 0;border-bottom:1px solid var(--line)"><dt class="muted" style="font-size:12px;letter-spacing:.16em;text-transform:uppercase">${a}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl></div><p class="muted" style="font-size:13.5px;margin-top:12px">Sample passport — the QR is illustrative and not scannable. No certification claim is made.</p>`);

  // ----- sticky buy bar appears once the main button scrolls away
  let io = null; const sb = $('#sbuy', root), ab = $('#addbag', root); if (sb && ab) { io = new IntersectionObserver((es) => { const out = !es[0].isIntersecting && es[0].boundingClientRect.top < 0; sb.classList.toggle('on', out); sb.setAttribute('aria-hidden', !out); }); io.observe(ab); }

  // ----- related
  const rel = products().filter((x) => x.id !== p.id && (x.collection === p.collection || x.fabric === p.fabric)).slice(0, 4); const relEl = $('#rel', root);
  (rel.length ? rel : products().filter((x) => x.id !== p.id).slice(0, 4)).forEach((x) => relEl.appendChild(card(x)));
  const onData = () => { const q = prod(p.id); if (q.stock !== p.stock) location.reload(); }; addEventListener('tpv:data', onData);
  return () => { dead = true; stopDrape?.(); io?.disconnect(); ld.remove(); removeEventListener('tpv:data', onData); };
}

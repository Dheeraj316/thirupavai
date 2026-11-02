// App shell: hash router, header/footer, bag drawer, search overlay, mobile menu, intro.
import { state, subscribe, cart, totals, coupon, reset, products, prod, markIntro, ADDONS, COUPONS, bootOnline, ensureFresh } from './store.js';
import { ONLINE, MODE, LIVE, T, biz } from './api.js';
import { $, $$, h, ic, toast, openLayer, closeAll, esc, img, money, reveal } from './ui.js';
import { COLLECTIONS, bySlug } from './data.js';
import { initCursor, initMagnetic, splitText, observeReveal, curtain, lotusPath } from './fx.js';
import { initExtras, toggleSound } from './extras.js';
import { glReady } from './gate.js';
initCursor(); initMagnetic();
// once a warp-slat reveal has finished, drop the mask so no seams remain between slats
addEventListener('animationend', (e) => { if (e.animationName === 'warp') e.target.classList.add('done'); }, true);
// The WebGL silk backdrop (three.js, ~2 MB) loads after the page has painted, never on the critical path.
let stage = null;
glReady().then(() => import('./stage.js')).then((m) => { stage = m.startStage(); stage?.theme(themeFor(parse())); }).catch((e) => console.warn('stage unavailable', e));
let covered = false, prevKey = null;
const themeFor = (r) => (r.name === 'product' ? (bySlug(r.args[0])?.colour || 'default') : ['shop', 'story', 'admin'].includes(r.name) ? r.name : 'default');

const VIEWS = { home: './views/home.js', shop: './views/shop.js', product: './views/product.js', checkout: './views/checkout.js', order: './views/order.js', story: './views/story.js', misc: './views/misc.js', admin: './views/admin.js' };
const ROUTES = [[/^\/?$/, 'home'], [/^\/shop\/?$/, 'shop'], [/^\/product\/([\w-]+)$/, 'product'], [/^\/checkout\/?$/, 'checkout'], [/^\/order\/([\w-]+)$/, 'order'], [/^\/story\/?$/, 'story'], [/^\/(wishlist|account)\/?$/, 'misc'], [/^\/page\/([\w-]+)$/, 'misc'], [/^\/admin(?:\/([\w-]+))?$/, 'admin']];
const TITLES = { home: 'Tradition, Woven Into Tomorrow', shop: 'Shop Sarees', product: 'Saree', checkout: T('Secure checkout (test mode)', 'Secure checkout', 'Secure checkout (test payments)'), order: 'Your order', story: 'Our Story', misc: 'Thirupavai', admin: 'Admin console' };

const main = $('#main'); let cleanup = null, token = 0;
export function parse() {
  const raw = location.hash.replace(/^#/, '') || '/'; const [path, qs] = raw.split('?'); const q = new URLSearchParams(qs || '');
  for (const [re, name] of ROUTES) { const m = path.match(re); if (m) return { name, args: m.slice(1), q, path }; }
  return { name: 'misc', args: ['notfound'], q, path };
}
export const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
window.__go = go;

async function render() {
  const my = ++token; const r = parse(); const key = r.name + ':' + r.args.join(',');
  if (prevKey !== null && prevKey !== key && !covered) { covered = true; await curtain.cover(); if (my !== token) return; }   // silk curtain sweeps in between pages
  closeAll(); try { cleanup?.(); } catch (e) { console.warn(e); } cleanup = null;
  document.body.dataset.route = r.name; drawMobileNav(); document.title = (TITLES[r.name] || 'Thirupavai') + ' — Thirupavai' + T(' (concept prototype)', '', ' (staging)');
  main.innerHTML = `<div class="wrap" style="padding:120px 0;text-align:center"><div class="spin" style="margin:0 auto;border-color:rgba(38,13,25,.2);border-top-color:#260D19"></div></div>`;
  try {
    // online: every page opens on today's prices and stock (a conditional request, normally a few ms; never waits more than 0.7 s)
    if (ONLINE && r.name !== 'admin') await Promise.race([ensureFresh(r.name === 'product' || r.name === 'checkout' ? 1500 : 5000).catch(() => {}), new Promise((ok) => setTimeout(ok, 700))]);
    const mod = await import(VIEWS[r.name]); if (my !== token) return;
    main.innerHTML = ''; const out = await mod.default(main, r);
    if (my !== token) { out?.(); return; } cleanup = typeof out === 'function' ? out : null;
  } catch (e) {
    console.error(e); main.innerHTML = `<div class="wrap empty"><h3>Something went wrong</h3><p class="muted">${esc(e.message || e)}</p><p style="margin-top:18px"><a class="btn btn-dark" href="#/">Back to home</a></p></div>`;
  }
  if (!r.q.has('keep')) window.scrollTo(0, 0); splitText(main); observeReveal(main); main.focus({ preventScroll: true }); onScroll();
  prevKey = key; stage?.theme(themeFor(r)); stage?.kick(.8); if (covered) { covered = false; curtain.reveal(); }
}

// ---------- header / footer
const hdr = $('#hdr'), ftr = $('#ftr');
// a slim promise strip above the header: the same rules the checkout applies (free standard delivery, 7-day returns, authenticity passport)
hdr.insertAdjacentElement('beforebegin', h('<div id="annc" role="note">Free standard delivery <i></i> 7-day returns <i></i> Every saree comes with its own authenticity passport</div>'));
function drawHeader() {
  const s = state(); const bag = cart.count(); const wc = s.wish.length;
  hdr.innerHTML = `<div class="wrap hdr-in">
    <nav class="nav-l" aria-label="Primary"><a href="#/shop">Shop Sarees</a><a href="#/shop?collection=bridal">Collections</a><a href="#/shop?sort=new">New Arrivals</a><a href="#/shop?occasion=Bridal">Bridal</a><a href="#/shop?occasion=Festive">Festive</a></nav>
    <button class="burger ib" id="burger" aria-label="Open menu">${ic('menu', 24)}</button>
    <a class="logo serif" href="#/" aria-label="Thirupavai — home">THIRUPAVAI</a>
    <div class="nav-r"><button class="tx navlink" id="navFind" type="button">Find my saree</button><a class="tx" href="#/story">Our Story</a>
      <button class="ib" id="sbtn" aria-label="Search">${ic('search', 22)}</button>
      <a class="ib" href="#/account" aria-label="Account">${ic('user', 22)}</a>
      <a class="ib" href="#/wishlist" aria-label="Wishlist, ${wc} saved">${ic('heart', 22)}${wc ? `<span class="badge">${wc}</span>` : ''}</a>
      <button class="ib" id="bbtn" aria-label="Open bag, ${bag} items">${ic('bag', 22)}${bag ? `<span class="badge">${bag}</span>` : ''}</button></div></div>
    <div class="wrap hdr-m"><button class="msearch" id="msearch" type="button" aria-label="Search sarees">${ic('search', 20)}<span>Search sarees, silks, weaves…</span></button></div>`;
  $('#bbtn').onclick = openBag; $('#sbtn').onclick = openSearch; $('#burger').onclick = openMenu; $('#msearch').onclick = openSearch;
  $('#navFind').onclick = openFinder;
  drawMobileNav();
}

// The style finder (a short quiz that ranks the sarees for you) lives in the header, the menu and the footer rather than in a floating button.
const openFinder = () => document.getElementById('dkStylist')?.click();
const soundLabel = () => { const on = document.getElementById('dkSound')?.getAttribute('aria-pressed') === 'true'; const b = document.getElementById('ftSound'); if (b) { b.setAttribute('aria-pressed', on); b.textContent = on ? 'Ambient sound: on' : 'Ambient sound: off'; } };

// ---------- phone navigation: category row under the search field, tab bar at the bottom (CSS shows them on phones only)
const RAIL = [['All sarees', '#/shop'], ['New', '#/shop?sort=new'], ['Bridal', '#/shop?occasion=Bridal'], ['Festive', '#/shop?occasion=Festive'], ['Kanchipuram', '#/shop?fabric=Kanchipuram%20silk'], ['Banarasi', '#/shop?fabric=Banarasi%20silk'], ['Mysore', '#/shop?fabric=Mysore%20silk'], ['Organza', '#/shop?fabric=Organza']];
let tabbar, rail;
function drawMobileNav() {
  const r = parse(); const bag = cart.count(), wc = state().wish.length;
  const is = { home: r.name === 'home', shop: r.name === 'shop', wish: r.path === '/wishlist', acct: r.path === '/account' };
  const tab = (k, href, icon, label, n) => `<a href="${href}"${is[k] ? ' aria-current="page"' : ''}>${ic(icon, 24)}${n ? `<span class="badge">${n}</span>` : ''}<span>${label}</span></a>`;
  tabbar = tabbar || document.body.appendChild(h('<nav class="tabbar" id="tabbar" aria-label="Main"></nav>'));
  tabbar.innerHTML = tab('home', '#/', 'home', 'Home') + tab('shop', '#/shop', 'grid', 'Shop') + tab('wish', '#/wishlist', 'heart', 'Saved', wc)
    + `<button type="button" id="tbag" aria-label="Open bag, ${bag} items">${ic('bag', 24)}${bag ? `<span class="badge">${bag}</span>` : ''}<span>Bag</span></button>` + tab('acct', '#/account', 'user', 'Account');
  $('#tbag', tabbar).onclick = openBag;
  rail = rail || hdr.insertAdjacentElement('afterend', h('<nav class="cat-rail" id="catrail" aria-label="Browse by category"></nav>'));
  const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } }; const cur = dec(location.hash || '#/');
  rail.innerHTML = RAIL.map(([t, l]) => `<a href="${l}"${dec(l) === cur ? ' aria-current="true"' : ''}>${t}</a>`).join('');
}
function drawFooter() {
  ftr.innerHTML = `<div class="band" aria-hidden="true"></div><div class="wrap"><div class="cols"><div><div class="logo serif">THIRUPAVAI</div><p style="max-width:300px">Tradition, Woven Into Tomorrow. A premium saree house${T(' — concept prototype with sample data', '')}.</p></div>
    <div><h3>Shop</h3><a href="#/shop">All sarees</a><a href="#/shop?occasion=Bridal">Bridal</a><a href="#/shop?occasion=Festive">Festive</a><a href="#/shop?sort=new">New arrivals</a><button class="ft-link" id="ftFind" type="button">Find my saree</button></div>
    <div><h3>Care</h3><a href="#/page/shipping">Shipping &amp; delivery</a><a href="#/page/returns">Returns &amp; exchanges</a><a href="#/page/faqs">FAQs</a><a href="#/page/contact">Contact</a></div>
    <div><h3>Trust</h3><a href="#/page/privacy">Privacy</a><a href="#/page/terms">Terms</a><a href="#/page/security">Security updates</a>${ONLINE ? '' : '<a href="#/admin">Admin console (demo)</a>'}</div></div>
    <div class="fine">${T('Concept prototype · sample products and prices · test-mode payments only · no real orders, shipments or customer data. Imagery is AI-generated concept imagery and supplied references — replace with licensed or original photography before launch. Domain, legal entity, GST and trademark status are unconfirmed.',
      `© ${new Date().getFullYear()} ${esc(biz.name)}${biz.gstin ? ' · GSTIN ' + esc(biz.gstin) : ''}${biz.supportEmail ? ' · <a href="mailto:' + esc(biz.supportEmail) + '">' + esc(biz.supportEmail) + '</a>' : ''}${biz.supportPhone ? ' · ' + esc(biz.supportPhone) : ''}`,
      'STAGING SITE · test payments only · orders placed here are not real and will not be shipped.')}</div>
    <div class="ft-tools"><button class="ft-link" id="ftSound" type="button" aria-pressed="false" title="A quiet tanpura and temple bells while you browse">Ambient sound: off</button></div></div>`;
  $('#ftFind').onclick = openFinder; $('#ftSound').onclick = () => { toggleSound(); soundLabel(); };
}

// ---------- bag drawer
let bagEl;
function bagHtml() {
  const t = totals(); const empty = !t.lines.length;
  const lines = t.lines.map((l) => `<div class="line" data-id="${l.id}"><a href="#/product/${l.p.slug}" class="ph" style="background-image:url(${img(l.p.gallery[0].img)});background-position:${l.p.gallery[0].pos}" aria-label="${esc(l.p.name)}"></a>
      <div><h4>${esc(l.p.name)}</h4><small>${l.p.sku} · ${esc(l.p.fabric)}</small>${(l.addons || []).map((a) => `<small>+ ${ADDONS[a][0]}</small>`).join('')}
      <div class="qty" role="group" aria-label="Quantity"><button data-q="-1" aria-label="Decrease">−</button><span>${l.qty}</span><button data-q="1" aria-label="Increase" ${l.qty >= l.p.stock ? 'disabled' : ''}>+</button></div></div>
      <div style="text-align:right"><div style="font:500 19px var(--sans)">${money(l.line)}</div><button class="muted" style="text-decoration:underline;margin-top:30px;font-size:14px" data-rm>Remove</button></div></div>`).join('');
  return `<header><h2 class="serif">Your Bag <span class="muted" style="font:400 20px var(--sans)">(${cart.count()})</span></h2><button class="ib" id="bagx" aria-label="Close bag">${ic('x', 24)}</button></header>
  <div class="body">${empty ? `<div class="empty"><h3>Your bag is empty</h3><p class="muted">Browsing needs no account. Add a saree to begin.</p><p style="margin-top:18px"><a class="btn btn-dark" href="#/shop">Shop sarees</a></p></div>` : lines}</div>
  ${empty ? '' : `<footer>
    <form id="cpn" style="display:flex;gap:10px;margin-bottom:12px"><input aria-label="Promo code" placeholder="Promo code (try FESTIVE5)" value="${esc(state().coupon || '')}" style="flex:1;height:44px;padding:0 12px;border:1px solid #cdb99b"><button class="btn btn-dark btn-sm" type="submit">Apply</button></form>
    ${t.couponMsg ? `<div class="pill warn" style="margin-bottom:8px">${esc(t.couponMsg)}</div>` : ''}
    <div class="sumrows"><div><span>Subtotal</span><span>${money(t.sub)}</span></div>${t.discount ? `<div style="color:var(--ok)"><span>Discount · ${esc(state().coupon)}${T(' (demo)', '')}</span><span>− ${money(t.discount)}</span></div>` : ''}<div><span>Delivery</span><span>${T('Free · sample rule', 'Free')}</span></div><div class="muted"><span>Taxes</span><span>GST included in price</span></div><div class="tot"><span>TOTAL PAYABLE</span><b class="serif">${money(t.total)}</b></div></div>
    <a class="btn btn-dark btn-block" id="gochk" href="#/checkout" style="margin-top:14px">${ic('lock', 18)} Checkout securely</a>
    <p class="muted" style="font-size:13px;text-align:center;margin-top:10px">Prices, offers and stock are re-validated on the server at checkout.</p></footer>`}`;
}
function openBag() { bagEl = bagEl || h('<aside class="drawer" role="dialog" aria-modal="true" aria-label="Shopping bag"></aside>'); drawBag(); openLayer(bagEl); }
function drawBag() {
  if (!bagEl) return; bagEl.innerHTML = bagHtml();
  $('#bagx', bagEl).onclick = closeAll; $('#gochk', bagEl)?.addEventListener('click', closeAll);
  $$('.line', bagEl).forEach((ln) => { const id = ln.dataset.id; $$('[data-q]', ln).forEach((b) => (b.onclick = () => { const c = state().cart.find((x) => x.id === id); cart.setQty(id, c.qty + Number(b.dataset.q)); })); $('[data-rm]', ln).onclick = () => { cart.remove(id); toast('Removed from bag'); }; });
  $('#cpn', bagEl)?.addEventListener('submit', (e) => { e.preventDefault(); const code = $('input', e.target).value; if (!code.trim()) { coupon.clear(); return; } const r = coupon.apply(code); toast(r.ok ? 'Applied: ' + r.msg : r.msg); });
}
window.__openBag = openBag;

// ---------- search overlay
let searchEl;
function openSearch() {
  searchEl = searchEl || h(`<div class="searchov" role="dialog" aria-modal="true" aria-label="Search"><button class="ib" style="position:absolute;right:var(--pad);top:calc(var(--hdr) - 52px)" aria-label="Close search" id="sx">${ic('x', 26)}</button><input id="sq" type="search" placeholder="Search sarees — try ‘banarasi’, ‘maroon’, ‘bridal’" aria-label="Search sarees" autocomplete="off"><div id="sres"></div></div>`);
  openLayer(searchEl); const input = $('#sq', searchEl), res = $('#sres', searchEl); $('#sx', searchEl).onclick = closeAll;
  const run = () => {
    const q = input.value.trim().toLowerCase(); res.innerHTML = '';
    if (!q) { res.innerHTML = `<p class="muted" style="text-align:center">Popular: ${['Banarasi', 'Kanchipuram', 'Bridal', 'Maroon'].map((x) => `<a class="chip" href="#/shop?q=${x}" style="margin:4px">${x}</a>`).join('')}</p>`; return; }
    const hits = products().filter((p) => [p.name, p.fabric, p.colour, p.weave, p.sku, ...p.occasion].join(' ').toLowerCase().includes(q));
    if (!hits.length) { res.innerHTML = `<div class="empty"><h3>No sarees match “${esc(q)}”</h3><p class="muted">Check the spelling or browse a collection.</p><p style="margin-top:14px"><a class="btn btn-dark" href="#/shop">Browse all sarees</a></p></div>`; return; }
    res.innerHTML = `<p class="muted" style="margin-bottom:14px">${hits.length} result${hits.length > 1 ? 's' : ''} · <a class="link-arrow" href="#/shop?q=${encodeURIComponent(q)}">See all in shop</a></p><div class="pgrid"></div>`;
    import('./ui.js').then(({ card }) => hits.slice(0, 8).forEach((p) => { const c = card(p); c.addEventListener('click', () => setTimeout(closeAll, 0)); $('.pgrid', res).appendChild(c); }));
  };
  input.oninput = run; input.onkeydown = (e) => { if (e.key === 'Enter' && input.value.trim()) { closeAll(); go('#/shop?q=' + encodeURIComponent(input.value.trim())); } }; run(); input.focus();
}

// ---------- mobile menu
function openMenu() {
  const m = h(`<aside class="drawer left" role="dialog" aria-modal="true" aria-label="Menu"><header><h2 class="serif" style="font-size:30px">THIRUPAVAI</h2><button class="ib" aria-label="Close menu" id="mx">${ic('x', 24)}</button></header>
    <div class="body" style="padding-top:12px;font:500 18px var(--serif)"><nav style="display:grid;gap:4px;font-size:26px">${[['Shop Sarees', '#/shop'], ['Collections', '#/shop?collection=bridal'], ['New Arrivals', '#/shop?sort=new'], ['Bridal', '#/shop?occasion=Bridal'], ['Festive', '#/shop?occasion=Festive'], ['Our Story', '#/story'], ['Wishlist', '#/wishlist'], ['Account', '#/account'], ['FAQs', '#/page/faqs']].map(([t, l]) => `<a href="${l}" style="padding:10px 0;border-bottom:1px solid var(--line)">${t}</a>`).join('')}<button id="mfind" type="button" style="padding:10px 0;border:0;border-bottom:1px solid var(--line);text-align:left;font:inherit;color:inherit;background:none">Find my saree</button></nav></div></aside>`);
  openLayer(m); $('#mx', m).onclick = closeAll; $('#mfind', m).onclick = () => { closeAll(); setTimeout(openFinder, 250); }; $$('a', m).forEach((a) => a.addEventListener('click', closeAll));
}

// ---------- intro (first visit only, skippable, respects reduced motion)
function maybeIntro() {
  if (state().introSeen || matchMedia('(prefers-reduced-motion:reduce)').matches || parse().name !== 'home') { markIntro(); return; }
  const lp = lotusPath();
  const el = h(`<div class="intro" role="dialog" aria-label="Welcome"><svg class="lotus" viewBox="0 0 240 240" aria-hidden="true"><path d="${lp.d}" style="--len:${lp.len}"/></svg><div class="wm">THIRUPAVAI</div><div class="tg">Tradition, Woven Into Tomorrow.</div><button type="button" id="skipintro">Skip intro</button></div>`);
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('show')); stage?.kick(1.2);
  const end = () => { if (!el.isConnected) return; el.style.opacity = 0; el.style.pointerEvents = 'none'; setTimeout(() => el.remove(), 900); markIntro(); };
  $('#skipintro', el).onclick = end; setTimeout(end, 3400); document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { end(); document.removeEventListener('keydown', esc); } });
}

// ---------- scroll behaviour for the transparent home header
function onScroll() { hdr.classList.toggle('solid', scrollY > 60 || document.body.dataset.route !== 'home'); document.body.classList.toggle('past-hero', scrollY > innerHeight * .55); }
addEventListener('scroll', onScroll, { passive: true });

// ---------- demo bar
const bar = $('#demobar');
if (!ONLINE) {
  bar.insertAdjacentHTML('afterbegin', '<a href="#/admin" id="admlink">Admin console</a>');
  $('#resetDemo').onclick = () => { if (confirm('Reset all demo data (bag, orders, edits) to the starting sample?')) { reset(); toast('Demo data reset'); go('#/'); } };
} else if (LIVE) bar.remove();                                           // the real shop has no prototype banner
else { bar.innerHTML = '<span><b>STAGING</b> · test payments · orders here are not real</span>'; }
document.body.dataset.mode = MODE;
addEventListener('tp:error', (e) => toast(e.detail));                   // API problems reach the person as a toast

// ---------- bring the page up: session + today's prices and stock, then the first view
bootOnline().finally(() => { drawHeader(); drawFooter(); onScroll(); initExtras({ go, openBag }); maybeIntro(); render(); });

// ---------- state wiring
let lastCount = cart.count();
subscribe((what) => {
  drawHeader(); onScroll(); if (['cart', 'orders', 'reset', 'sync'].includes(what)) drawBag(); lastCount = cart.count();
  if (!['cart', 'wish'].includes(what)) window.dispatchEvent(new CustomEvent('tpv:data', { detail: what }));
});
addEventListener('hashchange', drawMobileNav);                          // the tab bar answers the tap at once, not after the page transition
addEventListener('hashchange', render);
document.addEventListener('click', (e) => { const a = e.target.closest('a[href^="#/"]'); if (a && location.hash === a.getAttribute('href')) { e.preventDefault(); render(); } });

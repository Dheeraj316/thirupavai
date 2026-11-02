import { products } from '../store.js';
import { FABRICS, COLOURS, OCCASIONS, COLLECTIONS, inr } from '../data.js';
import { h, $, $$, ic, card, esc, img, openLayer, closeAll } from '../ui.js';

const SORTS = [['featured', 'Featured'], ['new', 'Newest first'], ['asc', 'Price: low to high'], ['desc', 'Price: high to low']];
const PRICES = [['Under ₹ 10,000', '', 10000], ['₹ 10,000 – 25,000', 10000, 25000], ['₹ 25,000 – 50,000', 25000, 50000], ['Over ₹ 50,000', 50000, '']];
const reduce = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
// the grid is the default; the 3D ring is an optional view that remembers the shopper's choice
const getMode = () => { try { const v = localStorage.getItem('tpv-view'); if (v === 'ring' || v === 'grid') return v; } catch {} return 'grid'; };
const EAGER = 8;                    // the first cards load at once, the rest as they come near the screen

export default async function shop(root, route) {
  const q = route.q; let mode = getMode(); let stopRing = null; let lazyIO = null;
  const F = { fabric: q.getAll('fabric'), colour: q.getAll('colour'), occasion: q.getAll('occasion'), collection: q.get('collection') || '', min: q.get('min') || '', max: q.get('max') || '', stock: q.get('stock') === '1', sort: q.get('sort') || 'featured', q: q.get('q') || '' };
  const all = () => products();
  const test = (p, skip) => (skip === 'fabric' || !F.fabric.length || F.fabric.includes(p.fabric)) && (skip === 'colour' || !F.colour.length || F.colour.includes(p.colour)) && (skip === 'occasion' || !F.occasion.length || p.occasion.some((o) => F.occasion.includes(o)))
    && (!F.collection || p.collection === F.collection) && (!F.min || p.price >= Number(F.min)) && (!F.max || p.price <= Number(F.max)) && (!F.stock || p.stock > 0)
    && (!F.q || [p.name, p.fabric, p.colour, p.weave, p.sku, ...p.occasion].join(' ').toLowerCase().includes(F.q.toLowerCase()));
  const sync = () => {
    const u = new URLSearchParams(); F.fabric.forEach((v) => u.append('fabric', v)); F.colour.forEach((v) => u.append('colour', v)); F.occasion.forEach((v) => u.append('occasion', v));
    if (F.collection) u.set('collection', F.collection); if (F.min) u.set('min', F.min); if (F.max) u.set('max', F.max); if (F.stock) u.set('stock', '1'); if (F.sort !== 'featured') u.set('sort', F.sort); if (F.q) u.set('q', F.q);
    const s = u.toString(); history.replaceState(null, '', '#/shop' + (s ? '?' + s : ''));
  };
  const nActive = () => F.fabric.length + F.colour.length + F.occasion.length + (F.collection ? 1 : 0) + (F.min || F.max ? 1 : 0) + (F.stock ? 1 : 0);

  root.innerHTML = `<div class="wrap shp">
    <header class="shp-head"><div><nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a><span aria-hidden="true">/</span><span aria-current="page">Sarees</span></nav><h1>Sarees</h1></div>
      <p class="shp-intro">Silks from the Kanchipuram, Banarasi and Mysore looms, and lighter handloom cotton, linen, tussar, georgette and organza for every day. Each piece is photographed six ways.</p></header>
    <nav class="shp-weaves" id="weaves" aria-label="Browse by weave"></nav>
    <div class="shop"><aside class="filters" id="filters" aria-label="Filters"><div class="fhead"><h3>Filters</h3><button class="ib fclose" aria-label="Close filters">${ic('x', 24)}</button></div><div id="fbody"></div><button class="btn btn-gold btn-block fclose fdone">Show results</button></aside>
    <section aria-live="polite" class="shp-main"><div class="shp-bar"><button class="btn btn-line btn-sm fbtn" id="fopen" aria-haspopup="dialog">${ic('filter', 18)}<span>Filters</span><b class="fcount" id="fcount" hidden></b></button><span class="shp-count" id="count" role="status"></span>
      <div class="vt" role="group" aria-label="View"><button id="vgrid" aria-pressed="false" aria-label="Grid view">${ic('grid', 18)}<span class="lbl">Grid</span></button><button id="vring" aria-pressed="false" aria-label="3D ring view">${ic('cube', 18)}<span class="lbl">3D ring</span></button></div>
      <label class="sr" for="sort">Sort by</label><select id="sort">${SORTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
      <div class="applied" id="applied"></div><div id="results"></div></section></div></div>`;
  $('#sort', root).value = F.sort;

  // ---------- weave tabs: the quickest way in
  function drawWeaves() {
    const list = all(); const one = F.fabric.length === 1 ? F.fabric[0] : '';
    $('#weaves', root).innerHTML = `<button class="wv" data-fab="" aria-pressed="${!F.fabric.length}">All<span>${list.length}</span></button>` + FABRICS.map((f) => `<button class="wv" data-fab="${esc(f)}" aria-pressed="${one === f}">${esc(f)}<span>${list.filter((p) => p.fabric === f).length}</span></button>`).join('');
    $$('.wv', root).forEach((b) => (b.onclick = () => { F.fabric = b.dataset.fab ? [b.dataset.fab] : []; update(); }));
  }

  // ---------- filters (collapsible groups; the open state survives a redraw)
  const openG = new Set(['fabric', 'colour', 'occasion']);
  function drawFilters() {
    const list = all(); const cnt = (key, val, fn) => list.filter((p) => test(p, key) && fn(p, val)).length;
    const g = (id, title, body, force) => `<details class="fgroup" data-g="${id}" ${openG.has(id) || force ? 'open' : ''}><summary>${title}</summary><div class="fb">${body}</div></details>`;
    $('#fbody', root).innerHTML =
      g('fabric', 'Fabric', FABRICS.map((f) => `<label class="frow"><input type="checkbox" data-k="fabric" value="${esc(f)}" ${F.fabric.includes(f) ? 'checked' : ''}><span>${f}</span><span class="n">${cnt('fabric', f, (p, v) => p.fabric === v)}</span></label>`).join('')) +
      g('colour', 'Colour', `<div class="swatches">${COLOURS.map(([n, c]) => `<button class="sw" data-k="colour" data-v="${n}" aria-pressed="${F.colour.includes(n)}" aria-label="${n} (${cnt('colour', n, (p, v) => p.colour === v)})" title="${n}"><i style="background:${c}"></i></button>`).join('')}</div>`) +
      g('occasion', 'Occasion', `<div class="chips">${OCCASIONS.map((o) => `<button class="chip ${F.occasion.includes(o) ? 'on' : ''}" data-k="occasion" data-v="${o}" aria-pressed="${F.occasion.includes(o)}">${o}</button>`).join('')}</div>`) +
      g('price', 'Price', `<div class="chips">${PRICES.map(([l, a, b]) => `<button class="chip ${String(F.min) === String(a) && String(F.max) === String(b) ? 'on' : ''}" data-pr="1" data-min="${a}" data-max="${b}" aria-pressed="${String(F.min) === String(a) && String(F.max) === String(b)}">${l}</button>`).join('')}</div><div class="range"><input id="pmin" type="number" min="0" inputmode="numeric" placeholder="Min ₹" aria-label="Minimum price" value="${esc(F.min)}"><span aria-hidden="true">–</span><input id="pmax" type="number" min="0" inputmode="numeric" placeholder="Max ₹" aria-label="Maximum price" value="${esc(F.max)}"></div>`, !!(F.min || F.max)) +
      g('more', 'Collection and availability', `<label class="fl" for="fcol">Collection</label><select id="fcol"><option value="">All collections</option>${COLLECTIONS.map(([k, n]) => `<option value="${k}" ${F.collection === k ? 'selected' : ''}>${n}</option>`).join('')}</select><label class="frow"><input type="checkbox" id="fstock" ${F.stock ? 'checked' : ''}><span>In stock only</span></label>`, !!(F.collection || F.stock)) +
      `<button class="link-arrow" id="fclear" type="button">Clear all filters</button>`;
    $$('details.fgroup', root).forEach((d) => d.addEventListener('toggle', () => { d.open ? openG.add(d.dataset.g) : openG.delete(d.dataset.g); }));
    $$('input[data-k]', root).forEach((i) => (i.onchange = () => toggle(i.dataset.k, i.value)));
    $$('button[data-k]', root).forEach((b) => (b.onclick = () => toggle(b.dataset.k, b.dataset.v)));
    $$('button[data-pr]', root).forEach((b) => (b.onclick = () => { const on = String(F.min) === b.dataset.min && String(F.max) === b.dataset.max; F.min = on ? '' : b.dataset.min; F.max = on ? '' : b.dataset.max; update(); }));
    $('#fcol', root).onchange = (e) => { F.collection = e.target.value; update(); };
    $('#pmin', root).onchange = (e) => { F.min = e.target.value; update(); }; $('#pmax', root).onchange = (e) => { F.max = e.target.value; update(); };
    $('#fstock', root).onchange = (e) => { F.stock = e.target.checked; update(); }; $('#fclear', root).onclick = () => { Object.assign(F, { fabric: [], colour: [], occasion: [], collection: '', min: '', max: '', stock: false, q: '' }); update(); };
  }
  function toggle(k, v) { F[k] = F[k].includes(v) ? F[k].filter((x) => x !== v) : [...F[k], v]; update(); }

  // ---------- 3D ring: a CSS-3D carousel with drag, inertia, snapping and idle auto-rotation
  let rot = 0;
  function ring(box, list) {
    const n = list.length, step = 360 / n, CW = 250, R = Math.max(430, ((CW + 46) * n) / (2 * Math.PI));
    box.innerHTML = `<div class="ring-wrap" id="rw" tabindex="0" role="group" aria-label="3D ring of sarees. Drag or use the arrow keys to turn it."><div class="ring-hint">Drag, swipe or use the arrow keys to turn the ring</div><div class="ring" id="rg">${list.map((p, i) => `<div class="rc" data-i="${i}"><a href="#/product/${p.slug}" draggable="false" aria-label="${esc(p.name)}, ${inr(p.price)}"><div class="ph" style="background-image:url(${img(p.gallery[0].img)});background-position:${p.gallery[0].pos}"></div><div class="t"><b>${esc(p.name)}</b><span>${inr(p.price)}</span></div></a></div>`).join('')}</div>
      <div class="ring-ui"><button class="btn btn-line btn-sm" id="rprev" aria-label="Previous saree">${ic('chevL', 18)}</button><button class="btn btn-line btn-sm" id="rnext" aria-label="Next saree">${ic('chevR', 18)}</button></div></div>`;
    const wrap = $('#rw', box), rg = $('#rg', box), cards = $$('.rc', box); let vel = 0, drag = null, moved = 0, snap = null, hover = false, raf = 0, alive = true;
    const layout = () => { rg.style.transform = `translateZ(${-R}px) rotateY(${rot}deg)`; cards.forEach((c, i) => { const a = i * step; const eff = ((((a + rot) % 360) + 540) % 360) - 180; const cs = Math.cos(eff * Math.PI / 180); c.style.transform = `rotateY(${-a}deg) translateZ(${R}px)`; c.style.opacity = (0.1 + 0.9 * Math.pow(Math.max(0, cs), 1.4)).toFixed(3); c.style.filter = cs < 0.35 ? `brightness(${(0.35 + cs * 0.65).toFixed(2)})` : ''; c.style.pointerEvents = cs > 0.55 ? 'auto' : 'none'; c.style.zIndex = Math.round(cs * 100) + 100; }); };
    const nearest = () => Math.round(-rot / step) * step * -1;
    const tick = () => { if (!alive) return; if (!drag) { if (snap != null) { rot += (snap - rot) * 0.12; if (Math.abs(snap - rot) < .05) { rot = snap; snap = null; } } else if (Math.abs(vel) > .02) { rot += vel; vel *= .94; if (Math.abs(vel) <= .3) snap = nearest(); } else if (!hover && !reduce()) rot -= 0.06; } layout(); raf = requestAnimationFrame(tick); };
    const go = (d) => { snap = -(Math.round(-rot / step) + d) * step; vel = 0; };
    // the ring captures the pointer only once a real drag starts: capturing on touch-down swallowed taps, so tapping a card did nothing on a phone
    wrap.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, id: e.pointerId, cap: false }; moved = 0; vel = 0; snap = null; wrap.classList.add('drag'); });
    wrap.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; moved += Math.abs(dx); if (!drag.cap && moved > 6) { drag.cap = true; try { wrap.setPointerCapture(drag.id); } catch {} } rot += dx * .32; vel = dx * .32; });
    const up = () => { if (!drag) return; drag = null; wrap.classList.remove('drag'); if (Math.abs(vel) <= .3) snap = nearest(); };
    wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up); wrap.addEventListener('mouseenter', () => (hover = true)); wrap.addEventListener('mouseleave', () => (hover = false));
    wrap.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    wrap.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); rot -= e.deltaX * .12; snap = null; vel = 0; } }, { passive: false });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { go(1); e.preventDefault(); } if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); } });
    $('#rprev', box).onclick = () => go(-1); $('#rnext', box).onclick = () => go(1);
    const io = new IntersectionObserver((es) => { const on = es[0].isIntersecting; if (on && !raf && alive) raf = requestAnimationFrame(tick); else if (!on) { cancelAnimationFrame(raf); raf = 0; } }); io.observe(wrap);
    layout(); raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); io.disconnect(); };
  }

  // ---------- cards: the first few load at once; the rest, and every hover image, load only when needed
  function lazyCards(grid) {
    lazyIO?.disconnect(); lazyIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { const el = e.target; if (el.dataset.bg) { el.style.backgroundImage = el.dataset.bg; delete el.dataset.bg; } lazyIO.unobserve(el); } }), { rootMargin: '900px 0px' });
    $$('.pcard', grid).forEach((c, i) => $$('.ph', c).forEach((ph) => {
      const bg = ph.style.backgroundImage; if (!bg) return;
      if (ph.classList.contains('alt')) { ph.dataset.bg = bg; ph.style.backgroundImage = ''; const arm = () => { if (ph.dataset.bg) { ph.style.backgroundImage = ph.dataset.bg; delete ph.dataset.bg; } }; c.addEventListener('pointerenter', arm, { once: true }); c.addEventListener('focusin', arm, { once: true }); }
      else if (i >= EAGER) { ph.dataset.bg = bg; ph.style.backgroundImage = ''; lazyIO.observe(ph); }
    }));
  }
  const assist = () => h(`<aside class="shp-assist"><div><h3>Not sure which weave suits the occasion?</h3><p>Answer three short questions and we will suggest three sarees. Or book a video call and see any piece in real light with a stylist.</p></div><div class="acts"><button class="btn btn-line" id="helpme" type="button">Help me choose</button><a class="link-arrow" href="#/page/contact">Talk to us</a></div></aside>`);

  function drawResults() {
    stopRing?.(); stopRing = null;
    let list = all().filter((p) => test(p));
    if (F.sort === 'new') list.sort((a, b) => b.date - a.date); else if (F.sort === 'asc') list.sort((a, b) => a.price - b.price); else if (F.sort === 'desc') list.sort((a, b) => b.price - a.price);
    $('#count', root).textContent = `${list.length} saree${list.length === 1 ? '' : 's'}`;
    const na = nActive(); const fc = $('#fcount', root); fc.hidden = !na; fc.textContent = na;
    const useRing = mode === 'ring' && list.length >= 4; $('#vgrid', root).setAttribute('aria-pressed', !useRing); $('#vring', root).setAttribute('aria-pressed', useRing); $('#vring', root).title = list.length < 4 ? 'Needs 4 or more sarees' : '';
    const chips = [...F.fabric.map((v) => ['fabric', v, v]), ...F.colour.map((v) => ['colour', v, v]), ...F.occasion.map((v) => ['occasion', v, v])];
    if (F.collection) chips.push(['collection', F.collection, COLLECTIONS.find((c) => c[0] === F.collection)?.[1] || F.collection]); if (F.min || F.max) chips.push(['price', '', `₹ ${F.min || 0} – ${F.max || 'any'}`]); if (F.stock) chips.push(['stock', '', 'In stock']); if (F.q) chips.push(['q', '', `“${F.q}”`]);
    $('#applied', root).innerHTML = chips.map(([k, v, l]) => `<span class="chip on">${esc(l)}<button data-rm="${k}" data-v="${esc(v)}" aria-label="Remove filter ${esc(l)}">${ic('x', 14)}</button></span>`).join('');
    $$('[data-rm]', root).forEach((b) => (b.onclick = () => { const k = b.dataset.rm, v = b.dataset.v; if (['fabric', 'colour', 'occasion'].includes(k)) F[k] = F[k].filter((x) => x !== v); else if (k === 'collection') F.collection = ''; else if (k === 'price') { F.min = ''; F.max = ''; } else if (k === 'stock') F.stock = false; else if (k === 'q') F.q = ''; update(); }));
    const g = $('#results', root); g.innerHTML = '';
    if (!list.length) { g.className = ''; g.innerHTML = `<div class="empty"><h3>No sarees match these filters</h3><p class="muted">Try removing a filter or widening the price range.</p><p style="margin-top:16px"><button class="btn btn-gold" id="eclr">Clear all filters</button></p></div>`; $('#eclr', root).onclick = () => $('#fclear', root).click(); return; }
    if (useRing) { g.className = ''; stopRing = ring(g, list); return; }
    g.className = 'pgrid'; list.forEach((p, i) => g.appendChild(card(p, { eager: i < EAGER })));
    if (list.length > 12) { const a = assist(); g.insertBefore(a, g.children[12]); $('#helpme', a).onclick = () => { const d = document.getElementById('dkStylist'); if (d) d.click(); else location.hash = '#/page/contact'; }; }
    lazyCards(g);
  }
  function update() { sync(); drawWeaves(); drawFilters(); drawResults(); }
  $('#sort', root).onchange = (e) => { F.sort = e.target.value; sync(); drawResults(); };
  const setMode = (m) => { mode = m; try { localStorage.setItem('tpv-view', m); } catch {} drawResults(); };
  $('#vgrid', root).onclick = () => setMode('grid'); $('#vring', root).onclick = () => setMode('ring');
  const fl = $('#filters', root); $('#fopen', root).onclick = () => openLayer(fl); $$('.fclose', root).forEach((b) => (b.onclick = closeAll));
  const fixDone = () => { const m = matchMedia('(max-width:900px)').matches; $$('.fdone', root).forEach((b) => (b.style.display = m ? '' : 'none')); $$('.fhead .fclose', root).forEach((b) => (b.style.display = m ? '' : 'none')); };
  fixDone(); addEventListener('resize', fixDone);
  const onData = () => update(); addEventListener('tpv:data', onData);
  drawWeaves(); drawFilters(); drawResults();
  return () => { stopRing?.(); lazyIO?.disconnect(); removeEventListener('resize', fixDone); removeEventListener('tpv:data', onData); };
}

import { products } from '../store.js';
import { FABRICS, COLOURS, OCCASIONS, COLLECTIONS, inr } from '../data.js';
import { h, $, $$, ic, card, esc, img, openLayer, closeAll } from '../ui.js';

const SORTS = [['featured', 'Featured'], ['new', 'Newest'], ['asc', 'Price: low to high'], ['desc', 'Price: high to low']];
const reduce = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
const getMode = () => { try { const v = localStorage.getItem('tpv-view'); if (v) return v; } catch {} return innerWidth >= 900 ? 'ring' : 'grid'; };

export default async function shop(root, route) {
  const q = route.q; let mode = getMode(); let stopRing = null;
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

  root.innerHTML = `<div class="wrap"><div class="page-head"><div class="crumbs"><a href="#/">Home</a> / Shop Sarees</div><h1 data-split>Shop Sarees</h1></div>
    <div class="shop"><aside class="filters" id="filters" aria-label="Filters"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px" class="fhead"><h3 class="serif" style="font-size:34px">Filters</h3><button class="ib fclose" aria-label="Close filters">${ic('x', 24)}</button></div><div id="fbody"></div><button class="btn btn-gold btn-block fclose fdone" style="margin-top:14px">Show results</button></aside>
    <section aria-live="polite"><div class="toolbar"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn btn-line btn-sm fbtn" id="fopen">${ic('filter', 18)} Filters</button><span class="muted" id="count" role="status"></span>
      <div class="vt" role="group" aria-label="View"><button id="vgrid" aria-pressed="false">${ic('grid', 16)} Grid</button><button id="vring" aria-pressed="false">${ic('cube', 16)} 3D Ring</button></div></div>
      <label class="sr" for="sort">Sort by</label><select id="sort">${SORTS.map(([v, l]) => `<option value="${v}">Sort: ${l}</option>`).join('')}</select></div>
      <div class="applied" id="applied" style="margin-bottom:20px"></div><div id="results"></div></section></div></div>`;
  $('#sort', root).value = F.sort;

  function drawFilters() {
    const list = all(); const cnt = (key, val, fn) => list.filter((p) => test(p, key) && fn(p, val)).length;
    $('#fbody', root).innerHTML = `
      <div class="fgroup"><h4>Fabric</h4>${FABRICS.map((f) => `<label class="frow"><input type="checkbox" data-k="fabric" value="${esc(f)}" ${F.fabric.includes(f) ? 'checked' : ''}><span>${f}</span><span class="n">${cnt('fabric', f, (p, v) => p.fabric === v)}</span></label>`).join('')}</div>
      <div class="fgroup"><h4>Colour</h4><div class="swatches">${COLOURS.map(([n, c]) => `<button class="sw" data-k="colour" data-v="${n}" style="background:${c}" aria-pressed="${F.colour.includes(n)}" aria-label="${n} (${cnt('colour', n, (p, v) => p.colour === v)})" title="${n}"></button>`).join('')}</div></div>
      <div class="fgroup"><h4>Occasion</h4><div style="display:flex;gap:8px;flex-wrap:wrap">${OCCASIONS.map((o) => `<button class="chip ${F.occasion.includes(o) ? 'on' : ''}" data-k="occasion" data-v="${o}" aria-pressed="${F.occasion.includes(o)}">${o}</button>`).join('')}</div></div>
      <div class="fgroup"><h4>Collection</h4><select id="fcol" style="width:100%;height:46px;padding:0 10px;border:1px solid #cdb99b"><option value="">All collections</option>${COLLECTIONS.map(([k, n]) => `<option value="${k}" ${F.collection === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="fgroup"><h4>Price (₹)</h4><div class="range"><input id="pmin" type="number" min="0" inputmode="numeric" placeholder="Min" aria-label="Minimum price" value="${esc(F.min)}"><span>–</span><input id="pmax" type="number" min="0" inputmode="numeric" placeholder="Max" aria-label="Maximum price" value="${esc(F.max)}"></div></div>
      <div class="fgroup"><label class="check"><input type="checkbox" id="fstock" ${F.stock ? 'checked' : ''}><span>In stock only</span></label></div>
      <button class="link-arrow" id="fclear" style="margin-bottom:10px">Clear all filters</button>`;
    $$('input[data-k]', root).forEach((i) => (i.onchange = () => toggle(i.dataset.k, i.value)));
    $$('button[data-k]', root).forEach((b) => (b.onclick = () => toggle(b.dataset.k, b.dataset.v)));
    $('#fcol', root).onchange = (e) => { F.collection = e.target.value; update(); };
    $('#pmin', root).onchange = (e) => { F.min = e.target.value; update(); }; $('#pmax', root).onchange = (e) => { F.max = e.target.value; update(); };
    $('#fstock', root).onchange = (e) => { F.stock = e.target.checked; update(); }; $('#fclear', root).onclick = () => { Object.assign(F, { fabric: [], colour: [], occasion: [], collection: '', min: '', max: '', stock: false, q: '' }); update(); };
  }
  function toggle(k, v) { F[k] = F[k].includes(v) ? F[k].filter((x) => x !== v) : [...F[k], v]; update(); }

  // ---------- 3D ring: a CSS-3D carousel with drag, inertia, snapping and idle auto-rotation
  let rot = 0;
  function ring(box, list) {
    const n = list.length, step = 360 / n, CW = 250, R = Math.max(430, ((CW + 46) * n) / (2 * Math.PI));
    box.innerHTML = `<div class="ring-wrap" id="rw" tabindex="0" role="group" aria-label="3D ring of sarees. Drag or use arrow keys to rotate."><div class="ring-hint">Drag, swipe or use the arrow keys</div><div class="ring" id="rg">${list.map((p, i) => `<div class="rc" data-i="${i}"><a href="#/product/${p.slug}" draggable="false" aria-label="${esc(p.name)}, ${inr(p.price)}"><div class="ph" style="background-image:url(${img(p.gallery[0].img)});background-position:${p.gallery[0].pos}"></div><div class="t"><b>${esc(p.name)}</b><span>${inr(p.price)}</span></div></a></div>`).join('')}</div>
      <div class="ring-ui"><button class="btn btn-line btn-sm" id="rprev" aria-label="Previous saree">${ic('chevL', 18)}</button><button class="btn btn-line btn-sm" id="rnext" aria-label="Next saree">${ic('chevR', 18)}</button></div></div>`;
    const wrap = $('#rw', box), rg = $('#rg', box), cards = $$('.rc', box); let vel = 0, drag = null, moved = 0, snap = null, hover = false, raf = 0, alive = true;
    const layout = () => { rg.style.transform = `translateZ(${-R}px) rotateY(${rot}deg)`; cards.forEach((c, i) => { const a = i * step; const eff = ((((a + rot) % 360) + 540) % 360) - 180; const cs = Math.cos(eff * Math.PI / 180); c.style.transform = `rotateY(${-a}deg) translateZ(${R}px)`; c.style.opacity = (0.1 + 0.9 * Math.pow(Math.max(0, cs), 1.4)).toFixed(3); c.style.filter = cs < 0.35 ? `brightness(${(0.35 + cs * 0.65).toFixed(2)})` : ''; c.style.pointerEvents = cs > 0.55 ? 'auto' : 'none'; c.style.zIndex = Math.round(cs * 100) + 100; }); };
    const nearest = () => Math.round(-rot / step) * step * -1;
    const tick = () => { if (!alive) return; if (!drag) { if (snap != null) { rot += (snap - rot) * 0.12; if (Math.abs(snap - rot) < .05) { rot = snap; snap = null; } } else if (Math.abs(vel) > .02) { rot += vel; vel *= .94; if (Math.abs(vel) <= .3) snap = nearest(); } else if (!hover && !reduce()) rot -= 0.06; } layout(); raf = requestAnimationFrame(tick); };
    const go = (d) => { snap = -(Math.round(-rot / step) + d) * step; vel = 0; };
    wrap.addEventListener('pointerdown', (e) => { drag = { x: e.clientX }; moved = 0; vel = 0; snap = null; wrap.classList.add('drag'); wrap.setPointerCapture(e.pointerId); });
    wrap.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; moved += Math.abs(dx); rot += dx * .32; vel = dx * .32; });
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

  function drawResults() {
    stopRing?.(); stopRing = null;
    let list = all().filter((p) => test(p));
    if (F.sort === 'new') list.sort((a, b) => b.date - a.date); else if (F.sort === 'asc') list.sort((a, b) => a.price - b.price); else if (F.sort === 'desc') list.sort((a, b) => b.price - a.price);
    $('#count', root).textContent = `${list.length} saree${list.length === 1 ? '' : 's'}`;
    const useRing = mode === 'ring' && list.length >= 4; $('#vgrid', root).setAttribute('aria-pressed', !useRing); $('#vring', root).setAttribute('aria-pressed', useRing); $('#vring', root).title = list.length < 4 ? 'Needs 4 or more sarees' : '';
    const chips = [...F.fabric.map((v) => ['fabric', v, v]), ...F.colour.map((v) => ['colour', v, v]), ...F.occasion.map((v) => ['occasion', v, v])];
    if (F.collection) chips.push(['collection', F.collection, COLLECTIONS.find((c) => c[0] === F.collection)?.[1] || F.collection]); if (F.min || F.max) chips.push(['price', '', `₹ ${F.min || 0} – ${F.max || '∞'}`]); if (F.stock) chips.push(['stock', '', 'In stock']); if (F.q) chips.push(['q', '', `“${F.q}”`]);
    $('#applied', root).innerHTML = chips.map(([k, v, l]) => `<span class="chip on">${esc(l)}<button data-rm="${k}" data-v="${esc(v)}" aria-label="Remove filter ${esc(l)}">${ic('x', 14)}</button></span>`).join('');
    $$('[data-rm]', root).forEach((b) => (b.onclick = () => { const k = b.dataset.rm, v = b.dataset.v; if (['fabric', 'colour', 'occasion'].includes(k)) F[k] = F[k].filter((x) => x !== v); else if (k === 'collection') F.collection = ''; else if (k === 'price') { F.min = ''; F.max = ''; } else if (k === 'stock') F.stock = false; else if (k === 'q') F.q = ''; update(); }));
    const g = $('#results', root); g.innerHTML = '';
    if (!list.length) { g.className = ''; g.innerHTML = `<div class="empty"><h3>No sarees match these filters</h3><p class="muted">Try removing a filter or widening the price range.</p><p style="margin-top:16px"><button class="btn btn-gold" id="eclr">Clear all filters</button></p></div>`; $('#eclr', root).onclick = () => $('#fclear', root).click(); return; }
    if (useRing) { g.className = ''; stopRing = ring(g, list); return; }
    g.className = 'pgrid'; list.forEach((p) => g.appendChild(card(p)));
  }
  function update() { sync(); drawFilters(); drawResults(); }
  $('#sort', root).onchange = (e) => { F.sort = e.target.value; sync(); drawResults(); };
  const setMode = (m) => { mode = m; try { localStorage.setItem('tpv-view', m); } catch {} drawResults(); };
  $('#vgrid', root).onclick = () => setMode('grid'); $('#vring', root).onclick = () => setMode('ring');
  const fl = $('#filters', root); $('#fopen', root).onclick = () => openLayer(fl); $$('.fclose', root).forEach((b) => (b.onclick = closeAll));
  const fixDone = () => { const m = matchMedia('(max-width:900px)').matches; $$('.fdone', root).forEach((b) => (b.style.display = m ? '' : 'none')); $$('.fhead .fclose', root).forEach((b) => (b.style.display = m ? '' : 'none')); };
  fixDone(); addEventListener('resize', fixDone);
  const onData = () => update(); addEventListener('tpv:data', onData);
  drawFilters(); drawResults();
  return () => { stopRing?.(); removeEventListener('resize', fixDone); removeEventListener('tpv:data', onData); };
}

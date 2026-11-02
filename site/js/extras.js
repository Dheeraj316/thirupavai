// Extras layer: floating dock (stylist / ambient sound / command palette), "Find my saree" quiz, Ctrl+K command palette,
// compare tray + side-by-side modal, synthesized ambient sound, and the gold scroll thread.
import { products, cart } from './store.js';
import { COLOURS, inr } from './data.js';
import { $, $$, h, ic, esc, img, modal, closeAll, toast } from './ui.js';
import { cmp, MAX } from './compare.js';
import { burst } from './fx.js';

const bgOf = (p, i = 0) => { const g = p.gallery[i] || p.gallery[0]; return `background-image:url(${img(g.img)});background-position:${g.pos};${g.zoom !== 'cover' ? `background-size:${g.zoom}` : ''}`; };
let API = { go: (hash) => { location.hash = hash; }, openBag: () => {} };

/* ------------------------------------------------------------------ Find my saree */
const OCC = [['Bridal', 'Heirloom weaves for the wedding day'], ['Festive', 'Zari and colour for celebrations'], ['Everyday', 'Light, graceful, easy to wear'], ['Any', 'Show me the best of everything']];
const BUD = [['u25', 'Under ₹ 25,000', 0, 25000], ['mid', '₹ 25,000 – ₹ 45,000', 25000, 45000], ['hi', 'Above ₹ 45,000', 45000, 1e9], ['any', 'No limit', 0, 1e9]];

export function openStylist() {
  const A = { occ: null, cols: [], bud: null }; let step = 0;
  const m = modal(`<div class="qz"><div class="qz-dots" id="qzd" aria-hidden="true"></div><div id="qzb" aria-live="polite"></div></div>`); m.querySelector('.box').classList.add('qzbox');
  const body = $('#qzb', m), dots = $('#qzd', m);

  const results = () => {
    const band = BUD.find((b) => b[0] === A.bud) || BUD[3];
    const scored = products().map((p) => {
      let s = 0; const why = [];
      if (A.occ && A.occ !== 'Any' && p.occasion.includes(A.occ)) { s += 4; why.push(A.occ); }
      if (A.cols.length && A.cols.includes(p.colour)) { s += 4; why.push(p.colour); }
      if (A.bud && A.bud !== 'any' && p.price >= band[2] && p.price <= band[3]) { s += 3; why.push('In your budget'); }
      if (p.stock > 0) s += 1; else why.push('Sold out');
      return { p, s, why };
    }).sort((a, b) => b.s - a.s || a.p.price - b.p.price);
    const inStock = scored.filter((x) => x.p.stock > 0); const top = (inStock.length >= 3 ? inStock : scored).slice(0, 3);
    const maxS = (A.occ && A.occ !== 'Any' ? 4 : 0) + (A.cols.length ? 4 : 0) + (A.bud && A.bud !== 'any' ? 3 : 0) + 1;
    const q = new URLSearchParams(); if (A.occ && A.occ !== 'Any') q.append('occasion', A.occ); A.cols.forEach((c) => q.append('colour', c));
    if (A.bud === 'u25') q.set('max', 25000); else if (A.bud === 'mid') { q.set('min', 25000); q.set('max', 45000); } else if (A.bud === 'hi') q.set('min', 45000);
    return { top, maxS, link: '#/shop' + (q.toString() ? '?' + q : '') };
  };

  const draw = () => {
    dots.innerHTML = [0, 1, 2, 3].map((i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('');
    const back = step > 0 ? `<button class="qback" id="qb" type="button">${ic('chevL', 16)} Back</button>` : '';
    if (step === 0) {
      body.innerHTML = `<div class="qstep"><div class="eyebrow">Step 1 of 3 · Your personal stylist</div><h2>What is the occasion?</h2><p class="sub">Tell me a little and I’ll pick the sarees that suit you best.</p>
        <div class="qopts">${OCC.map(([v, d]) => `<button type="button" class="qopt" data-v="${v}" aria-pressed="${A.occ === v}"><b>${v === 'Any' ? 'Not sure yet' : v}</b><span>${d}</span></button>`).join('')}</div></div>`;
      $$('.qopt', body).forEach((b) => (b.onclick = () => { A.occ = b.dataset.v; step = 1; draw(); }));
    } else if (step === 1) {
      body.innerHTML = `<div class="qstep">${back}<div class="eyebrow">Step 2 of 3</div><h2>Which colours speak to you?</h2><p class="sub">Choose up to two — or let me surprise you.</p>
        <div class="qsw">${COLOURS.map(([n, c]) => `<button type="button" data-v="${n}" aria-pressed="${A.cols.includes(n)}"><i style="background:${c}"></i><span>${n}</span></button>`).join('')}</div>
        <div class="qfoot"><button type="button" class="btn btn-line btn-sm" id="qany">Surprise me</button><button type="button" class="btn btn-gold btn-sm" id="qn">Continue</button></div></div>`;
      $$('.qsw button', body).forEach((b) => (b.onclick = () => { const v = b.dataset.v; A.cols = A.cols.includes(v) ? A.cols.filter((x) => x !== v) : [...A.cols, v].slice(-2); $$('.qsw button', body).forEach((x) => x.setAttribute('aria-pressed', A.cols.includes(x.dataset.v))); }));
      $('#qany', body).onclick = () => { A.cols = []; step = 2; draw(); }; $('#qn', body).onclick = () => { step = 2; draw(); };
    } else if (step === 2) {
      body.innerHTML = `<div class="qstep">${back}<div class="eyebrow">Step 3 of 3</div><h2>What feels comfortable?</h2><p class="sub">Your budget stays between us — it only shapes the shortlist.</p>
        <div class="qopts">${BUD.map(([v, l]) => `<button type="button" class="qopt" data-v="${v}" aria-pressed="${A.bud === v}"><b>${l}</b></button>`).join('')}</div></div>`;
      $$('.qopt', body).forEach((b) => (b.onclick = () => { A.bud = b.dataset.v; step = 3; draw(); }));
    } else {
      const R = results(); const none = R.maxS === 1;
      body.innerHTML = `<div class="qstep">${back}<div class="eyebrow">Your shortlist</div><h2>Three sarees, chosen for you</h2><p class="sub">${none ? 'No preferences set — here are our current favourites.' : 'Ranked by how well each piece matches what you told me.'}</p>
        <div class="qres">${R.top.map(({ p, s, why }, i) => `<a class="qr" href="#/product/${p.slug}" style="--i:${i}"><div class="ph" style="${bgOf(p)}"></div><div class="in"><span class="mt">${none ? 'Curated pick' : Math.min(99, Math.round(s / R.maxS * 100)) + '% match'}</span><b>${esc(p.name)}</b><span class="pr">${inr(p.price)} · ${esc(p.fabric)}</span><div class="why">${why.map((w) => `<small>${esc(w)}</small>`).join('')}</div></div>${ic('chevR', 22)}</a>`).join('')}</div>
        <div class="qfoot"><button type="button" class="btn btn-line btn-sm" id="qagain">Start again</button><a class="btn btn-gold btn-sm" href="${R.link}">See all matches in the shop</a></div></div>`;
      $('#qagain', body).onclick = () => { A.occ = null; A.cols = []; A.bud = null; step = 0; draw(); };
      $$('a', body).forEach((a) => a.addEventListener('click', () => setTimeout(closeAll, 0)));
      burst(innerWidth / 2, innerHeight * .28); window.__stage?.kick(.9);
    }
    $('#qb', body)?.addEventListener('click', () => { step = Math.max(0, step - 1); draw(); });
    if (step < 3) setTimeout(() => body.querySelector('.qopt,.qsw button')?.focus({ preventScroll: true }), 140);   // after the modal's own focus pass
  };
  draw();
}

/* ------------------------------------------------------------------ compare */
export function openCompare() {
  const items = cmp.ids().map((id) => products().find((p) => p.id === id)).filter(Boolean);
  if (items.length < 2) { toast('Pick at least two sarees — use the compare icon on any card.'); return; }
  const low = Math.min(...items.map((p) => p.price)); const n = items.length;
  const rows = [['Fabric', (p) => p.fabric], ['Weave', (p) => p.weave], ['Colour', (p) => p.colour], ['Occasion', (p) => p.occasion.join(', ')], ['Length', (p) => p.length], ['Blouse piece', (p) => p.blouse], ['Care', (p) => p.care], ['Returns', (p) => p.returns], ['Availability', (p) => (p.stock < 1 ? 'Sold out' : p.stock === 1 ? 'One-of-one piece' : p.stock <= 3 ? `Only ${p.stock} left` : 'In stock')]];
  const m = modal(`<div class="cmpm"><div class="eyebrow">Side by side</div><h2 class="serif">Compare sarees</h2>
    <div class="cmp-scroll"><div class="cmp-grid" style="--n:${n}">
      <div class="cl"></div>${items.map((p) => `<div class="ch"><div class="ph" style="${bgOf(p)}"></div><a href="#/product/${p.slug}" class="serif">${esc(p.name)}</a><div class="pr">${inr(p.price)}${p.price === low && n > 1 && items.some((q) => q.price !== low) ? '<small class="pill ok">Lowest price</small>' : ''}</div></div>`).join('')}
      ${rows.map(([l, f]) => `<div class="cl">${l}</div>${items.map((p) => `<div class="cv">${esc(f(p))}</div>`).join('')}`).join('')}
      <div class="cl"></div>${items.map((p) => `<div class="ca"><button class="btn btn-gold btn-sm" data-add="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>Add to bag</button><button class="btn btn-line btn-sm" data-rm="${p.id}">Remove</button></div>`).join('')}
    </div></div></div>`);
  m.querySelector('.box').classList.add('cmpbox');
  $$('[data-add]', m).forEach((b) => (b.onclick = () => { const r = cart.add(b.dataset.add, 1, { addons: [] }); toast(r.ok ? 'Added to bag' : r.msg); if (r.ok) { closeAll(); setTimeout(() => API.openBag(), 120); } }));
  $$('[data-rm]', m).forEach((b) => (b.onclick = () => { cmp.remove(b.dataset.rm); closeAll(); if (cmp.ids().length >= 2) setTimeout(openCompare, 60); }));
}
let tray;
function buildTray() {
  tray = h(`<div class="cmptray" role="region" aria-label="Compare sarees"><div class="ct">Compare <b id="ctn">0</b>/${MAX}</div><div class="cthumbs" id="cts"></div><button class="btn btn-gold btn-sm" id="ctgo" type="button">Compare</button><button class="ct-clr" id="ctclr" type="button" aria-label="Clear compare list">Clear</button></div>`);
  document.body.appendChild(tray);
  $('#ctgo', tray).onclick = openCompare; $('#ctclr', tray).onclick = () => cmp.clear();
  const draw = () => {
    const ids = cmp.ids(); tray.classList.toggle('on', ids.length > 0); $('#ctn', tray).textContent = ids.length; $('#ctgo', tray).disabled = ids.length < 2;
    $('#cts', tray).innerHTML = ids.map((id) => products().find((p) => p.id === id)).filter(Boolean).map((p) => `<button class="cth" data-id="${p.id}" aria-label="Remove ${esc(p.name)} from compare" title="Remove ${esc(p.name)}" style="${bgOf(p)}"><i>${ic('x', 12, 2.4)}</i></button>`).join('');
    $$('.cth', tray).forEach((b) => (b.onclick = () => cmp.remove(b.dataset.id)));
    $$('.pcard .cmp').forEach((b) => b.setAttribute('aria-pressed', cmp.has(b.dataset.id)));
  };
  cmp.subscribe(draw); draw();
  new MutationObserver(() => $$('.pcard .cmp').forEach((b) => b.setAttribute('aria-pressed', cmp.has(b.dataset.id)))).observe(document.getElementById('main'), { childList: true, subtree: true });
}

/* ------------------------------------------------------------------ command palette (Ctrl/⌘ + K) */
const PAGES = [['Home', '#/'], ['Shop all sarees', '#/shop'], ['Bridal edit', '#/shop?occasion=Bridal'], ['Festive edit', '#/shop?occasion=Festive'], ['New arrivals', '#/shop?sort=new'], ['Our story', '#/story'], ['Wishlist', '#/wishlist'], ['Account & track an order', '#/account'], ['Shipping & delivery', '#/page/shipping'], ['Returns & exchanges', '#/page/returns'], ['FAQs', '#/page/faqs'], ['Contact us', '#/page/contact'], ...(window.TP_CONFIG?.api ? [] : [['Admin console (demo)', '#/admin']])];
const ACTIONS = () => [
  ['Find my saree', 'Answer three quick questions', () => openStylist()],
  ['Open bag', `${cart.count()} item${cart.count() === 1 ? '' : 's'}`, () => API.openBag()],
  ['Compare sarees', `${cmp.ids().length} selected`, () => openCompare()],
  [`Ambient sound: turn ${soundOn ? 'off' : 'on'}`, 'Tanpura drone & temple bells', () => toggleSound()],
  ['Shop view: 3D ring', 'Drag-to-rotate carousel', () => { try { localStorage.setItem('tpv-view', 'ring'); } catch {} API.go('#/shop'); }],
  ['Shop view: grid', 'Classic product grid', () => { try { localStorage.setItem('tpv-view', 'grid'); } catch {} API.go('#/shop'); }],
];
export function openPalette() {
  const m = modal(`<div class="cmdk"><div class="ck-in">${ic('search', 20)}<input id="ckq" placeholder="Type a command, a page or a saree…" autocomplete="off" aria-label="Command palette"><kbd>Esc</kbd></div><div class="ck-list" id="ckl" role="listbox"></div></div>`); m.querySelector('.box').classList.add('ckbox');
  const input = $('#ckq', m), list = $('#ckl', m); let items = [], sel = 0;
  const hit = (q, hay) => { const t = q.toLowerCase().split(/\s+/).filter(Boolean); const s = hay.toLowerCase(); return t.every((x) => s.includes(x)); };
  const build = () => {
    const q = input.value.trim(); items = [];
    ACTIONS().filter(([t, d]) => !q || hit(q, t + ' ' + d)).slice(0, q ? 4 : 4).forEach(([t, d, run]) => items.push({ k: 'Action', t, d, run }));
    PAGES.filter(([t]) => !q || hit(q, t)).slice(0, q ? 5 : 5).forEach(([t, href]) => items.push({ k: 'Go to', t, d: '', run: () => API.go(href) }));
    products().filter((p) => !q || hit(q, [p.name, p.fabric, p.colour, p.weave, p.sku, ...p.occasion].join(' '))).slice(0, q ? 6 : 3).forEach((p) => items.push({ k: q ? 'Saree' : 'Trending', t: p.name, d: `${p.fabric} · ${inr(p.price)}`, th: bgOf(p), run: () => API.go('#/product/' + p.slug) }));
    sel = Math.min(sel, Math.max(0, items.length - 1));
    list.innerHTML = items.length ? items.map((it, i) => `<button type="button" class="ck-it" role="option" data-i="${i}" aria-selected="${i === sel}">${it.th ? `<span class="th" style="${it.th}"></span>` : `<span class="kk">${esc(it.k)}</span>`}<span class="tt"><b>${esc(it.t)}</b>${it.d ? `<small>${esc(it.d)}</small>` : ''}</span>${it.th ? `<span class="kk">${esc(it.k)}</span>` : ''}</button>`).join('') : `<div class="empty" style="padding:30px 10px"><h3>Nothing matches “${esc(q)}”</h3><p class="muted">Try a fabric, colour or occasion.</p></div>`;
    $$('.ck-it', list).forEach((b) => { b.onmouseenter = () => { sel = Number(b.dataset.i); mark(); }; b.onclick = () => run(Number(b.dataset.i)); });
  };
  const mark = () => $$('.ck-it', list).forEach((b, i) => { b.setAttribute('aria-selected', i === sel); if (i === sel) b.scrollIntoView({ block: 'nearest' }); });
  const run = (i) => { const it = items[i]; if (!it) return; closeAll(); setTimeout(() => it.run(), 60); };
  input.oninput = () => { sel = 0; build(); };
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, items.length); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % Math.max(1, items.length); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
  };
  build(); setTimeout(() => input.focus(), 140);
}

/* ------------------------------------------------------------------ ambient sound (synthesized — no audio files) */
let ac = null, master = null, soundOn = false, voices = [], bellT = 0;
function bell() {
  if (!soundOn) return; const t = ac.currentTime; const notes = [554.37, 622.25, 739.99, 830.61, 932.33]; const f = notes[Math.floor(Math.random() * notes.length)];
  [[1, .11], [2.76, .04], [5.4, .015]].forEach(([r, g]) => { const o = ac.createOscillator(), e = ac.createGain(); o.type = 'sine'; o.frequency.value = f * r; e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + .012); e.gain.exponentialRampToValueAtTime(.0001, t + 3.8); o.connect(e); e.connect(master); o.start(t); o.stop(t + 4); });
  bellT = setTimeout(bell, 4200 + Math.random() * 4800);
}
function soundStart() {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume();
  master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 820; lp.Q.value = .5; lp.connect(master);
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .07; lg.gain.value = 340; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); voices = [lfo];
  [[69.3, .5], [138.6, .55], [207.7, .32], [277.2, .2], [139.4, .34]].forEach(([f, g], i) => { const o = ac.createOscillator(), og = ac.createGain(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 2) * 4; og.gain.value = g * .17; o.connect(og); og.connect(lp); o.start(); voices.push(o); });
  master.gain.setTargetAtTime(.55, ac.currentTime, 1.3); soundOn = true; bellT = setTimeout(bell, 1800);
}
function soundStop() {
  soundOn = false; clearTimeout(bellT); if (!ac) return; const g = master, vs = voices; g.gain.setTargetAtTime(0, ac.currentTime, .35);
  setTimeout(() => { vs.forEach((o) => { try { o.stop(); } catch {} }); try { g.disconnect(); } catch {} }, 1600); voices = [];
}
export function toggleSound() {
  const b = $('#dkSound'); try { if (soundOn) soundStop(); else soundStart(); } catch { toast('Sound is not available on this device.'); return; }
  if (b) { b.setAttribute('aria-pressed', soundOn); b.setAttribute('aria-label', soundOn ? 'Turn ambient sound off' : 'Turn ambient sound on'); }
  toast(soundOn ? 'Ambient sound on — tanpura & temple bells' : 'Ambient sound off', 2200);
}

/* ------------------------------------------------------------------ dock + gold thread + keys */
function buildDock() {
  const dock = h(`<div class="dock" id="dock"><button class="dk-pill" id="dkStylist" type="button" aria-label="Find my saree — style quiz">${ic('sparkle', 18)}<span class="t">Find my saree</span></button>
    <button class="dk-ib" id="dkSound" type="button" aria-pressed="false" aria-label="Turn ambient sound on" title="Ambient sound"><span class="eq"><i></i><i></i><i></i><i></i></span></button>
    <button class="dk-ib dk-k" id="dkCmd" type="button" aria-label="Open command palette (Ctrl K)" title="Command palette (Ctrl K)">⌘K</button></div>`);
  document.body.appendChild(dock);
  $('#dkStylist', dock).onclick = openStylist; $('#dkSound', dock).onclick = toggleSound; $('#dkCmd', dock).onclick = openPalette;
}
/* The gold scroll thread and the glowing cursor trail were decoration with no job; they are gone. Only the silk kick on fast scrolling stays. */
function buildTrail() {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  let sy = scrollY, st = 0; addEventListener('scroll', () => { const t = performance.now(); if (t - st < 90) return; const d = Math.abs(scrollY - sy); sy = scrollY; st = t; if (d > 140) window.__stage?.kick(Math.min(.35, d / 1800)); }, { passive: true });
}
export function initExtras(api) {
  API = { ...API, ...api }; buildDock(); buildTray(); buildTrail();
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  });
  document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend(); else if (soundOn) ac.resume(); });
  window.__stylist = openStylist; window.__palette = openPalette; window.__compare = openCompare;
}

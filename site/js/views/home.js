import { products, createTicket } from '../store.js';
import { ONLINE, T } from '../api.js';
import { COLLECTIONS, FABRICS } from '../data.js';
import { h, $, $$, ic, img, card, esc, money } from '../ui.js';
import { glReady, motionReduced, set3D } from '../gate.js';
const webglOK = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };   // three.js (cloth.js) is imported only when the tunnel mounts

const GAL = [['blue', 'royal-blue-zari-silk'], ['green', 'emerald-peacock-border'], ['border', 'maroon-banarasi-katan-silk'], ['magenta', 'magenta-heritage-silk'], ['pallu', 'wine-katan-gold-border'], ['weave', 'garnet-plain-silk']];
const FAB = [['Kanchipuram silk', 'orange', '50% 22%', 'Temple borders, woven in Kanchi'], ['Banarasi silk', 'brocade', '50% 25%', 'Brocade, katan and gold zari'], ['Mysore silk', 'green', '50% 50%', 'Crepe silk with a quiet fall'], ['Organza', 'magenta', '30% 30%', 'Featherlight, edged in gold']];
const WORDS = 'Every saree can carry an authenticity passport: fibre, weave, weaver and Silk Mark / GI details — shown only where they are certified and supplied by the business.';
const rm = motionReduced;

export default async function home(root) {
  const all = products(); const bySlug = Object.fromEntries(all.map((p) => [p.slug, p])); const news = all.slice().sort((a, b) => b.date - a.date).slice(0, 6);
  const mq = (rev) => { const inner = ['Tradition', '✦', 'Woven into', '✦', 'Tomorrow', '✦', 'Every drape tells a story', '✦'].map((t, i) => (t === '✦' ? '<i class="zg"></i>' : `<span${i % 4 === 2 ? ' class="f"' : ''}>${t}</span>`)).join(''); return `<div class="row ${rev ? 'rev' : ''}">${inner}${inner}</div>`; };
  const tunnelOK = webglOK() && !rm();
  root.innerHTML = `
  <section class="hero2" aria-label="Introduction">
    <div class="hero-copy">
      <p class="tagline reveal">Tradition, woven into tomorrow.</p>
      <p class="lead reveal">Silks, zari borders and heritage weaves — chosen with care, delivered with a story.</p>
      <div class="cta reveal"><a class="btn btn-gold" href="#/shop">Shop the autumn bridal edit</a><a class="link-arrow" href="#/story">How it is woven</a></div>
      <ul class="assure reveal"><li>Authenticity passport</li><li>Secure payments</li><li>Tracked delivery</li></ul>
    </div>
    <div class="arch-wrap"><div class="arch warp" role="img" aria-label="Model in a maroon silk saree with a gold zari border"><div class="ph" id="archph"></div></div></div>
    <h1 class="mono" data-split>Thirupavai</h1>
  </section>

  <div class="mq" id="mq" aria-hidden="true">${mq(false)}${mq(true)}</div>

  ${tunnelOK ? `<section class="tunnel" id="tun" aria-label="Silk gallery — scroll to fly through"><div class="stick"><div class="tt"><h2>Woven in light</h2></div><canvas id="tunc" aria-hidden="true"></canvas>
      <div class="tcap" id="tcap"></div><div class="tbar" id="tbar" aria-hidden="true">${GAL.map(() => '<i></i>').join('')}</div><div class="tip">Scroll to fly through. ${matchMedia('(hover:none)').matches ? 'Tap' : 'Click'} a cloth to open it.</div></div></section>`
    : `<section class="sec" aria-label="Silk gallery"><div class="wrap"><div class="sec-head"><div><h2>Woven in Light</h2></div>${webglOK() ? '<button class="btn btn-line btn-sm" id="on3d" type="button" title="Your device asks apps to reduce motion. Tap to play the 3D gallery anyway.">Turn on 3D effects</button>' : ''}</div></div><div class="tunnel-fb">${GAL.map(([i, s]) => `<a href="#/product/${s}" style="background-image:url(${img(i)})" aria-label="${esc(bySlug[s]?.name || 'Saree')}"></a>`).join('')}</div></section>`}

  <section class="hs" id="hs" aria-label="The houses of silk"><div class="stick"><div class="head"><h2>The houses of silk</h2></div>
    <div class="track" id="hstrack">${FAB.map(([f, i, p, d], k) => `<a class="slab" href="#/shop?fabric=${encodeURIComponent(f)}"><div class="ph" style="background-image:url(${img(i)});background-position:${p}"></div><div class="t"><b>${f}</b><small>${esc(d)}</small></div></a>`).join('')}<a class="slab" href="#/shop" style="display:grid;place-items:center;text-align:center"><div style="position:relative;z-index:2"><b class="serif" style="font-size:clamp(34px,4vw,60px);color:var(--ivory);display:block;margin:0 0 22px">All sarees</b><span class="btn btn-gold">Enter the shop</span></div></a></div></div></section>

  <section class="sec"><div class="wrap"><div class="sec-head reveal"><div><h2>Just woven</h2></div><a class="link-arrow" href="#/shop?sort=new">See what’s new</a></div><div class="pgrid" id="newgrid"></div></div></section>

  <section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-head reveal"><div><h2>Five ways to wear tradition</h2></div></div>
    <div class="edits reveal">${COLLECTIONS.map(([k, n, i, p], idx) => `<a class="edit" href="#/shop?collection=${k}" aria-label="${n}"><div class="ph" style="background-image:url(${img(i)});background-position:${p}"></div><div class="t"><b>${n}</b></div></a>`).join('')}</div>
    <p class="muted" style="margin-top:22px;font-size:14.5px">Edits are labels over live inventory — they change as stock changes.</p></div></section>

  <section class="craft2" id="craft"><div class="frame reveal warp" role="img" aria-label="Close-up of gold zari border on maroon silk"><div class="ph" id="craftph"></div></div>
    <div><h2 data-split style="margin:14px 0 22px">Woven by hand, verified by you.</h2>
      <p class="words" id="words" style="font:300 clamp(18px,1.7vw,23px)/1.7 var(--sans);color:var(--champ);max-width:560px">${WORDS.split(' ').map((w) => `<span>${esc(w)}</span>`).join(' ')}</p>
      <p style="margin-top:28px" class="reveal"><a class="btn btn-gold" href="#/story">Follow the weave</a></p></div></section>

  <section class="sec news"><div class="wrap"><h2 class="reveal" style="margin:10px 0 12px">New weaves, first.</h2><p class="muted reveal" style="max-width:520px;margin-bottom:22px">A short note when new pieces arrive. No spam — and you can leave at any time.${T(' (Demo: nothing is stored or sent.)', '')}</p>
    <form id="nl" class="reveal" novalidate><input type="email" aria-label="Email address" placeholder="you@example.com" autocomplete="email"><button class="btn btn-gold" type="submit">Subscribe</button></form><div id="nlmsg" class="muted" style="margin-top:10px" role="status"></div></div></section>`;

  const grid = $('#newgrid', root); news.forEach((p) => grid.appendChild(card(p)));
  $('#nl', root).addEventListener('submit', async (e) => {
    e.preventDefault(); const v = $('input', e.target).value.trim(); const m = $('#nlmsg', root);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { m.textContent = 'Please enter a valid email address.'; m.style.color = 'var(--err)'; return; }
    if (ONLINE) { try { await createTicket({ channel: 'Newsletter', subject: 'Newsletter signup', message: 'Please add me to the new-arrivals list.', contact: v }); } catch (er) { m.textContent = er.message; m.style.color = 'var(--err)'; return; } }
    m.style.color = 'var(--ok)'; m.textContent = T('Thank you — this is a demo, so nothing was stored.', 'Thank you — you are on the list.'); e.target.reset();
  });

  // ---- 3D tunnel
  let stop = null, dead = false;
  $('#on3d', root)?.addEventListener('click', () => { set3D(true); location.reload(); });
  if (tunnelOK) {
    const cap = $('#tcap', root), bars = $$('#tbar i', root); const draw = (i) => { const p = bySlug[GAL[i][1]]; if (!p) return; cap.style.opacity = 0; setTimeout(() => { cap.innerHTML = `<h3>${esc(p.name)}</h3><div class="pr">${money(p.price)}</div><a class="btn btn-line btn-sm" href="#/product/${p.slug}">View saree</a>`; cap.style.transition = 'opacity .5s'; cap.style.opacity = 1; }, 120); bars.forEach((b, k) => b.classList.toggle('on', k === i)); };
    const mountTunnel = () => import('../cloth.js').then(({ silkTunnel }) => silkTunnel($('#tunc', root), GAL.map(([i, s]) => ({ url: img(i), slug: s })), { onPick: (s) => { location.hash = '#/product/' + s; }, onIndex: draw, section: $('#tun', root) })).then((s) => { if (dead) s(); else stop = s; }).catch((e) => { console.warn('tunnel failed', e); $('#tun', root)?.remove(); });
    // three.js (~2 MB) is fetched on first interaction or once the page has settled — never on the first paint.
    glReady().then(() => { if (!dead) mountTunnel(); });
  }

  // ---- scroll-driven effects (one rAF loop)
  const hs = $('#hs', root), track = $('#hstrack', root), mqEl = $('#mq', root), archph = $('#archph', root), craftph = $('#craftph', root), craft = $('#craft', root), wordsEl = $('#words', root), words = $$('#words span', root);
  let native = false, lastY = scrollY, vel = 0, ticking = false; const mouse = { x: 0, y: 0 };
  const setup = () => { native = innerWidth < 900 || rm(); hs.classList.toggle('native', native); if (!native) { const dist = Math.max(0, track.scrollWidth - innerWidth + 40); hs.style.height = `${innerHeight + dist}px`; hs.dataset.dist = dist; } else { hs.style.height = ''; track.style.transform = ''; } };
  const tick = () => {
    ticking = false; if (dead) return;   // a frame queued just before leaving the page must not touch the next page's DOM
    const y = scrollY; vel += ((y - lastY) - vel) * .2; lastY = y; const vh = innerHeight;
    if (!native) { const b = hs.getBoundingClientRect(); const dist = Number(hs.dataset.dist || 0); const p = Math.min(1, Math.max(0, -b.top / Math.max(1, hs.offsetHeight - vh))); track.style.transform = `translate3d(${-p * dist}px,0,0)`; }
    if (!rm()) { archph.style.transform = `translate3d(${mouse.x * -14}px,${y * .06 + mouse.y * -10}px,0) scale(1.04)`; mqEl.style.transform = `skewX(${Math.max(-8, Math.min(8, vel * -.35))}deg)`; const cb = craft.getBoundingClientRect(); craftph.style.transform = `translate3d(0,${(cb.top + cb.height / 2 - vh / 2) * -.12}px,0) scale(1.06)`; }
    const wb = wordsEl.getBoundingClientRect(); const wp = Math.min(1, Math.max(0, (vh * .92 - wb.top) / (vh * .55 + wb.height))); const on = Math.floor(wp * words.length * 1.15); words.forEach((w, i) => w.classList.toggle('on', i < on));
    if (Math.abs(vel) > .2) { vel *= .9; requestAnimationFrame(tick); ticking = true; }
  };
  const onS = () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } };
  const onM = (e) => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; onS(); };
  setup(); tick(); addEventListener('scroll', onS, { passive: true }); addEventListener('resize', setup); addEventListener('pointermove', onM, { passive: true });
  return () => { dead = true; stop?.(); removeEventListener('scroll', onS); removeEventListener('resize', setup); removeEventListener('pointermove', onM); };
}

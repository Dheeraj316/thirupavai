import { products, createTicket } from '../store.js';
import { ONLINE, T } from '../api.js';
import { COLOURS } from '../data.js';
import { h, $, $$, ic, img, card, esc, money } from '../ui.js';
import { glReady, motionReduced, set3D } from '../gate.js';
const webglOK = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };   // three.js (cloth.js) is imported only when the tunnel mounts

// Every picture on this page is one of the catalogue's own photographs (assets/s/pNN-k) or the hero, so the page reads as a single shoot.
const GAL = [['s/p4-3', 'royal-blue-zari-silk'], ['s/p5-3', 'emerald-peacock-border'], ['s/p1-3', 'maroon-banarasi-katan-silk'], ['s/p6-3', 'magenta-heritage-silk'], ['s/p9-3', 'wine-katan-gold-border'], ['s/p8-3', 'garnet-plain-silk']];
const WEAVES = [['Kanchipuram silk', 's/p3-2', 'Temple borders and heavy zari, woven in Kanchipuram'], ['Banarasi silk', 's/p1-2', 'Brocade, katan and kadhwa from Varanasi'], ['Mysore silk', 's/p5-2', 'Crepe silk with a soft, quiet fall'], ['Organza', 's/p10-2', 'Sheer and crisp, edged in gold or silver'],
  ['Chanderi cotton', 's/p23-2', 'Sheer handloom cotton, light for long days'], ['Linen', 's/p27-2', 'Textured handloom linen, cool and easy to care for'], ['Tussar silk', 's/p31-2', 'Naturally golden wild silk, often hand-painted'], ['Georgette', 's/p36-2', 'Fluid and light, for evenings and receptions']];
const OCC = [['Bridal', 's/p3-1', 'Kanchipuram and Banarasi silks for the wedding day'], ['Festive', 's/p7-1', 'Gold and jewel tones for festivals'], ['Everyday', 's/p17-1', 'Light silks and cottons for ordinary days'], ['Party', 's/p34-1', 'Georgette and organza for evenings'], ['Office', 's/p28-1', 'Linen and Chanderi that wear well all day']];
const rm = motionReduced;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export default async function home(root) {
  const all = products(); const bySlug = Object.fromEntries(all.map((p) => [p.slug, p]));
  const news = all.slice().sort((a, b) => b.date - a.date).slice(0, 8);
  const value = all.filter((p) => p.price <= 10000 && p.stock > 0).sort((a, b) => b.date - a.date).slice(0, 4);
  const from = (list) => (list.length ? Math.min(...list.map((p) => p.price)) : 0);
  const weaves = WEAVES.map(([f, i, d]) => { const l = all.filter((p) => p.fabric === f); return { f, i, d, n: l.length, min: from(l) }; }).filter((w) => w.n);
  const occ = OCC.map(([o, i, d]) => ({ o, i, d, n: all.filter((p) => p.occasion.includes(o)).length })).filter((x) => x.n);
  const have = new Set(all.map((p) => p.colour)); const cols = COLOURS.filter(([c]) => have.has(c));
  const tunnelOK = webglOK() && !rm(); const touch = matchMedia('(hover:none)').matches;

  root.innerHTML = `
  <section class="hm-hero hero2" aria-label="Introduction">
    <div class="hm-hero-in">
      <div class="hm-hero-copy">
        <p class="hm-eyebrow tagline">Tradition, woven into tomorrow.</p>
        <h1 class="hm-h1">Silk sarees for the weddings and festivals ahead</h1>
        <p class="hm-lead">Kanchipuram, Banarasi and Mysore silks for the big days, with Chanderi, linen and organza for the days in between. Every saree is photographed six ways and listed with its fabric, weave, length and care.</p>
        <div class="hm-cta"><a class="btn btn-gold" href="#/shop?collection=bridal">Shop the bridal edit</a><a class="hm-link" href="#/shop">Browse all ${all.length} sarees</a></div>
        <p class="hm-fine">Free standard delivery · 7-day returns on eligible pieces</p>
      </div>
      <figure class="hm-hero-photo warp reveal"><div class="hm-hero-frame"><div class="hm-hero-img" id="archph" role="img" aria-label="Model in a maroon silk saree with a gold zari border"></div></div><figcaption>Maroon silk with a gold zari border</figcaption></figure>
    </div>
  </section>

  <section class="hs hm-weaves" id="hs" aria-label="Shop by weave"><div class="hm-wstick">
    <div class="hm-head hm-wwrap"><div><p class="hm-eyebrow">Shop by weave</p><h2 class="hm-h2">${weaves.length} weaves, from temple silk to everyday linen</h2></div><a class="hm-link" href="#/shop">All sarees</a></div>
    <div class="hm-wscroll"><div class="hm-wtrack" id="hstrack">${weaves.map((w) => `<a class="hm-wcard" href="#/shop?fabric=${encodeURIComponent(w.f)}"><span class="hm-wph" style="background-image:url(${img(w.i)})" role="img" aria-label="${esc(w.f)}"></span><span class="hm-wt"><b>${esc(w.f)}</b><span class="hm-wmeta">${plural(w.n, 'saree')} · from ${money(w.min)}</span><span class="hm-wnote">${esc(w.d)}</span></span></a>`).join('')}<a class="hm-wcard hm-wall" href="#/shop"><span class="hm-wt"><b>Every saree</b><span class="hm-wmeta">${plural(all.length, 'saree')}</span><span class="btn btn-gold">Enter the shop</span></span></a></div></div>
  </div></section>

  <section class="hm-sec hm-arrivals" aria-label="New arrivals"><div class="hm-wrap">
    <div class="hm-head reveal"><div><p class="hm-eyebrow">New arrivals</p><h2 class="hm-h2">Just woven</h2></div><a class="hm-link" href="#/shop?sort=new">See what’s new</a></div>
    <div class="pgrid hm-grid" id="newgrid"></div></div></section>

  <section class="hm-sec hm-occasions" aria-label="Shop by occasion and colour"><div class="hm-wrap">
    <div class="hm-head reveal"><div><p class="hm-eyebrow">Shop by occasion</p><h2 class="hm-h2">Start with where you are going</h2></div></div>
    <div class="hm-tiles reveal">${occ.map((x) => `<a class="hm-tile" href="#/shop?occasion=${encodeURIComponent(x.o)}"><span class="hm-tph" style="background-image:url(${img(x.i)})" role="img" aria-label="${esc(x.o)} sarees"></span><span class="hm-tt"><b>${esc(x.o)}</b><span>${esc(x.d)}</span><span class="hm-tn">${plural(x.n, 'saree')}</span></span></a>`).join('')}</div>
    <div class="hm-colours reveal"><p class="hm-eyebrow">Or by colour</p><div class="hm-cl">${cols.map(([c, hex]) => `<a class="hm-chip" href="#/shop?colour=${encodeURIComponent(c)}"><i style="background:${hex}"></i>${esc(c)}</a>`).join('')}</div></div>
  </div></section>

  ${tunnelOK ? `<section class="tunnel hm-tunnel" id="tun" aria-label="Silk gallery"><div class="stick"><div class="tt"><p class="hm-eyebrow">Six pieces, up close</p><h2 class="hm-h2">Walk through the collection</h2><p>Scroll to move past each cloth. ${touch ? 'Tap' : 'Click'} one to open it.</p></div><canvas id="tunc" aria-hidden="true"></canvas>
      <div class="tcap" id="tcap"></div><div class="tbar" id="tbar" aria-hidden="true">${GAL.map(() => '<i></i>').join('')}</div></div></section>`
    : `<section class="hm-sec hm-tfb" aria-label="Silk gallery"><div class="hm-wrap"><div class="hm-head"><div><p class="hm-eyebrow">Six pieces, up close</p><h2 class="hm-h2">The collection, cloth by cloth</h2></div>${webglOK() ? '<button class="btn btn-line btn-sm" id="on3d" type="button" title="Your device asks apps to reduce motion. Tap to play the 3D gallery anyway.">Turn on 3D effects</button>' : ''}</div></div><div class="tunnel-fb">${GAL.map(([i, s]) => `<a href="#/product/${s}" style="background-image:url(${img(i)})" aria-label="${esc(bySlug[s]?.name || 'Saree')}"></a>`).join('')}</div></section>`}

  ${value.length >= 3 ? `<section class="hm-sec hm-value" aria-label="Everyday sarees under ten thousand rupees"><div class="hm-wrap">
    <div class="hm-head reveal"><div><p class="hm-eyebrow">For every day</p><h2 class="hm-h2">Sarees under ${money(10000)}</h2></div><a class="hm-link" href="#/shop?max=10000">See all under ${money(10000)}</a></div>
    <div class="pgrid hm-grid" id="valuegrid"></div></div></section>` : ''}

  <section class="hm-craft" id="craft" aria-label="How we describe a saree"><div class="hm-craft-in">
    <div class="hm-craft-photo reveal"><div class="hm-craft-img" id="craftph" role="img" aria-label="Close-up of the pallu of a maroon Banarasi silk saree, woven in gold zari"></div></div>
    <div class="hm-craft-copy reveal"><p class="hm-eyebrow">Know what you are buying</p><h2 class="hm-h2">A saree is a big purchase to make from a photograph, so we say plainly what each one is</h2>
      <dl class="hm-facts">
        <div><dt>Six photographs</dt><dd>Full length, draped, folded, and close-ups of the border, pallu and weave.</dd></div>
        <div><dt>The details that matter</dt><dd>Fabric, weave, length, blouse piece and care are listed on every saree.</dd></div>
        <div><dt>Certification, only where it exists</dt><dd>Where a saree carries Silk Mark or GI certification we show it. Where it does not, we say nothing about it.</dd></div>
      </dl>
      <a class="hm-link" href="#/story">How a saree is woven</a></div>
  </div></section>

  <section class="hm-sec hm-promises" aria-label="Delivery, returns and payment"><div class="hm-wrap">
    <ul class="hm-prom reveal">
      <li><h3>Delivery</h3><p>Standard delivery is free and usually takes 3–7 days, depending on your PIN code. Express delivery is ₹350 where available. Every order is tracked.</p></li>
      <li><h3>Returns</h3><p>Return an eligible saree within 7 days of delivery, unworn and with its tags. Stitched blouses, fall and pico, and gift add-ons are final sale.</p></li>
      <li><h3>Payment</h3><p>Pay by UPI or card through our payment provider. Your card and UPI details are never stored by us.</p></li>
      <li><h3>Questions</h3><p>Not sure about a weave, a colour or a delivery date? Write to us from the <a class="hm-inl" href="#/page/contact">contact page</a>.</p></li>
    </ul></div></section>

  <section class="hm-sec hm-news" aria-label="New arrivals by email"><div class="hm-wrap hm-news-in">
    <div class="reveal"><h2 class="hm-h2">Hear about new sarees</h2><p class="hm-lead">One short email when new pieces arrive. You can leave at any time.${T(' (Demo: nothing is stored or sent.)', '')}</p></div>
    <div class="reveal"><form id="nl" novalidate><input type="email" aria-label="Email address" placeholder="you@example.com" autocomplete="email"><button class="btn btn-gold" type="submit">Subscribe</button></form><div id="nlmsg" class="hm-fine" role="status"></div></div></div></section>`;

  const grid = $('#newgrid', root); news.forEach((p) => grid.appendChild(card(p)));
  const vg = $('#valuegrid', root); if (vg) value.forEach((p) => vg.appendChild(card(p)));
  $('#archph', root).style.backgroundImage = `url(${img('hero')})`;
  $('#craftph', root).style.backgroundImage = `url(${img('s/p1-5')})`;
  $('#nl', root).addEventListener('submit', async (e) => {
    e.preventDefault(); const v = $('input', e.target).value.trim(); const m = $('#nlmsg', root);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { m.textContent = 'Please enter a valid email address.'; m.style.color = 'var(--err)'; return; }
    if (ONLINE) { try { await createTicket({ channel: 'Newsletter', subject: 'Newsletter signup', message: 'Please add me to the new-arrivals list.', contact: v }); } catch (er) { m.textContent = er.message; m.style.color = 'var(--err)'; return; } }
    m.style.color = 'var(--ok)'; m.textContent = T('Thank you — this is a demo, so nothing was stored.', 'Thank you — you are on the list.'); e.target.reset();
  });

  // ---- 3D tunnel (touch: a swipe over a cloth scrolls the page; only a clean tap opens it, see cloth.js)
  let stop = null, dead = false;
  $('#on3d', root)?.addEventListener('click', () => { set3D(true); location.reload(); });
  if (tunnelOK) {
    const cap = $('#tcap', root), bars = $$('#tbar i', root); const draw = (i) => { const p = bySlug[GAL[i][1]]; if (!p) return; cap.style.opacity = 0; setTimeout(() => { cap.innerHTML = `<h3>${esc(p.name)}</h3><div class="pr">${money(p.price)}</div><a class="btn btn-line btn-sm" href="#/product/${p.slug}">View saree</a>`; cap.style.transition = 'opacity .5s'; cap.style.opacity = 1; }, 120); bars.forEach((b, k) => b.classList.toggle('on', k === i)); };
    const mountTunnel = () => import('../cloth.js').then(({ silkTunnel }) => silkTunnel($('#tunc', root), GAL.map(([i, s]) => ({ url: img(i), slug: s })), { onPick: (s) => { location.hash = '#/product/' + s; }, onIndex: draw, section: $('#tun', root) })).then((s) => { if (dead) s(); else stop = s; }).catch((e) => { console.warn('tunnel failed', e); $('#tun', root)?.remove(); });
    // three.js (~2 MB) is fetched on first interaction or once the page has settled — never on the first paint.
    glReady().then(() => { if (!dead) mountTunnel(); });
  }

  // ---- scroll-driven effects (one rAF loop): the hero photo drifts, the weaves strip slides sideways while pinned, the craft photo has depth
  const hs = $('#hs', root), track = $('#hstrack', root), archph = $('#archph', root), craftph = $('#craftph', root), craft = $('#craft', root);
  let native = false, lastY = scrollY, vel = 0, ticking = false; const mouse = { x: 0, y: 0 };
  const setup = () => { native = innerWidth < 900 || rm(); hs.classList.toggle('native', native); if (!native) { const dist = Math.max(0, track.scrollWidth - innerWidth + 40); hs.style.height = `${innerHeight + dist}px`; hs.dataset.dist = dist; } else { hs.style.height = ''; track.style.transform = ''; } };
  const tick = () => {
    ticking = false; if (dead) return;   // a frame queued just before leaving the page must not touch the next page's DOM
    const y = scrollY; vel += ((y - lastY) - vel) * .2; lastY = y; const vh = innerHeight;
    if (!native) { const b = hs.getBoundingClientRect(); const dist = Number(hs.dataset.dist || 0); const p = Math.min(1, Math.max(0, -b.top / Math.max(1, hs.offsetHeight - vh))); track.style.transform = `translate3d(${-p * dist}px,0,0)`; }
    if (!rm()) { archph.style.transform = `translate3d(${mouse.x * -10}px,${Math.min(y, vh) * .05 + mouse.y * -8}px,0) scale(1.05)`; const cb = craft.getBoundingClientRect(); craftph.style.transform = `translate3d(0,${(cb.top + cb.height / 2 - vh / 2) * -.08}px,0) scale(1.08)`; }
    if (Math.abs(vel) > .2) { vel *= .9; requestAnimationFrame(tick); ticking = true; }
  };
  const onS = () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } };
  const onM = (e) => { if (e.pointerType === 'touch') return; mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; onS(); };
  setup(); tick(); addEventListener('scroll', onS, { passive: true }); addEventListener('resize', setup); addEventListener('pointermove', onM, { passive: true });
  return () => { dead = true; stop?.(); removeEventListener('scroll', onS); removeEventListener('resize', setup); removeEventListener('pointermove', onM); };
}

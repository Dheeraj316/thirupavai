// Shared UI helpers: element builder, icons, toasts, drawers, modals, product cards.
import { inr } from './data.js';
import { tilt } from './fx.js';
import { cmp, MAX as CMP_MAX } from './compare.js';
import { wish, prod } from './store.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export const img = (n) => `assets/${n}.webp`;

const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>', heart: '<path d="M12 20s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.4-7 10-7 10z"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', chev: '<path d="M6 9l6 6 6-6"/>', chevR: '<path d="M9 6l6 6-6 6"/>', chevL: '<path d="M15 6l-6 6 6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h5l3 3v4h-8"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>', qr: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h3v3h-3zM19 14v6M14 19h3"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/>', cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>', filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/>', chart: '<path d="M4 20V4M4 20h16"/><path d="M8 15l4-4 3 3 5-6"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18.5 14.4c1.9.8 3 2.7 3 5.6"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>', chat: '<path d="M4 5h16v11H9l-5 4V5z"/>', receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  hanger: '<path d="M12 7a2.2 2.2 0 10-2.2-2.2"/><path d="M12 7v3L3 17h18l-9-7"/>', megaphone: '<path d="M3 10v4h4l8 4V6L7 10H3z"/><path d="M18.5 9a4 4 0 010 6"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  drag: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>', mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>', phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  compare: '<rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/><path d="M7 9v6M17 9v6"/>',
  bell: '<path d="M6 17V11a6 6 0 0112 0v6l2 2H4l2-2z"/><path d="M10 21h4"/>', pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', refresh: '<path d="M20 11a8 8 0 00-14.5-4M4 13a8 8 0 0014.5 4"/><path d="M20 4v7h-7M4 20v-7h7"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>', home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>', key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>', sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>',
};
export const ic = (n, s = 22, sw = 1.6) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

// toasts
let tbox;
export function toast(msg, ms = 2600) {
  tbox = tbox || document.body.appendChild(h('<div class="toasts" role="status" aria-live="polite"></div>'));
  const t = h(`<div class="toast">${esc(msg)}</div>`); tbox.appendChild(t); setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, ms);
}
// scrim + drawer + modal helpers (one at a time)
let openEl = null, lastFocus = null;
export function closeAll() { $$('.drawer.on,.modal.on,.filters.on,.searchov.on').forEach((e) => e.classList.remove('on')); $('#scrim')?.classList.remove('on'); document.body.style.overflow = ''; openEl = null; lastFocus?.focus?.(); }
export function openLayer(el) {
  const ov = $('#overlays'); if (!$('#scrim')) { const s = h('<div class="scrim" id="scrim"></div>'); s.addEventListener('click', closeAll); ov.appendChild(s); }
  closeAll(); lastFocus = document.activeElement; $$('.modal:not(.on)', ov).forEach((x) => { if (x !== el) x.remove(); });   // drop stale closed modals (keeps ids unique)
  if (!el.isConnected) ov.appendChild(el); requestAnimationFrame(() => { el.classList.add('on'); if (!el.classList.contains('searchov')) $('#scrim').classList.add('on'); }); document.body.style.overflow = 'hidden'; openEl = el;
  setTimeout(() => (el.querySelector('[autofocus],input,button,a') || el).focus?.({ preventScroll: true }), 80);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openEl) closeAll(); });
export function modal(html, { onClose } = {}) {
  const m = h(`<div class="modal" role="dialog" aria-modal="true"><div class="box"><button class="x ib" aria-label="Close">${ic('x', 22)}</button>${html}</div></div>`);
  $('.x', m).onclick = () => { closeAll(); onClose?.(); }; m.addEventListener('mousedown', (e) => { if (e.target === m) { closeAll(); onClose?.(); } }); openLayer(m); return m;
}

// product card (shared by home, shop, search, wishlist)
export function card(p, { eager = false } = {}) {
  const a = p.gallery[0], b = p.gallery[1];
  const sold = p.stock < 1;
  const el = h(`<article class="pcard"><a href="#/product/${p.slug}"><div class="imgbox">
      <div class="ph" style="background-image:url(${img(a.img)});background-position:${a.pos};${a.zoom !== 'cover' ? `background-size:${a.zoom}` : ''}"></div>
      ${b ? `<div class="ph alt" style="background-image:url(${img(b.img)});background-position:${b.pos};${b.zoom !== 'cover' ? `background-size:${b.zoom}` : ''}"></div>` : ''}
      ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}${sold ? '<div class="soldout">SOLD OUT</div>' : ''}</div>
      <div class="meta"><div><h3>${esc(p.name)}</h3><div class="sub">${esc(p.fabric)} · ${esc(p.weave)}</div></div><div class="pr">${inr(p.price)}${p.was ? `<s>${inr(p.was)}</s>` : ''}</div></div></a>
    <button class="heart" aria-pressed="${wish.has(p.id)}" aria-label="Add ${esc(p.name)} to wishlist">${ic('heart', 20)}</button>
    <button class="cmp" data-id="${p.id}" aria-pressed="${cmp.has(p.id)}" aria-label="Compare ${esc(p.name)}" title="Add to compare">${ic('compare', 18)}</button></article>`);
  const hb = $('.heart', el); hb.onclick = (e) => { e.preventDefault(); const on = wish.toggle(p.id); hb.setAttribute('aria-pressed', on); toast(on ? 'Saved to wishlist' : 'Removed from wishlist'); };
  const cb = $('.cmp', el); cb.onclick = (e) => { e.preventDefault(); const r = cmp.toggle(p.id); if (r.full) { toast(`You can compare up to ${CMP_MAX} sarees at a time`); return; } cb.setAttribute('aria-pressed', r.on); toast(r.on ? 'Added to compare' : 'Removed from compare', 1600); };
  tilt($('.imgbox', el), { rx: 8, ry: 7 });   // 3D tilt + moving glare
  return el;
}
export function reveal(root = document) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  $$('.reveal', root).forEach((e) => io.observe(e));
}
export const money = inr;
export const pad = (n) => String(n).padStart(2, '0');
export const when = (t) => new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export { prod };

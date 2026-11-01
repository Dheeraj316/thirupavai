import { h, $, $$, ic, img, reveal } from '../ui.js';

const STEPS = [['border', '50% 50%', '01', 'Border', 'Antique-gold zari woven into the silk ground — motif, density and finish shown at true colour.'], ['pallu', '50% 35%', '02', 'Pallu', 'The statement end of the drape, photographed full width so you see the pattern before you buy.'], ['weave', '50% 50%', '03', 'Weave', 'Fibre, sheen and texture up close. Zoom on desktop; swipe and pinch on mobile.']];

export default async function story(root) {
  root.innerHTML = `
  <section class="story-hero"><div class="bg" id="sbg"></div><div class="wrap t"><h1 style="margin:0 0 22px">Every drape<br>tells a story.</h1><p style="font:300 clamp(18px,2vw,25px)/1.5 var(--sans);color:var(--champ);max-width:520px">Scroll from the full drape into the border, the pallu and the weave.</p></div></section>
  <section class="zoomrun" id="zr" aria-label="Scroll-linked weave story"><div class="stick"><div class="tile" role="img" aria-label="Macro imagery, sample">${STEPS.map(([i, p]) => `<div class="ph" style="background-image:url(${img(i)});background-position:${p}"></div>`).join('')}<span class="pill gd" style="position:absolute;left:14px;top:14px;z-index:3">Macro imagery · sample</span></div>
    <div class="txt" aria-live="polite">${STEPS.map(([, , n, t, d]) => `<div class="step" style="position:absolute;max-width:560px;transition:opacity .5s,transform .5s"><h2>${t}</h2><p>${d}</p></div>`).join('')}<div style="height:clamp(300px,36vw,420px)"></div></div></div></section>
  <section class="sec verified"><div class="wrap"><h2 style="margin:0 0 14px">Woven by hand, verified by you.</h2>
    <p style="max-width:640px;font-size:19px">Weaver stories, loom origin, fibre tests and Silk Mark / GI details live here — published only once Thirupavai supplies and approves verified content.</p><p style="margin-top:14px"><span class="pill gd">Content placeholder · no claims published</span></p>
    <div class="cards reveal">${[['Fibre', 'shield', 'Pure silk · test report'], ['Weave', 'grid', 'Loom · weaver · region'], ['Zari', 'sparkle', 'Metal content · certificate']].map(([t, i, d]) => `<div class="vc"><div style="display:flex;gap:14px;align-items:center;color:var(--ink)">${ic(i, 34, 1.3)}<span class="serif" style="font-size:42px">${t}</span></div><div class="muted" style="margin-top:14px">${d}</div><div class="skel" style="width:78%;margin-top:18px"></div><div class="skel" style="width:56%"></div></div>`).join('')}</div>
    <p style="margin-top:36px"><a class="btn btn-dark" href="#/shop">Shop the collection</a></p></div></section>`;

  const zr = $('#zr', root), phs = $$('.tile .ph', root), steps = $$('.step', root), sbg = $('#sbg', root);
  const rm = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const upd = () => {
    const b = zr.getBoundingClientRect(); const p = Math.min(1, Math.max(0, -b.top / (b.height - innerHeight))); const seg = Math.min(2, Math.floor(p * 3)), sp = p * 3 - seg;
    phs.forEach((el, i) => { el.style.opacity = i === seg ? 1 : 0; el.style.transform = i === seg && !rm ? `scale(${1 + sp * 0.28})` : 'scale(1)'; });
    steps.forEach((el, i) => { el.style.opacity = i === seg ? 1 : 0; el.style.transform = i === seg ? 'none' : 'translateY(24px)'; el.style.pointerEvents = i === seg ? '' : 'none'; });
    if (!rm) sbg.style.transform = `scale(${1 + Math.min(scrollY, 900) / 3200}) translateY(${Math.min(scrollY, 900) * 0.1}px)`;
  };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  return () => { removeEventListener('scroll', upd); removeEventListener('resize', upd); };
}

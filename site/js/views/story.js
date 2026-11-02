import { h, $, $$, ic, img, reveal, esc } from '../ui.js';
import { products } from '../store.js';

// A buyer's guide told as a scroll: border, pallu, weave. The advice is general; the photographs and the example details come from the shop's own catalogue.
const STEPS = [['s/p5-5', '50% 50%', 'Border', 'The zari border is where the work shows first. Look for even, sharply cut motifs and a firm edge. In a well-made border the gold sits in the weave rather than on top of it.'], ['s/p5-4', '50% 50%', 'Pallu', 'The pallu is the end that falls over the shoulder, and it usually carries the richest design. Ask to see it opened out, at full width, before you decide.'], ['s/p33-6', '50% 50%', 'Weave', 'Turn the cloth in the light. In good silk the sheen moves as you do, the threads are even, and the surface feels smooth and slightly cool.']];

export default async function story(root) {
  const eg = products().find((p) => p.slug === 'maroon-banarasi-katan-silk') || products()[0];
  const facts = eg ? [['Fabric', eg.fabric], ['Weave', eg.weave], ['Length', eg.length], ['Blouse piece', eg.blouse], ['Care', eg.care]].filter(([, v]) => v) : [];
  root.innerHTML = `
  <section class="story-hero fl-story"><div class="bg" id="sbg"></div><div class="wrap t"><p class="fl-kicker">The buyer’s guide</p><h1>How to look at<br>a silk saree</h1><p class="fl-leadline">Three things to check before you buy: the border, the pallu and the weave. Scroll to look closer.</p></div></section>
  <section class="zoomrun fl-story" id="zr" aria-label="Looking closely at a saree: border, pallu and weave"><div class="stick"><div class="tile" role="img" aria-label="Close-up photographs of a zari border, a pallu and a silk weave">${STEPS.map(([i, p]) => `<div class="ph" style="background-image:url(${img(i)});background-position:${p}"></div>`).join('')}</div>
    <div class="txt" aria-live="polite">${STEPS.map(([, , t, d], k) => `<div class="step" style="position:absolute;max-width:560px;transition:opacity .5s,transform .5s"><p class="fl-stepno">${k + 1} of ${STEPS.length}</p><h2>${t}</h2><p>${d}</p></div>`).join('')}<div style="height:clamp(300px,36vw,420px)"></div></div></div></section>
  <section class="sec verified fl-story fl-detail"><div class="wrap fl-detailgrid"><div><h2>What we tell you about every saree</h2>
    <p>Each product page lists the fibre, the weave, the length, what comes with the blouse piece and how to care for it. If a detail has not been confirmed for a piece, we leave it out rather than guess.</p><p class="fl-aside">Here is a real example, the ${esc(eg?.name || 'Maroon Banarasi Katan Silk')}.</p>
    <p><a class="btn btn-gold" href="#/product/${esc(eg?.slug || '')}">See this saree</a> <a class="btn btn-line" href="#/shop">Shop the collection</a></p></div>
    <dl class="fl-specs">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div></section>`;

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

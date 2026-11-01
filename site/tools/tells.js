// Rendered-state audit for "AI-made" tells (Taste tells list): node tools/tells.js [width]
// Counts, per route, elements that still render a known tell: glass, glow, gradient text, outlined text, tracked capitals,
// italic accents, eyebrow labels, index numbering, ornament glyphs, hairline boxes, pill badges.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const W = Number(process.argv[2] || 1440);
const ROUTES = ['', '#/shop', '#/product/maroon-banarasi-katan-silk', '#/story', '#/wishlist', '#/account', '#/page/faqs', '#/page/contact', '#/checkout', '#/order/TPV-DEMO-0001', '#/admin', '#/admin/orders'];
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--ignore-gpu-blocklist'] });
  const c = await b.newContext({ viewport: { width: W, height: 900 } }); const p = await c.newPage();
  await c.addInitScript(() => { try { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; if (!s.cart || !s.cart.length) s.cart = [{ id: 'p1', qty: 1, addons: [] }]; localStorage.setItem(k, JSON.stringify(s)); } catch {} });
  const total = {};
  for (const r of ROUTES) {
    await p.goto('http://127.0.0.1:4173/' + r); await p.waitForTimeout(r.includes('admin') ? 1800 : 1500);
    const res = await p.evaluate(() => {
      const out = { glass: 0, glow: 0, gradText: 0, outlineText: 0, trackedCaps: 0, italic: 0, eyebrow: 0, numbering: 0, glyph: 0, hairBox: 0, pill: 0 }; const samples = {};
      const note = (k, el) => { out[k]++; (samples[k] = samples[k] || []); if (samples[k].length < 3) samples[k].push((el.className && el.className.toString().slice(0, 28)) || el.tagName); };
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (el.closest('#demobar')) continue; const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
        if (cs.backdropFilter && cs.backdropFilter !== 'none') note('glass', el);
        if (cs.boxShadow !== 'none' && /rgba?\(\s*(198|203|235)[^)]*\)\s*0px 0px [2-9]\d/.test(cs.boxShadow)) note('glow', el);
        if (hasText && (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text')) note('gradText', el);
        if (hasText && parseFloat(cs.webkitTextStrokeWidth) > 0) note('outlineText', el);
        if (hasText && cs.textTransform === 'uppercase' && parseFloat(cs.letterSpacing) / parseFloat(cs.fontSize) > 0.06 && parseFloat(cs.fontSize) < 16 && !el.closest('.tbl,.adm,.kpi')) note('trackedCaps', el);
        if (hasText && cs.fontStyle === 'italic') note('italic', el);
        if (el.classList.contains('eyebrow') && hasText) note('eyebrow', el);
        if (hasText && /^\s*(0\d|\(0\d+\)|I{1,3}|IV|V)\s*$/.test(el.textContent) && el.children.length === 0) note('numbering', el);
        if (hasText && /[✦✧★☆◆❖]/.test(el.textContent)) note('glyph', el);
        if (cs.borderTopWidth === '1px' && cs.borderTopStyle === 'solid' && cs.borderRightWidth === '1px' && cs.borderBottomWidth === '1px' && cs.borderLeftWidth === '1px' && r.width > 120 && !el.closest('.adm,.tbl,input,select,textarea,button')) note('hairBox', el);
        if (hasText && parseFloat(cs.borderTopLeftRadius) >= 9 && r.height < 34 && r.width < 220 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && !el.closest('.adm,.tbl') && !el.matches('.heart,.cmp,.ib')) note('pill', el);
      }
      return { out, samples };
    });
    const line = Object.entries(res.out).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log((r || '#/').padEnd(40), line || 'clean'); for (const [k, v] of Object.entries(res.out)) total[k] = (total[k] || 0) + v;
    for (const [k, s] of Object.entries(res.samples)) if (res.out[k]) console.log('     ', k.padEnd(12), s.join(' | '));
  }
  console.log('TOTAL', JSON.stringify(total)); await b.close();
})();

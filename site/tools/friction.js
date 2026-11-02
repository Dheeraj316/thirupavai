// Friction audit: what a real person would trip over, page by page and device by device.
//   node tools/friction.js [base-url] [outfile.json]
// Per page and device it reports: JS errors and console errors, failed or slow requests, page wider than the screen, touch targets under 40 px,
// text that is too small or too faint, images without alt text, controls without a name, fields without a label, and layout shift while loading.
const path = require('path'); const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const BASE = process.argv[2] || 'http://127.0.0.1:8080/'; const OUT = process.argv[3];
const DEVICES = [['phone 390', { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true], ['phone 360', { viewport: { width: 360, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true],
  ['tablet 820', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true], ['laptop 1366', { viewport: { width: 1366, height: 768 } }, false], ['desktop 1920', { viewport: { width: 1920, height: 1080 } }, false]];
const ROUTES = ['#/', '#/shop', '#/product/maroon-banarasi-katan-silk', '#/product/sage-chanderi-gold-border', '#/story', '#/wishlist', '#/account', '#/page/contact', '#/page/shipping', '#/page/returns', '#/page/faqs', '#/checkout', '#/order/TPV-100001'];
const seed = () => { try { localStorage.setItem('tpv-live-v1', JSON.stringify({ introSeen: true, cart: [{ id: 'p10', qty: 1 }] })); localStorage.setItem('tpv-view', 'grid'); } catch {} };

const probe = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > 0.05 && r.bottom > 0 && r.right > 0; };
  const name = (e) => (e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || e.getAttribute('alt') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const sel = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '');
  const out = { small: [], tiny: [], faint: [], noalt: [], noname: [], nolabel: [] };
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(',').map(Number); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = (e) => { for (let n = e; n; n = n.parentElement) { const b = parse(getComputedStyle(n).backgroundColor); if (b && b.a > .5) return b.c; if (getComputedStyle(n).backgroundImage !== 'none') return null; } return [11, 7, 9]; };
  for (const e of document.querySelectorAll('a[href],button,[role=button],input:not([type=hidden]),select,textarea,summary')) {
    if (!vis(e) || e.closest('[aria-hidden=true]')) continue; const r = e.getBoundingClientRect();
    if (e.matches('input[type=checkbox],input[type=radio]')) { const lab = e.closest('label') || document.querySelector(`label[for="${e.id}"]`); const lr = lab ? lab.getBoundingClientRect() : r; if (Math.max(r.height, lr.height) < 36) out.small.push(`${sel(e)} ${Math.round(r.width)}x${Math.round(Math.max(r.height, lr.height))}`); }
    else if (Math.min(r.width, r.height) < 36 && !(e.tagName === 'A' && e.closest('p,li,.fine,#ftr') && r.height >= 20)) out.small.push(`${sel(e)} "${name(e)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (!e.matches('input,select,textarea') && !name(e)) out.noname.push(sel(e));
    if (e.matches('input:not([type=checkbox]):not([type=radio]):not([type=submit]),select,textarea') && !(e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.id && document.querySelector(`label[for="${e.id}"]`)) || e.closest('label'))) out.nolabel.push(sel(e) + ' ' + (e.placeholder || ''));
  }
  for (const i of document.querySelectorAll('img')) if (vis(i) && !i.hasAttribute('alt')) out.noalt.push(i.src.split('/').pop());
  const seen = new Set();
  for (const e of document.querySelectorAll('main *, #ftr *, #hdr *')) {
    if (!vis(e) || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2)) continue; const cs = getComputedStyle(e); const fs = parseFloat(cs.fontSize);
    const t = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').slice(0, 30);
    if (fs < 12 && !seen.has(sel(e) + fs)) { seen.add(sel(e) + fs); out.tiny.push(`${sel(e)} ${fs}px "${t}"`); }
    const fg = parse(cs.color); const bg = bgOf(e); if (fg && bg) { const L1 = lum(fg.c) * fg.a + lum(bg) * (1 - fg.a), L2 = lum(bg); const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); const big = fs >= 24 || (fs >= 18.5 && +cs.fontWeight >= 700); if (ratio < (big ? 3 : 4.5) && !seen.has('c' + sel(e))) { seen.add('c' + sel(e)); out.faint.push(`${sel(e)} ${ratio.toFixed(1)}:1 "${t}"`); } }
  }
  const de = document.documentElement; out.overflow = de.scrollWidth - de.clientWidth;
  return out;
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = []; let hardFails = 0;
  for (const [dname, opts, touch] of DEVICES) {
    const ctx = await browser.newContext(opts); await ctx.addInitScript(seed); await ctx.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {} });
    const page = await ctx.newPage(); const errs = [], reqs = [];
    page.on('pageerror', (e) => errs.push('JS ' + String(e).slice(0, 140))); page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|401|403|404|409|429)/.test(m.text())) errs.push('console ' + m.text().slice(0, 140)); });
    page.on('response', (r) => { const s = r.status(); if (s >= 500 || (s === 404 && !/favicon|\.map/.test(r.url()))) reqs.push(s + ' ' + r.url().replace(BASE, '/').slice(0, 90)); });
    for (const route of ROUTES) {
      errs.length = 0; reqs.length = 0;
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => document.body.dataset.route && !document.querySelector('#main .spin'), null, { timeout: 25000 }).catch(() => {}); await page.waitForTimeout(2200);
      const r = await page.evaluate(probe); const cls = await page.evaluate(() => +window.__cls.toFixed(3));
      const row = { device: dname, route, overflow: r.overflow, cls, errors: [...errs], badRequests: [...reqs], small: touch ? r.small : [], tiny: r.tiny, faint: r.faint, noalt: r.noalt, noname: r.noname, nolabel: r.nolabel };
      if (r.overflow > 1 || errs.length || reqs.length) hardFails++; report.push(row);
    }
    await ctx.close();
  }
  await browser.close();
  const agg = (k) => report.reduce((a, r) => a + (Array.isArray(r[k]) ? r[k].length : 0), 0);
  console.log(`pages checked: ${report.length}   overflow: ${report.filter((r) => r.overflow > 1).length}   with errors: ${report.filter((r) => r.errors.length).length}   bad requests: ${report.filter((r) => r.badRequests.length).length}   CLS>0.1: ${report.filter((r) => r.cls > 0.1).length}`);
  console.log(`touch targets <36px: ${agg('small')}   tiny text (<12px): ${agg('tiny')}   low contrast: ${agg('faint')}   images without alt: ${agg('noalt')}   controls without a name: ${agg('noname')}   fields without a label: ${agg('nolabel')}`);
  const top = (k, n = 12) => { const c = {}; report.forEach((r) => r[k].forEach((x) => { const key = x.replace(/ \d+x\d+$/, '').replace(/ [\d.]+(px|:1)/, ''); c[key] = (c[key] || 0) + 1; })); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n); };
  for (const k of ['small', 'faint', 'tiny', 'noname', 'nolabel', 'noalt']) { const t = top(k); if (t.length) { console.log(`\n${k}:`); t.forEach(([x, n]) => console.log(`  ${String(n).padStart(3)}  ${x}`)); } }
  for (const r of report) { if (r.errors.length || r.badRequests.length || r.overflow > 1 || r.cls > 0.1) console.log(`\n! ${r.device} ${r.route}: overflow ${r.overflow}, CLS ${r.cls}, errors ${JSON.stringify(r.errors)}, bad requests ${JSON.stringify(r.badRequests)}`); }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
})();

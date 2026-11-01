// rAF fps while scrolling through each home section (GPU Chrome, 1440x810 @1.33 dpr): node tools/fps_sections.js
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  const c = await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1.3333 }); const p = await c.newPage();
  await c.addInitScript(() => { try { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); } catch {} });
  await p.goto('http://127.0.0.1:4173/#/'); await p.waitForTimeout(1500); await p.evaluate(() => window.dispatchEvent(new Event('pointerdown'))); await p.waitForTimeout(2500);
  const measure = async (label, from, to, ms) => {
    const r = await p.evaluate(async ([a, z, d]) => { const dts = []; let last = performance.now(); const t0 = last; await new Promise((res) => { (function f(ts) { const n = performance.now(); dts.push(n - last); last = n; const pr = Math.min(1, (n - t0) / d); scrollTo({ top: a + (z - a) * pr, behavior: 'instant' }); if (pr < 1) requestAnimationFrame(f); else res(); })(); }); dts.sort((x, y) => x - y); return { fps: (1000 / (dts.reduce((s, v) => s + v, 0) / dts.length)).toFixed(1), p95ms: dts[Math.floor(dts.length * .95)].toFixed(1) }; }, [from, to, ms]);
    console.log(label.padEnd(10), JSON.stringify(r));
  };
  const top = (sel) => p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, sel);
  const hs = await top('#hs'), hh = await p.evaluate(() => document.querySelector('#hs').offsetHeight - innerHeight), tun = await top('#tun'), th = await p.evaluate(() => document.querySelector('#tun').offsetHeight - innerHeight);
  await measure('hero', 0, 500, 2000); await measure('tunnel', tun, tun + th, 4000); await measure('houses', hs, hs + hh, 4000); await measure('grid', await top('#newgrid') - 300, await top('#newgrid') + 400, 2500); await measure('craft', await top('#craft') - 200, await top('#craft') + 500, 2500);
  await b.close();
})();

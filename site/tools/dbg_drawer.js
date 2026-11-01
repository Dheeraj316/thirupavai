const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--disable-gpu-compositing', '--disable-gpu-rasterization'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await c.newPage();
  await c.addInitScript(() => { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); });
  await p.goto('http://127.0.0.1:4173/#/product/maroon-banarasi-katan-silk'); await p.waitForSelector('.mainimg'); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('#addbag').click()); await p.waitForSelector('.drawer.on');
  for (const ms of [100, 400, 900, 1800]) { await p.waitForTimeout(ms === 100 ? 100 : ms - (ms === 400 ? 100 : ms === 900 ? 400 : 900)); console.log(ms, JSON.stringify(await p.evaluate(() => { const d = document.querySelector('.drawer.on'); const r = d.getBoundingClientRect(); return { left: Math.round(r.left), width: Math.round(r.width), vw: innerWidth, tf: getComputedStyle(d).transform }; }))); }
  await p.screenshot({ path: path.join(__dirname, '..', 'qa', 'm_bag2.png') }); await b.close();
})();

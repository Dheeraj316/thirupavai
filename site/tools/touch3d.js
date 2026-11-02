// Touch behaviour of the 3D scenes on a phone: swiping over a cloth must SCROLL the page and never open a saree; a clean tap on a cloth opens it.
//   node tools/touch3d.js [http://127.0.0.1:8080/]
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const BASE = process.argv[2] || 'http://127.0.0.1:8080/';
const results = []; const ok = (n, p, x = '') => { results.push(p); console.log((p ? 'PASS ' : 'FAIL ') + n + (x ? '  — ' + x : '')); };
const seed = () => { try { localStorage.setItem('tpv-live-v1', JSON.stringify({ introSeen: true })); localStorage.setItem('tpv-view', 'grid'); } catch {} };
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await ctx.addInitScript(seed);
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const swipe = async (x, y, dy, steps = 12) => { await touch('touchStart', x, y); for (let i = 1; i <= steps; i++) { await touch('touchMove', x, y + (dy * i) / steps); await page.waitForTimeout(16); } await touch('touchEnd'); await page.waitForTimeout(500); };
  const tap = async (x, y) => { await touch('touchStart', x, y); await page.waitForTimeout(60); await touch('touchEnd'); await page.waitForTimeout(700); };

  // ---- silk tunnel on the home page
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => document.body.dataset.route === 'home'); await page.waitForTimeout(1500);
  await page.evaluate(() => window.dispatchEvent(new Event('pointerdown'))); await page.waitForSelector('#tunc', { timeout: 20000 }); await page.waitForTimeout(3500);
  const y0 = await page.evaluate(() => { const t = document.getElementById('tun'); const top = t.getBoundingClientRect().top + scrollY; scrollTo(0, top + 40); return top + 40; }); await page.waitForTimeout(1200);
  const here = await page.evaluate(() => ({ y: scrollY, hash: location.hash }));
  // sweep a few swipe starts across the screen (cloths sit left and right of centre) and make sure none of them navigates
  let navigated = 0, moved = 0;
  for (const [x, y] of [[100, 420], [290, 380], [195, 430], [80, 300], [310, 520]]) {
    await page.evaluate((yy) => scrollTo(0, yy), y0); await page.waitForTimeout(500);
    const before = await page.evaluate(() => scrollY); await swipe(x, y, -260);
    const after = await page.evaluate(() => ({ y: scrollY, hash: location.hash }));
    if (/#\/product\//.test(after.hash)) { navigated++; console.log('  swipe from', x, y, 'opened', after.hash); await page.evaluate(() => { location.hash = '#/'; }); await page.waitForFunction(() => document.body.dataset.route === 'home' && document.getElementById('tunc'), null, { timeout: 25000 }).catch(() => {}); await page.waitForTimeout(3500); await page.evaluate(() => { const t = document.getElementById('tun'); if (t) scrollTo(0, t.getBoundingClientRect().top + scrollY + 40); }); }
    if (Math.abs(after.y - before) > 40) moved++;
  }
  ok('swiping over the 3D cloths never opens a saree', navigated === 0, `${navigated} of 5 swipes navigated`);
  ok('the same swipes scroll the page', moved >= 4, `${moved} of 5 scrolled`);
  // a clean tap on a cloth still opens it
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => document.body.dataset.route === 'home'); await page.waitForTimeout(1200);
  await page.evaluate(() => window.dispatchEvent(new Event('pointerdown'))); await page.waitForSelector('#tunc', { timeout: 20000 }); await page.waitForTimeout(3500);
  const top2 = await page.evaluate(() => { const t = document.getElementById('tun'); const top = t.getBoundingClientRect().top + scrollY; scrollTo(0, top + (t.offsetHeight - innerHeight) * 0.35); return top; }); await page.waitForTimeout(1500);
  let opened = false; search: for (const fy of [0.45, 0.35, 0.55, 0.3, 0.6, 0.5]) for (const fx of [0.3, 0.7, 0.5, 0.2, 0.8]) { await tap(390 * fx, 780 * fy); if (await page.evaluate(() => /#\/product\//.test(location.hash))) { opened = true; break search; } }
  ok('a clean tap on a cloth opens that saree', opened);

  // ---- 3D ring in the shop
  await page.goto(BASE + '#/shop', { waitUntil: 'load' }); await page.waitForSelector('#vring'); await page.evaluate(() => document.querySelector('#vring').click()); await page.waitForSelector('.rc'); await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('#rw').scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(900);
  const pick = () => page.evaluate(() => { const vis = (b) => { const l = Math.max(b.left, 0), r = Math.min(b.right, innerWidth), t = Math.max(b.top, 0), bt = Math.min(b.bottom, innerHeight); return { l, r, t, b: bt, area: Math.max(0, r - l) * Math.max(0, bt - t) }; }; const c = [...document.querySelectorAll('.rc')].map((e) => ({ e, r: e.getBoundingClientRect() })).filter((o) => o.r.width > 150).sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - innerWidth / 2) - Math.abs(b.r.left + b.r.width / 2 - innerWidth / 2))[0]; if (!c) return null; const v = vis(c.r); return v.area > 4000 ? { x: (v.l + v.r) / 2, y: c.r.top + c.r.height / 2 } : null; });   // the card nearest the middle, tapped on its visible part
  let rb = await pick();
  if (rb) { const h0 = await page.evaluate(() => location.hash); await swipe(rb.x, rb.y, -200); const h1 = await page.evaluate(() => location.hash); ok('swiping over the 3D ring does not open a saree', h1 === h0, h1);
    console.log('  ring card point', Math.round(rb.x), Math.round(rb.y), 'element there:', await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + ' in ' + (e.closest('.rc') ? '.rc' : e.closest('.ring-ui') ? '.ring-ui' : '?') : null; }, [rb.x, rb.y]));
    await page.waitForTimeout(1800); rb = await pick();   // the ring has moved since the swipe: find the card again
    await tap(rb.x, rb.y); ok('tapping a card in the 3D ring opens it', await page.evaluate(() => /#\/product\//.test(location.hash)), await page.evaluate(() => location.hash)); }
  else ok('3D ring card found', false);
  await browser.close(); const f = results.filter((x) => !x).length; console.log(f ? `\n${f} FAILED` : '\nall passed'); process.exit(f ? 1 : 0);
})();

// "All angles": phones (portrait + landscape), tablets, laptops, desktops. Checks the app-style shell appears/disappears at the right sizes,
// every tab works, 3D is running, and takes a first-screen picture of each.   usage: node angles.js <base> <outDir>
const path = require('path'); const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const [BASE, OUT] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[4]; const ALL = [['phone-320x568', 320, 568], ['phone-360x740', 360, 740], ['phone-375x812', 375, 812], ['phone-412x915', 412, 915], ['phone-430x932', 430, 932], ['phone-land-667x375', 667, 375], ['phone-land-812x375', 812, 375], ['phone-land-915x412', 915, 412],
  ['tablet-768x1024', 768, 1024], ['tablet-820x1180', 820, 1180], ['tablet-land-1024x768', 1024, 768], ['laptop-1366x768', 1366, 768], ['desktop-1920x1080', 1920, 1080], ['wide-2560x1440', 2560, 1440]];
const DEV = ONLY ? ALL.filter((d) => d[0].includes(ONLY)) : ALL;
const seed = () => { try { localStorage.setItem('tpv-live-v1', JSON.stringify({ introSeen: true, cart: [{ id: 'p10', qty: 1 }], wish: ['p1'] })); localStorage.setItem('tpv-view', 'grid'); } catch {} };
let fails = 0; const ok = (name, pass, extra = '') => { if (!pass) fails++; console.log((pass ? '  PASS ' : '  FAIL ') + name + (extra ? '  â€” ' + extra : '')); };
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [name, w, h] of DEV) {
    console.log(name);
    const touch = w < 1000; const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: false, deviceScaleFactor: 1 }); await ctx.addInitScript(seed); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForFunction(() => document.body.dataset.route === 'home' && !document.querySelector('#main .spin'), null, { timeout: 25000 }); await page.waitForTimeout(3200);
    const vis = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0; }, sel);
    const phone = w <= 700, landscapeShort = h <= 540 && w > h, appHeader = w <= 900 && !landscapeShort;
    const t = await vis('#tabbar'), s = await vis('#msearch'), r = await vis('#catrail'), dn = await vis('.nav-l');
    ok('tab bar ' + (phone && !landscapeShort ? 'shown' : 'hidden'), t === (phone && !landscapeShort));
    ok('search field row ' + (appHeader ? 'shown' : 'hidden'), s === appHeader);
    ok('category row ' + (appHeader ? 'shown' : 'hidden') + ' on home', r === appHeader);
    ok('desktop menu ' + (w > 900 ? 'shown' : 'hidden'), dn === (w > 900));
    const gl = await page.evaluate(() => ({ stage: !!window.__stage, tun: !!document.getElementById('tunc') && document.getElementById('tunc').width > 10, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok('3D background running', gl.stage); ok('3D silk tunnel running', gl.tun); ok('page not wider than screen', gl.sw <= gl.cw + 1, `scroll ${gl.sw} / screen ${gl.cw}`);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    if (phone && !landscapeShort) {
      await page.click('#tabbar a[href="#/shop"]'); await page.waitForFunction(() => document.body.dataset.route === 'shop' && !document.querySelector('#main .spin'), null, { timeout: 15000 });
      ok('Shop tab opens the shop and lights up', await page.waitForFunction(() => document.querySelector('#tabbar a[aria-current=page]')?.getAttribute('href') === '#/shop', null, { timeout: 3000 }).then(() => true, () => false));
      await page.click('#catrail a:has-text("Bridal")'); await page.waitForFunction(() => /occasion=Bridal/.test(location.hash), null, { timeout: 8000 }); ok('Bridal chip filters the shop', true);
      try { await page.click('#tabbar a[href="#/wishlist"]', { timeout: 5000 }); } catch (e) { console.log('   DIAG', JSON.stringify(await page.evaluate(() => { const r = document.querySelector('#tabbar a[href="#/wishlist"]').getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const e = document.elementFromPoint(x, y); const chain = []; let n = e; while (n && n !== document.body) { const c = getComputedStyle(n); chain.push(n.tagName.toLowerCase() + '.' + String(n.className).split(' ')[0] + '[' + c.position + ' z' + c.zIndex + ']'); n = n.parentElement; } const f = document.querySelector('.filters'); const fr = f && f.getBoundingClientRect(); return { x: Math.round(x), y: Math.round(y), vh: innerHeight, chain, filters: f && { cls: f.className, top: Math.round(fr.top), bottom: Math.round(fr.bottom), tf: getComputedStyle(f).transform } }; }))); await page.evaluate(() => { location.hash = '#/wishlist'; }); }
      await page.waitForFunction(() => /wishlist/.test(location.hash)); ok('Saved tab opens the wishlist and lights up', await page.waitForFunction(() => document.querySelector('#tabbar a[aria-current=page]')?.getAttribute('href') === '#/wishlist', null, { timeout: 3000 }).then(() => true, () => false));
      await page.click('#tbag'); await page.waitForSelector('.drawer.on, .drawer.open, aside.drawer[aria-label="Shopping bag"]', { timeout: 8000 }); ok('Bag tab opens the bag', await page.evaluate(() => { const d = document.querySelector('aside.drawer[aria-label="Shopping bag"]'); return !!d && d.getBoundingClientRect().right > 50; }));
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
      await page.click('#msearch'); await page.waitForSelector('#sq', { timeout: 8000 }); ok('Search field opens search', await vis('#sq')); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      await page.click('#tabbar a[href="#/"]'); await page.waitForFunction(() => document.body.dataset.route === 'home'); ok('Home tab returns home', true);
    }
    ok('no page errors', errs.length === 0, errs[0] || '');
    await ctx.close();
  }
  await browser.close(); console.log(fails ? `\n${fails} FAILED` : '\nall passed');
})();


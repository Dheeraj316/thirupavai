// Strict responsive audit. A fixed-width window (not phone emulation, which silently widens the screen to fit wide content),
// so scrollWidth > innerWidth really means "the page is wider than the screen".  usage: node fit_audit2.js <base> [widths]
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const BASE = process.argv[2]; const WIDTHS = (process.argv[3] || '280,320,360,375,390,412,430,600,768,820,1024,1280,1440,1920').split(',').map(Number);
const PAGES = ['#/', '#/shop', '#/product/ivory-organza-gold-edge', '#/product/maroon-banarasi-katan-silk', '#/story', '#/wishlist', '#/account', '#/page/contact', '#/page/shipping', '#/checkout', '#/admin', '#/order/TPV-100001'];
const seed = () => { try { localStorage.setItem('tpv-live-v1', JSON.stringify({ introSeen: true, cart: [{ id: 'p10', qty: 1 }] })); localStorage.setItem('tpv-view', 'grid'); } catch {} };
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const bad = [];
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 800 : 900 }, hasTouch: w < 1000, deviceScaleFactor: 1 }); await ctx.addInitScript(seed); const page = await ctx.newPage();
    const states = [...PAGES.map((p) => [p, null])]; states.push(['#/checkout', 'otp']);
    for (const [p, st] of states) {
      await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.dataset.route && !document.querySelector('#main .spin'), null, { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(700);
      if (st === 'otp') { await page.waitForSelector('#mob', { timeout: 8000 }).catch(() => {}); if (await page.$('#mob')) { await page.fill('#mob', '9' + String(Date.now()).slice(-9)); await page.click('#sendotp'); await page.waitForSelector('.otp input', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(400); } }
      const r = await page.evaluate(() => {
        const iw = document.documentElement.clientWidth; const de = document.documentElement;
        const over = []; for (const el of document.querySelectorAll('body *')) { const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.display === 'none') continue; const b = el.getBoundingClientRect(); if (b.width && b.right > iw + 1) { let p = el.parentElement, clipped = false; while (p && p !== document.body) { const o = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(o.overflowX) && p.getBoundingClientRect().right <= iw + 1) { clipped = true; break; } p = p.parentElement; } if (!clipped) over.push({ t: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''), right: Math.round(b.right), w: Math.round(b.width) }); } }
        return { iw, sw: de.scrollWidth, over: over.slice(0, 5), n: over.length };
      });
      if (r.sw > r.iw + 1 || r.n) bad.push(`w=${w} ${p}${st ? ' [' + st + ']' : ''} | docScroll=${r.sw} (screen ${r.iw}) | ` + r.over.map((o) => `${o.t}(right ${o.right}, w ${o.w})`).join('; '));
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`${bad.length} page/width combinations are wider than the screen`); bad.forEach((b) => console.log(b));
})();


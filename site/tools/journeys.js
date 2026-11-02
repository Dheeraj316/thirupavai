// Real-user journeys against the ONLINE shop (API server, demo sign-in codes), on a phone with a finger, a laptop with a mouse and keyboard, a tablet and a phone on its side.
//   node tools/journeys.js [http://127.0.0.1:8080/] [profile-filter]
// Each step is something a person does; a step fails when what they would see is wrong (nothing opens, an error with no explanation, the page jumps sideways,
// a control is covered by something else, a JS error). Needs a server whose demo codes are on (staging/dev). Creates test orders.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const BASE = process.argv[2] || 'http://127.0.0.1:8080/'; const ONLY = process.argv[3];
const PROFILES = [
  { name: 'phone-390', opts: { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, touch: true },
  { name: 'phone-360', opts: { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, touch: true },
  { name: 'tablet-820', opts: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, touch: true },
  { name: 'laptop-1366', opts: { viewport: { width: 1366, height: 768 } }, touch: false },
  { name: 'desktop-1920', opts: { viewport: { width: 1920, height: 1080 } }, touch: false },
  { name: 'phone-landscape', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, touch: true },
].filter((p) => !ONLY || p.name.includes(ONLY));
const seed = () => { try { if (!localStorage.getItem('tpv-live-v1')) localStorage.setItem('tpv-live-v1', JSON.stringify({ introSeen: true })); if (!localStorage.getItem('tpv-view')) localStorage.setItem('tpv-view', 'grid'); } catch {} };
let total = 0, failed = 0; const fails = [];
const mob = (n) => '98' + String(10000000 + ((Date.now() + n * 7919) % 80000000));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const P of PROFILES) {
    console.log(`\n=== ${P.name} ===`);
    const ctx = await browser.newContext(P.opts); await ctx.addInitScript(seed); const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push('JS error: ' + String(e).slice(0, 160)));
    page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|401|402|403|404|409|429|502|503)|Failed to load resource: net::ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });
    page.on('dialog', (d) => d.accept());
    const cdp = P.touch ? await ctx.newCDPSession(page) : null;
    const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const swipe = async (x, y, dx, dy, steps = 10) => { await tp('touchStart', x, y); for (let i = 1; i <= steps; i++) { await tp('touchMove', x + (dx * i) / steps, y + (dy * i) / steps); await page.waitForTimeout(14); } await tp('touchEnd'); await page.waitForTimeout(450); };
    const step = async (name, fn) => { total++; const e0 = errors.length; try { await fn(); const ne = errors.slice(e0); if (ne.length) throw new Error('page reported: ' + ne[0]); const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (ov > 1) throw new Error(`page is ${ov}px wider than the screen`); console.log('  ok   ' + name); } catch (e) { failed++; const msg = String(e.message || e).split('\n')[0].slice(0, 200); fails.push(`${P.name}: ${name}: ${msg}`); console.log('  FAIL ' + name + '  — ' + msg); try { await page.screenshot({ path: path.join(process.env.SHOTS || '.', `journey_${P.name}_${total}.png`) }); } catch {} } };
    const go = async (hash, route) => { await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' }); await page.waitForFunction((r) => document.body.dataset.route === r && !document.querySelector('#main .spin'), route, { timeout: 25000 }); await page.waitForTimeout(600); };
    const press = async (loc) => {
      await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); if (!b) throw new Error('control not visible'); const x = b.x + b.width / 2, y = b.y + b.height / 2;
      const same = await loc.evaluate((el, [px, py]) => { const t = document.elementFromPoint(px, py); return !!t && (el === t || el.contains(t) || t.contains(el)); }, [x, y]);
      if (!same) { const top = await page.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); return e ? e.outerHTML.slice(0, 60) : null; }, [x, y]); throw new Error('something covers the control: ' + top); }
      if (P.touch && Math.min(b.width, b.height) < 36) throw new Error(`control is only ${Math.round(b.width)}x${Math.round(b.height)}px for a thumb`);
      if (P.touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await page.waitForTimeout(450);
    };

    // ---------------- J1: browse, pick, buy
    await step('home opens with the hero and header', async () => { await go('#/', 'home'); if (!(await page.locator('#hdr').isVisible())) throw new Error('no header'); });
    await step('scrolling the home page with a finger / wheel moves it and opens nothing', async () => { const y0 = await page.evaluate(() => scrollY); if (P.touch) await swipe(195, 600, 0, -380); else await page.mouse.wheel(0, 900); await page.waitForTimeout(500); const s = await page.evaluate(() => ({ y: scrollY, h: location.hash })); if (s.y - y0 < 100) throw new Error('page did not scroll'); if (/#\/product\//.test(s.h)) throw new Error('a saree opened while scrolling'); });
    await step('shop opens from the main navigation', async () => {
      await go('#/', 'home'); const w = P.opts.viewport.width, h = P.opts.viewport.height; const tab = w <= 700 && h > 540;
      const link = w >= 1100 ? page.locator('#hdr nav a[href="#/shop"]').first() : tab ? page.locator('#tabbar a[href="#/shop"]') : page.locator('#burger');
      await press(link); if (!tab && w < 1100) await page.locator('.drawer.left a[href="#/shop"]').first().click(); await page.waitForFunction(() => document.body.dataset.route === 'shop', null, { timeout: 15000 });
    });
    await step('shop lists sarees with photos that loaded', async () => { await page.waitForSelector('.pcard'); const n = await page.locator('.pcard').count(); if (n < 12) throw new Error(`only ${n} sarees listed`); const broken = await page.evaluate(() => [...document.querySelectorAll('.pcard img')].filter((i) => i.complete && i.naturalWidth === 0).length); if (broken) throw new Error(`${broken} broken photos`); });
    await step('a saree opens from the grid', async () => { await go('#/shop', 'shop'); await page.waitForSelector('.pcard'); const card = page.locator('.pcard a[href^="#/product/"]').nth(2); await card.scrollIntoViewIfNeeded(); const b = await card.boundingBox(); if (P.touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height * 0.4); else await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.4); await page.waitForFunction(() => /#\/product\//.test(location.hash) && document.body.dataset.route === 'product', null, { timeout: 15000 }); await page.waitForSelector('.info h1'); });
    await step('the gallery changes picture and shows six views', async () => { await page.waitForSelector('.thumb'); const n = await page.locator('.thumb').count(); if (n !== 6) throw new Error(`${n} thumbnails, expected 6`); const before = await page.locator('#lbl').innerText().catch(() => ''); await press(page.locator('.thumb').nth(3)); await page.waitForTimeout(500); const after = await page.locator('#lbl').innerText().catch(() => ''); if (after === before) throw new Error('main picture did not change'); });
    await step('3D drape opens and can be dragged without moving the page', async () => {
      await press(page.locator('#m3d')); await page.waitForSelector('#dstage'); await page.waitForTimeout(1800); const cv = page.locator('#dstage canvas').first(); const b = await cv.boundingBox(); if (!b || b.height < 120) throw new Error('3D stage has no size');
      const y0 = await page.evaluate(() => scrollY); if (P.touch) await swipe(b.x + b.width * 0.7, b.y + b.height / 2, -b.width * 0.4, 0); else { await page.mouse.move(b.x + b.width * 0.7, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width * 0.3, b.y + b.height / 2, { steps: 8 }); await page.mouse.up(); }
      const y1 = await page.evaluate(() => scrollY); if (Math.abs(y1 - y0) > 8) throw new Error('the page scrolled while rotating the cloth'); await press(page.locator('#mphoto'));
    });
    let slug = 'sand-linen-handloom';
    await step('add to bag works and the bag shows a total and a checkout button', async () => {
      slug = await page.evaluate(async () => { const { PRODUCTS } = await import('/js/data.js'); const cat = await (await fetch('/api/catalog', { cache: 'no-store' })).json(); const best = cat.filter((c) => c.active && c.stock > 1).sort((a, b) => b.stock - a.stock)[0]; return PRODUCTS.find((p) => p.id === best.id).slug; });   // a saree that is really in stock
      await go('#/product/' + slug, 'product'); await page.waitForSelector('#addbag'); await press(page.locator('#addbag')); await page.waitForTimeout(600); await page.evaluate(() => document.querySelector('#bbtn').click()); await page.waitForSelector('aside.drawer[aria-label="Shopping bag"]'); const t = await page.locator('aside.drawer[aria-label="Shopping bag"]').innerText(); if (!/₹/.test(t) || !/checkout/i.test(t)) throw new Error('bag has no total or checkout button'); });
    const mobile = mob(P.name.length);
    await step('checkout asks to sign in, the code arrives and signs in', async () => { await page.evaluate(() => document.querySelector('#gochk').click()); await page.waitForSelector('#mob', { timeout: 15000 }); await page.fill('#mob', mobile); await press(page.locator('#sendotp')); await page.waitForSelector('.pill.gd b', { timeout: 15000 }); const code = (await page.locator('.pill.gd b').first().innerText()).trim(); for (let i = 0; i < 6; i++) await page.fill('#o' + i, code[i]); await page.waitForSelector('#nm', { timeout: 15000 }); });
    await step('address form accepts a PIN and fills the city', async () => { await page.fill('#nm', 'Asha Raman'); await page.fill('#ad', '12 Temple Street, Mylapore'); await page.fill('#pn', '600004'); await page.waitForFunction(() => document.querySelector('#ct') && document.querySelector('#ct').value, null, { timeout: 8000 }); });
    await step('payment succeeds and the order page shows the order number', async () => { await press(page.locator('#f2 button[type=submit]')); await page.waitForSelector('#next', { timeout: 10000 }); await press(page.locator('#next')); await page.waitForSelector('#upi', { timeout: 10000 }); await page.fill('#upi', 'success@upi'); await press(page.locator('#pay')); await page.waitForFunction(() => document.body.dataset.route === 'order' && document.querySelector('.okbanner h1'), null, { timeout: 25000 }); const t = await page.locator('.okbanner').innerText(); if (!/TPV-\d{6}/.test(t)) throw new Error('no order number on the confirmation'); });
    await step('reloading the order page still shows the order', async () => { await page.reload(); await page.waitForFunction(() => document.body.dataset.route === 'order' && document.querySelector('.okbanner h1'), null, { timeout: 20000 }); });

    // ---------------- J2: find things
    await step('search finds sarees by name and opens one', async () => { await go('#/', 'home'); const sb = P.opts.viewport.width <= 900 && P.opts.viewport.height > 540 ? page.locator('#msearch') : page.locator('#sbtn'); await press(sb); await page.waitForSelector('#sq'); await page.fill('#sq', 'banarasi'); await page.waitForSelector('.searchov .pcard', { timeout: 8000 }); const c = page.locator('.searchov .pcard a[href^="#/product/"]').first(); await press(c); await page.waitForFunction(() => /#\/product\//.test(location.hash), null, { timeout: 12000 }); });
    await step('saving a saree puts it on the wishlist page', async () => { await go('#/shop', 'shop'); await page.waitForSelector('.pcard .heart'); await press(page.locator('.pcard .heart').first()); await go('#/wishlist', 'misc'); const n = await page.locator('.pcard').count(); if (n < 1) throw new Error('wishlist is empty after saving a saree'); });

    // ---------------- J3: when things go wrong
    await step('a wrong sign-in code is explained, not silent', async () => { await go('#/product/' + slug, 'product'); await page.waitForSelector('#addbag'); await press(page.locator('#addbag')); await page.waitForTimeout(500); await ctx.clearCookies(); await page.goto('about:blank'); await go('#/checkout', 'checkout'); await page.waitForSelector('#mob', { timeout: 15000 }); await page.fill('#mob', mob(99)); await press(page.locator('#sendotp')); await page.waitForSelector('.pill.gd b'); for (let i = 0; i < 6; i++) await page.fill('#o' + i, '000000'[i]); await page.waitForFunction(() => /not right|attempt/i.test(document.querySelector('#e-otp')?.textContent || ''), null, { timeout: 8000 }); });
    await step('a failed payment says so and keeps the bag', async () => { const code = (await page.locator('.pill.gd b').first().innerText()).trim(); for (let i = 0; i < 6; i++) await page.fill('#o' + i, code[i]); await page.waitForSelector('#nm', { timeout: 12000 }); await page.fill('#nm', 'Asha Raman'); await page.fill('#ad', '12 Temple Street'); await page.fill('#pn', '600004'); await page.waitForFunction(() => document.querySelector('#ct')?.value, null, { timeout: 8000 }); await press(page.locator('#f2 button[type=submit]')); await page.waitForSelector('#next'); await press(page.locator('#next')); await page.waitForSelector('#upi'); await page.fill('#upi', 'fail@upi'); await press(page.locator('#pay')); await page.waitForFunction(() => /failed|try/i.test(document.querySelector('#payerr')?.textContent || ''), null, { timeout: 12000 }); if (!(await page.locator('#sum .li').count())) throw new Error('the bag emptied after a failed payment'); });
    await step('going offline during payment gives a human message, and recovers', async () => { try { await page.fill('#upi', 'success@upi'); await ctx.setOffline(true); await page.evaluate(() => document.querySelector('#pay').click()); await page.waitForTimeout(2500); const msg = await page.evaluate(() => (document.querySelector('#payerr')?.textContent || '') + ' ' + [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' ')); if (!msg.trim()) throw new Error('no message at all while offline (the button just seemed to do nothing)'); } finally { await ctx.setOffline(false); } });
    await step('an out-of-stock saree cannot be bought', async () => { await go('#/product/noir-mysore-silk', 'product'); const t = await page.locator('main').innerText(); if (!/sold out|out of stock|notify/i.test(t)) throw new Error('no sold-out message'); const label = await page.locator('#addbag').innerText().catch(() => ''); if (/add to bag/i.test(label) && !(await page.locator('#addbag[disabled]').count())) throw new Error('"Add to bag" is offered for a sold-out saree'); });
    await step('an unknown address shows a friendly page, not a blank one', async () => { await go('#/page/doesnotexist', 'misc'); const t = (await page.locator('main').innerText()).trim(); if (t.length < 20) throw new Error('blank page'); });
    await step('the back button goes back to the previous page', async () => { await go('#/shop', 'shop'); await page.evaluate(() => { location.hash = '#/story'; }); await page.waitForFunction(() => document.body.dataset.route === 'story'); await page.goBack(); await page.waitForFunction(() => document.body.dataset.route === 'shop', null, { timeout: 8000 }); });

    // ---------------- J4: keyboard (people who do not use a mouse)
    if (!P.touch) {
      await step('keyboard: Tab reaches the header and the focus is visible', async () => { await go('#/', 'home'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); const f = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const c = getComputedStyle(e); return { tag: e.tagName, outline: c.outlineStyle + ' ' + c.outlineWidth, shadow: c.boxShadow !== 'none' }; }); if (!f) throw new Error('nothing took focus'); if (/none/.test(f.outline) && !f.shadow) throw new Error('focused control has no visible outline'); });
      await step('keyboard: Escape closes the bag', async () => { await page.evaluate(() => document.querySelector('#bbtn').click()); await page.waitForSelector('aside.drawer.on'); await page.keyboard.press('Escape'); await page.waitForTimeout(500); if (await page.locator('aside.drawer.on').count()) throw new Error('Escape did not close the bag'); });
    }
    // ---------------- J5: turning the phone
    if (P.touch && P.opts.viewport.width < 600) {
      await step('rotating to landscape keeps the product page usable', async () => { await go('#/product/royal-blue-zari-silk', 'product'); await page.setViewportSize({ width: P.opts.viewport.height, height: P.opts.viewport.width }); await page.waitForTimeout(900); const ok = await page.locator('#addbag').first().isVisible(); await page.setViewportSize(P.opts.viewport); if (!ok) throw new Error('no add-to-bag control in landscape'); });
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${total - failed} of ${total} steps passed${failed ? `; ${failed} FAILED:` : ''}`); fails.forEach((f) => console.log('  - ' + f)); process.exit(failed ? 1 : 0);
})();

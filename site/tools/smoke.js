// End-to-end smoke test: node tools/smoke.js   (needs the server on :4173 and Playwright from ../film/node_modules)
const path = require('path'); const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const BASE = 'http://127.0.0.1:4173/'; const QA = path.join(__dirname, '..', 'qa'); fs.mkdirSync(QA, { recursive: true });
const results = []; const errors = [];
const ok = (name, pass, extra = '') => { results.push({ name, pass, extra }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : '')); };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing', '--disable-gpu-rasterization'] });
  // skip the intro and default the shop to Grid so .pcard selectors are deterministic (the 3D ring is tested separately)
  const seed = () => { try { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); if (!localStorage.getItem('tpv-view')) localStorage.setItem('tpv-view', 'grid'); } catch {} };
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addInitScript(seed); const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('requestfailed', (r) => errors.push('reqfail: ' + r.url().slice(0, 120)));
  const shot = (n) => page.screenshot({ path: path.join(QA, n + '.png') });
  const txt = (s) => page.locator(s).first().innerText();
  // the silk-curtain transition keeps the old page on screen for ~0.5 s, so wait for the new route to have rendered
  const nav = async (hash, route) => { await page.goto(BASE + hash); await page.waitForFunction((r) => document.body.dataset.route === r && !document.querySelector('#main .spin'), route); };

  // --- home
  await page.goto(BASE); await page.waitForSelector('.hero2 h1'); await page.waitForTimeout(3200);
  ok('home hero renders', (await txt('.hero2 .tagline')).includes('woven into tomorrow') && (await txt('.hero2 h1')).toLowerCase().includes('silk sarees')); await shot('01_home_hero');
  ok('WebGL silk backdrop is live', await page.evaluate(() => { const c = document.getElementById('stagebg'); return !!c && !!(c.getContext('webgl2') || c.getContext('webgl')) && !document.documentElement.classList.contains('no-gl'); }));
  await page.evaluate(() => document.querySelector('#tun').scrollIntoView()); await page.waitForTimeout(2600); await shot('02_home_tunnel');
  ok('3D silk tunnel canvas present', await page.locator('#tunc').count() === 1);
  const y0 = await page.evaluate(() => scrollY); await page.evaluate(() => { const t = document.querySelector('#tun'); scrollTo(0, t.getBoundingClientRect().top + scrollY + (t.offsetHeight - innerHeight) * .6); }); await page.waitForTimeout(1600);
  ok('tunnel caption follows scroll', (await page.locator('#tcap').innerText()).trim().length > 0, (await page.locator('#tcap').innerText()).replace(/\s+/g, ' ').slice(0, 50)); await shot('02b_home_tunnel_deep');
  await page.evaluate(() => document.querySelector('#hs').scrollIntoView()); await page.waitForTimeout(1400);
  const hx1 = await page.evaluate(() => document.querySelector('#hstrack').getBoundingClientRect().left); await page.evaluate(() => { const t = document.querySelector('#hs'); scrollTo(0, t.getBoundingClientRect().top + scrollY + (t.offsetHeight - innerHeight) * .7); }); await page.waitForTimeout(1200);
  const hx2 = await page.evaluate(() => document.querySelector('#hstrack').getBoundingClientRect().left); ok('pinned horizontal track slides on scroll', hx2 < hx1 - 60, `${Math.round(hx1)} → ${Math.round(hx2)}`); await shot('02c_home_houses');
  // --- shop filters
  await nav('#/shop', 'shop'); await page.waitForSelector('#results .pcard'); const total = await page.locator('#results .pcard').count(); const N = await page.evaluate(async () => (await import(new URL('js/data.js', location.href).href)).PRODUCTS.length); ok('shop lists all products', total === N, `count=${total} of ${N}`);
  await page.locator('input[data-k=fabric][value="Banarasi silk"]').check(); await page.waitForTimeout(150);
  const n1 = await page.locator('.pcard').count(); ok('fabric filter narrows results', n1 > 0 && n1 < total, 'banarasi=' + n1);
  await page.locator('button.sw[data-v=Maroon]').click(); await page.locator('button.chip[data-v=Bridal]').click(); await page.waitForTimeout(150);
  const n2 = await page.locator('.pcard').count(); ok('colour+occasion narrow further', n2 > 0 && n2 <= n1, 'maroon+bridal=' + n2);
  ok('URL reflects filters', page.url().includes('fabric=Banarasi') && page.url().includes('colour=Maroon') && page.url().includes('occasion=Bridal'), page.url().split('#')[1]);
  await page.selectOption('#sort', 'asc'); await page.waitForTimeout(100);
  const prices = await page.$$eval('.pcard .pr', (els) => els.map((e) => Number(e.childNodes[0].textContent.replace(/[^\d]/g, ''))));
  ok('sort price low→high', prices.every((v, i) => i === 0 || prices[i - 1] <= v), prices.join(','));
  await shot('03_shop_filtered');
  await page.goto(BASE + '#/shop?q=zzzz'); await page.waitForSelector('.empty'); ok('no-results state', (await txt('.empty h3')).includes('No sarees match'));
  // 3D ring view
  await nav('#/shop', 'shop'); await page.waitForSelector('#results .pcard'); await page.click('#vring'); await page.waitForSelector('.rc'); await page.waitForTimeout(700);
  ok('3D ring lists every saree', (await page.locator('.rc').count()) === N, 'cards=' + await page.locator('.rc').count());
  const rt1 = await page.evaluate(() => document.getElementById('rg').style.transform); await page.click('#rnext'); await page.waitForTimeout(1200); const rt2 = await page.evaluate(() => document.getElementById('rg').style.transform);
  ok('ring rotates on Next', rt1 !== rt2); await shot('03b_shop_ring');
  await page.click('#vgrid'); await page.waitForSelector('.pcard'); ok('grid toggle restores cards', (await page.locator('.pcard').count()) === N);
  await page.evaluate(() => localStorage.setItem('tpv-view', 'grid'));
  // --- product
  await page.goto(BASE + '#/product/maroon-banarasi-katan-silk'); await page.waitForSelector('.mainimg'); await page.waitForTimeout(1200);
  ok('product page renders', (await txt('.info h1')).includes('Maroon Banarasi')); ok('six gallery thumbs', await page.locator('.thumb').count() === 6);
  await page.locator('.thumb').nth(3).click(); await page.waitForTimeout(700); ok('thumb changes label', (await txt('#lbl')).includes('Border'), await txt('#lbl'));
  await page.hover('#pimg', { position: { x: 300, y: 250 } }); await page.waitForTimeout(300); await shot('04_product_zoom');
  await page.click('#m3d'); await page.waitForTimeout(2600); ok('3D drape stage opens', (await page.locator('#dstage.on').count()) === 1 && (await page.locator('#m3d').getAttribute('aria-pressed')) === 'true'); await shot('04b_product_drape');
  await page.click('#mphoto'); await page.waitForTimeout(300); ok('back to photos', (await page.locator('#dstage.on').count()) === 0);
  await page.fill('#pin', '600004'); await page.click('#pinf button'); ok('PIN serviceable', (await txt('#pinres')).includes('Serviceable'));
  await page.fill('#pin', '12'); await page.click('#pinf button'); ok('PIN invalid message', (await txt('#pinres')).includes('valid 6-digit'));
  await page.fill('#pin', '600004'); await page.click('#pinf button');
  await page.evaluate(() => scrollTo(0, document.querySelector('#addbag').getBoundingClientRect().top + scrollY + 500)); await page.waitForTimeout(600); ok('sticky buy bar appears once Add to bag scrolls away', (await page.locator('.stickybuy.on').count()) === 1);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400);
  await page.locator('[data-add=fall]').check(); await page.click('#addbag'); await page.waitForSelector('.drawer.on'); await page.waitForTimeout(500); ok('add to bag opens drawer', (await txt('.drawer.on .line h4')).includes('Maroon'));
  await shot('05_bag_drawer');
  // coupon in bag
  await page.fill('#cpn input', 'FESTIVE5'); await page.click('#cpn button'); await page.waitForTimeout(200); ok('coupon applies discount', (await txt('.drawer.on .sumrows')).includes('Discount'));
  // --- checkout
  await page.click('#gochk'); await page.waitForSelector('#f1'); ok('checkout asks sign-in', true);
  await page.fill('#mob', '9000000001'); await page.click('#sendotp'); await page.waitForSelector('#otp');
  const code = (await txt('.pill.gd b')).trim(); await page.fill('#o0', '0'); await page.fill('#o1', '0'); await page.fill('#o2', '0'); await page.fill('#o3', '0'); await page.fill('#o4', '0'); await page.fill('#o5', '0'); await page.waitForTimeout(300);
  ok('wrong OTP rejected', (await txt('#e-otp')).includes('not right') || (await txt('#e-otp')).includes('attempt'), await txt('#e-otp'));
  for (let i = 0; i < 6; i++) await page.fill('#o' + i, code[i]); await page.waitForSelector('#f2'); ok('OTP accepted, bag preserved', (await txt('#sum')).includes('Maroon'));
  await page.click('#f2 button[type=submit]'); await page.waitForTimeout(150); ok('address validation errors', (await txt('#e-nm')).length > 0);
  await page.fill('#nm', 'Demo Customer'); await page.fill('#ad', '12, Sample Street, Mylapore'); await page.fill('#pn', '600004'); await page.waitForTimeout(100); ok('city auto-fills from PIN', (await page.inputValue('#ct')) === 'Chennai');
  await page.click('#f2 button[type=submit]'); await page.waitForSelector('.opt'); await page.click('.opt[data-k=Standard]'); await page.click('#next'); await page.waitForSelector('#upi');
  await shot('06_checkout_payment');
  await page.fill('#upi', 'fail@upi'); await page.click('#pay'); await page.waitForSelector('#payerr .pill'); ok('failed payment keeps bag, no order', (await txt('#payerr')).includes('Payment failed') && (await page.evaluate(() => JSON.parse(localStorage.getItem('tpv-proto-v1')).cart.length)) === 1);
  await page.fill('#upi', 'success@upi'); await page.dblclick('#pay'); await page.waitForURL(/#\/order\//, { timeout: 8000 });
  const orderId = (await txt('.okbanner b')).trim(); ok('order confirmed after success payment', (await txt('.okbanner h1')).includes('Order confirmed'), orderId);
  const orderCount = await page.evaluate((id) => JSON.parse(localStorage.getItem('tpv-proto-v1')).orders.filter((o) => o.id === id).length, orderId); ok('double-click created only one order', orderCount === 1);
  ok('stock reduced to sold out', await page.evaluate(() => JSON.parse(localStorage.getItem('tpv-proto-v1')).overrides.p1.stock === 0));
  await shot('07_order_confirmed');
  // --- admin sees the order; advance; customer page updates
  const adm = await ctx.newPage(); adm.on('pageerror', (e) => errors.push('admin pageerror: ' + String(e).slice(0, 300))); adm.on('console', (m) => { if (m.type() === 'error') errors.push('admin console: ' + m.text().slice(0, 300)); });
  await adm.goto(BASE + '#/admin/orders'); await adm.waitForSelector('.kan'); ok('admin board shows new order', (await adm.locator('.kc', { hasText: orderId }).count()) === 1);
  await adm.locator('.kc', { hasText: orderId }).click(); await adm.waitForSelector('.drawer.on #acts button'); await adm.screenshot({ path: path.join(QA, '08_admin_order.png') });
  await adm.click('#acts button'); await adm.waitForTimeout(300); ok('admin: start processing', (await adm.locator('.drawer.on .pill').first().innerText()).includes('Processing'));
  await adm.click('#acts button'); await adm.waitForTimeout(200); ok('cannot pack before QC checklist', (await adm.locator('.drawer.on .pill').first().innerText()).includes('Processing'));
  for (let i = 0; i < 5; i++) await adm.locator(`[data-qc="${i}"]`).check();
  await adm.click('#acts button'); await adm.waitForTimeout(250); await adm.click('#acts button'); await adm.waitForTimeout(250);
  ok('admin: shipment created with AWB', (await adm.locator('.drawer.on').innerText()).includes('AWB TPV-SAMPLE'));
  await page.waitForTimeout(400); ok('customer tracking page synced from admin (cross-tab)', (await page.locator('.tl .nd.cur b').innerText()) === 'Dispatched', await page.locator('.tl .nd.cur b').innerText());
  await page.screenshot({ path: path.join(QA, '09_order_dispatched.png') });
  ok('delivery progress shows the stage reached (no drawn map)', await page.evaluate(() => { const f = document.querySelector('.tl .fill'); const done = document.querySelectorAll('.tl .nd.done').length; return !!f && done >= 1 && !document.querySelector('.mapbox'); }));
  // --- role permissions
  await adm.keyboard.press('Escape'); await adm.selectOption('#role', 'Customer Support'); await adm.goto(BASE + '#/admin/payments'); await adm.waitForTimeout(1500); ok('Customer Support denied payments', (await adm.locator('.adm-main').innerText()).toLowerCase().includes('no access'));
  await adm.selectOption('#role', 'Finance Manager'); await adm.goto(BASE + '#/admin/payments'); await adm.waitForTimeout(1500); ok('Finance Manager sees payments', (await adm.locator('.adm-main').innerText()).toLowerCase().includes('reconcil') || !(await adm.locator('.adm-main').innerText()).toLowerCase().includes('no access'));
  await adm.goto(BASE + '#/admin'); await adm.screenshot({ path: path.join(QA, '10_admin_dashboard.png') });
  await adm.selectOption('#role', 'Super Admin');
  // --- product edit from admin affects storefront
  await adm.goto(BASE + '#/admin/products'); await adm.locator('[data-p=p5]').click(); await adm.waitForSelector('#ppr'); await adm.fill('#ppr', '33333'); adm.once('dialog', (d) => d.accept()); await adm.click('#psave'); await adm.waitForTimeout(500);
  await page.goto(BASE + '#/product/emerald-peacock-border'); await page.waitForSelector('.info .price'); ok('price edit from admin visible on shop', (await txt('.info .price')).includes('33,333'));
  // --- search, wishlist, story, contact → ticket, OTP lockout
  await page.goto(BASE + '#/'); await page.waitForTimeout(500); await page.click('#sbtn'); await page.fill('#sq', 'kanchipuram'); await page.waitForTimeout(400);
  ok('search shows matching sarees', (await page.locator('.searchov .pcard').count()) >= 2, 'hits=' + (await page.locator('.searchov .pcard').count()));
  await page.fill('#sq', 'qqqq'); await page.waitForTimeout(300); ok('search no-results state', (await page.locator('.searchov').innerText()).includes('No sarees match')); await page.keyboard.press('Escape');
  await nav('#/shop', 'shop'); await page.waitForSelector('#results .pcard'); await page.locator('.pcard .heart').first().click(); await nav('#/wishlist', 'misc'); await page.waitForSelector('.pcard'); ok('wishlist keeps saved saree', (await page.locator('.pcard').count()) === 1);
  await page.goto(BASE + '#/story'); await page.waitForSelector('.story-hero'); await page.evaluate(() => window.scrollTo(0, innerHeight * 2.2)); await page.waitForTimeout(500); ok('story scroll-zoom shows a step', (await page.locator('.step').evaluateAll((els) => els.filter((e) => getComputedStyle(e).opacity === '1').length)) === 1);
  await page.goto(BASE + '#/page/contact'); await page.waitForSelector('#cf'); await page.click('#cf button'); ok('contact form validates', (await txt('#e-cn')).length > 0);
  await page.fill('#cn', 'Test Buyer'); await page.fill('#cm', '9000000002'); await page.fill('#cx', 'Do you ship to Singapore?'); await page.click('#cf button'); await page.waitForTimeout(200); ok('contact creates ticket', (await txt('#cok')).includes('ticket'));
  await adm.goto(BASE + '#/admin/support'); await adm.waitForSelector('[data-t]'); await adm.waitForTimeout(300); ok('admin support shows web-form ticket', (await adm.locator('.adm-main').innerText()).includes('Singapore'));
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('tpv-proto-v1')); s.user = null; s.cart = [{ id: 'p5', qty: 1, addons: [] }]; localStorage.setItem('tpv-proto-v1', JSON.stringify(s)); }); await page.goto(BASE + '#/checkout'); await page.reload(); await page.waitForSelector('#f1');
  await page.fill('#mob', '9000000003'); await page.click('#sendotp'); await page.waitForSelector('#otp'); for (let t = 0; t < 3; t++) { for (let i = 0; i < 6; i++) await page.fill('#o' + i, '1'); await page.waitForTimeout(150); }
  await page.waitForTimeout(1200); ok('OTP locks after 3 wrong attempts', await page.locator('#otp').count() === 0 || (await txt('#e-otp')).includes('Too many'));
  // --- extras: stylist quiz, Ctrl+K palette, light studio, compare, ambient sound, scroll thread
  await nav('#/', 'home'); await page.waitForSelector('#navFind'); await page.click('#navFind'); await page.waitForSelector('.qopt'); await page.click('.qopt[data-v=Bridal]'); await page.waitForSelector('.qsw'); await page.click('.qsw button[data-v=Maroon]'); await page.click('#qn'); await page.waitForSelector('.qopt'); await page.click('.qopt[data-v=hi]'); await page.waitForSelector('.qr'); await page.waitForTimeout(700);
  ok('stylist quiz returns three ranked sarees', (await page.locator('.qr').count()) === 3 && (await txt('.qr .mt')).toLowerCase().includes('match'), (await page.locator('.qr b').allInnerTexts()).join(' | ')); await shot('14_stylist_results');
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await page.keyboard.press('Control+k'); await page.waitForSelector('#ckq'); await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'ckq'); await page.keyboard.type('royal'); await page.waitForTimeout(300);
  const ckTexts = await page.locator('.ck-it b').allInnerTexts(); ok('Ctrl+K palette finds a saree', ckTexts.some((t) => t.includes('Royal Blue')), `typed="${await page.locator('#ckq').first().inputValue().catch(() => '?')}" items=${ckTexts.slice(0, 4).join(' | ')}`); await shot('15_palette');
  await page.keyboard.press('Enter'); await page.waitForFunction(() => location.hash.startsWith('#/product/royal-blue')); await page.waitForSelector('.lights'); await page.waitForTimeout(600);
  await page.click('.lights button[data-l=candle]'); await page.waitForTimeout(1200); ok('light studio re-lights the photo', (await page.locator('#mwrap').getAttribute('data-light')) === 'candle'); await shot('16_light_candle');
  await nav('#/shop', 'shop'); await page.waitForSelector('#results .pcard'); await page.waitForTimeout(500);
  const cmps = page.locator('#results .pcard .cmp'); for (let i = 0; i < 4; i++) { await cmps.nth(i).click(); await page.waitForTimeout(150); }
  ok('compare list caps at three sarees', (await page.locator('.cmptray.on').count()) === 1 && (await txt('#ctn')) === '3'); await page.click('#ctgo'); await page.waitForSelector('.cmp-grid'); await page.waitForTimeout(500);
  ok('compare modal shows three columns', (await page.locator('.cmp-grid .ch').count()) === 3); await shot('17_compare_modal');
  await page.locator('[data-rm]').first().click(); await page.waitForSelector('.modal.on .cmp-grid'); await page.waitForTimeout(400); ok('removing one keeps a two-way compare', (await page.locator('.modal.on .cmp-grid .ch').count()) === 2); await page.keyboard.press('Escape');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(400);
  await page.click('#ftSound'); await page.waitForTimeout(500); const snd1 = await page.locator('#dkSound').getAttribute('aria-pressed'); await page.click('#ftSound'); await page.waitForTimeout(300); const snd2 = await page.locator('#dkSound').getAttribute('aria-pressed');
  ok('ambient sound toggles on and off', snd1 === 'true' && snd2 === 'false', `${snd1} → ${snd2}`);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(500); const promise = await page.locator('#annc').innerText(); ok('promise strip states the delivery and returns rules', /Free standard delivery/.test(promise) && /7-day returns/.test(promise));
  // --- mobile (true 390px layout viewport so overflow is measurable)
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); await mob.addInitScript(seed); const m = await mob.newPage(); m.on('pageerror', (e) => errors.push('mobile pageerror: ' + String(e).slice(0, 300)));
  await m.goto(BASE); await m.waitForSelector('.hero2 h1'); await m.waitForTimeout(3200); await m.screenshot({ path: path.join(QA, '11_mobile_home.png') });
  const ovx = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok('mobile home has no horizontal scroll', ovx <= 1, 'overflow=' + ovx);
  await m.goto(BASE + '#/shop'); await m.waitForSelector('.pcard'); await m.click('#fopen'); await m.waitForTimeout(500); await m.screenshot({ path: path.join(QA, '12_mobile_filters.png') });
  await m.click('.fdone'); await m.click('#burger'); await m.waitForTimeout(500); ok('mobile menu opens', await m.locator('.drawer.left.on').count() === 1); await m.keyboard.press('Escape'); await m.goto(BASE + '#/product/maroon-banarasi-katan-silk'); await m.waitForSelector('.mainimg'); await m.waitForTimeout(800); await m.screenshot({ path: path.join(QA, '13_mobile_product.png') });
  const ovp = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok('mobile product has no horizontal scroll', ovp <= 1, 'overflow=' + ovp);
  await browser.close();
  console.log('\nERRORS:', errors.length ? '\n' + [...new Set(errors)].join('\n') : 'none');
  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(QA, 'smoke.json'), JSON.stringify({ results, errors }, null, 1));
})().catch((e) => { console.error('SMOKE CRASH', e); process.exit(1); });

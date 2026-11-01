// End-to-end test of the ONLINE storefront (real server, database, OTP sign-in, server-priced checkout, admin console).
//   cd ../app && npm run build && SEED_ADMIN_MOBILE=9000000001 PORT=8100 node server.js     (staging mode: demo OTP, mock payments)
//   node tools/smoke_online.js [http://127.0.0.1:8100/]
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const BASE = process.argv[2] || 'http://127.0.0.1:8100/';
const ADMIN = '9000000001';
const results = []; const errors = [];
const ok = (name, pass, extra = '') => { results.push({ name, pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (extra ? '  — ' + extra : '')); };
const run = Date.now() % 100000000;                                  // fresh customer numbers on every run
const mob = (n) => '98' + String(10000000 + ((run + n) % 80000000));

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const seed = () => { try { if (!localStorage.getItem('tpv-live-v1')) localStorage.setItem('tpv-live-v1', JSON.stringify({ introSeen: true })); if (!localStorage.getItem('tpv-view')) localStorage.setItem('tpv-view', 'grid'); } catch {} };
  const open = async (label) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.addInitScript(seed); const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(label + ' pageerror: ' + String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of (400|401|402|403|404|409|429)/.test(m.text())) errors.push(label + ' console: ' + m.text().slice(0, 300)); });
    page.on('dialog', (d) => d.accept());
    return { ctx, page };
  };
  const nav = async (page, hash, route) => { await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' }); await page.waitForFunction((r) => document.body.dataset.route === r && !document.querySelector('#main .spin'), route, { timeout: 20000 }); };
  const api = (page, url, init) => page.evaluate(async ([u, i]) => { const r = await fetch(u, { cache: "no-store", ...(i || {}), headers: { 'x-tp': '1', 'content-type': 'application/json', ...((i || {}).headers || {}) } }); return { status: r.status, body: await r.json().catch(() => null) }; }, [url, init]);

  async function signInAtCheckout(page, mobile) {
    await page.waitForSelector('#mob'); await page.fill('#mob', mobile); await page.click('#sendotp');
    await page.waitForSelector('.pill.gd b'); const code = (await page.locator('.pill.gd b').first().innerText()).trim();
    for (let i = 0; i < 6; i++) await page.fill('#o' + i, code[i]);
    await page.waitForSelector('#nm', { timeout: 10000 });
  }
  async function toPayment(page) {
    await page.fill('#nm', 'Asha Raman'); await page.fill('#ad', '12 Temple Street, Mylapore'); await page.fill('#pn', '600004'); await page.waitForFunction(() => document.querySelector('#ct').value);
    await page.click('#f2 button[type=submit]'); await page.waitForSelector('#next'); await page.click('#next'); await page.waitForSelector('#upi');
  }
  async function addToBag(page, slug) { await nav(page, '#/product/' + slug, 'product'); await page.click('#addbag'); await page.waitForSelector('#gochk'); await page.click('#gochk'); await page.waitForFunction(() => document.body.dataset.route === 'checkout'); }

  // ---------- 1. shopper A: mode, sign-in, checkout, order
  const A = await open('A'); const a = A.page; const mobA = mob(1);
  await a.goto(BASE); await a.waitForSelector('.hero2 h1');
  ok('online mode with staging banner (no demo controls)', await a.evaluate(() => window.TP_CONFIG.api === true && document.body.dataset.mode === 'staging' && /STAGING/.test(document.querySelector('#demobar').textContent) && !document.querySelector('#resetDemo') && !document.querySelector('#admlink')));
  ok('footer has no prototype wording', !(await a.locator('#ftr').innerText()).match(/concept prototype|sample products/i));
  const cat = (await api(a, '/api/catalog')).body; const p10 = cat.find((x) => x.id === 'p10'); const stock0 = p10.stock;
  await addToBag(a, 'ivory-organza-gold-edge');
  await a.waitForSelector('#mob'); ok('checkout asks for sign-in', await a.locator('#mob').count() === 1);
  await a.fill('#mob', mobA); await a.click('#sendotp'); await a.waitForSelector('.pill.gd b');
  const code = (await a.locator('.pill.gd b').first().innerText()).trim();
  const wrong = code === '123456' ? '654321' : '123456';
  for (let i = 0; i < 6; i++) await a.fill('#o' + i, wrong[i]);
  await a.waitForFunction(() => /not right/.test(document.querySelector('#e-otp').textContent), null, { timeout: 8000 });
  ok('wrong code rejected by the server', /attempts? left/.test(await a.locator('#e-otp').innerText()));
  for (let i = 0; i < 6; i++) await a.fill('#o' + i, code[i]);
  await a.waitForSelector('#nm', { timeout: 10000 });
  const cookies = await A.ctx.cookies(); const sid = cookies.find((c) => c.name === 'tp_sid');
  ok('session cookie is HttpOnly + SameSite', !!sid && sid.httpOnly === true && sid.sameSite === 'Lax');
  ok('bag survived sign-in', (await a.locator('#sum .li').count()) === 1);
  await toPayment(a);
  ok('staging shows the test-payment notice', /TEST MODE/.test(await a.locator('.testmode').innerText()));
  await a.fill('#upi', 'fail@upi'); await a.click('#pay');
  await a.waitForFunction(() => document.querySelector('#payerr')?.textContent.includes('failed'), null, { timeout: 10000 });
  ok('failed payment keeps the bag and creates no order', (await api(a, '/api/orders/mine')).body.orders.length === 0);
  await a.fill('#upi', 'success@upi'); await a.click('#pay');
  await a.waitForFunction(() => document.body.dataset.route === 'order' && document.querySelector('.okbanner h1'), null, { timeout: 20000 });
  const orderId = (await a.locator('.okbanner .muted b').first().innerText()).trim();
  ok('order confirmed with a real sequential id', /^TPV-\d{6}$/.test(orderId) && /Order confirmed/.test(await a.locator('.okbanner h1').innerText()), orderId);
  ok('order page says TEST ORDER, not demo/sample', (await a.locator('.okbanner').innerText()).includes('TEST ORDER') && !/SAMPLE ORDER DATA|DEMO ORDER/.test(await a.locator('main').innerText()));
  ok('no "Demo controls" on a real order', await a.locator('.democtl').count() === 0);
  ok('server took the stock', (await api(a, '/api/catalog')).body.find((x) => x.id === 'p10').stock === stock0 - 1);
  ok('bag emptied after payment', await a.evaluate(() => JSON.parse(localStorage.getItem('tpv-live-v1')).cart.length === 0));
  ok('no orders or user kept in browser storage', await a.evaluate(() => { const s = JSON.parse(localStorage.getItem('tpv-live-v1')); return !('orders' in s) && !('user' in s) && !('overrides' in s); }));
  await a.reload(); await a.waitForFunction(() => document.body.dataset.route === 'order' && document.querySelector('.okbanner h1'), null, { timeout: 15000 });
  ok('order survives a reload (read from the server)', (await a.locator('.okbanner .muted b').first().innerText()).trim() === orderId);
  await nav(a, '#/account', 'misc'); await a.waitForSelector('a[href^="#/order/"]');
  ok('signed-in account lists the order', (await a.locator('main').innerText()).includes(orderId) && (await a.locator('main').innerText()).includes('+91 ' + mobA));

  // ---------- 2. shopper B: guest tracking with masked details
  const B = await open('B'); const b = B.page;
  await nav(b, '#/account', 'misc'); await b.fill('#oid', orderId); await b.fill('#om', mobA.slice(-4)); await b.click('#trk button[type=submit]');
  await b.waitForFunction(() => document.body.dataset.route === 'order' && document.querySelector('.okbanner h1'), null, { timeout: 15000 });
  const guestText = await b.locator('main').innerText();
  ok('guest can track by order number + last 4 digits', guestText.includes(orderId));
  ok('guest view hides address and full name', !guestText.includes('Mylapore') && !guestText.includes('Asha Raman') && !guestText.includes(mobA));
  await nav(b, '#/account', 'misc'); await b.fill('#oid', orderId); await b.fill('#om', '0000'); await b.click('#trk button[type=submit]');
  await b.waitForFunction(() => document.querySelector('#trkerr').textContent.length > 0);
  ok('wrong last-4 is refused', /could not find/i.test(await b.locator('#trkerr').innerText()));

  // ---------- 3. the last piece: two shoppers, one saree
  const C = await open('C'), D = await open('D'); const c = C.page, d = D.page; await c.goto(BASE); await d.goto(BASE);
  const p1stock = (await api(c, '/api/catalog')).body.find((x) => x.id === 'p1').stock;
  await addToBag(c, 'maroon-banarasi-katan-silk'); await addToBag(d, 'maroon-banarasi-katan-silk');
  await signInAtCheckout(c, mob(3)); await signInAtCheckout(d, mob(4)); await toPayment(c); await toPayment(d);
  await c.fill('#upi', 'success@upi'); await d.fill('#upi', 'success@upi');
  await c.click('#pay'); await c.waitForFunction(() => document.body.dataset.route === 'order', null, { timeout: 20000 });
  await d.click('#pay'); await d.waitForFunction(() => /sold out|no longer available/i.test(document.querySelector('#payerr')?.textContent || ''), null, { timeout: 15000 });
  ok('second buyer of a one-of-one piece is told it just sold out', p1stock === 1 && /sold out|no longer available/i.test(await d.locator('#payerr').innerText()));
  ok('…and the sold-out piece was removed from their bag', await d.evaluate(() => JSON.parse(localStorage.getItem('tpv-live-v1')).cart.length === 0));

  // ---------- 4. staff console
  const E = await open('E'); const e = E.page;
  await nav(e, '#/admin', 'admin');
  ok('admin asks staff to sign in first', await e.locator('#adsi').count() === 1);
  await e.click('#adsi'); await e.fill('#am', ADMIN); await e.click('#ago'); await e.waitForSelector('.pill.gd b');
  const acode = (await e.locator('.pill.gd b').first().innerText()).trim(); await e.fill('#ac', acode); await e.click('#ago');
  await e.waitForSelector('.adm', { timeout: 15000 });
  ok('staff number opens the console as Super Admin', /Super Admin/.test(await e.locator('.adm-top').innerText()) && await e.locator('#role').count() === 0);
  ok('console has no sample-data label or role simulator', !/SAMPLE DATA/.test(await e.locator('.adm-top').innerText()));
  const stats = (await api(e, '/api/admin/bootstrap')).body.stats;
  const kpiOrders = Number((await e.locator('.kpi').nth(1).locator('b').innerText()).replace(/\D/g, ''));
  ok('dashboard order count comes from the database', kpiOrders === stats.total && stats.total >= 2, `kpi=${kpiOrders} db=${stats.total}`);
  await nav(e, '#/admin/orders', 'admin'); await e.waitForSelector('.kan .kc[data-o]');
  ok('admin board shows the shopper’s order', await e.locator(`.kc[data-o="${orderId}"]`).count() === 1);
  await e.click(`.kc[data-o="${orderId}"]`); await e.waitForSelector('#acts button');
  ok('admin sees the full customer details (Super Admin)', (await e.locator('.drawer').innerText()).includes('+91 ' + mobA));
  await e.click('#acts button'); await e.waitForFunction((id) => document.querySelector('.drawer')?.innerText.includes('Processing'), orderId, { timeout: 10000 });
  await nav(a, '#/order/' + orderId, 'order'); await a.waitForSelector('.tl .nd.cur');
  ok('customer’s order page shows the stage the admin set', (await a.locator('.tl .nd.cur b').innerText()).trim() === 'Processing');
  await e.keyboard.press('Escape');
  await nav(e, '#/admin/products', 'admin'); await e.waitForSelector('tr[data-p="p10"]'); await e.click('tr[data-p="p10"]'); await e.waitForSelector('#ppr'); await e.fill('#ppr', '12345'); await e.click('#psave');
  await e.waitForTimeout(800); await a.waitForTimeout(1700);
  await nav(a, '#/product/ivory-organza-gold-edge', 'product');
  ok('price edited in admin is live on the storefront', /12,345/.test(await a.locator('.price').innerText()));
  const t = await api(a, '/api/checkout/intent', { method: 'POST', body: JSON.stringify({ items: [{ id: 'p10', qty: 1 }], address: { line: '12 Temple Street', city: 'Chennai', pin: '600004' }, customer: { name: 'Asha Raman' }, key: 'x' + run }) });
  ok('the server charges the edited price', t.status === 200 && t.body.totals.sub === 12345, JSON.stringify(t.body.totals));

  // ---------- 5. contact form → support inbox; customers cannot enter the console
  await nav(b, '#/page/contact', 'misc'); await b.fill('#cn', 'Meera'); await b.fill('#cm', mob(9)); await b.fill('#cx', 'When will my saree ship? Order ' + orderId); await b.click('#cf button[type=submit]');
  await b.waitForSelector('#cok .pill.ok'); ok('contact form creates a real ticket', /reference T-/.test(await b.locator('#cok').innerText()));
  await nav(e, '#/admin/support', 'admin'); await e.waitForSelector('.g-sup');
  ok('support inbox shows the web-form ticket', (await e.locator('main').innerText()).includes('When will my saree ship'));
  await nav(a, '#/admin', 'admin');
  ok('a customer number gets "No access", not the console', /No access/.test(await a.locator('main').innerText()) && await a.locator('.adm').count() === 0);
  const forged = await api(a, '/api/admin/products/p10', { method: 'PATCH', body: JSON.stringify({ price: 100 }) });
  ok('and the API refuses their admin calls', forged.status === 403);

  ok('no console or page errors anywhere', errors.length === 0, errors.slice(0, 4).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r.pass); console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed'); process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('RUN ERROR', e); process.exit(2); });

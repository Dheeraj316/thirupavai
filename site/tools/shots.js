// Visual review screenshots (desktop full-page + mobile). node tools/shots.js
const path = require('path'); const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const BASE = 'http://127.0.0.1:4173/'; const QA = path.join(__dirname, '..', 'qa'); fs.mkdirSync(QA, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing', '--disable-gpu-rasterization'] });
  const errs = [];
  const run = async (name, vp, mobile, steps) => {
    const c = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile }); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(name + ' ' + String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ' console ' + m.text().slice(0, 200)); });
    await c.addInitScript(() => { try { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); } catch {} });
    const settle = async () => { await p.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); }); await p.waitForTimeout(900); };
    await steps(p, async (n, full = true) => { if (full) await settle(); await p.screenshot({ path: path.join(QA, name + '_' + n + '.png'), fullPage: full }); }); await c.close();
  };
  const go = async (p, h, sel) => { await p.goto(BASE + h); await p.waitForSelector(sel); await p.waitForTimeout(1500); };
  await run('d', { width: 1440, height: 900 }, false, async (p, s) => {
    await go(p, '', '.hero h1'); await s('home'); await go(p, '#/story', '.story-hero'); await p.evaluate(() => window.scrollTo(0, innerHeight * 1.9)); await p.waitForTimeout(500); await s('story_mid', false);
    await go(p, '#/product/garnet-brocade-banarasi', '.mainimg'); await p.waitForTimeout(1500); await s('product');
    await go(p, '#/admin/products', '.tbl'); await p.locator('[data-p=p2]').click(); await p.waitForSelector('#psave'); await s('admin_product', false);
    await p.keyboard.press('Escape'); await go(p, '#/admin/roles', '.matrix'); await s('admin_roles', false);
    await go(p, '#/admin/support', '[data-t]'); await s('admin_support', false); await go(p, '#/admin/payments', '.tbl'); await s('admin_payments', false);
    await go(p, '#/account', '#trk'); await s('account', false);
  });
  await run('m', { width: 390, height: 844 }, true, async (p, s) => {
    await go(p, '', '.hero h1'); await s('home', false); await p.evaluate(() => window.scrollTo(0, innerHeight * 1.05)); await p.waitForTimeout(1800); await s('gallery', false);
    await go(p, '#/shop', '.pcard'); await s('shop', false); await go(p, '#/product/maroon-banarasi-katan-silk', '.mainimg'); await s('product', false);
    await p.evaluate(() => document.querySelector('#addbag').click()); await p.waitForSelector('.drawer.on'); await p.waitForTimeout(600); await s('bag', false);
    await go(p, '#/admin', '.kpis'); await s('admin', false);
  });
  await b.close(); console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
})();

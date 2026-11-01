// Finds elements wider than a 390px viewport on every route.   node tools/overflow.js [width]
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const W = Number(process.argv[2] || 390);
const ROUTES = ['', '#/shop', '#/product/maroon-banarasi-katan-silk', '#/story', '#/wishlist', '#/account', '#/page/faqs', '#/page/contact', '#/admin', '#/admin/orders', '#/admin/products', '#/admin/payments', '#/admin/support', '#/admin/roles'];
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-compositing', '--disable-gpu-rasterization'] });
  const c = await b.newContext({ viewport: { width: W, height: 844 } }); const p = await c.newPage();
  await c.addInitScript(() => { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); });
  for (const r of ROUTES) {
    await p.goto('http://127.0.0.1:4173/' + r); await p.waitForTimeout(r === '' ? 1800 : 1700);
    const res = await p.evaluate((W) => {
      const over = document.documentElement.scrollWidth - W; if (over <= 1) return { over: 0 };
      const bad = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1 && getComputedStyle(e).position !== 'fixed'; })
        .filter((e) => !e.closest('.drawer,.modal,.searchov,.intro,.toasts,#overlays,.kan,.scroll-x,.thumbs,.adm-side')).slice(0, 10).map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : ''} right=${Math.round(e.getBoundingClientRect().right)}`);
      return { over, bad };
    }, W);
    console.log((res.over ? 'OVERFLOW ' : 'ok       ') + (r || '#/') + (res.over ? `  +${res.over}px  ${res.bad.join(' | ')}` : ''));
  }
  await b.close();
})();


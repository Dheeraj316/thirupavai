// node tools/probe.js "<hash>" "<selector to scroll to>" x y   -> prints the elements stacked at (x,y)
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const [hash, sel, x, y] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-compositing', '--disable-gpu-rasterization'] });
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
  await c.addInitScript(() => { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); });
  await p.goto('http://127.0.0.1:4173/' + hash); await p.waitForTimeout(2500);
  await p.evaluate((s) => { const e = document.querySelector(s); scrollTo(0, e.getBoundingClientRect().top + scrollY); }, sel); await p.waitForTimeout(1800);
  const r = await p.evaluate(([x, y]) => document.elementsFromPoint(+x, +y).slice(0, 8).map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.split(' ').join('.') : ''} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}] bg=${cs.backgroundColor} op=${cs.opacity}`; }), [x, y]);
  console.log(r.join('\n')); await b.close();
})();

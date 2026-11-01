// Visual look: node tools/look.js <name> <hash> <width> <height> "<sel>@<frac>,<sel>@<frac>,..."   -> qa/look_<name>_<n>.png
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const [name, hash = '', W = '1440', H = '900', spec = '@0'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing', '--disable-gpu-rasterization'] });
  const c = await b.newContext({ viewport: { width: +W, height: +H }, hasTouch: +W < 800 }); const p = await c.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 240))); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 240)); });
  await c.addInitScript(() => { try { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); } catch {} });
  await p.goto('http://127.0.0.1:4173/' + hash); await p.waitForTimeout(2600);
  let n = 0;
  for (const part of spec.split(',')) {
    const [sel, frac = '0'] = part.split('@'); n++;
    await p.evaluate(([sel, f]) => { const el = sel ? document.querySelector(sel) : null; const top = el ? el.getBoundingClientRect().top + scrollY : 0; const h = el ? el.offsetHeight - innerHeight : 0; scrollTo(0, top + Math.max(0, h) * f + (el && h < 0 ? 0 : 0)); }, [sel, +frac]);
    await p.waitForTimeout(1900); await p.screenshot({ path: path.join(__dirname, '..', 'qa', `look_${name}_${n}.png`) });
  }
  console.log('errors:', errs.length ? '\n' + [...new Set(errs)].join('\n') : 'none'); await b.close();
})();

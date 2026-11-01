// Element close-up: node tools/clip.js <name> <hash> <width> <height> "<selector>"   -> qa/clip_<name>.png (2x)
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const [name, hash = '', W = '1440', H = '900', sel = 'body'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2 }); const p = await c.newPage();
  await c.addInitScript(() => { try { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); } catch {} });
  await p.goto('http://127.0.0.1:4173/' + hash); await p.waitForTimeout(2200);
  const el = await p.$(sel); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(1800);
  await el.screenshot({ path: path.join(__dirname, '..', 'qa', `clip_${name}.png`) }); await b.close(); console.log('ok');
})();

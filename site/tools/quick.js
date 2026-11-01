const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-compositing', '--disable-gpu-rasterization'] });
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); await c.addInitScript(() => { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); });
  await p.goto('http://127.0.0.1:4173/#/admin/roles'); await p.waitForSelector('.matrix'); await p.screenshot({ path: path.join(__dirname, '..', 'qa', 'q_roles.png') });
  await p.goto('http://127.0.0.1:4173/#/product/maroon-banarasi-katan-silk'); await p.waitForSelector('#drape'); await p.evaluate(() => document.querySelector('#drape').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1800);
  const box = await p.locator('#drape').boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 30, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(__dirname, '..', 'qa', 'q_drape.png') }); await b.close();
})();

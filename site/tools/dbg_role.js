const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
(async () => {
  const b = await chromium.launch({ executablePath: CHROME }); const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
  p.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 200)));
  await p.goto('http://127.0.0.1:4173/#/admin/orders'); await p.waitForSelector('.kan');
  await p.selectOption('#role', 'Customer Support'); await p.waitForTimeout(300);
  console.log('role in state:', await p.evaluate(() => JSON.parse(localStorage.getItem('tpv-proto-v1')).role), '| select value:', await p.inputValue('#role'));
  console.log('orders page text:', (await p.locator('.adm-main').innerText()).slice(0, 120).replace(/\n/g, ' | '));
  await p.goto('http://127.0.0.1:4173/#/admin/payments'); await p.waitForTimeout(500);
  console.log('payments page text:', (await p.locator('.adm-main').innerText()).slice(0, 160).replace(/\n/g, ' | '));
  console.log('role now:', await p.inputValue('#role'));
  await b.close();
})();

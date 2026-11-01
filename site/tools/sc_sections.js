// screencast frame rate while scrolling the houses track, with optional style overrides: node tools/sc_sections.js [css]
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const extra = process.argv[2] || '';
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: (process.env.FLAGS || '--ignore-gpu-blocklist --enable-gpu-rasterization').split(' ') });
  const c = await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1.3333 }); const p = await c.newPage();
  await c.addInitScript(() => { try { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); } catch {} });
  await p.goto('http://127.0.0.1:4173/#/'); await p.waitForTimeout(1500); await p.evaluate(() => window.dispatchEvent(new Event('pointerdown'))); await p.waitForTimeout(2500);
  if (extra) await p.addStyleTag({ content: extra });
  const cdp = await c.newCDPSession(p); let n = 0, first = 0, last = 0;
  cdp.on('Page.screencastFrame', (f) => { n++; if (!first) first = f.metadata.timestamp; last = f.metadata.timestamp; cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  const SEL = process.argv[3] || '#hs'; const hs = await p.evaluate((s) => document.querySelector(s).getBoundingClientRect().top + scrollY, SEL) - (SEL === '#hs' ? 0 : 300), hh = SEL === '#hs' ? await p.evaluate(() => document.querySelector('#hs').offsetHeight - innerHeight) : 900;
  await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), hs); await p.waitForTimeout(500);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const t0 = Date.now(); while (Date.now() - t0 < 5000) { const pr = (Date.now() - t0) / 5000; await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), hs + hh * pr); }
  await cdp.send('Page.stopScreencast'); console.log((extra || 'default').slice(0, 40).padEnd(40), (n / (last - first)).toFixed(1), 'fps'); await b.close();
})();

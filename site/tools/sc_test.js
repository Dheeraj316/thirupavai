// CDP screencast throughput test: node tools/sc_test.js [W] [H] [quality]
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const W = +(process.argv[2] || 1920), H = +(process.argv[3] || 1080), Q = +(process.argv[4] || 85);
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'], headless: true });
  const c = await b.newContext({ viewport: { width: W, height: H } }); const p = await c.newPage();
  await c.addInitScript(() => { try { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); } catch {} });
  await p.goto('http://127.0.0.1:4173/#/'); await p.waitForTimeout(3000);
  const cdp = await c.newCDPSession(p); let n = 0, bytes = 0, first = 0, last = 0;
  cdp.on('Page.screencastFrame', (f) => { n++; bytes += f.data.length; if (!first) first = f.metadata.timestamp; last = f.metadata.timestamp; cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: Q, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  // keep the page animating: scroll + mouse moves for 6 s
  const t0 = Date.now(); let y = 0;
  while (Date.now() - t0 < 6000) { y += 18; await p.evaluate((yy) => scrollTo(0, yy), y); await p.mouse.move(400 + (y % 600), 300 + (y % 200)); await p.waitForTimeout(16); }
  await cdp.send('Page.stopScreencast');
  console.log(`${W}x${H} q${Q}: ${n} frames in ${(last - first).toFixed(2)} s = ${(n / (last - first)).toFixed(1)} fps, ${(bytes * 0.75 / n / 1024).toFixed(0)} KB/frame`);
  await b.close();
})();

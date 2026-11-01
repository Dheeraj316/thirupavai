// Measure rAF fps + WebGL renderer for a launch config:  node tools/fps.js shell|chrome [W] [H]
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'film', 'node_modules', 'playwright'));
const mode = process.argv[2] || 'shell', W = +(process.argv[3] || 1280), H = +(process.argv[4] || 720);
const SHELL = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const args = mode === 'shell' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing', '--disable-gpu-rasterization'] : ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
  const b = await chromium.launch({ executablePath: mode === 'shell' ? SHELL : CHROME, args, headless: true });
  const c = await b.newContext({ viewport: { width: W, height: H } }); const p = await c.newPage();
  await c.addInitScript(() => { try { const k = 'tpv-proto-v1'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.introSeen = true; localStorage.setItem(k, JSON.stringify(s)); } catch {} });
  await p.goto('http://127.0.0.1:4173/#/'); await p.waitForTimeout(3500);
  await p.mouse.move(300, 300); await p.evaluate(() => scrollTo(0, 400));  // trigger the lazy WebGL gate
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => new Promise((res) => { const gl = document.createElement('canvas').getContext('webgl'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); const rend = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a'; let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res({ fps: +(n / 3).toFixed(1), rend }); })(); }));
  console.log(mode, W + 'x' + H, JSON.stringify(r)); await b.close();
})();

// Motion helpers: custom cursor, magnetic buttons, kinetic text, silk-curtain page transition, gold-thread burst.
const fine = () => matchMedia('(hover:hover) and (pointer:fine)').matches;
const reduce = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initCursor() {
  return;   // a second cursor drawn over the real one read as a gimmick; the system cursor is the cursor
  if (!fine() || reduce()) return;
  const dot = document.createElement('div'), ring = document.createElement('div'); dot.className = 'cur-dot'; ring.className = 'cur-ring'; document.body.append(ring, dot);
  let x = -100, y = -100, rx = -100, ry = -100;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px,${y}px)`; const t = e.target; ring.classList.toggle('hot', !!t.closest?.('a,button,[role=button],.pcard,.slab,.rc,summary,.opt,select,label.check')); ring.classList.toggle('txt', !!t.closest?.('input,textarea')); }, { passive: true });
  (function loop() { rx += (x - rx) * .18; ry += (y - ry) * .18; ring.style.transform = `translate(${rx}px,${ry}px)`; requestAnimationFrame(loop); })();
  document.addEventListener('pointerleave', () => { ring.style.opacity = 0; dot.style.opacity = 0; }); document.addEventListener('pointerenter', () => { ring.style.opacity = ''; dot.style.opacity = ''; });
}

// magnetic pull on buttons / icon buttons (event delegation so dynamic content works)
export function initMagnetic() {
  if (!fine() || reduce()) return; let cur = null;
  document.addEventListener('pointermove', (e) => {
    const b = e.target.closest?.('.btn,.ib'); if (cur && cur !== b) { cur.style.transform = ''; cur = null; }
    if (!b) return; cur = b; const r = b.getBoundingClientRect(); const dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    b.style.transform = `translate(${dx * 10}px,${dy * 8}px)`;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (cur) { cur.style.transform = ''; cur = null; } });
}

// wrap [data-split] text into words/letters for the kinetic reveal (keeps <i class="gl"> etc.)
export function splitText(root = document) {
  $$('[data-split]', root).forEach((el) => {
    if (el.dataset.done) return; el.dataset.done = 1; let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((tok) => { if (!tok) return; if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; } const w = document.createElement('span'); w.className = 'w'; [...tok].forEach((c) => { const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i++); s.textContent = c; w.appendChild(s); }); frag.appendChild(w); });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el); el.classList.add('split'); el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim()); $$('.w', el).forEach((w) => w.setAttribute('aria-hidden', 'true'));
  });
}
export function observeReveal(root = document) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  $$('.reveal,.split', root).forEach((e) => io.observe(e));
}

// 3D tilt + glare for an element (sets --mx/--my for the CSS glare)
export function tilt(box, { rx = 7, ry = 6, lift = 0 } = {}) {
  if (!fine() || reduce()) return;
  box.addEventListener('pointermove', (e) => { const r = box.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; box.style.setProperty('--mx', x * 100 + '%'); box.style.setProperty('--my', y * 100 + '%'); box.style.transform = `perspective(900px) rotateY(${(x - .5) * rx * 2}deg) rotateX(${-(y - .5) * ry * 2}deg) translateZ(${lift}px)`; });
  box.addEventListener('pointerleave', () => { box.style.transform = ''; });
}

// ---------- silk-curtain page transition (raw WebGL, from the film)
const CFS = `precision highp float; uniform vec2 uRes; uniform float uP, uT;
float edge(float y, float t, float s){ return sin(y*7.+t*2.+s)*0.035 + sin(y*17.-t*3.+s*2.)*0.012; }
void main(){ vec2 uv = gl_FragCoord.xy/uRes; float x = uv.x;
  float lead = 1.45 - 3.9*uP; float trail = lead + 1.55; float lw = lead + edge(uv.y, uT, 0.); float tw = trail + edge(uv.y, uT, 3.);
  float inside = smoothstep(lw-0.002, lw+0.004, x) * (1.-smoothstep(tw-0.004, tw+0.002, x)); if(inside<=0.001){ gl_FragColor=vec4(0.); return; }
  float fold = sin(x*38. + sin(uv.y*3.+uT)*1.2); float fold2 = sin(x*91. + uv.y*4.);
  vec3 base = mix(vec3(.10,.022,.058), vec3(.36,.075,.19), 0.5+0.5*fold); float sheen = pow(max(0.,fold),6.)*0.34 + pow(max(0.,fold2),10.)*0.06; vec3 col = base + sheen*vec3(1.,.80,.58);
  float dl = x-lw, dt = tw-x; float dash = 0.55+0.45*step(0.5, fract(uv.y*120.));
  float z1 = smoothstep(0.0035,0.0015,abs(dl-0.040)) + smoothstep(0.0035,0.0015,abs(dt-0.040)); float z2 = smoothstep(0.0022,0.0008,abs(dl-0.058))*dash + smoothstep(0.0022,0.0008,abs(dt-0.058))*dash;
  col = mix(col, vec3(0.86,0.70,0.40), clamp(z1*0.95+z2*0.8,0.,1.)); col *= 0.85 + 0.15*smoothstep(0.0,0.08,min(dl,dt)); gl_FragColor = vec4(col*inside, inside); }`;
let gl, prog, loc, cvs, ready = false;
function setup() {
  if (ready) return true; cvs = document.getElementById('curtain'); if (!cvs) return false;
  gl = cvs.getContext('webgl', { premultipliedAlpha: true, alpha: true }); if (!gl) return false;
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
  prog = gl.createProgram(); gl.attachShader(prog, mk(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }')); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, CFS)); gl.linkProgram(prog); gl.useProgram(prog);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); const a = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  loc = { res: gl.getUniformLocation(prog, 'uRes'), p: gl.getUniformLocation(prog, 'uP'), t: gl.getUniformLocation(prog, 'uT') }; ready = true; return true;
}
const draw = (p, t) => { const w = Math.round(innerWidth * .6), h = Math.round(innerHeight * .6); if (cvs.width !== w) { cvs.width = w; cvs.height = h; } gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform2f(loc.res, w, h); gl.uniform1f(loc.p, p); gl.uniform1f(loc.t, t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
const tween = (a, b, ms, step) => new Promise((res) => { const t0 = performance.now(); (function f(now) { const k = Math.min(1, (now - t0) / ms); const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; step(a + (b - a) * e, now / 1000); k < 1 ? requestAnimationFrame(f) : res(); })(t0); });
export const curtain = {
  async cover() { if (reduce() || !setup()) return; cvs.style.visibility = 'visible'; await tween(0, .5, 480, draw); },
  async reveal() { if (reduce() || !ready) return; await tween(.5, 1, 620, draw); cvs.style.visibility = 'hidden'; },
};

// ---------- gold-thread burst (celebration on order confirmed)
export function burst(x = innerWidth / 2, y = innerHeight / 3) {
  if (reduce()) return; const c = document.createElement('canvas'); c.className = 'burst'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c); const g = c.getContext('2d');
  const P = [...Array(150)].map(() => { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 9; return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, l: 0, life: 70 + Math.random() * 60, w: 1 + Math.random() * 2.2, len: 8 + Math.random() * 22, h: 38 + Math.random() * 14 }; });
  (function f() { g.clearRect(0, 0, c.width, c.height); let alive = 0; for (const p of P) { p.l++; if (p.l > p.life) continue; alive++; p.vy += .22; p.vx *= .985; p.x += p.vx; p.y += p.vy; const a = 1 - p.l / p.life; g.strokeStyle = `hsla(${p.h},75%,${60 + a * 20}%,${a})`; g.lineWidth = p.w; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * p.len / 8, p.y - p.vy * p.len / 8); g.stroke(); } alive ? requestAnimationFrame(f) : c.remove(); })();
}

// lotus motif path for the intro (same geometry as the film's golden thread)
export function lotusPath() {
  const pts = [[0, 0]]; const bez = (p0, p1, p2, p3, n) => { for (let i = 1; i <= n; i++) { const t = i / n, a = 1 - t; pts.push([a * a * a * p0[0] + 3 * a * a * t * p1[0] + 3 * a * t * t * p2[0] + t * t * t * p3[0], a * a * a * p0[1] + 3 * a * a * t * p1[1] + 3 * a * t * t * p2[1] + t * t * t * p3[1]]); } };
  for (const L of [{ n: 12, R: 1, w: .30, r0: .2, rot: 0 }, { n: 8, R: .76, w: .38, r0: .15, rot: .2 }, { n: 6, R: .5, w: .46, r0: .1, rot: .5 }]) for (let k = 0; k < L.n; k++) { const th = L.rot + k / L.n * 6.2832, P = (a, r) => [Math.cos(a) * r, Math.sin(a) * r]; const B = P(th, L.r0), T = P(th, L.R); bez(B, P(th - L.w, L.R * .55), P(th - L.w * .45, L.R * .92), T, 16); bez(T, P(th + L.w * .45, L.R * .92), P(th + L.w, L.R * .55), B, 16); }
  for (let i = 0; i <= 80; i++) { const a = i / 80 * 6.2832; pts.push([Math.cos(a) * 1.12, Math.sin(a) * 1.12]); }
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { d: 'M' + pts.map((p) => `${(p[0] * 100 + 120).toFixed(1)} ${(p[1] * 100 + 120).toFixed(1)}`).join(' L'), len: Math.round(len * 100) };
}

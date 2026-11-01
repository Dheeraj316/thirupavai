// Real-time cloth (vertex-displaced planes, three.js). Used for the home "silk gallery" and the product "drape preview".
import * as THREE from '../vendor/three/three.module.js';
import { motionReduced } from './gate.js';

const VERT = `
uniform float uT, uSeed, uAmp, uW, uH;
varying vec2 vUv; varying vec3 vN;
void main(){
  vUv = uv; float fx = uv.x, fy = uv.y;
  float a1 = fx*3.1 + uT*1.10 + uSeed, a2 = fy*2.3 - uT*0.90 + uSeed*1.7, a3 = (fx+fy)*5.0 + uT*1.6;
  float w = sin(a1)*0.50 + sin(a2)*0.30 + sin(a3)*0.12;
  float dwx = (cos(a1)*3.1*0.50 + cos(a3)*5.0*0.12), dwy = (cos(a2)*2.3*0.30 + cos(a3)*5.0*0.12);
  float k = uAmp*(0.45+0.55*abs(fx-0.5)*2.0);
  vec3 p = position; p.z += w*k;
  vN = normalMatrix * normalize(vec3(-dwx*k/uW, -dwy*k/uH, 1.0));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
}`;
const FRAG = `
uniform sampler2D uTex; uniform vec2 uCover; uniform float uHem;
varying vec2 vUv; varying vec3 vN;
void main(){
  vec2 uv = (vUv-0.5)*uCover+0.5; vec3 c = texture2D(uTex, uv).rgb;
  vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;
  vec3 L = normalize(vec3(-0.4,0.6,0.7)); float diff = 0.50 + 0.50*dot(N,L);
  float spec = pow(max(reflect(-L,N).z,0.0), 26.0)*0.30;
  vec2 e = min(vUv,1.0-vUv); float edge = min(e.x*0.75,e.y*0.55);
  float hem = smoothstep(0.016,0.011,edge)*uHem, hem2 = smoothstep(0.004,0.0015,abs(edge-0.026))*uHem;
  c = mix(c, vec3(0.80,0.64,0.36), clamp(hem*0.9+hem2*0.8,0.0,1.0));
  gl_FragColor = vec4(c*diff + spec*vec3(1.0,0.9,0.75), 1.0);
}`;

export function webglOK() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
const loader = new THREE.TextureLoader();
const loadTex = (u) => loader.loadAsync(u).then((t) => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return t; });
const cover = (tex, pw, ph) => { const ta = tex.image.width / tex.image.height, pa = pw / ph; return ta > pa ? new THREE.Vector2(pa / ta, 1) : new THREE.Vector2(1, ta / pa); };
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const reduce = motionReduced;

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); r.setClearColor(0x000000, 0);
  const fit = () => { const w = canvas.clientWidth || 600, h = canvas.clientHeight || 400; r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.setSize(w, h, false); return [w, h]; };
  return { r, fit };
}
function loopWhenVisible(canvas, frame) {
  let vis = false, raf = 0, t0 = performance.now();
  const tick = (now) => { frame((now - t0) / 1000); raf = vis && !reduce() ? requestAnimationFrame(tick) : 0; };
  const io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; if (vis && !raf) raf = requestAnimationFrame(tick); }, { threshold: 0.02 });
  io.observe(canvas); frame(0.001);
  return () => { io.disconnect(); cancelAnimationFrame(raf); vis = false; };
}

const LAYOUT = [[-8.3, 0.4, -1.4, .36, .09, 0.3], [-5.5, -2.7, 1.0, .20, -.06, 1.7], [-3.3, 2.9, 1.8, .10, .05, 2.9], [3.1, -2.9, 1.9, -.10, -.05, 4.1], [5.5, 2.8, 0.8, -.20, .07, 5.3], [8.3, -0.2, -1.6, -.36, -.08, 6.2]];

// items: [{ url, slug }] (6). onPick(slug) on click. section: element whose scroll progress drives parallax.
export async function silkGallery(canvas, items, onPick, section) {
  const { r, fit } = makeRenderer(canvas);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100), group = new THREE.Group(); scene.add(group);
  const pw = 3.0, ph = 4.0, panels = [];
  const texs = await Promise.all(items.map((i) => loadTex(i.url)));
  items.forEach((it, i) => {
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uSeed: { value: LAYOUT[i][5] }, uAmp: { value: 0.55 }, uW: { value: pw }, uH: { value: ph }, uTex: { value: texs[i] }, uCover: { value: cover(texs[i], pw, ph) }, uHem: { value: 1 } } });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph, 32, 44), mat); m.userData.slug = it.slug; group.add(m); panels.push(m);
  });
  let W = 1, H = 1; const resize = () => { [W, H] = fit(); cam.aspect = W / H; const k = Math.min(1, (W / H) / 1.75); group.scale.setScalar(Math.max(.45, k)); cam.updateProjectionMatrix(); };
  resize(); const ro = new ResizeObserver(() => { resize(); }); ro.observe(canvas);
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 }; let born = null, hover = null;
  canvas.addEventListener('pointermove', (e) => { const b = canvas.getBoundingClientRect(); ptr.x = ((e.clientX - b.left) / b.width) * 2 - 1; ptr.y = -(((e.clientY - b.top) / b.height) * 2 - 1); });
  canvas.addEventListener('pointerleave', () => { ptr.x = 0; ptr.y = 0; hover = null; canvas.style.cursor = ''; });
  const ray = new THREE.Raycaster(); const hit = () => { ray.setFromCamera(new THREE.Vector2(ptr.x, ptr.y), cam); const h = ray.intersectObjects(panels, false)[0]; return h ? h.object : null; };
  canvas.addEventListener('pointerdown', (e) => { const b = canvas.getBoundingClientRect(); ptr.x = ((e.clientX - b.left) / b.width) * 2 - 1; ptr.y = -(((e.clientY - b.top) / b.height) * 2 - 1); const o = hit(); if (o) onPick?.(o.userData.slug); });
  const stop = loopWhenVisible(canvas, (t) => {
    if (born === null) born = t; const tin = t - born;
    ptr.sx += (ptr.x - ptr.sx) * 0.06; ptr.sy += (ptr.y - ptr.sy) * 0.06;
    let prog = 0.5; if (section) { const b = section.getBoundingClientRect(); prog = Math.min(1, Math.max(0, 1 - (b.bottom) / (innerHeight + b.height))); }
    const calm = reduce() ? 0 : 1;
    panels.forEach((m, i) => {
      const L = LAYOUT[i], e = reduce() ? 1 : ease((tin - 0.15 * i) / 1.6);
      m.position.set(L[0], L[1] + Math.sin(t * 0.8 + L[5]) * 0.22 * calm - (1 - e) * 9 + (prog - 0.5) * (i % 2 ? 2.4 : -2.4) * (L[2] + 3) * 0.35, L[2] + (1 - e) * -2);
      m.rotation.set(Math.sin(t * 0.5 + L[5]) * 0.05 * calm, L[3] + Math.sin(t * 0.35 + L[5]) * 0.07 * calm + (1 - e) * 0.4, L[4] + Math.sin(t * 0.6 + L[5]) * 0.04 * calm);
      m.material.uniforms.uT.value = t * calm; m.scale.setScalar(m === hover ? 1.04 : 1);
    });
    group.rotation.y = ptr.sx * 0.12; group.rotation.x = -ptr.sy * 0.05; cam.position.set(ptr.sx * 0.8, ptr.sy * 0.4, 17.8 - Math.min(1, tin / 6) * 1.2); cam.lookAt(0, 0, 0);
    const o = ptr.x || ptr.y ? hit() : null; if (o !== hover) { hover = o; canvas.style.cursor = o ? 'pointer' : ''; }
    r.render(scene, cam);
  });
  return () => { stop(); ro.disconnect(); r.dispose(); panels.forEach((m) => { m.geometry.dispose(); m.material.dispose(); }); texs.forEach((t) => t.dispose()); };
}

// Scroll-driven fly-through: the camera dollies down a tunnel of floating silk panels as the pinned section scrolls.
// items: [{url, slug}]; onIndex(i) fires as a new panel becomes the focus; onPick(slug) on click.
const FRAG_A = FRAG.replace('uniform sampler2D uTex;', 'uniform sampler2D uTex; uniform float uAlpha;').replace('gl_FragColor = vec4(c*diff + spec*vec3(1.0,0.9,0.75), 1.0);', 'gl_FragColor = vec4(c*diff + spec*vec3(1.0,0.9,0.75), uAlpha);');
const TUN = [[-2.7, .5, .30, .22], [2.7, -.4, -.34, -.12], [-2.5, -.5, .30, .10], [2.6, .6, -.32, -.16], [-2.8, .3, .36, .14], [2.5, -.3, -.30, -.10]]; // x, y, rotY, rotZ
export async function silkTunnel(canvas, items, { onPick, onIndex, section } = {}) {
  const { r, fit } = makeRenderer(canvas); const n = items.length, GAP = 8.5, pw = 3.6, ph = 4.8;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(38, 1, .1, 120);
  const texs = await Promise.all(items.map((i) => loadTex(i.url))); const panels = [];
  items.forEach((it, i) => {
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_A, side: THREE.DoubleSide, transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uSeed: { value: i * 1.7 }, uAmp: { value: .6 }, uW: { value: pw }, uH: { value: ph }, uTex: { value: texs[i] }, uCover: { value: cover(texs[i], pw, ph) }, uHem: { value: 1 }, uAlpha: { value: 1 } } });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph, 30, 40), mat); m.userData = { slug: it.slug, i }; scene.add(m); panels.push(m);
  });
  const resize = () => { const [w, h] = fit(); cam.aspect = w / h; const wide = w / h; cam.fov = wide < 1 ? 52 : 38; cam.updateProjectionMatrix(); panels.forEach((m, i) => { const k = wide < 1 ? .55 : 1; m.userData.k = k; }); }; resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 }; let ps = 0, idx = -1, hover = null;
  canvas.addEventListener('pointermove', (e) => { const b = canvas.getBoundingClientRect(); ptr.x = ((e.clientX - b.left) / b.width) * 2 - 1; ptr.y = -(((e.clientY - b.top) / b.height) * 2 - 1); });
  canvas.addEventListener('pointerleave', () => { ptr.x = ptr.y = 0; hover = null; canvas.style.cursor = ''; });
  const ray = new THREE.Raycaster(); const hit = () => { ray.setFromCamera(new THREE.Vector2(ptr.x, ptr.y), cam); const h = ray.intersectObjects(panels, false)[0]; return h ? h.object : null; };
  canvas.addEventListener('pointerdown', (e) => { const b = canvas.getBoundingClientRect(); ptr.x = ((e.clientX - b.left) / b.width) * 2 - 1; ptr.y = -(((e.clientY - b.top) / b.height) * 2 - 1); const o = hit(); if (o) onPick?.(o.userData.slug); });
  const stop = loopWhenVisible(canvas, (t) => {
    let p = .5; if (section) { const b = section.getBoundingClientRect(); p = Math.min(1, Math.max(0, -b.top / Math.max(1, b.height - innerHeight))); }
    ps += (p - ps) * (reduce() ? 1 : .09); ptr.sx += (ptr.x - ptr.sx) * .06; ptr.sy += (ptr.y - ptr.sy) * .06;
    const camZ = 6 - ps * (GAP * (n - 1) + 10); cam.position.set(Math.sin(ps * 9) * .45 + ptr.sx * .8, ptr.sy * .45 + Math.cos(ps * 7) * .2, camZ); cam.lookAt(cam.position.x * .4 + ptr.sx * .6, ptr.sy * .3, camZ - 12); cam.rotation.z += Math.sin(ps * 5) * .015;
    panels.forEach((m, i) => {
      const L = TUN[i % TUN.length], z = -i * GAP, dist = camZ - z, k = m.userData.k || 1; // dist>0: panel ahead of camera
      const near = Math.max(0, Math.min(1, (dist + 2) / 6)); const slide = 1 - Math.max(0, Math.min(1, (dist - 1) / 9)); // swing aside as the camera arrives
      m.position.set(L[0] * k * (1 + (1 - near) * .35), L[1] + Math.sin(t * .8 + i) * .18 * (reduce() ? 0 : 1), z); m.rotation.set(Math.sin(t * .5 + i) * .04, L[2] * (1 - slide * .3) + ptr.sx * .08, L[3]);
      const far = Math.max(0, Math.min(1, (34 - dist) / 14)), gone = Math.max(0, Math.min(1, (dist + 2.5) / 3)); m.material.uniforms.uAlpha.value = far * gone * (m === hover ? 1 : .96); m.material.uniforms.uT.value = reduce() ? 0 : t; m.visible = dist > -2.5 && dist < 36; m.scale.setScalar(k * (m === hover ? 1.04 : 1));
    });
    const focus = Math.max(0, Math.min(n - 1, Math.round(ps * (n - 1)))); if (focus !== idx) { idx = focus; onIndex?.(idx); }
    const o = ptr.x || ptr.y ? hit() : null; if (o !== hover) { hover = o; canvas.style.cursor = o ? 'pointer' : ''; }
    r.render(scene, cam);
  });
  return () => { stop(); ro.disconnect(); r.dispose(); panels.forEach((m) => { m.geometry.dispose(); m.material.dispose(); }); texs.forEach((t) => t.dispose()); };
}

// Single draggable cloth swatch for the product page
export async function drapeViewer(canvas, url) {
  const { r, fit } = makeRenderer(canvas);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const tex = await loadTex(url); const pw = 3.2, ph = 4.2;
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uSeed: { value: 2.0 }, uAmp: { value: 0.45 }, uW: { value: pw }, uH: { value: ph }, uTex: { value: tex }, uCover: { value: cover(tex, pw, ph) }, uHem: { value: 0 } } });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph, 40, 52), mat); scene.add(m); cam.position.set(0, 0, 8.4);
  const resize = () => { const [w, h] = fit(); cam.aspect = w / h; cam.updateProjectionMatrix(); }; resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);
  let drag = null, ry = 0.25, rx = 0, vy = 0; canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; vy = (e.clientX - drag.x) * 0.008; ry += vy; rx = Math.max(-.6, Math.min(.6, rx + (e.clientY - drag.y) * 0.005)); drag = { x: e.clientX, y: e.clientY }; });
  const up = () => { drag = null; canvas.style.cursor = 'grab'; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  const stop = loopWhenVisible(canvas, (t) => { if (!drag) { vy *= 0.95; ry += vy; ry += (Math.sin(t * 0.4) * 0.35 - ry) * 0.01 * (reduce() ? 0 : 1); rx *= 0.97; } m.rotation.set(rx, ry, 0); mat.uniforms.uT.value = reduce() ? 0 : t; r.render(scene, cam); });
  return () => { stop(); ro.disconnect(); r.dispose(); m.geometry.dispose(); mat.dispose(); tex.dispose(); };
}

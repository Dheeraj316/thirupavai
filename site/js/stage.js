// Persistent WebGL backdrop: flowing silk + a few drifting motes of zari. Reacts to scroll, pointer and route; tints to the saree colour.
import * as THREE from '../vendor/three/three.module.js';

// [dark, lit] colours (linear-ish, tuned by eye)
const PAL = {
  default: [[.030, .004, .014], [.285, .040, .105]], Maroon: [[.030, .004, .014], [.300, .040, .110]], Red: [[.045, .004, .006], [.420, .040, .050]], Gold: [[.050, .030, .005], [.420, .270, .060]],
  Emerald: [[.004, .030, .020], [.030, .300, .180]], 'Royal blue': [[.006, .010, .050], [.070, .120, .430]], Pink: [[.050, .006, .030], [.450, .080, .280]], Ivory: [[.055, .048, .040], [.430, .380, .300]], Black: [[.010, .008, .010], [.130, .100, .140]],
  shop: [[.028, .004, .022], [.250, .035, .150]], story: [[.020, .004, .020], [.210, .050, .170]], admin: [[.012, .004, .010], [.090, .030, .070]],
};
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const FS = `precision highp float; varying vec2 vUv;
uniform vec2 uRes, uPtr; uniform float uT, uScroll, uKick, uBeam; uniform vec3 uC0, uC1;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float H(vec2 p){
  float t = uT;
  vec2 w = p + 0.30*vec2(sin(p.y*1.3+t*.20), cos(p.x*1.1-t*.17));
  float a = sin(w.x*6.4 + w.y*2.4 + t*0.30)*0.50;
  a += sin(w.x*11.7 - w.y*5.1 - t*0.42 + sin(w.y*2.0))*0.22;
  a += sin(w.x*21.0 + w.y*8.5 + t*0.55)*0.06;
  a -= pow(abs(sin(w.x*4.1 - w.y*1.7 + t*.2)), .7)*0.30;
  return a*0.07;
}
void main(){
  vec2 uv = vUv; float asp = uRes.x/uRes.y;
  vec2 p = (uv-0.5)*vec2(asp,1.0)*2.2; p += vec2(uPtr.x*.14, uPtr.y*.09); p.y += uScroll*1.6; p.x += uScroll*.5;
  float e = 0.004; float h0 = H(p), hx = H(p+vec2(e,0.)), hy = H(p+vec2(0.,e));
  vec3 n = normalize(vec3(-(hx-h0)/e*1.5, -(hy-h0)/e*1.5, 1.0));
  vec3 L = normalize(vec3(-0.35 + uPtr.x*.25, 0.55 + uPtr.y*.2, 0.78));
  float diff = clamp(dot(n,L),0.,1.); vec3 Hh = normalize(L+vec3(0.,0.,1.));
  vec3 T = normalize(vec3(0.25,1.,0.) - n*dot(vec3(0.25,1.,0.),n)); float th = dot(T,Hh);
  float aniso = pow(sqrt(max(1.-th*th,0.)), 120.); float ridge = smoothstep(0.55,0.98,diff);
  vec3 col = mix(uC0, uC1, smoothstep(0.30,0.95,diff)) + aniso*vec3(0.96,0.76,0.50)*0.34*(0.30+ridge);
  float d = dot(uv-vec2(.5), normalize(vec2(1.,.35))); float beam = exp(-pow((d-uBeam)*3.2, 2.0));
  col += beam*vec3(.46,.30,.18)*(0.15+0.85*ridge)*0.75 + beam*aniso*vec3(1.,.84,.58)*0.8;
  col += uKick*vec3(.55,.36,.14)*exp(-5.*length((uv-vec2(.5))*vec2(asp,1.)));
  float v = smoothstep(1.35,0.15,length((uv-.5)*vec2(1.0,0.95))); col *= (0.24+0.76*v)*0.46;
  col *= 0.78 + 0.22*smoothstep(0.0, 0.7, uv.x);
  col += (hash(gl_FragCoord.xy+uT*13.)*2.-1.)*0.006;
  gl_FragColor = vec4(col, 1.);
}`;
const PVS = `attribute vec3 aSeed; uniform float uT, uScroll; uniform vec2 uPtr; uniform float uPx; varying float vA;
void main(){
  float spd = .02 + aSeed.z*.05; float y = fract(aSeed.y + uT*spd + uScroll*.35*(.3+aSeed.z));
  vec3 p = vec3((aSeed.x*2.-1.)*1.9 + sin(uT*.2 + aSeed.y*20.)*.08 + uPtr.x*.12*aSeed.z, y*2.4-1.2, -.6 + aSeed.z*1.4);
  vA = smoothstep(0.,.12,y) * (1.-smoothstep(.8,1.,y)) * (.35+.65*aSeed.z);
  vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv; gl_PointSize = (1.2 + aSeed.z*3.2) * uPx * (2.6/(-mv.z));
}`;
const PFS = `precision mediump float; varying float vA; void main(){ vec2 c = gl_PointCoord-.5; float r = length(c); float a = smoothstep(.5,0.,r); gl_FragColor = vec4(vec3(.98,.82,.52)*1.2, a*a*vA*.9); }`;

const reduce = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
export function startStage() {
  const canvas = document.getElementById('stagebg'); if (!canvas) return null;
  let r; try { r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' }); } catch { document.documentElement.classList.add('no-gl'); return null; }
  const lite = (navigator.hardwareConcurrency || 4) <= 2 || innerWidth < 700; const scale = lite ? 0.38 : 0.55;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(42, 1, .1, 20); cam.position.z = 2.4;
  const U = { uRes: { value: new THREE.Vector2(1, 1) }, uPtr: { value: new THREE.Vector2() }, uT: { value: 0 }, uScroll: { value: 0 }, uKick: { value: 0 }, uBeam: { value: -.6 }, uC0: { value: new THREE.Vector3(...PAL.default[0]) }, uC1: { value: new THREE.Vector3(...PAL.default[1]) } };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: U, depthTest: false, depthWrite: false })); quad.frustumCulled = false; quad.renderOrder = -1; scene.add(quad);
  const N = lite ? 40 : 110, seed = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const PU = { uT: U.uT, uScroll: U.uScroll, uPtr: U.uPtr, uPx: { value: 1 } };
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: PVS, fragmentShader: PFS, uniforms: PU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; scene.add(pts);
  const resize = () => { const w = Math.max(2, Math.round(innerWidth * scale)), h = Math.max(2, Math.round(innerHeight * scale)); r.setPixelRatio(1); r.setSize(w, h, false); U.uRes.value.set(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); PU.uPx.value = Math.max(.6, h / 520); };
  resize(); addEventListener('resize', resize);
  const ptr = { x: 0, y: 0 }; addEventListener('pointermove', (e) => { ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = -(e.clientY / innerHeight * 2 - 1); }, { passive: true });
  let target = PAL.default, scrollTo = 0, last = performance.now(), acc = 0, raf = 0, kick = 0;
  const lerp3 = (v, t, k) => v.set(v.x + (t[0] - v.x) * k, v.y + (t[1] - v.y) * k, v.z + (t[2] - v.z) * k);
  const frame = (now) => {
    const dt = Math.min(.05, (now - last) / 1000); last = now; acc += dt; U.uT.value += dt;
    const doc = document.documentElement; const max = Math.max(1, doc.scrollHeight - innerHeight); scrollTo = scrollY / max; U.uScroll.value += (scrollTo - U.uScroll.value) * .06;
    U.uPtr.value.x += (ptr.x - U.uPtr.value.x) * .04; U.uPtr.value.y += (ptr.y - U.uPtr.value.y) * .04;
    lerp3(U.uC0.value, target[0], .04); lerp3(U.uC1.value, target[1], .04); kick *= .94; U.uKick.value = kick; U.uBeam.value = -.7 + ((U.uT.value * .05 + scrollTo * 1.4) % 1.6);
    r.render(scene, cam);
    raf = !document.hidden && !reduce() ? requestAnimationFrame(frame) : 0;
  };
  const play = () => { if (!raf && !reduce()) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) play(); });
  frame(performance.now()); play();
  const api = {
    theme(key) { target = PAL[key] || PAL.default; if (reduce()) { U.uC0.value.set(...target[0]); U.uC1.value.set(...target[1]); r.render(scene, cam); } },
    kick(v = 1) { kick = Math.min(1.4, kick + v); play(); },
  };
  window.__stage = api; return api;
}

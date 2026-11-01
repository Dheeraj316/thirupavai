// Gate for the heavy WebGL work (three.js, ~2 MB). Resolves on the visitor's first interaction, or once the page
// has settled — so the first paint and the largest paint never compete with it for bandwidth or the main thread.
// Phones start it about a second after load (it used to wait 6 s, which read as "the 3D is broken"); only a very slow
// or data-saving connection waits longer.
const EVS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
const slowLink = () => { const c = navigator.connection; return !!c && (!!c.saveData || /(^|-)2g$/.test(c.effectiveType || '')); };
let gate;
export const glReady = () => gate || (gate = new Promise((resolve) => {
  let t = 0;
  const go = () => { EVS.forEach((e) => removeEventListener(e, go)); clearTimeout(t); resolve(); };
  EVS.forEach((e) => addEventListener(e, go, { passive: true }));
  const arm = () => { t = setTimeout(go, innerWidth < 820 ? (slowLink() ? 6000 : 1100) : 2500); };
  document.readyState === 'complete' ? arm() : addEventListener('load', arm, { once: true });
}));

// "Reduce motion" is honoured by default, but a phone in battery-saver mode reports it without the owner ever choosing it,
// so a visitor can switch the 3D effects back on (the page offers a button). One answer for every module.
export const motionReduced = () => {
  try { if (localStorage.getItem('tpv-3d') === 'on') return false; } catch {}
  return matchMedia('(prefers-reduced-motion:reduce)').matches;
};
export const set3D = (on) => { try { on ? localStorage.setItem('tpv-3d', 'on') : localStorage.removeItem('tpv-3d'); } catch {} };

// Gate for the heavy WebGL work (three.js, ~2 MB). Resolves on the visitor's first interaction, or once the page
// has settled — so the first paint and the largest paint never compete with it for bandwidth or the main thread.
const EVS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
let gate;
export const glReady = () => gate || (gate = new Promise((resolve) => {
  let t = 0;
  const go = () => { EVS.forEach((e) => removeEventListener(e, go)); clearTimeout(t); resolve(); };
  EVS.forEach((e) => addEventListener(e, go, { passive: true }));
  const arm = () => { t = setTimeout(go, innerWidth < 820 ? 6000 : 2500); };
  document.readyState === 'complete' ? arm() : addEventListener('load', arm, { once: true });
}));

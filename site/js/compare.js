// Compare list (max 3 sarees). Kept in its own tiny module so cards, the tray and the modal can share it without import cycles.
const KEY = 'tpv-compare'; export const MAX = 3; const subs = new Set();
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.slice(0, MAX) : []; } catch { return []; } };
let ids = read();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {} subs.forEach((f) => f(ids)); };
export const cmp = {
  ids: () => ids.slice(),
  has: (id) => ids.includes(id),
  toggle(id) {
    if (ids.includes(id)) { ids = ids.filter((x) => x !== id); save(); return { on: false }; }
    if (ids.length >= MAX) return { on: false, full: true };
    ids = [...ids, id]; save(); return { on: true };
  },
  remove(id) { ids = ids.filter((x) => x !== id); save(); },
  clear() { ids = []; save(); },
  subscribe(f) { subs.add(f); return () => subs.delete(f); },
};
addEventListener('storage', (e) => { if (e.key === KEY) { ids = read(); subs.forEach((f) => f(ids)); } });

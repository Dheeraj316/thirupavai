// Server-side price rules. The browser shows totals, but only these numbers are ever charged.
export const ADDONS = { fall: ['Fall & pico', 450], blouse: ['Blouse stitching', 1800], gift: ['Gift wrap + message card', 250] };
export const COUPONS = { FESTIVE5: { pct: 5 }, WELCOME10: { pct: 10, min: 25000 } };

// lines: [{ id, qty, addons[] }]; catalog: Map(id -> { price, stock, active })
export function price(lines, catalog, delivery = 'Standard', couponCode = '') {
  const out = []; let sub = 0;
  for (const l of lines) {
    const p = catalog.get(l.id); if (!p || !p.active) return { error: 'One of the sarees in your bag is no longer available.', id: l.id };
    const qty = Math.floor(Number(l.qty)); if (!(qty >= 1 && qty <= 10)) return { error: 'Invalid quantity.', id: l.id };
    if (p.stock < qty) return { error: p.stock < 1 ? 'A saree in your bag has just sold out.' : `Only ${p.stock} available for one of the sarees in your bag.`, id: l.id };
    const addons = [...new Set((l.addons || []).filter((k) => ADDONS[k]))];
    const add = addons.reduce((s, k) => s + ADDONS[k][1], 0);
    const line = p.price * qty + add; sub += line; out.push({ id: l.id, qty, price: p.price, addons, line });
  }
  const code = String(couponCode || '').trim().toUpperCase(); const cp = COUPONS[code];
  const discount = cp && !(cp.min && sub < cp.min) ? Math.round((sub * cp.pct) / 100) : 0;
  const ship = delivery === 'Express' ? 350 : 0;
  return { items: out, totals: { sub, discount, delivery: ship, total: sub - discount + ship }, coupon: discount ? code : null };
}

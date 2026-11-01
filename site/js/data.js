// Sample catalogue — concept data only. Images are the film's concept imagery (generated + supplied references).
// Each gallery entry: [image, label, focal point "x% y%", zoom (background-size %)]
export const FABRICS = ['Kanchipuram silk', 'Banarasi silk', 'Mysore silk', 'Organza'];
export const COLOURS = [['Maroon', '#6b1f35'], ['Red', '#b3262c'], ['Gold', '#c6a15b'], ['Emerald', '#1f6b4f'], ['Royal blue', '#2b3a8c'], ['Pink', '#d86c9a'], ['Ivory', '#efe3d0'], ['Black', '#222222']];
export const OCCASIONS = ['Bridal', 'Festive', 'Everyday'];
export const COLLECTIONS = [['bridal', 'Bridal Edit', 'red', '50% 30%'], ['festive', 'Festive Gold', 'orange', '50% 25%'], ['heritage', 'Silk Heritage', 'blue', '50% 40%'], ['everyday', 'Everyday Elegance', 'green', '50% 50%'], ['contemporary', 'Contemporary Drape', 'seated', '62% 50%']];

const g = (a, b) => ({ img: a, label: b[0], pos: b[1], zoom: b[2] || 'cover' });
export const PRODUCTS = [
  { id: 'p1', sku: 'TPV-BAN-0142', slug: 'maroon-banarasi-katan-silk', name: 'Maroon Banarasi Katan Silk', fabric: 'Banarasi silk', weave: 'Banarasi brocade', colour: 'Maroon', occasion: ['Bridal'], collection: 'bridal', price: 42500, was: null, stock: 1, tag: 'Bridal', date: 20260928,
    desc: 'A deep maroon katan silk with antique-gold zari borders and a woven pallu. Sample product copy — final description will use verified product details.', length: '5.5 m + 0.8 m blouse piece', blouse: 'Unstitched · gold zari', care: 'Dry clean only', returns: 'Eligible · 7 days (sample)',
    gallery: [g('corridor', ['Full view', '67% 50%']), g('brocade', ['Model view', '50% 25%']), g('seated', ['Alternate angle', '60% 50%']), g('border', ['Border close-up', '50% 50%']), g('pallu', ['Pallu close-up', '50% 40%']), g('weave', ['Fabric weave', '50% 50%'])] },
  { id: 'p2', sku: 'TPV-BAN-0171', slug: 'garnet-brocade-banarasi', name: 'Garnet Brocade Banarasi', fabric: 'Banarasi silk', weave: 'Brocade', colour: 'Maroon', occasion: ['Bridal', 'Festive'], collection: 'bridal', price: 48200, was: null, stock: 1, tag: 'Bridal', date: 20261002,
    desc: 'Rich garnet silk with all-over brocade work and a wide gold border. Sample copy.', length: '5.5 m + 0.8 m blouse piece', blouse: 'Attached · matching', care: 'Dry clean only', returns: 'Eligible · 7 days (sample)',
    gallery: [g('brocade', ['Model view', '50% 25%']), g('corridor', ['Full view', '67% 50%']), g('border', ['Border close-up', '30% 40%', '180%']), g('pallu', ['Pallu close-up', '50% 60%'])] },
  { id: 'p3', sku: 'TPV-KAN-0088', slug: 'vermilion-bridal-kanchipuram', name: 'Vermilion Bridal Kanchipuram', fabric: 'Kanchipuram silk', weave: 'Temple border', colour: 'Red', occasion: ['Bridal'], collection: 'bridal', price: 68000, was: 74000, stock: 2, tag: 'Bridal', date: 20260915,
    desc: 'Vermilion silk with contrast green-and-gold borders, woven the traditional way. Sample copy.', length: '6.0 m incl. blouse piece', blouse: 'Included · contrast', care: 'Dry clean only', returns: 'Eligible · 7 days (sample)',
    gallery: [g('red', ['Full view', '50% 30%']), g('orange', ['Styled view', '50% 25%']), g('weave', ['Fabric weave', '70% 40%', '220%'])] },
  { id: 'p4', sku: 'TPV-SLK-0213', slug: 'royal-blue-zari-silk', name: 'Royal Blue Zari Silk', fabric: 'Kanchipuram silk', weave: 'Zari', colour: 'Royal blue', occasion: ['Festive', 'Bridal'], collection: 'heritage', price: 36800, was: null, stock: 1, tag: 'New', date: 20261020,
    desc: 'Royal blue silk with a heavy gold zari border. Sample copy.', length: '5.5 m + 0.8 m blouse piece', blouse: 'Unstitched · gold', care: 'Dry clean only', returns: 'Eligible · 7 days (sample)',
    gallery: [g('blue', ['Drape detail', '50% 40%']), g('border', ['Zari border', '50% 50%', '170%']), g('pallu', ['Pallu', '50% 70%', '200%'])] },
  { id: 'p5', sku: 'TPV-MYS-0054', slug: 'emerald-peacock-border', name: 'Emerald Peacock Border', fabric: 'Mysore silk', weave: 'Peacock motif', colour: 'Emerald', occasion: ['Festive', 'Everyday'], collection: 'everyday', price: 31500, was: null, stock: 3, tag: '', date: 20260905,
    desc: 'Emerald crepe silk with a peacock-motif gold border. Sample copy.', length: '5.5 m + 0.8 m blouse piece', blouse: 'Unstitched · matching', care: 'Dry clean only', returns: 'Eligible · 7 days (sample)',
    gallery: [g('green', ['Border detail', '50% 50%']), g('weave', ['Weave', '40% 50%', '250%']), g('border', ['Zari close-up', '60% 60%', '260%'])] },
  { id: 'p6', sku: 'TPV-BAN-0119', slug: 'magenta-heritage-silk', name: 'Magenta Heritage Silk', fabric: 'Banarasi silk', weave: 'Brocade', colour: 'Pink', occasion: ['Festive'], collection: 'festive', price: 29900, was: 33500, stock: 2, tag: 'Festive', date: 20260820,
    desc: 'Magenta and gold shot silk with a woven floral border. Sample copy.', length: '5.5 m + 0.8 m blouse piece', blouse: 'Unstitched', care: 'Dry clean only', returns: 'Eligible · 7 days (sample)',
    gallery: [g('magenta', ['Drape detail', '50% 50%']), g('orange', ['Styled view', '50% 25%'])] },
  { id: 'p7', sku: 'TPV-KAN-0097', slug: 'ember-kanchipuram-festive', name: 'Ember Kanchipuram Festive', fabric: 'Kanchipuram silk', weave: 'Temple border', colour: 'Gold', occasion: ['Festive'], collection: 'festive', price: 58600, was: null, stock: 1, tag: 'Festive', date: 20260930,
    desc: 'Ember and gold tissue-effect silk with a temple border. Sample copy.', length: '6.0 m incl. blouse piece', blouse: 'Included', care: 'Dry clean only', returns: 'Eligible · 7 days (sample)',
    gallery: [g('orange', ['Full view', '50% 25%']), g('red', ['Alternate', '50% 30%']), g('pallu', ['Pallu', '50% 50%', '180%'])] },
  { id: 'p8', sku: 'TPV-KAT-0066', slug: 'garnet-plain-silk', name: 'Garnet Plain Silk', fabric: 'Banarasi silk', weave: 'Katan', colour: 'Maroon', occasion: ['Everyday', 'Festive'], collection: 'contemporary', price: 24800, was: null, stock: 4, tag: '', date: 20260812,
    desc: 'A quiet garnet katan with a single gold zari stripe. Sample copy.', length: '5.5 m + 0.8 m blouse piece', blouse: 'Unstitched', care: 'Dry clean only', returns: 'Eligible · 7 days (sample)',
    gallery: [g('weave', ['Fabric', '50% 50%']), g('seated', ['Styled view', '62% 50%'])] },
  { id: 'p9', sku: 'TPV-KAN-0101', slug: 'wine-katan-gold-border', name: 'Wine Katan Silk, Gold Border', fabric: 'Kanchipuram silk', weave: 'Katan', colour: 'Maroon', occasion: ['Bridal', 'Festive'], collection: 'contemporary', price: 44900, was: null, stock: 1, tag: 'Bridal', date: 20260925,
    desc: 'Wine silk with a broad, burnished gold border. Sample copy.', length: '5.5 m + 0.8 m blouse piece', blouse: 'Unstitched · gold', care: 'Dry clean only', returns: 'Eligible · 7 days (sample)',
    gallery: [g('seated', ['Styled view', '62% 50%']), g('pallu', ['Pallu', '50% 40%']), g('border', ['Border', '50% 50%'])] },
  { id: 'p10', sku: 'TPV-ORG-0031', slug: 'ivory-organza-gold-edge', name: 'Ivory Organza, Gold Edge', fabric: 'Organza', weave: 'Plain', colour: 'Ivory', occasion: ['Everyday'], collection: 'everyday', price: 14900, was: null, stock: 6, tag: 'New', date: 20261018,
    desc: 'Featherlight ivory organza finished with a gold edge. Sample copy (placeholder styling image).', length: '5.5 m + 0.8 m blouse piece', blouse: 'Unstitched', care: 'Gentle dry clean', returns: 'Eligible · 7 days (sample)',
    gallery: [g('weave', ['Fabric', '20% 30%', '300%']), g('green', ['Detail', '10% 10%', '300%'])] },
  { id: 'p11', sku: 'TPV-MYS-0072', slug: 'noir-mysore-silk', name: 'Noir Mysore Silk', fabric: 'Mysore silk', weave: 'Crepe', colour: 'Black', occasion: ['Everyday', 'Festive'], collection: 'contemporary', price: 21800, was: 24500, stock: 0, tag: '', date: 20260710,
    desc: 'A black crepe silk with an antique-gold border. Sample copy.', length: '5.5 m + 0.8 m blouse piece', blouse: 'Unstitched', care: 'Dry clean only', returns: 'Eligible · 7 days (sample)',
    gallery: [g('border', ['Border', '50% 50%', '150%']), g('pallu', ['Pallu', '50% 50%'])] },
  { id: 'p12', sku: 'TPV-ORG-0044', slug: 'blush-organza-festive', name: 'Blush Organza Festive', fabric: 'Organza', weave: 'Embroidered', colour: 'Pink', occasion: ['Festive'], collection: 'festive', price: 17200, was: null, stock: 5, tag: '', date: 20261008,
    desc: 'Blush pink organza with delicate gold embroidery. Sample copy (placeholder styling image).', length: '5.5 m + 0.8 m blouse piece', blouse: 'Unstitched', care: 'Gentle dry clean', returns: 'Eligible · 7 days (sample)',
    gallery: [g('magenta', ['Detail', '30% 30%', '200%']), g('orange', ['Styled', '50% 25%'])] },
];

export const byId = (id) => PRODUCTS.find((p) => p.id === id);
export const bySlug = (s) => PRODUCTS.find((p) => p.slug === s);
export const inr = (v) => '₹ ' + Math.round(v).toLocaleString('en-IN');

// Demo serviceability — PIN prefixes (the real answer comes from the courier API)
export const SERVICEABLE = { '6': ['Tamil Nadu / South', 2], '5': ['South India', 3], '4': ['West India', 4], '1': ['North India', 4], '7': ['East India', 5], '2': ['North India', 4], '3': ['North-West', 5], '8': ['East India', 5] };
export const checkPin = (pin) => {
  if (!/^\d{6}$/.test(pin)) return { ok: false, msg: 'Enter a valid 6-digit PIN code.' };
  if (pin === '000000' || pin[0] === '9' || pin[0] === '0') return { ok: false, msg: 'Sorry — we cannot deliver to this PIN code yet.' };
  const [zone, d] = SERVICEABLE[pin[0]] || ['India', 5];
  return { ok: true, zone, days: d, msg: `Serviceable · dispatch in 2–3 days, delivery in ${d}–${d + 2} days` };
};

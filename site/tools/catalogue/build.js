// Writes site/js/gallery_map.js: which sarees have their six photos (site/assets/s/pNN-1.webp … pNN-6.webp).
//   node tools/catalogue/build.js
const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '..', '..', 'assets', 's');
const have = {};
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) { const m = /^(p\d+)-([1-6])\.webp$/.exec(f); if (m) have[m[1]] = (have[m[1]] || 0) + 1; }
const ids = Object.keys(have).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
const body = ids.map((id) => `${id}: ${have[id]}`).join(', ');
fs.writeFileSync(path.join(__dirname, '..', '..', 'js', 'gallery_map.js'),
  `// Written by tools/catalogue/build.js: how many of the six photos each saree has in assets/s/. A saree needs all six to be listed.\nexport const SET = { ${body} };\n`);
console.log('gallery_map.js:', ids.length, 'sarees with photos;', ids.filter((i) => have[i] === 6).length, 'complete');

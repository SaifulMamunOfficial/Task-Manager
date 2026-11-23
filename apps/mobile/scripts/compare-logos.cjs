// Renders the logo designs side by side so they can be compared: node scripts/compare-logos.cjs
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const assets = path.join(__dirname, '..', 'assets');
const designs = [
  ['A', path.join(assets, 'logo.svg')],
  ['B', path.join(assets, 'alt', 'logo-b.svg')],
  ['C', path.join(assets, 'alt', 'logo-c.svg')],
  ['D', path.join(assets, 'alt', 'logo-d.svg')],
  ['E', path.join(assets, 'alt', 'logo-e.svg')],
];

(async () => {
  const size = 220;
  const gap = 36;
  const pad = 40;
  const width = pad * 2 + size * designs.length + gap * (designs.length - 1);
  const height = size + pad * 2 + 70;
  const layers = [];
  for (const [i, [name, file]] of designs.entries()) {
    const x = pad + i * (size + gap);
    layers.push({ input: await sharp(fs.readFileSync(file)).resize(size, size).png().toBuffer(), left: x, top: pad });
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="60"><text x="${size / 2}" y="42" font-family="Arial" font-size="40" font-weight="700" fill="#0f172a" text-anchor="middle">${name}</text></svg>`);
    layers.push({ input: label, left: x, top: pad + size + 6 });
  }
  // small sizes too: how each one looks at 64px and 32px (home screen and browser tab)
  await sharp({ create: { width, height, channels: 4, background: '#f3f5f9' } }).composite(layers).png().toFile(path.join(assets, 'alt', 'compare.png'));
  console.log('compare.png written');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

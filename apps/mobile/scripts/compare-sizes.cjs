// Shows two logos at real icon sizes on a light and a dark background: node scripts/compare-sizes.cjs C D
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const assets = path.join(__dirname, '..', 'assets');
const file = (n) => (n === 'A' ? path.join(assets, 'logo.svg') : path.join(assets, 'alt', `logo-${n.toLowerCase()}.svg`));
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['C', 'D'];
const sizes = [160, 96, 64, 40, 24];

(async () => {
  const pad = 28;
  const rowH = 190;
  const labelW = 70;
  const colW = sizes.reduce((a, b) => a + b + 24, 0);
  const panelW = labelW + colW + pad;
  const width = panelW * 2 + pad;
  const height = rowH * names.length + pad * 2;
  const layers = [];
  for (const [p, [, color]] of [['light', '#f3f5f9'], ['dark', '#0b1020']].map((v, i) => [i, v])) {
    const x0 = pad + p * panelW;
    layers.push({ input: await sharp({ create: { width: panelW + (p ? 0 : pad - 8), height, channels: 4, background: color } }).png().toBuffer(), left: p ? panelW + pad - 8 : 0, top: 0 });
    for (const [r, name] of names.entries()) {
      const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${labelW}" height="60"><text x="14" y="44" font-family="Arial" font-size="40" font-weight="700" fill="${p ? '#e6eaf3' : '#0f172a'}">${name}</text></svg>`);
      layers.push({ input: label, left: x0, top: pad + r * rowH + 50 });
      let x = x0 + labelW;
      for (const s of sizes) {
        layers.push({ input: await sharp(fs.readFileSync(file(name))).resize(s, s).png().toBuffer(), left: x, top: pad + r * rowH + Math.round((160 - s) / 2) + 10 });
        x += s + 24;
      }
    }
  }
  await sharp({ create: { width, height, channels: 4, background: '#f3f5f9' } }).composite(layers).png().toFile(path.join(assets, 'alt', 'sizes.png'));
  console.log('sizes.png written');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

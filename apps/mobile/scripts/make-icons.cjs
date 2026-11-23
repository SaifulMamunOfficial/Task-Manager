// Builds every app icon from the two SVGs in ../assets.   node scripts/make-icons.cjs
// Needs `sharp` (already installed in the workspace).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const assets = path.join(__dirname, '..', 'assets');
const webPublic = path.join(__dirname, '..', '..', 'web', 'public');
const webApp = path.join(__dirname, '..', '..', 'web', 'app');
const logo = fs.readFileSync(path.join(assets, 'logo.svg'));
const mark = fs.readFileSync(path.join(assets, 'logo-mark.svg'));

(async () => {
  // iOS / store icon (full square; the OS rounds the corners)
  await sharp(logo).resize(1024, 1024).png().toFile(path.join(assets, 'icon.png'));
  // Android adaptive icon: the mark must sit inside the central 66% "safe zone" on a transparent layer
  const small = await sharp(mark).resize(676, 676).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: small, gravity: 'center' }])
    .png()
    .toFile(path.join(assets, 'adaptive-icon.png'));
  // splash screen mark (white on transparent; the splash background colour comes from app.json)
  await sharp(mark).resize(512, 512).png().toFile(path.join(assets, 'splash-icon.png'));
  // small in-app logo for the sign-in screen
  await sharp(mark).resize(256, 256).png().toFile(path.join(assets, 'logo-mark.png'));
  // web: browser tab icon and PWA-sized icons
  fs.mkdirSync(webPublic, { recursive: true });
  fs.copyFileSync(path.join(assets, 'logo.svg'), path.join(webApp, 'icon.svg'));
  await sharp(logo).resize(512, 512).png().toFile(path.join(webPublic, 'icon-512.png'));
  await sharp(logo).resize(192, 192).png().toFile(path.join(webPublic, 'icon-192.png'));
  await sharp(logo).resize(180, 180).png().toFile(path.join(webApp, 'apple-icon.png'));
  await sharp(logo).resize(48, 48).png().toFile(path.join(assets, 'favicon.png'));
  console.log('icons written');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

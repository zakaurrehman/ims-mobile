const sharp = require('sharp');
const path = require('path');

const SIZE = 1024;

const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0a2552"/>
      <stop offset="60%" stop-color="#0d4fa8"/>
      <stop offset="100%" stop-color="#1a78d4"/>
    </linearGradient>
    <linearGradient id="shelfGlow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="white" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="white" stop-opacity="0.7"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>

  <!-- Subtle bottom glow -->
  <ellipse cx="512" cy="960" rx="420" ry="80" fill="#1a78d4" opacity="0.35"/>

  <!-- ── SHELF UNIT ── -->

  <!-- Left vertical support -->
  <rect x="195" y="175" width="32" height="680" rx="16" fill="white" opacity="0.88"/>
  <!-- Right vertical support -->
  <rect x="797" y="175" width="32" height="680" rx="16" fill="white" opacity="0.88"/>

  <!-- ── SHELF 1 (top) ── -->
  <rect x="195" y="265" width="634" height="26" rx="13" fill="white" opacity="0.92"/>
  <!-- Boxes on shelf 1 -->
  <rect x="228" y="185" width="115" height="80" rx="12" fill="white" opacity="0.72"/>
  <line x1="285" y1="185" x2="285" y2="265" stroke="#b8ddf8" stroke-width="2" opacity="0.5"/>
  <rect x="359" y="198" width="95" height="67" rx="12" fill="white" opacity="0.50"/>
  <rect x="468" y="182" width="138" height="83" rx="12" fill="white" opacity="0.72"/>
  <line x1="537" y1="182" x2="537" y2="265" stroke="#b8ddf8" stroke-width="2" opacity="0.5"/>
  <rect x="622" y="195" width="115" height="70" rx="12" fill="white" opacity="0.50"/>

  <!-- ── SHELF 2 (middle) ── -->
  <rect x="195" y="490" width="634" height="26" rx="13" fill="white" opacity="0.92"/>
  <!-- Boxes on shelf 2 -->
  <rect x="228" y="398" width="95" height="92" rx="12" fill="white" opacity="0.72"/>
  <rect x="340" y="413" width="128" height="77" rx="12" fill="white" opacity="0.50"/>
  <line x1="404" y1="413" x2="404" y2="490" stroke="#b8ddf8" stroke-width="2" opacity="0.5"/>
  <rect x="484" y="396" width="106" height="94" rx="12" fill="white" opacity="0.72"/>
  <rect x="607" y="409" width="155" height="81" rx="12" fill="white" opacity="0.50"/>

  <!-- ── SHELF 3 (bottom) ── -->
  <rect x="195" y="715" width="634" height="26" rx="13" fill="white" opacity="0.92"/>
  <!-- Boxes on shelf 3 -->
  <rect x="228" y="622" width="148" height="93" rx="12" fill="white" opacity="0.72"/>
  <line x1="302" y1="622" x2="302" y2="715" stroke="#b8ddf8" stroke-width="2" opacity="0.5"/>
  <rect x="392" y="634" width="106" height="81" rx="12" fill="white" opacity="0.50"/>
  <rect x="514" y="619" width="126" height="96" rx="12" fill="white" opacity="0.72"/>
  <line x1="577" y1="619" x2="577" y2="715" stroke="#b8ddf8" stroke-width="2" opacity="0.5"/>
  <rect x="656" y="630" width="121" height="85" rx="12" fill="white" opacity="0.50"/>

  <!-- Floor line -->
  <rect x="155" y="855" width="714" height="18" rx="9" fill="white" opacity="0.42"/>

  <!-- ── Tiny accent dot on top-right (like a notification / badge detail) ── -->
  <circle cx="797" cy="175" r="18" fill="#38bdf8" opacity="0.9"/>
</svg>`;

async function main() {
  const assets = path.join(__dirname, '..', 'assets');
  const buf = Buffer.from(iconSvg);

  await sharp(buf).png().toFile(path.join(assets, 'icon.png'));
  console.log('✓ assets/icon.png  (1024×1024)');

  await sharp(buf).png().toFile(path.join(assets, 'adaptive-icon.png'));
  console.log('✓ assets/adaptive-icon.png  (1024×1024)');

  await sharp(buf).resize(48, 48).png().toFile(path.join(assets, 'favicon.png'));
  console.log('✓ assets/favicon.png  (48×48)');

  // Splash: icon centred on light brand-blue background
  const SPLASH_W = 1284;
  const SPLASH_H = 2778;
  const ICON_SZ  = 640;
  const IX = Math.round((SPLASH_W - ICON_SZ) / 2);
  const IY = Math.round((SPLASH_H - ICON_SZ) / 2) - 80;

  const splashSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${SPLASH_W}" height="${SPLASH_H}" viewBox="0 0 ${SPLASH_W} ${SPLASH_H}">
  <defs>
    <linearGradient id="splashBg" x1="0" y1="0" x2="0" y2="${SPLASH_H}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#dbeeff"/>
      <stop offset="100%" stop-color="#b8ddf8"/>
    </linearGradient>
  </defs>
  <rect width="${SPLASH_W}" height="${SPLASH_H}" fill="url(#splashBg)"/>
  <!-- Drop shadow simulation -->
  <rect x="${IX + 12}" y="${IY + 12}" width="${ICON_SZ}" height="${ICON_SZ}"
        rx="${Math.round(ICON_SZ * 0.22)}" fill="#0a2552" opacity="0.18"/>
  <!-- Icon image embedded as a nested SVG scaled to ICON_SZ -->
  <svg x="${IX}" y="${IY}" width="${ICON_SZ}" height="${ICON_SZ}">
    ${iconSvg
      .replace(/<\?xml[^>]*\?>/, '')
      .replace(/<svg[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SZ}" height="${ICON_SZ}" viewBox="0 0 ${SIZE} ${SIZE}">`)
    }
  </svg>
</svg>`;

  await sharp(Buffer.from(splashSvg)).png().toFile(path.join(assets, 'splash.png'));
  console.log(`✓ assets/splash.png  (${SPLASH_W}×${SPLASH_H})`);

  console.log('\nAll icons generated successfully!');
}

main().catch(err => { console.error(err); process.exit(1); });

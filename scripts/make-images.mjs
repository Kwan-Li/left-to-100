// Renders the favicon, app icons and social share image from SVG. Run: node scripts/make-images.mjs
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const grad = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4fa3"/><stop offset="1" stop-color="#ffa24c"/></linearGradient></defs>`;

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${grad}<rect width="64" height="64" rx="16" fill="url(#g)"/><text x="32" y="45" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="900" fill="#fff" text-anchor="middle">%</text></svg>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="a" cx="0.85" cy="0" r="0.8"><stop offset="0" stop-color="#ff4fa3" stop-opacity="0.45"/><stop offset="1" stop-color="#ff4fa3" stop-opacity="0"/></radialGradient>
    <radialGradient id="b" cx="0" cy="0.2" r="0.7"><stop offset="0" stop-color="#2ee6c8" stop-opacity="0.25"/><stop offset="1" stop-color="#2ee6c8" stop-opacity="0"/></radialGradient>
    <linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#ff4fa3"/><stop offset="1" stop-color="#ffa24c"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#120d24"/>
  <rect width="1200" height="630" fill="url(#a)"/>
  <rect width="1200" height="630" fill="url(#b)"/>
  <g font-family="Helvetica, Arial, sans-serif">
    <rect x="80" y="80" width="72" height="72" rx="18" fill="url(#t)"/>
    <text x="116" y="134" font-size="44" font-weight="900" fill="#fff" text-anchor="middle">%</text>
    <text x="172" y="131" font-size="40" font-weight="800" fill="#f4f0ff">LeftTo100</text>
    <text x="80" y="290" font-size="84" font-weight="900" fill="#f4f0ff">GTA 6 100%</text>
    <text x="80" y="385" font-size="84" font-weight="900" fill="url(#t)">completion calculator</text>
    <text x="80" y="470" font-size="34" fill="#b3a9d6">See what's left, what to skip, and which card sets to finish.</text>
    <text x="80" y="550" font-size="28" fill="#2ee6c8">Free · Open source · No account · Spoiler-safe</text>
  </g>
</svg>`;

writeFileSync('public/favicon.svg', icon);
await sharp(Buffer.from(icon)).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(Buffer.from(icon)).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(Buffer.from(icon)).resize(32, 32).toFormat('png').toFile('public/favicon-32.png');
await sharp(Buffer.from(og)).png().toFile('public/og.png');
console.log('images written');

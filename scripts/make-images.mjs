// Renders the favicon, app icons and social share image. Run: pnpm images (node scripts/make-images.mjs)
// The emblem lives in one place, src/brand/emblem.svg (the header mark inlines the same file).
// The OG text comes from src/copy/r1.ts (Node strips the types), so re-run this after copy changes.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { r1 } from '../src/copy/r1.ts';

const root = new URL('../', import.meta.url);
const out = (p) => new URL(`public/${p}`, root);
const emblem = readFileSync(new URL('src/brand/emblem.svg', root), 'utf8').trim();

/** The emblem's inner markup (no outer <svg>), for embedding at any position and size. */
const emblemInner = emblem.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const placeEmblem = (x, y, size, idSuffix) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 64 64">${emblemInner.replaceAll('lt100-arc', `lt100-arc-${idSuffix}`)}</svg>`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap using an average glyph width. Good enough for a bold sans at display sizes. */
function wrap(text, fontSize, width, avg = 0.56) {
  const perLine = Math.max(4, Math.floor(width / (fontSize * avg)));
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= perLine) line += ' ' + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest font size (from the list) whose wrapped text fits in maxLines. */
function fit(text, sizes, width, maxLines) {
  for (const size of sizes) {
    const lines = wrap(text, size, width);
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  return { size, lines: wrap(text, size, width).slice(0, maxLines) };
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

writeFileSync(out('favicon.svg'), emblem + '\n');
const icon = Buffer.from(emblem);
await sharp(icon, { density: 72 * 8 }).resize(32, 32).png().toFile(out('favicon-32.png').pathname);
await sharp(icon, { density: 72 * 24 }).resize(192, 192).png().toFile(out('icon-192.png').pathname);
await sharp(icon, { density: 72 * 24 }).resize(512, 512).png().toFile(out('icon-512.png').pathname);

/* ------------------------------------------------------------------ */
/* OG image, 1200x630                                                  */
/* ------------------------------------------------------------------ */

const W = 1200;
const H = 630;
const PAD = 72;
const font = `font-family="Helvetica Neue, Helvetica, Arial, sans-serif"`;

// Left column: emblem + name at the top, headline anchored to the bottom, so no band is left empty.
const title = fit(r1.ogTitle, [76, 68, 60, 52, 46], 560, 4);
const titleLine = Math.round(title.size * 1.08);
const titleLast = H - PAD - 8;
const titleSvg = title.lines
  .map((l, i) => `<tspan x="${PAD}" y="${titleLast - (title.lines.length - 1 - i) * titleLine}">${esc(l)}</tspan>`)
  .join('');

// Right column: a framed mini result card in the site's style, with the sample row highlighted.
const card = { x: 668, y: PAD, w: W - 668 - PAD, h: H - 2 * PAD };
const rowX = card.x + 28;
const rowW = card.w - 56;
// "Name: N to go · skip up to M" renders as two lines like a planner row: the result, then the skip margin in teal.
const [lead, ...rest] = r1.ogSampleRow.split(' · ');
const tail = rest.join(' · ');
const sampleParts = tail ? [lead, tail] : [r1.ogSampleRow];
const sampleFit = [30, 27, 24].find((size) => sampleParts.every((p) => wrap(p, size, rowW - 44, 0.54).length === 1)) ?? 24;
const sampleLines = sampleParts.flatMap((p, i) => wrap(p, sampleFit, rowW - 44, 0.54).map((l) => ({ l, teal: i === 1 })));
const sampleStep = Math.round(sampleFit * 1.3);
const sampleSvg = sampleLines
  .map(({ l, teal }, i) => `<tspan x="${rowX + 22}" dy="${i === 0 ? 0 : sampleStep}"${teal ? ' fill="#2ee6c8" font-weight="600"' : ''}>${esc(l)}</tspan>`)
  .join('');
const sampleH = 26 + sampleFit + (sampleLines.length - 1) * sampleStep + 14;
const skeleton = (y, w1, w2, done) => `
    <rect x="${rowX}" y="${y}" width="${rowW}" height="60" rx="14" fill="#1a1433" stroke="#3a3166"/>
    <rect x="${rowX + 22}" y="${y + 17}" width="${w1}" height="12" rx="6" fill="#4a4080"/>
    <rect x="${rowX + 22}" y="${y + 37}" width="${w2}" height="9" rx="4.5" fill="#342b63"/>
    <rect x="${rowX + rowW - 108}" y="${y + 13}" width="86" height="36" rx="9" fill="#120d24" stroke="#8a7fc4"/>
    ${done ? `<path d="M${rowX + rowW - 76} ${y + 31} l8 8 l16 -16" fill="none" stroke="#3ddc97" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}`;
const sampleY = card.y + 120;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glowA" cx="0.88" cy="0" r="0.75"><stop offset="0" stop-color="#ff4fa3" stop-opacity="0.42"/><stop offset="1" stop-color="#ff4fa3" stop-opacity="0"/></radialGradient>
    <radialGradient id="glowB" cx="0" cy="1" r="0.75"><stop offset="0" stop-color="#2ee6c8" stop-opacity="0.2"/><stop offset="1" stop-color="#2ee6c8" stop-opacity="0"/></radialGradient>
    <linearGradient id="sunset" x1="0" x2="1"><stop offset="0" stop-color="#ff4fa3"/><stop offset="1" stop-color="#ffb347"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#120d24"/>
  <rect width="${W}" height="${H}" fill="url(#glowA)"/>
  <rect width="${W}" height="${H}" fill="url(#glowB)"/>
  <g ${font}>
    ${placeEmblem(PAD, PAD, 104, 'og')}
    <text x="${PAD + 128}" y="${PAD + 70}" font-size="50" font-weight="800" fill="#f4f0ff" letter-spacing="-1">LeftTo100</text>
    <text font-size="${title.size}" font-weight="900" fill="#f4f0ff" letter-spacing="-1.5">${titleSvg}</text>

    <rect x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="28" fill="#211a3f" stroke="#4a4080" stroke-width="2"/>
    <rect x="${card.x + 28}" y="${card.y}" width="${card.w - 56}" height="6" rx="3" fill="url(#sunset)"/>
    <circle cx="${rowX + 26}" cy="${card.y + 66}" r="17" fill="none" stroke="#342b63" stroke-width="7"/>
    <circle cx="${rowX + 26}" cy="${card.y + 66}" r="17" fill="none" stroke="url(#sunset)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * 17 * 0.6).toFixed(1)} 200" transform="rotate(-90 ${rowX + 26} ${card.y + 66})"/>
    <rect x="${rowX + 62}" y="${card.y + 52}" width="190" height="12" rx="6" fill="#4a4080"/>
    <rect x="${rowX + 62}" y="${card.y + 74}" width="120" height="9" rx="4.5" fill="#342b63"/>

    <rect x="${rowX - 6}" y="${sampleY - 6}" width="${rowW + 12}" height="${sampleH + 12}" rx="18" fill="none" stroke="url(#sunset)" stroke-width="3"/>
    <rect x="${rowX}" y="${sampleY}" width="${rowW}" height="${sampleH}" rx="14" fill="#2a2250"/>
    <text x="${rowX + 22}" y="${sampleY + 18 + sampleFit}" font-size="${sampleFit}" font-weight="700" fill="#f4f0ff">${sampleSvg}</text>
    ${skeleton(sampleY + sampleH + 22, 170, 110, true)}
    ${skeleton(sampleY + sampleH + 22 + 78, 210, 90, false)}
    ${skeleton(sampleY + sampleH + 22 + 156, 150, 130, false)}
  </g>
</svg>`;

await sharp(Buffer.from(og)).png().toFile(out('og.png').pathname);
console.log('images written: favicon.svg, favicon-32.png, icon-192.png, icon-512.png, og.png');

// Renders the favicon, app icons and social share image. Run: pnpm images (node scripts/make-images.mjs)
// The emblem lives in one place, src/brand/emblem.svg (the header mark inlines the same file).
// The OG text comes from src/copy/r1.ts (Node strips the types), so re-run this after copy changes.
// The OG uses the site's own typefaces (scripts/og-fonts, OFL): librsvg finds them through a private fontconfig file,
// set up before sharp loads, so the output doesn't depend on fonts installed on the machine.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { r1 } from '../src/copy/r1.ts';

const root = new URL('../', import.meta.url);
const fcDir = mkdtempSync(join(tmpdir(), 'lt100-fc-'));
writeFileSync(
  join(fcDir, 'fonts.conf'),
  `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fileURLToPath(new URL('scripts/og-fonts/', root))}</dir><cachedir>${join(fcDir, 'cache')}</cachedir></fontconfig>`,
);
process.env.FONTCONFIG_FILE = join(fcDir, 'fonts.conf');
process.env.PANGOCAIRO_BACKEND = 'fc'; // macOS: use fontconfig instead of CoreText, so the private fonts are found
const { default: sharp } = await import('sharp');

const out = (p) => new URL(`public/${p}`, root);
const emblem = readFileSync(new URL('src/brand/emblem.svg', root), 'utf8').trim();

/** The emblem's inner markup (no outer <svg>), for embedding at any position and size. */
const emblemInner = emblem.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const placeEmblem = (x, y, size) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 64 64">${emblemInner}</svg>`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap using an average glyph width. Good enough for a bold sans at display sizes. */
function wrap(text, fontSize, width, avg = 0.5) {
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
/* OG image, 1200x630: a pause-menu stats screen                       */
/* ------------------------------------------------------------------ */

const W = 1200;
const H = 630;
const PAD = 64;
const C = { bg: '#0a0b0b', panel: '#141716', line: '#262b28', line2: '#343a36', text: '#eef1ea', muted: '#9aa39c', lime: '#c8ff3c', cyan: '#62d6ff' };
const DISPLAY = `font-family="Michroma"`;
const BODY = `font-family="Barlow"`;
const MONO = `font-family="Martian Mono"`;

// Left column: emblem and wordmark at the top, the headline anchored to the bottom.
const leftW = 520;
const title = fit(r1.ogTitle, [66, 60, 54, 48, 44], leftW, 4);
const titleLine = Math.round(title.size * 1.06);
const titleLast = H - PAD - 6;
const titleSvg = title.lines
  .map((l, i) => `<tspan x="${PAD}" y="${titleLast - (title.lines.length - 1 - i) * titleLine}">${esc(l)}</tspan>`)
  .join('');
const titleTop = titleLast - (title.lines.length - 1) * titleLine - title.size;
const [w1, w2, w3] = 'LeftTo100'.match(/^([A-Z][a-z]+)([A-Z][a-z]+)(\d+)$/).slice(1);

// Right column: the stats screen. A 35-cell strip, three counts, then the sample row focused like a menu item.
const card = { x: 640, y: PAD, w: W - 640 - PAD, h: H - 2 * PAD };
const inX = card.x + 32;
const inW = card.w - 56;
const cellGap = 3;
const cellW = (inW - 34 * cellGap) / 35;
const cellsY = card.y + 34;
const cells = Array.from({ length: 35 }, (_, i) => {
  const x = (inX + i * (cellW + cellGap)).toFixed(2);
  const kind = i < 14 ? 'd' : i < 23 ? 'p' : '';
  if (kind === 'd') return `<rect x="${x}" y="${cellsY}" width="${cellW.toFixed(2)}" height="30" fill="${C.lime}"/>`;
  if (kind === 'p') return `<rect x="${x}" y="${cellsY}" width="${cellW.toFixed(2)}" height="30" fill="url(#hatch)" stroke="${C.lime}" stroke-opacity="0.6"/>`;
  return `<rect x="${x}" y="${cellsY}" width="${cellW.toFixed(2)}" height="30" fill="#101211" stroke="${C.line2}"/>`;
}).join('');
const stats = [
  [14, 'done', C.lime],
  [9, 'in progress', C.text],
  [12, 'not entered', C.muted],
]
  .map(
    ([n, l, fill], i) => `
    <text x="${inX + i * (inW / 3)}" y="${cellsY + 92}" ${MONO} font-size="40" font-weight="700" fill="${fill}" letter-spacing="-1.5">${n}</text>
    <text x="${inX + i * (inW / 3)}" y="${cellsY + 120}" ${BODY} font-size="15" font-weight="700" fill="${C.muted}" letter-spacing="2">${l.toUpperCase()}</text>`,
  )
  .join('');

// "Animals: 38 to go · skip up to 155": the result in white with its number in lime, the skip margin in cyan.
const [lead, ...rest] = r1.ogSampleRow.split(' · ');
const tail = rest.join(' · ');
const leadSize = [30, 27, 24].find((size) => wrap(lead, size, inW - 20).length === 1) ?? 24;
const leadSvg = esc(lead).replace(/(\d[\d,]*)/, `<tspan fill="${C.lime}" ${MONO} font-weight="700">$1</tspan>`);
const rowY = cellsY + 156;
const rowH = 150;
const meterY = rowY + rowH - 44;
const meterW = inW - 28;
const need = 0.7; // where the required mark sits on the sample meter
const have = 0.46;
const segs = 24;
const segLines = Array.from({ length: segs - 1 }, (_, i) => {
  const x = (inX + 14 + ((i + 1) * meterW) / segs).toFixed(1);
  return `<rect x="${x}" y="${meterY}" width="2" height="16" fill="${C.bg}"/>`;
}).join('');
const meter = `
    <rect x="${inX + 14}" y="${meterY}" width="${meterW}" height="16" fill="#101211" stroke="${C.line2}"/>
    <rect x="${inX + 14 + meterW * need}" y="${meterY}" width="${meterW * (1 - need)}" height="16" fill="url(#skip)"/>
    <rect x="${inX + 14}" y="${meterY}" width="${meterW * have}" height="16" fill="${C.lime}"/>
    ${segLines}
    <rect x="${inX + 13 + meterW * need}" y="${meterY - 6}" width="3" height="28" fill="${C.text}"/>
    <path d="M${inX + 14 + meterW * have - 7} ${meterY + 30} l7 -9 l7 9 Z" fill="${C.lime}"/>`;
const ghost = (y, nameW) => `
    <rect x="${inX}" y="${y}" width="${inW}" height="62" fill="${C.panel}" stroke="${C.line}"/>
    <rect x="${inX + 16}" y="${y + 16}" width="${nameW}" height="11" fill="${C.line2}"/>
    <rect x="${inX + 16}" y="${y + 38}" width="${inW * 0.55}" height="9" fill="#1d211f"/>
    <rect x="${inX + inW - 104}" y="${y + 13}" width="88" height="36" fill="none" stroke="${C.line2}"/>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ffffff" fill-opacity="0.028"/></pattern>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#ffffff" stroke-opacity="0.025"/></pattern>
    <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill="${C.lime}" fill-opacity="0.6"/></pattern>
    <pattern id="skip" width="6" height="16" patternUnits="userSpaceOnUse"><rect width="3" height="16" fill="${C.cyan}" fill-opacity="0.45"/></pattern>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>

  ${placeEmblem(PAD, PAD, 64)}
  <text x="${PAD + 84}" y="${PAD + 43}" ${DISPLAY} font-size="27" fill="${C.text}" letter-spacing="1">${w1.toUpperCase()} ${w2.toUpperCase()} <tspan fill="${C.lime}">${w3}</tspan></text>

  <rect x="${PAD}" y="${titleTop - 30}" width="44" height="3" fill="${C.lime}"/>
  <rect x="${PAD}" y="${titleTop - 30}" width="44" height="3" fill="${C.lime}" filter="url(#glow)"/>
  <text ${BODY} font-size="${title.size}" font-weight="700" fill="${C.text}" letter-spacing="-0.5">${titleSvg}</text>

  <rect x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="4" fill="${C.panel}" stroke="${C.line}" stroke-width="2"/>
  ${cells}
  ${stats}

  <rect x="${inX - 8}" y="${rowY}" width="${inW + 16}" height="${rowH}" fill="${C.lime}" fill-opacity="0.06" stroke="${C.lime}" stroke-opacity="0.55" stroke-width="2"/>
  <rect x="${inX - 10}" y="${rowY + 12}" width="5" height="${rowH - 24}" fill="${C.lime}" filter="url(#glow)"/>
  <rect x="${inX - 10}" y="${rowY + 12}" width="5" height="${rowH - 24}" fill="${C.lime}"/>
  <text x="${inX + 14}" y="${rowY + 22 + leadSize}" ${BODY} font-size="${leadSize}" font-weight="700" fill="${C.text}">${leadSvg}</text>
  ${tail ? `<text x="${inX + 14}" y="${rowY + 26 + leadSize + 32}" ${BODY} font-size="23" font-weight="600" fill="${C.cyan}">${esc(tail)}</text>` : ''}
  ${meter}

  ${ghost(rowY + rowH + 16, 150)}
  ${ghost(rowY + rowH + 16 + 74, 196)}

  <rect width="${W}" height="${H}" fill="url(#scan)"/>
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`;

await sharp(Buffer.from(og)).png().toFile(out('og.png').pathname);
console.log('images written: favicon.svg, favicon-32.png, icon-192.png, icon-512.png, og.png');

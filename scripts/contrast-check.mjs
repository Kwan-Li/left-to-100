// WCAG 2.x contrast check for the theme tokens in src/styles/global.css, in both themes.
// Run: node scripts/contrast-check.mjs   (exits 1 if any pair fails)
// Text pairs need 4.5:1. Control borders (inputs, selects, segmented controls) and the focus ring need 3:1.
// Surfaces include the tinted mixes the CSS builds with color-mix(), computed the same way (sRGB interpolation).
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

/** Custom properties from a CSS block body. */
const props = (body) => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const darkBody = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
const lightBody = css.match(/@media \(prefers-color-scheme: light\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}/)[1];
const dark = props(darkBody);
const themes = { dark, light: { ...dark, ...props(lightBody) } };

function resolve(theme, value) {
  const v = value.trim();
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  if (ref) return resolve(theme, theme[ref[1]]);
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  throw new Error(`Can't resolve ${value}`);
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
/** color-mix(in srgb, a p%, b): also what "a p% over transparent" composites to on top of b. */
const mix = (a, p, b) => hex(rgb(a).map((x, i) => x * p + rgb(b)[i] * (1 - p)));
const lum = (h) => {
  const [r, g, b] = rgb(h).map((x) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const rows = [];
let failed = 0;

for (const [name, theme] of Object.entries(themes)) {
  const t = (k) => resolve(theme, `var(--${k})`);
  const plain = { bg: t('bg'), 'bg-2': t('bg-2'), surface: t('surface'), 'surface-2': t('surface-2') };
  // Tinted surfaces used by the CSS.
  const tinted = {
    'bg + pink glow 18%': mix(t('pink'), 0.18, t('bg')),
    'bg + teal glow 12%': mix(t('teal'), 0.12, t('bg')),
    'trap (orange 12% on surface)': mix(t('orange'), 0.12, t('surface')),
    'callout (orange 10% on surface)': mix(t('orange'), 0.1, t('surface')),
    'callout.spoiler (pink 10% on surface)': mix(t('pink'), 0.1, t('surface')),
    'lost set (red 6% on bg-2)': mix(t('red'), 0.06, t('bg-2')),
  };
  const all = { ...plain, ...tinted };
  const add = (cat, fgName, fg, bgName, bg, min) => {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failed++;
    rows.push({ theme: name, cat, pair: `${fgName} on ${bgName}`, fg, bg, ratio: r, min, ok });
  };

  // Body text and every accent used as text, on every surface.
  for (const fg of ['text', 'muted', 'pink', 'orange', 'teal', 'yellow', 'red', 'ok']) {
    for (const [bgName, bg] of Object.entries(all)) add('text', `--${fg}`, t(fg), bgName, bg, 4.5);
  }
  // Text on its own tinted chip.
  add('text', '--teal', t('teal'), 'Finish chip (teal 20% on bg-2)', mix(t('teal'), 0.2, t('bg-2')), 4.5);
  add('text', '--ok', t('ok'), 'Done chip (ok 18% on bg-2)', mix(t('ok'), 0.18, t('bg-2')), 4.5);
  add('text', '--yellow', t('yellow'), 'Uncertain chip (yellow 18% on bg-2)', mix(t('yellow'), 0.18, t('bg-2')), 4.5);
  add('text', '--muted', t('muted'), 'Skip chip (surface-2 on bg-2)', t('surface-2'), 4.5);
  add('text', '--red', t('red'), 'danger hover (red 10% on surface)', mix(t('red'), 0.1, t('surface')), 4.5);
  add('text', '--muted', t('muted'), 'nav hover (surface)', t('surface'), 4.5);
  // Primary button ink across the whole gradient (the midpoint is the sRGB average of the stops).
  add('button', '--on-grad', t('on-grad'), '--grad-a', t('grad-a'), 4.5);
  add('button', '--on-grad', t('on-grad'), 'gradient midpoint', mix(t('grad-a'), 0.5, t('grad-b')), 4.5);
  add('button', '--on-grad', t('on-grad'), '--grad-b', t('grad-b'), 4.5);
  add('button', '--seg-on-ink', t('seg-on-ink'), '--seg-on-bg', t('seg-on-bg'), 4.5);
  add('button', 'skip link --bg', t('bg'), '--text', t('text'), 4.5);
  // Control borders on the control's own fill and on every surface a control sits on.
  const fills = { 'input fill (bg-2)': t('bg-2'), 'card input fill': t('card-input-bg'), ...plain };
  for (const [bgName, bg] of Object.entries(fills)) add('control border', '--control-border', t('control-border'), bgName, bg, 3);
  // Number-input placeholder ("?") at full strength on both input fills (home rows, card tiles).
  add('placeholder', '--placeholder', t('placeholder'), 'home input fill (bg-2)', t('bg-2'), 4.5);
  add('placeholder', '--placeholder', t('placeholder'), 'card input fill (--card-input-bg)', t('card-input-bg'), 4.5);
  add('control border', '--red (invalid)', t('red'), 'input fill (bg-2)', t('bg-2'), 3);
  add('control border', '--red (invalid)', t('red'), 'card input fill', t('card-input-bg'), 3);
  for (const [bgName, bg] of Object.entries(plain)) add('focus ring', '--focus', t('focus'), bgName, bg, 3);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('theme', 6), pad('category', 15), pad('pair', 58), pad('fg', 8), pad('bg', 8), 'ratio  min  result');
for (const r of rows) {
  console.log(pad(r.theme, 6), pad(r.cat, 15), pad(r.pair, 58), pad(r.fg, 8), pad(r.bg, 8), r.ratio.toFixed(2).padStart(5), ' ', String(r.min).padEnd(4), r.ok ? 'ok' : 'FAIL');
}
console.log('\nWorst per theme and category:');
const groups = {};
for (const r of rows) {
  const k = `${r.theme} / ${r.cat}`;
  if (!groups[k] || r.ratio < groups[k].ratio) groups[k] = r;
}
for (const [k, r] of Object.entries(groups)) console.log(`  ${pad(k, 28)} ${r.ratio.toFixed(2)}:1  (${r.pair}, min ${r.min})`);
console.log(failed ? `\n${failed} pair(s) FAIL` : `\nAll ${rows.length} pairs pass.`);
process.exit(failed ? 1 : 0);

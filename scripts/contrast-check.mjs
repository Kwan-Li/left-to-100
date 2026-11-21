// WCAG 2.x contrast check for the theme tokens in src/styles/global.css (dark only).
// Run: node scripts/contrast-check.mjs   (exits 1 if any pair fails)
// Text pairs need 4.5:1. Control borders (inputs, selects, steppers, segmented controls) and the focus ring need 3:1.
// Surfaces include the tinted mixes the CSS lays over them (an rgb(... / a) tint composites like color-mix in sRGB).
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

/** Custom properties from a CSS block body. */
const props = (body) => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const theme = props(css.match(/:root\s*\{([\s\S]*?)\n\}/)[1]);

function resolve(value) {
  const v = value.trim();
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  if (ref) return resolve(theme[ref[1]]);
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
const add = (cat, fgName, fg, bgName, bg, min) => {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  rows.push({ cat, pair: `${fgName} on ${bgName}`, fg, bg, ratio: r, min, ok });
};

const t = (k) => resolve(`var(--${k})`);
const plain = { bg: t('bg'), 'bg-2': t('bg-2'), panel: t('panel'), 'panel-2': t('panel-2') };
const ALL = ['text', 'muted', 'dim', 'lime', 'cyan', 'amber', 'red'];
// Tinted surfaces the CSS builds (planner.css and global.css), composited the same way the browser does, each with
// the text colors that actually appear on it. Gradient tints are checked at their strongest point.
const tinted = [
  ['selected tab (lime 14% on panel-2)', mix(t('lime'), 0.14, t('panel-2')), ['text', 'lime']],
  ['selected phone tab (lime 16% on panel-2)', mix(t('lime'), 0.16, t('panel-2')), ['text', 'lime']],
  ['chapter bar warn (amber 8% on bg-2)', mix(t('amber'), 0.08, t('bg-2')), ['text', 'muted', 'dim', 'amber']],
  ['done row (lime 6% on panel)', mix(t('lime'), 0.06, t('panel')), ALL],
  ['trap note (amber 7% on panel)', mix(t('amber'), 0.07, t('panel')), ['text', 'amber']],
  ['trap note (amber 7% on panel-2)', mix(t('amber'), 0.07, t('panel-2')), ['text', 'amber']],
  ['hint (white 2% on panel-2)', mix('#ffffff', 0.02, t('panel-2')), ['text', 'muted']],
  ['card result (lime 14% on panel)', mix(t('lime'), 0.14, t('panel')), ['text', 'muted', 'lime', 'cyan']],
  ['card result bad (red 10% on panel)', mix(t('red'), 0.1, t('panel')), ['text', 'muted', 'red']],
  ['done tile (lime 6% on panel)', mix(t('lime'), 0.06, t('panel')), ['text', 'muted', 'lime', 'amber', 'red']],
  ['skip tile stripe (cyan 4.5% on bg-2)', mix(t('cyan'), 0.045, t('bg-2')), ALL],
  ['lost tile (red 6% on bg-2)', mix(t('red'), 0.06, t('bg-2')), ['text', 'muted', 'lime', 'amber', 'red']],
  ['before-you-finish warn (amber 6% on panel)', mix(t('amber'), 0.06, t('panel')), ['text', 'muted', 'lime', 'amber']],
  ['callout (amber 8% on panel)', mix(t('amber'), 0.08, t('panel')), ['text', 'muted', 'amber']],
];

// Body text and every accent used as text, on every plain surface; on tinted surfaces, the colors used there.
for (const fg of ALL) for (const [bgName, bg] of Object.entries(plain)) add('text', `--${fg}`, t(fg), bgName, bg, 4.5);
for (const [bgName, bg, fgs] of tinted) for (const fg of fgs) add('text', `--${fg}`, t(fg), bgName, bg, 4.5);
// Row outcomes: "skip up to n" is cyan, but "no skips" is muted (cyan only when there is something to skip). Rows sit
// on the panel, or panel-2 while focused.
for (const [bgName, bg] of [['row (panel)', t('panel')], ['focused row (panel-2)', t('panel-2')]]) {
  add('outcome', '"skip up to n" --cyan', t('cyan'), bgName, bg, 4.5);
  add('outcome', '"no skips" --muted', t('muted'), bgName, bg, 4.5);
}
const tint = Object.fromEntries(tinted.map(([n, bg]) => [n, bg]));
const all = { ...plain, ...tint };
// Dark ink on the lime fills: primary button, pressed filter, selected answer, DONE chips, skip link.
add('ink', '--lime-ink', t('lime-ink'), '--lime', t('lime'), 4.5);
add('ink', '--lime-ink', t('lime-ink'), '--lime-hi (button hover)', t('lime-hi'), 4.5);
add('ink', 'skip link --bg', t('bg'), '--lime', t('lime'), 4.5);
add('ink', '--lime-ink (focus ring on a lime fill)', t('lime-ink'), '--lime', t('lime'), 3);
// Number-input placeholder ("?") at full strength on the input fill.
add('placeholder', '--placeholder', t('placeholder'), 'input fill (--input-bg)', t('input-bg'), 4.5);
// Control borders on the control's own fill and on every surface a control sits on.
// (Tinted surfaces that hold an input, select or stepper. Tabs and the card result hold no bordered control.)
const controlTints = ['chapter bar warn', 'done row', 'done tile', 'skip tile', 'lost tile'];
const fills = {
  'input fill (--input-bg)': t('input-bg'),
  ...plain,
  ...Object.fromEntries(Object.entries(tint).filter(([n]) => controlTints.some((c) => n.startsWith(c)))),
};
for (const [bgName, bg] of Object.entries(fills)) add('control border', '--control-border', t('control-border'), bgName, bg, 3);
add('control border', '--red (invalid)', t('red'), 'input fill (--input-bg)', t('input-bg'), 3);
for (const [bgName, bg] of Object.entries(all)) add('focus ring', '--focus', t('focus'), bgName, bg, 3);

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('category', 15), pad('pair', 58), pad('fg', 8), pad('bg', 8), 'ratio  min  result');
for (const r of rows) {
  console.log(pad(r.cat, 15), pad(r.pair, 58), pad(r.fg, 8), pad(r.bg, 8), r.ratio.toFixed(2).padStart(5), ' ', String(r.min).padEnd(4), r.ok ? 'ok' : 'FAIL');
}
console.log('\nWorst per category:');
const groups = {};
for (const r of rows) {
  const k = r.cat;
  if (!groups[k] || r.ratio < groups[k].ratio) groups[k] = r;
}
for (const [k, r] of Object.entries(groups)) console.log(`  ${pad(k, 16)} ${r.ratio.toFixed(2)}:1  (${r.pair}, min ${r.min})`);
console.log(failed ? `\n${failed} pair(s) FAIL` : `\nAll ${rows.length} pairs pass.`);
process.exit(failed ? 1 : 0);

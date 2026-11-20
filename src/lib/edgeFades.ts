/** Width of an edge fade (global.css .fade-l / .fade-r). */
const FADE = 28;

/**
 * Scroll a sideways strip (scrollLeft only, never scrollIntoView, so the page doesn't move) until `item` and its
 * focus ring sit fully inside the strip and clear of any edge fade that will still be showing.
 */
export function revealInStrip(strip: HTMLElement, item: Element): void {
  const max = strip.scrollWidth - strip.clientWidth;
  if (max <= 0) return;
  const cs = getComputedStyle(item);
  const ring = (parseFloat(cs.outlineWidth) || 0) + Math.max(0, parseFloat(cs.outlineOffset) || 0);
  const s = strip.getBoundingClientRect();
  const c = item.getBoundingClientRect();
  const left = c.left - s.left - ring; // ring's left edge, relative to the strip's visible box
  const right = c.right - s.left + ring;
  let target = strip.scrollLeft;
  // A fade shows on a side only while there is more to scroll that way, so aim one fade-width in from the edge;
  // landing on the boundary instead drops that fade.
  // Rounded away from the item, since some engines (WebKit) snap scrollLeft to whole pixels.
  if (left < 0 || (left < FADE && strip.scrollLeft > 1)) target = Math.floor(target + left - FADE);
  else if (right > s.width || (right > s.width - FADE && max - strip.scrollLeft > 1))
    target = Math.ceil(target + right + FADE - s.width);
  target = Math.max(0, Math.min(max, target));
  if (Math.abs(target - strip.scrollLeft) > 0.5) strip.scrollLeft = target;
}

/**
 * Edge fades for a sideways-scrolling strip (the header nav and the planner jump links): `fade-l` / `fade-r` are
 * set only toward a side that has more to scroll, and drop at the scroll boundary. A link reached by keyboard is
 * scrolled clear of the fades. The header nav also sets its starting scroll and fades from an inline script in
 * Layout.astro, before first paint; keep that toggle logic in step with `update` here.
 */
export function edgeFades(el: HTMLElement): () => void {
  const update = () => {
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle('fade-l', el.scrollLeft > 1);
    el.classList.toggle('fade-r', max - el.scrollLeft > 1);
  };
  // Keyboard focus only: a tap or click that focused a link must not slide it away before the click lands.
  const focusin = (e: FocusEvent) => {
    const a = e.target instanceof Element ? e.target.closest('a, button') : null;
    if (!a || !el.contains(a) || !a.matches(':focus-visible')) return;
    revealInStrip(el, a);
    update();
  };
  update();
  el.addEventListener('scroll', update, { passive: true });
  el.addEventListener('focusin', focusin);
  window.addEventListener('resize', update);
  return () => {
    el.removeEventListener('scroll', update);
    el.removeEventListener('focusin', focusin);
    window.removeEventListener('resize', update);
  };
}

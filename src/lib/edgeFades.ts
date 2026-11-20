/**
 * Edge fades for a sideways-scrolling strip (the planner jump links): `fade-l` / `fade-r` are set only toward a
 * side that has more to scroll, and drop at the scroll boundary. The header nav runs the same logic from an
 * inline script in Layout.astro so it applies before first paint; keep the two in step.
 */
export function edgeFades(el: HTMLElement): () => void {
  const update = () => {
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle('fade-l', el.scrollLeft > 1);
    el.classList.toggle('fade-r', max - el.scrollLeft > 1);
  };
  update();
  el.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  return () => {
    el.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
  };
}

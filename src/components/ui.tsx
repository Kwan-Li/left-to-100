/** Small shared pieces for the islands: icons and a text highlighter. */

/** `text` with the first occurrence of `part` in <strong>. The text content stays exactly `text`. */
export function Highlight({ text, part }: { text: string; part: string }) {
  const i = part ? text.indexOf(part) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong>{part}</strong>
      {text.slice(i + part.length)}
    </>
  );
}

/** Warning triangle, drawn in currentColor. Decorative. */
export function WarnIcon() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.5 2.5 20.5h19L12 3.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <path d="M12 10v4.5M12 17.2v.1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    </svg>
  );
}

/** Square "i" marker for neutral notes, drawn in currentColor. Decorative. */
export function InfoIcon() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M12 11v6M12 7.2v.1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    </svg>
  );
}

/** Check mark, drawn in currentColor. Decorative. */
export function CheckIcon() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m4.5 12.5 5 5 10-11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

/** Floppy-style save marker for "keep a manual save" lines. Decorative. */
export function SaveIcon() {
  return (
    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 4h12.5L20 7.5V20H4V4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <path d="M8 4v5h7V4M7.5 20v-6h9v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
    </svg>
  );
}

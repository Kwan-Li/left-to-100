/**
 * UI round 1 strings. Final text from the copy writer (copy/COPY_DECK_R1.md), pasted verbatim.
 * Keep this file plain, erasable TypeScript: scripts/make-images.mjs imports it with Node's type stripping
 * to render the OG image, so `pnpm images` picks up pasted text without other changes.
 */

export interface R1Copy {
  /** Summary of the collapsed "Watch out" traps under a requirement row. n = number of traps. */
  trapToggle: (n: number) => string;
  /** One line above the requirement form and the card grid explaining the reported/disputed badges. */
  badgeLegend: string;
  /** Error shown in place of a row result when the typed count is above the maximum. */
  errMax: (max: number) => string;
  /** aria-label of the jump links in the planner summary panel. */
  jumpNavLabel: string;
  /** Jump link to the "before you finish" panel. */
  jumpBeforeFinish: string;
  /** Strip under the chapter picker on the home page. */
  chapterStrip: {
    /** n things are reported lost at the end of `chapter` (a label such as "Chapter 2"). */
    some: (n: number, chapter: string) => string;
    /** Nothing is reported lost at the end of `chapter`. */
    none: (chapter: string) => string;
    notStarted: string;
    finished: string;
  };
  /** Link text in the chapter strip, pointing at #dont-lose. */
  chapterStripLink: string;
  /** Heading of the "before you finish" panel while the player is in a chapter. `chapter` is its label. */
  dontLoseHeading: (chapter: string) => string;
  /** Link after the card grid back to the card plan result. */
  backToResult: string;
  /** Card tile verdict when the set's Finish/Skip depends on an unconfirmed missable. */
  verdictUncertain: string;
  /** Card tile verdict for a set that is already complete. */
  verdictDone: string;
  /** Second step of the inline reset confirm: the button that actually resets. */
  resetConfirm: string;
  /** Second step of the inline reset confirm: the button that backs out. */
  resetCancel: string;
  /** Primary hero button on the home page, linking to the calculator. */
  heroCta: string;
  /** Screen-reader announcement when leaving a count input. `result` is the row's outcome text. */
  announce: (name: string, result: string) => string;
  /** Muted hint under a missable question that has no answer yet. */
  missableUnanswered: string;
  /** OG image headline. */
  ogTitle: string;
  /** OG image sample result row, e.g. a requirement with "N to go · skip up to M". */
  ogSampleRow: string;
}

export const r1: R1Copy = {
  trapToggle: (n) => (n === 1 ? 'Watch out: 1 note' : `Watch out: ${n} notes`),
  badgeLegend: 'Unmarked items are verified (2+ sources). Badges mark reported (1 source) or disputed items.',
  errMax: (max) => `Enter ${max} or less`,
  jumpNavLabel: 'Calculator sections',
  jumpBeforeFinish: 'Before you finish',
  chapterStrip: {
    some: (n, chapter) =>
      n === 1 ? `1 reported missable at the end of ${chapter}.` : `${n} reported missables at the end of ${chapter}.`,
    none: (chapter) => `No 100% missables are reported at the end of ${chapter}.`,
    notStarted: 'Pick your chapter above to see spoiler-safe missable warnings.',
    finished: 'No chapter lockouts ahead. Log earlier missables to update your plan.',
  },
  chapterStripLink: 'See chapter missables',
  dontLoseHeading: (chapter) => `Before you finish ${chapter}`,
  backToResult: 'Back to your card plan',
  verdictUncertain: 'Finish or skip',
  verdictDone: 'Done',
  resetConfirm: 'Confirm reset',
  resetCancel: 'Cancel',
  heroCta: 'Enter your counts',
  announce: (name, result) => `${name}: ${result}`,
  missableUnanswered: 'Not answered yet—treated as "Not sure".',
  ogTitle: "GTA 6 100%: what's left and what to skip",
  ogSampleRow: 'Animals: 38 to go · skip up to 155',
};

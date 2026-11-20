/**
 * UI round 1 strings. Placeholder values (⟦key⟧) until the copy writer's final text is pasted in.
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
  trapToggle: (n) => (n === 1 ? `⟦trapToggle.one:${n}⟧` : `⟦trapToggle.other:${n}⟧`),
  badgeLegend: '⟦badgeLegend⟧',
  errMax: (max) => `⟦errMax:${max}⟧`,
  jumpNavLabel: '⟦jumpNavLabel⟧',
  jumpBeforeFinish: '⟦jumpBeforeFinish⟧',
  chapterStrip: {
    some: (n, chapter) => (n === 1 ? `⟦chapterStrip.some.one:${n}:${chapter}⟧` : `⟦chapterStrip.some.other:${n}:${chapter}⟧`),
    none: (chapter) => `⟦chapterStrip.none:${chapter}⟧`,
    notStarted: '⟦chapterStrip.notStarted⟧',
    finished: '⟦chapterStrip.finished⟧',
  },
  chapterStripLink: '⟦chapterStripLink⟧',
  dontLoseHeading: (chapter) => `⟦dontLoseHeading:${chapter}⟧`,
  backToResult: '⟦backToResult⟧',
  verdictUncertain: '⟦verdictUncertain⟧',
  verdictDone: '⟦verdictDone⟧',
  resetConfirm: '⟦resetConfirm⟧',
  resetCancel: '⟦resetCancel⟧',
  heroCta: '⟦heroCta⟧',
  announce: (name, result) => `⟦announce:${name}:${result}⟧`,
  missableUnanswered: '⟦missableUnanswered⟧',
  ogTitle: '⟦ogTitle⟧',
  ogSampleRow: '⟦ogSampleRow⟧',
};

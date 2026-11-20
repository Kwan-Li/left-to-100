/**
 * UI round 2 strings. Final text from the copy writer (copy/COPY_DECK_R2.md), pasted verbatim.
 * Same rules as r1.ts: plain, erasable TypeScript.
 */

export interface R2Copy {
  chapterStrip: {
    /**
     * Strip under the chapter picker when nothing on the checklist is reported lost at the end of `chapter`,
     * but the chapter does end at a point of no return (the panel below says to keep a manual save).
     */
    saveOnly: (chapter: string) => string;
  };
  /** Card plan result once 15 or more sets are already complete: nothing left to collect, no skip list. */
  cardsAchieved: string;
  /**
   * Card plan result when n sets have a count above the set size, so no plan can be made.
   * Shown in the error style, followed by `cardsInvalidLink`.
   */
  cardsInvalid: (n: number) => string;
  /** Link after `cardsInvalid` that moves focus to the first set with the error. */
  cardsInvalidLink: string;
}

export const r2: R2Copy = {
  chapterStrip: {
    saveOnly: (chapter) => `No 100% missables are reported in ${chapter}. Keep a manual save before the end.`,
  },
  cardsAchieved: "You've hit the 15-set target\u2014no more cards needed for 100%.",
  cardsInvalid: (n) =>
    n === 1 ? '1 set has a count above its size. Lower it to get your plan.' : `${n} sets have counts above their sizes. Lower them to get your plan.`,
  cardsInvalidLink: 'Go to first error',
};

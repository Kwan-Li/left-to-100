/**
 * UI round 2 strings. Placeholder values (⟦key⟧) until the copy writer's final text is pasted in.
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
   * Shown in the error style; the whole line links to the first set with the error.
   */
  cardsInvalid: (n: number) => string;
}

export const r2: R2Copy = {
  chapterStrip: {
    saveOnly: (chapter) => `⟦chapterStrip.saveOnly:${chapter}⟧`,
  },
  cardsAchieved: '⟦cardsAchieved⟧',
  cardsInvalid: (n) => (n === 1 ? `⟦cardsInvalid.one:${n}⟧` : `⟦cardsInvalid.other:${n}⟧`),
};

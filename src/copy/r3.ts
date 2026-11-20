/**
 * UI round 3 strings. Final text from the copy writer (copy/COPY_DECK_R3.md), pasted verbatim.
 * Same rules as r1.ts: plain, erasable TypeScript.
 */

export interface R3Copy {
  /**
   * Requirement row outcome when the target may be out of reach, but only because of losses that aren't confirmed
   * (an item marked "Missed it" that is only reported, or whose data says other copies may exist). Replaces the
   * definite "can't reach" outcome in that case.
   * `remaining` = what is still to go, already formatted for the row's unit (e.g. "16", "$1,000", "20%").
   * The text may leave it out: the row still shows its target above.
   */
  rowAtRisk: (remaining: string) => string;
  /**
   * Optional muted line under an at-risk row (shown with the row's "where to check" hint: on phones for the row
   * whose input was focused last, always on desktop). Leave it empty ('') to show nothing.
   */
  rowAtRiskHint?: string;
  /**
   * Link text in the chapter strip when the chapter has no checklist missables: the `none` and `saveOnly` lines,
   * and the story-finished line. Replaces `chapterStripLink` ("See chapter missables") in those states.
   */
  chapterStripLinkNeutral: string;
}

export const r3: R3Copy = {
  rowAtRisk: (remaining) => `${remaining} to go \u00b7 may still be reachable`,
  rowAtRiskHint: "Items you marked missed aren't confirmed lost\u2014other copies may still exist.",
  chapterStripLinkNeutral: 'See chapter notes',
};

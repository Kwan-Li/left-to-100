/**
 * Redesign (Direction B, "Pause Menu") strings. Placeholder values (⟦key⟧) until the copy writer's final text is
 * pasted in. Same rules as r1.ts: plain, erasable TypeScript.
 */

export interface R4Copy {
  /** aria-label of the All / Left / Done filter above the requirement rows (home page). Not visible. */
  filterLabel: string;
  /** Filter button: show every row in the selected category. Followed by the row count in small mono digits. */
  filterAll: string;
  /** Filter button: show rows that aren't Done yet (replaces the old "Hide done" checkbox). Followed by a count. */
  filterLeft: string;
  /** Filter button: show only Done rows. Followed by a count. */
  filterDone: string;
  /**
   * Shown in place of the rows when the Done filter is on and nothing in the selected category is Done yet.
   * (The Left filter with nothing left reuses the existing "All done in this group.")
   */
  filterEmptyDone: string;
  /** Legend next to the filter (desktop only), for the lime part of each row's meter: the amount the game needs. */
  legendNeeded: string;
  /** Legend next to the filter (desktop only), for the striped cyan part of the meter: the amount you can skip. */
  legendSkip: string;
  /**
   * Progress line on each category tab of the desktop rail ("1 / 20 done" in the mockup). `done` = Done rows in the
   * category, `total` = rows in it; the first occurrence of `done` is highlighted in lime. On the mobile tab switch
   * it is visually replaced by a bare "1/20" (digits only) but still read out as the tab's accessible name.
   */
  tabProgress: (done: number, total: number) => string;
  /** Keyboard hint under the desktop category rail, shown next to key caps. Hidden on touch layouts. */
  kbdHint: {
    /** After the "Tab" key cap, e.g. what Tab does in the form. */
    tab: string;
    /** After the "↵" (Enter) key cap, e.g. that Enter moves to the next count. */
    enter: string;
  };
  /** aria-label of the − button left of a count input (rows and card tiles). `name` = requirement or set name. */
  stepDown: (name: string) => string;
  /** aria-label of the + button right of a count input (rows and card tiles). `name` = requirement or set name. */
  stepUp: (name: string) => string;
}

export const r4: R4Copy = {
  filterLabel: '⟦filterLabel⟧',
  filterAll: '⟦filterAll⟧',
  filterLeft: '⟦filterLeft⟧',
  filterDone: '⟦filterDone⟧',
  filterEmptyDone: '⟦filterEmptyDone⟧',
  legendNeeded: '⟦legendNeeded⟧',
  legendSkip: '⟦legendSkip⟧',
  tabProgress: (done, total) => `⟦tabProgress:${done}/${total}⟧`,
  kbdHint: {
    tab: '⟦kbdHint.tab⟧',
    enter: '⟦kbdHint.enter⟧',
  },
  stepDown: (name) => `⟦stepDown:${name}⟧`,
  stepUp: (name) => `⟦stepUp:${name}⟧`,
};

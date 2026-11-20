import type { CardSet, Chapter, Dataset, Missable, Requirement } from '../data/schema';

/** null = the player has not entered a value ("unknown"). */
export type Count = number | null;
export type MissableAnswer = 'logged' | 'missed' | 'unknown';

export interface PlayerState {
  v: 1;
  chapterId: string;
  req: Record<string, Count>;
  cards: Record<string, Count>;
  /** Sets the player explicitly marked as unobtainable. */
  unobtainable: string[];
  /** Answers about missables whose loss point the player has passed. */
  missables: Record<string, MissableAnswer>;
}

export function emptyState(data: Dataset): PlayerState {
  const first = [...data.chapters].sort((a, b) => a.order - b.order)[0];
  return { v: 1, chapterId: first.id, req: {}, cards: {}, unobtainable: [], missables: {} };
}

/* ------------------------------------------------------------------ */
/* Chapters                                                            */
/* ------------------------------------------------------------------ */

export function chapterOrder(data: Dataset, chapterId: string): number {
  return data.chapters.find((c) => c.id === chapterId)?.order ?? 0;
}

/** True once the player is past the end of `chapterId`. */
export function isPast(data: Dataset, state: PlayerState, chapterId: string): boolean {
  return chapterOrder(data, state.chapterId) > chapterOrder(data, chapterId);
}

/** Missables whose loss point is the end of the player's current chapter. Nothing later is revealed. */
export function upcomingMissables(data: Dataset, state: PlayerState): Missable[] {
  return data.missables.filter((m) => m.lostAfterChapterId === state.chapterId);
}

/** Missables the player has already passed and should answer about. */
export function passedMissables(data: Dataset, state: PlayerState): Missable[] {
  return data.missables.filter((m) => isPast(data, state, m.lostAfterChapterId));
}

export function currentChapter(data: Dataset, state: PlayerState): Chapter | undefined {
  return data.chapters.find((c) => c.id === state.chapterId);
}

/* ------------------------------------------------------------------ */
/* Requirements                                                        */
/* ------------------------------------------------------------------ */

export type RowResult =
  | { kind: 'unknown' }
  /** The typed count is above the most the game has. Treated as unknown until fixed. */
  | { kind: 'invalid'; value: number; max: number }
  | { kind: 'done'; value: number }
  | {
      kind: 'remaining';
      value: number;
      remaining: number;
      /** How many of the not-yet-done items can still be ignored. null when the total is unknown. */
      skipLeft: number | null;
      /** True when confirmed losses mean the requirement can no longer be met. */
      impossible: boolean;
      /**
       * True when the worst case (every missed item counted as lost) can't meet the requirement, but only
       * because of losses that aren't confirmed. Never true together with `impossible`.
       */
      atRisk: boolean;
    };

/** How many checklist items a missable entry covers (a grouped entry covers several). */
export function missableCount(m: Missable): number {
  return m.count ?? 1;
}

/**
 * A missed item is a confirmed loss only when the entry is verified and its data doesn't say other copies
 * may exist. Anything else is the worst case, not a certainty.
 */
export function isConfirmedLoss(m: Missable): boolean {
  return m.status === 'verified' && !m.copiesMayExist;
}

function missedFor(data: Dataset, state: PlayerState, requirementId: string): Missable[] {
  return passedMissables(data, state).filter(
    (m) => m.requirementId === requirementId && !m.cardSetId && state.missables[m.id] === 'missed',
  );
}

/**
 * Count of items the player marked missed for this requirement. A grouped entry answered "missed" counts
 * every item in it: other copies may exist but aren't confirmed, so the worst case is used.
 */
export function lostFor(data: Dataset, state: PlayerState, requirementId: string): number {
  return missedFor(data, state, requirementId).reduce((n, m) => n + missableCount(m), 0);
}

/** The part of `lostFor` that is a confirmed loss (see `isConfirmedLoss`). */
export function confirmedLostFor(data: Dataset, state: PlayerState, requirementId: string): number {
  return missedFor(data, state, requirementId)
    .filter(isConfirmedLoss)
    .reduce((n, m) => n + missableCount(m), 0);
}

/** Highest valid count for a requirement, or null when the game total is unknown. */
export function requirementMax(r: Requirement): number | null {
  return r.total;
}

/** True when a count is above its maximum. A null max means anything goes. */
export function isOverMax(value: Count | undefined, max: number | null): boolean {
  return typeof value === 'number' && max !== null && value > max;
}

export function rowResult(data: Dataset, state: PlayerState, r: Requirement): RowResult {
  const raw = state.req[r.id];
  if (raw === null || raw === undefined || Number.isNaN(raw)) return { kind: 'unknown' };
  const max = requirementMax(r);
  if (max !== null && isOverMax(raw, max)) return { kind: 'invalid', value: raw, max };
  const value = Math.max(0, raw);
  if (value >= r.required) return { kind: 'done', value };
  const remaining = r.required - value;
  if (r.total === null) return { kind: 'remaining', value, remaining, skipLeft: null, impossible: false, atRisk: false };
  // Grouped missables (count > 1) are already summed by lostFor. The skip margin is the worst case; only
  // confirmed losses make the row impossible, and unconfirmed ones that would put it out of reach make it at risk.
  const skipLeft = r.total - lostFor(data, state, r.id) - r.required;
  const impossible = r.total - confirmedLostFor(data, state, r.id) - r.required < 0;
  return { kind: 'remaining', value, remaining, skipLeft: Math.max(0, skipLeft), impossible, atRisk: !impossible && skipLeft < 0 };
}

export interface Summary {
  done: number;
  remaining: number;
  unknown: number;
  total: number;
}

/** Counts rows by state. Deliberately not a weighted percentage: the game's weighting is unverified. Out-of-range rows count as unknown. */
export function summary(data: Dataset, state: PlayerState): Summary {
  const s: Summary = { done: 0, remaining: 0, unknown: 0, total: data.requirements.length };
  for (const r of data.requirements) {
    const k = rowResult(data, state, r).kind;
    if (k === 'done') s.done++;
    else if (k === 'remaining') s.remaining++;
    else s.unknown++;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Card-set optimizer                                                  */
/* ------------------------------------------------------------------ */

export type SetAvailability = 'available' | 'lost' | 'uncertain';

export interface SetNeed {
  set: CardSet;
  logged: number;
  needed: number;
  availability: SetAvailability;
  /** Why the set is lost or uncertain. */
  reasons: string[];
}

export interface Pick {
  /** Total additional unique cards needed across the chosen sets. */
  min: number;
  setIds: string[];
}

export type CardPlan =
  /** Enough sets are already complete: nothing left to collect. */
  | { kind: 'achieved'; doneSetIds: string[] }
  /** Some sets are blank or over their size. `invalidSetIds` lists the over-size ones, in grid order. */
  | { kind: 'incomplete'; missingSetIds: string[]; invalidSetIds: string[] }
  | { kind: 'exact'; plan: Pick; needs: SetNeed[] }
  | { kind: 'range'; best: Pick; worst: Pick | null; uncertainSetIds: string[]; needs: SetNeed[] }
  | { kind: 'impossible'; available: number; needs: SetNeed[] };

export function setAvailability(data: Dataset, state: PlayerState, set: CardSet): { availability: SetAvailability; reasons: string[] } {
  // A fully logged set can't be lost: any missable card in it was already collected.
  if (isSetComplete(state, set)) return { availability: 'available', reasons: [] };
  if (state.unobtainable.includes(set.id)) return { availability: 'lost', reasons: ['You marked this set as unobtainable.'] };
  let availability: SetAvailability = 'available';
  const reasons: string[] = [];
  // A grouped card entry (count > 1) needs no extra arithmetic here: losing any one card already blocks the set.
  for (const m of passedMissables(data, state)) {
    if (m.cardSetId !== set.id) continue;
    const answer = state.missables[m.id] ?? 'unknown';
    if (answer === 'logged') continue;
    if (answer === 'missed' && isConfirmedLoss(m)) {
      return { availability: 'lost', reasons: [`You marked ${m.label} missed, and that loss is verified.`] };
    }
    availability = 'uncertain';
    reasons.push(
      answer === 'missed'
        ? `You marked ${m.label} missed. It isn't confirmed whether another copy exists.`
        : `Not sure whether you logged ${m.label}.`,
    );
  }
  return { availability, reasons };
}

/** Pick the `k` cheapest sets. Sets are independent, so sorting is optimal. */
export function cheapest(needs: SetNeed[], k: number): Pick | null {
  if (needs.length < k) return null;
  const chosen = [...needs].sort((a, b) => a.needed - b.needed || a.set.id.localeCompare(b.set.id)).slice(0, k);
  return { min: chosen.reduce((s, n) => s + n.needed, 0), setIds: chosen.map((n) => n.set.id) };
}

/** True when every card in the set is logged. */
export function isSetComplete(state: PlayerState, set: CardSet): boolean {
  return state.cards[set.id] === set.size;
}

export function cardPlan(data: Dataset, state: PlayerState): CardPlan {
  const k = data.totals.cardSetsRequired;
  // Enough finished sets settle it, whatever the other sets say.
  const done = data.cardSets.filter((s) => isSetComplete(state, s));
  if (done.length >= k) return { kind: 'achieved', doneSetIds: done.map((s) => s.id) };

  // Blank and out-of-range counts both leave a set unknown: the plan never guesses.
  const missing = data.cardSets.filter((s) => {
    const v = state.cards[s.id];
    return v === null || v === undefined || Number.isNaN(v) || isOverMax(v, s.size);
  });
  if (missing.length)
    return {
      kind: 'incomplete',
      missingSetIds: missing.map((s) => s.id),
      invalidSetIds: missing.filter((s) => isOverMax(state.cards[s.id], s.size)).map((s) => s.id),
    };

  const needs: SetNeed[] = data.cardSets.map((set) => {
    const logged = Math.min(set.size, Math.max(0, state.cards[set.id] as number));
    const { availability, reasons } = setAvailability(data, state, set);
    return { set, logged, needed: set.size - logged, availability, reasons };
  });

  const available = needs.filter((n) => n.availability === 'available');
  const uncertain = needs.filter((n) => n.availability === 'uncertain');

  if (uncertain.length === 0) {
    const plan = cheapest(available, k);
    return plan ? { kind: 'exact', plan, needs } : { kind: 'impossible', available: available.length, needs };
  }

  const best = cheapest([...available, ...uncertain], k);
  if (!best) return { kind: 'impossible', available: available.length + uncertain.length, needs };
  return {
    kind: 'range',
    best,
    worst: cheapest(available, k),
    uncertainSetIds: uncertain.map((n) => n.set.id),
    needs,
  };
}

/* ------------------------------------------------------------------ */
/* Per-set verdicts                                                    */
/* ------------------------------------------------------------------ */

/**
 * done      = the set is complete.
 * finish    = the plan finishes this set.
 * skip      = the plan skips this set.
 * uncertain = finish in one case of a range plan and skip in the other.
 */
export type SetVerdict = 'done' | 'finish' | 'skip' | 'uncertain';

/**
 * One verdict per set that always agrees with the plan. Sets without a verdict (null) have no plan yet, or
 * nothing left to decide (the card goal is already achieved).
 * In a range plan the worst case finishes only sets that are surely available; when even that falls short
 * (worst is null), the worst case is "finish every available set".
 */
export function setVerdicts(data: Dataset, state: PlayerState, plan: CardPlan): Record<string, SetVerdict | null> {
  const out: Record<string, SetVerdict | null> = {};
  for (const set of data.cardSets) {
    if (isSetComplete(state, set)) {
      out[set.id] = 'done';
      continue;
    }
    if (plan.kind === 'exact') {
      out[set.id] = plan.plan.setIds.includes(set.id) ? 'finish' : 'skip';
    } else if (plan.kind === 'range') {
      const best = plan.best.setIds.includes(set.id);
      const worst = plan.worst
        ? plan.worst.setIds.includes(set.id)
        : plan.needs.find((n) => n.set.id === set.id)?.availability === 'available';
      out[set.id] = best === worst ? (best ? 'finish' : 'skip') : 'uncertain';
    } else {
      out[set.id] = null;
    }
  }
  return out;
}

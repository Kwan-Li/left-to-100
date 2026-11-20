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
      /** True when known losses mean the requirement can no longer be met. */
      impossible: boolean;
    };

/** Count of items the player confirmed missed for this requirement. */
export function lostFor(data: Dataset, state: PlayerState, requirementId: string): number {
  return passedMissables(data, state).filter(
    (m) => m.requirementId === requirementId && !m.cardSetId && state.missables[m.id] === 'missed',
  ).length;
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
  if (r.total === null) return { kind: 'remaining', value, remaining, skipLeft: null, impossible: false };
  const lost = lostFor(data, state, r.id);
  const skipLeft = r.total - lost - r.required;
  return { kind: 'remaining', value, remaining, skipLeft: Math.max(0, skipLeft), impossible: skipLeft < 0 };
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
  | { kind: 'incomplete'; missingSetIds: string[] }
  | { kind: 'exact'; plan: Pick; needs: SetNeed[] }
  | { kind: 'range'; best: Pick; worst: Pick | null; uncertainSetIds: string[]; needs: SetNeed[] }
  | { kind: 'impossible'; available: number; needs: SetNeed[] };

export function setAvailability(data: Dataset, state: PlayerState, set: CardSet): { availability: SetAvailability; reasons: string[] } {
  // A fully logged set can't be lost: any missable card in it was already collected.
  if (state.cards[set.id] === set.size) return { availability: 'available', reasons: [] };
  if (state.unobtainable.includes(set.id)) return { availability: 'lost', reasons: ['You marked this set as unobtainable.'] };
  let availability: SetAvailability = 'available';
  const reasons: string[] = [];
  for (const m of passedMissables(data, state)) {
    if (m.cardSetId !== set.id) continue;
    const answer = state.missables[m.id] ?? 'unknown';
    if (answer === 'logged') continue;
    if (answer === 'missed' && m.status === 'verified') {
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

export function cardPlan(data: Dataset, state: PlayerState): CardPlan {
  const k = data.totals.cardSetsRequired;
  // Blank and out-of-range counts both leave a set unknown: the plan never guesses.
  const missing = data.cardSets.filter((s) => {
    const v = state.cards[s.id];
    return v === null || v === undefined || Number.isNaN(v) || isOverMax(v, s.size);
  });
  if (missing.length) return { kind: 'incomplete', missingSetIds: missing.map((s) => s.id) };

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
 * One verdict per set that always agrees with the plan. Sets without a verdict (null) have no plan yet.
 * In a range plan the worst case finishes only sets that are surely available; when even that falls short
 * (worst is null), the worst case is "finish every available set".
 */
export function setVerdicts(data: Dataset, state: PlayerState, plan: CardPlan): Record<string, SetVerdict | null> {
  const out: Record<string, SetVerdict | null> = {};
  for (const set of data.cardSets) {
    const v = state.cards[set.id];
    const complete = v === set.size;
    if (complete) {
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

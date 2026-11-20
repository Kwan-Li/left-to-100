import { z } from 'zod';

/**
 * verified  = at least two independent origins (different publishers that did their own work).
 * reported  = a single origin, even if other sites repeat it.
 * disputed  = independent sources conflict.
 */
export const Status = z.enum(['verified', 'reported', 'disputed']);
export type Status = z.infer<typeof Status>;

export const Source = z.object({
  publisher: z.string().min(1),
  url: z.url(),
});
export type Source = z.infer<typeof Source>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Fields every fact carries. */
const Provenance = {
  status: Status,
  sources: z.array(Source).min(1),
  lastVerified: isoDate,
  /** Optional free-text note in original words (e.g. why it is disputed). */
  note: z.string().optional(),
};

export const Category = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
});

export const Requirement = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  categoryId: z.string(),
  /** Short label as it appears on the in-game checklist. */
  name: z.string().min(1),
  /** count = items, dollars = cash target, percent = story completion. */
  unit: z.enum(['count', 'dollars', 'percent']),
  /** Amount needed for 100%. */
  required: z.number().int().positive(),
  /** Total available in the game, or null when no reliable total is known. */
  total: z.number().int().positive().nullable(),
  /** Spoiler-safe hint, in original words, for where the player can read their count before the story ends. */
  whereToCount: z.string().optional(),
  ...Provenance,
});
export type Requirement = z.infer<typeof Requirement>;

export const CardSet = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  size: z.number().int().positive(),
  ...Provenance,
});
export type CardSet = z.infer<typeof CardSet>;

export const Chapter = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Spoiler-safe label only, e.g. "Chapter 2". */
  label: z.string().min(1),
  order: z.number().int().nonnegative(),
});
export type Chapter = z.infer<typeof Chapter>;

export const Missable = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  requirementId: z.string(),
  /** Set when the missable is a collectible card. */
  cardSetId: z.string().optional(),
  /** Spoiler-safe, original-words label: what to grab. */
  label: z.string().min(1),
  /** Spoiler-safe hint for where it is. */
  where: z.string().min(1),
  /** Chapter id after which it is reported lost. */
  lostAfterChapterId: z.string(),
  /** What losing it means for 100%, in original words. */
  effect: z.string().min(1),
  /**
   * How many checklist items this entry covers when it groups several (e.g. five magazines in one house).
   * Missing it uses this many skips. Omitted = 1.
   */
  count: z.number().int().min(1).optional(),
  ...Provenance,
});
export type Missable = z.infer<typeof Missable>;

export const PointOfNoReturn = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Chapter id whose end is the point of no return. */
  chapterId: z.string(),
  /** Spoiler-safe label. Never name plot events. */
  label: z.string().min(1),
  ...Provenance,
});
export type PointOfNoReturn = z.infer<typeof PointOfNoReturn>;

export const Exception = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  requirementIds: z.array(z.string()).min(1),
  title: z.string().min(1),
  /** Original-words explanation of the trap. */
  detail: z.string().min(1),
  ...Provenance,
});
export type Exception = z.infer<typeof Exception>;

export const Dataset = z.object({
  version: z.string().min(1),
  game: z.string(),
  updated: isoDate,
  totals: z.object({
    requirements: z.number().int().positive(),
    cardSets: z.number().int().positive(),
    cards: z.number().int().positive(),
    cardSetsRequired: z.number().int().positive(),
  }),
  categories: z.array(Category).min(1),
  requirements: z.array(Requirement).min(1),
  cardSets: z.array(CardSet).min(1),
  chapters: z.array(Chapter).min(2),
  missables: z.array(Missable),
  pointsOfNoReturn: z.array(PointOfNoReturn),
  exceptions: z.array(Exception),
});
export type Dataset = z.infer<typeof Dataset>;

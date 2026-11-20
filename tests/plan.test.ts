import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cardPlan, emptyState, passedMissables, rowResult, summary, upcomingMissables, type PlayerState } from '../src/lib/plan';
import { decodeState, encodeState, sanitize } from '../src/lib/state';
import { fixture } from './fixture';

const data = fixture();
const req = (id: string) => data.requirements.find((r) => r.id === id)!;
const allCards = (v: number | ((size: number) => number)): PlayerState['cards'] =>
  Object.fromEntries(data.cardSets.map((s) => [s.id, typeof v === 'number' ? v : v(s.size)]));
const state = (p: Partial<PlayerState> = {}): PlayerState => ({ ...emptyState(data), ...p });

describe('requirement rows', () => {
  it('treats a blank input as unknown', () => {
    expect(rowResult(data, state(), req('stunts')).kind).toBe('unknown');
  });

  it('computes remaining and skip budget', () => {
    expect(rowResult(data, state({ req: { stunts: 12 } }), req('stunts'))).toEqual({
      kind: 'remaining', value: 12, remaining: 18, skipLeft: 10, impossible: false,
    });
  });

  it('marks a row done at the threshold', () => {
    expect(rowResult(data, state({ req: { stunts: 30 } }), req('stunts')).kind).toBe('done');
  });

  it('has no skip budget when the total is unknown', () => {
    const r = rowResult(data, state({ req: { cash: 10 } }), req('cash'));
    expect(r).toMatchObject({ kind: 'remaining', skipLeft: null });
  });

  it('a confirmed missed item uses one skip, only after its chapter', () => {
    const before = rowResult(data, state({ chapterId: 'ch1', req: { meditation: 0 }, missables: { 'med-1': 'missed' } }), req('meditation'));
    const after = rowResult(data, state({ chapterId: 'ch2', req: { meditation: 0 }, missables: { 'med-1': 'missed' } }), req('meditation'));
    expect(before).toMatchObject({ skipLeft: 3 });
    expect(after).toMatchObject({ skipLeft: 2 });
  });

  it('summary counts rows and never reports a weighted percent', () => {
    expect(summary(data, state({ req: { stunts: 30, meditation: 3 } }))).toEqual({ done: 1, remaining: 1, unknown: 1, total: 3 });
  });
});

describe('chapter gating', () => {
  it('only shows missables lost at the end of the current chapter', () => {
    expect(upcomingMissables(data, state({ chapterId: 'pre' }))).toEqual([]);
    expect(upcomingMissables(data, state({ chapterId: 'ch1' })).map((m) => m.id)).toEqual(['med-1']);
    expect(upcomingMissables(data, state({ chapterId: 'ch2' })).map((m) => m.id)).toEqual(['card-a', 'card-b']);
  });

  it('asks about missables only once the player is past them', () => {
    expect(passedMissables(data, state({ chapterId: 'ch1' }))).toEqual([]);
    expect(passedMissables(data, state({ chapterId: 'post' })).map((m) => m.id)).toEqual(['med-1', 'card-a', 'card-b']);
  });
});

describe('card-set optimizer', () => {
  it('needs every set count before giving a number', () => {
    const p = cardPlan(data, state({ cards: { a: 1 } }));
    expect(p).toEqual({ kind: 'incomplete', missingSetIds: ['b', 'c', 'd', 'e'] });
  });

  it('with nothing logged, the minimum is the sum of the smallest sets', () => {
    const p = cardPlan(data, state({ cards: allCards(0) }));
    expect(p).toMatchObject({ kind: 'exact', plan: { min: 6 + 8 + 10, setIds: ['a', 'b', 'c'] } });
  });

  it('prefers sets closest to completion, not the smallest', () => {
    const p = cardPlan(data, state({ cards: { ...allCards(0), e: 23 } }));
    expect(p).toMatchObject({ kind: 'exact', plan: { min: 1 + 6 + 8, setIds: ['e', 'a', 'b'] } });
  });

  it('a verified loss removes the set', () => {
    const p = cardPlan(data, state({ chapterId: 'post', cards: allCards(0), missables: { 'card-a': 'logged', 'card-b': 'missed' } }));
    expect(p).toMatchObject({ kind: 'exact', plan: { min: 6 + 10 + 12, setIds: ['a', 'c', 'd'] } });
  });

  it('an unverified loss gives a range, never one exact number', () => {
    const p = cardPlan(data, state({ chapterId: 'post', cards: allCards(0), missables: { 'card-a': 'missed', 'card-b': 'logged' } }));
    expect(p.kind).toBe('range');
    if (p.kind !== 'range') return;
    expect(p.best.min).toBe(6 + 8 + 10);
    expect(p.worst?.min).toBe(8 + 10 + 12);
    expect(p.uncertainSetIds).toEqual(['a']);
  });

  it('an unanswered passed missable is uncertain', () => {
    const p = cardPlan(data, state({ chapterId: 'post', cards: allCards(0) }));
    expect(p.kind).toBe('range');
  });

  it('missables before their chapter do not affect the plan', () => {
    const p = cardPlan(data, state({ chapterId: 'ch2', cards: allCards(0), missables: { 'card-a': 'missed' } }));
    expect(p.kind).toBe('exact');
  });

  it('player-marked unobtainable sets are excluded, and too few sets is impossible', () => {
    const p = cardPlan(data, state({ cards: allCards(0), unobtainable: ['a', 'b', 'c'] }));
    expect(p).toMatchObject({ kind: 'impossible', available: 2 });
  });

  const arbState = fc.record({
    counts: fc.tuple(...data.cardSets.map((s) => fc.integer({ min: 0, max: s.size }))),
    lose: fc.subarray(data.cardSets.map((s) => s.id)),
  });

  it('property: marking a set lost never lowers the minimum', () => {
    fc.assert(
      fc.property(arbState, fc.constantFrom(...data.cardSets.map((s) => s.id)), ({ counts, lose }, extra) => {
        const cards = Object.fromEntries(data.cardSets.map((s, i) => [s.id, counts[i]]));
        const a = cardPlan(data, state({ cards, unobtainable: lose }));
        const b = cardPlan(data, state({ cards, unobtainable: [...new Set([...lose, extra])] }));
        if (a.kind !== 'exact') return true;
        if (b.kind === 'impossible') return true;
        expect(b.kind).toBe('exact');
        return b.kind === 'exact' && b.plan.min >= a.plan.min;
      }),
    );
  });

  it('property: worst case is never better than best case', () => {
    fc.assert(
      fc.property(arbState, ({ counts }) => {
        const cards = Object.fromEntries(data.cardSets.map((s, i) => [s.id, counts[i]]));
        const p = cardPlan(data, state({ chapterId: 'post', cards }));
        if (p.kind !== 'range' || !p.worst) return true;
        return p.worst.min >= p.best.min;
      }),
    );
  });

  it('property: minimum equals sum of the cheapest sets when nothing is lost', () => {
    fc.assert(
      fc.property(arbState, ({ counts }) => {
        const cards = Object.fromEntries(data.cardSets.map((s, i) => [s.id, counts[i]]));
        const p = cardPlan(data, state({ cards }));
        const needs = data.cardSets.map((s, i) => s.size - counts[i]).sort((x, y) => x - y);
        return p.kind === 'exact' && p.plan.min === needs.slice(0, 3).reduce((s, n) => s + n, 0);
      }),
    );
  });
});

describe('state', () => {
  it('round-trips through a share link', () => {
    const s = state({ chapterId: 'ch2', req: { stunts: 4 }, cards: { a: 2 }, unobtainable: ['e'], missables: { 'card-a': 'logged' } });
    expect(decodeState(data, encodeState(s))).toEqual(s);
  });

  it('drops unknown ids and clamps values', () => {
    const s = sanitize(data, { chapterId: 'nope', req: { stunts: -3, bogus: 9 }, cards: { a: 99 }, unobtainable: ['zzz'], missables: { 'card-a': 'hax' } });
    expect(s).toEqual({ ...emptyState(data), req: { stunts: 0 }, cards: { a: 6 } });
  });

  it('rejects garbage links', () => {
    expect(decodeState(data, 'not-a-real-link')).toBeNull();
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import raw from '../src/data/gta6.json';
import { Dataset } from '../src/data/schema';
import {
  cardPlan,
  emptyState,
  lostFor,
  passedMissables,
  rowResult,
  setVerdicts,
  summary,
  upcomingMissables,
  type MissableAnswer,
  type PlayerState,
} from '../src/lib/plan';
import { decodeState, encodeState, MAX_COUNT, sanitize } from '../src/lib/state';
import { fixture } from './fixture';

const data = fixture();
const realData = Dataset.parse(raw);
const req = (id: string) => data.requirements.find((r) => r.id === id)!;
const allCards = (v: number | ((size: number) => number)): PlayerState['cards'] =>
  Object.fromEntries(data.cardSets.map((s) => [s.id, typeof v === 'number' ? v : v(s.size)]));
const state = (p: Partial<PlayerState> = {}): PlayerState => ({ ...emptyState(data), ...p });

describe('requirement rows', () => {
  it('treats a blank input as unknown', () => {
    expect(rowResult(data, state(), req('stunts')).kind).toBe('unknown');
  });

  it('computes remaining and skip margin', () => {
    expect(rowResult(data, state({ req: { stunts: 12 } }), req('stunts'))).toEqual({
      kind: 'remaining', value: 12, remaining: 18, skipLeft: 10, impossible: false,
    });
  });

  it('marks a row done at the threshold', () => {
    expect(rowResult(data, state({ req: { stunts: 30 } }), req('stunts')).kind).toBe('done');
  });

  it('has no skip margin when the total is unknown', () => {
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

describe('out-of-range counts', () => {
  it('a count above the total is invalid: not done, and unknown in the summary', () => {
    const st = state({ req: { stunts: 41, meditation: 15 } });
    expect(rowResult(data, st, req('stunts'))).toEqual({ kind: 'invalid', value: 41, max: 40 });
    expect(summary(data, st)).toEqual({ done: 1, remaining: 0, unknown: 2, total: 3 });
  });

  it('the total itself is still valid', () => {
    expect(rowResult(data, state({ req: { stunts: 40 } }), req('stunts')).kind).toBe('done');
  });

  it('has no maximum when the total is unknown', () => {
    expect(rowResult(data, state({ req: { cash: 1e9 } }), req('cash')).kind).toBe('done');
  });

  it('keeps blank and 0 distinct', () => {
    expect(rowResult(data, state(), req('stunts')).kind).toBe('unknown');
    expect(rowResult(data, state({ req: { stunts: 0 } }), req('stunts'))).toMatchObject({ kind: 'remaining', remaining: 30 });
  });

  it('a card count above the set size leaves the set unknown, so there is no plan', () => {
    const p = cardPlan(data, state({ cards: { ...allCards(0), a: 7 } }));
    expect(p).toEqual({ kind: 'incomplete', missingSetIds: ['a'], invalidSetIds: ['a'] });
    expect(setVerdicts(data, state({ cards: { ...allCards(0), a: 7 } }), p).a).toBeNull();
  });

  it('a card count equal to the set size is complete', () => {
    const p = cardPlan(data, state({ cards: { ...allCards(0), a: 6 } }));
    expect(p).toMatchObject({ kind: 'exact', plan: { setIds: ['a', 'b', 'c'] } });
  });

  it('property: any count above the total is never done and never feeds the summary', () => {
    fc.assert(
      fc.property(fc.integer({ min: 41, max: 1e7 }), (v) => {
        const st = state({ req: { stunts: v } });
        return rowResult(data, st, req('stunts')).kind === 'invalid' && summary(data, st).done === 0;
      }),
    );
  });

  it('keeps an out-of-range count as typed (up to a sane cap); negatives become 0', () => {
    expect(sanitize(data, { cards: { a: 9, b: -2, c: 1e9 } }).cards).toEqual({ a: 9, b: 0, c: MAX_COUNT });
    expect(sanitize(data, { req: { stunts: 41, meditation: 1e9, cash: 1e9 } }).req).toEqual({ stunts: 41, meditation: MAX_COUNT, cash: 1e9 });
  });
});

describe('grouped missables', () => {
  const grouped = fixture({
    missables: [
      ...data.missables,
      { ...data.missables[0], id: 'stunt-pack', requirementId: 'stunts', label: 'Five stunts', count: 5, lostAfterChapterId: 'ch1' },
    ],
  });
  const g = (p: Partial<PlayerState>): PlayerState => ({ ...emptyState(grouped), ...p });
  const stunts = grouped.requirements.find((r) => r.id === 'stunts')!;

  it('a missed group uses one skip per item it covers', () => {
    // 40 total, 30 needed: 10 spare. Missing the group of 5 leaves 5.
    expect(lostFor(grouped, g({ chapterId: 'ch2', missables: { 'stunt-pack': 'missed' } }), 'stunts')).toBe(5);
    expect(rowResult(grouped, g({ chapterId: 'ch2', req: { stunts: 10 }, missables: { 'stunt-pack': 'missed' } }), stunts)).toMatchObject({
      kind: 'remaining',
      skipLeft: 5,
      impossible: false,
    });
  });

  it('a group without a count still counts as one', () => {
    expect(lostFor(grouped, g({ chapterId: 'ch2', missables: { 'med-1': 'missed' } }), 'meditation')).toBe(1);
  });

  it('a group bigger than the spare room makes the requirement impossible', () => {
    const tight = fixture({
      missables: [{ ...data.missables[0], id: 'stunt-pack', requirementId: 'stunts', count: 11, lostAfterChapterId: 'ch1' }],
    });
    const st = { ...emptyState(tight), chapterId: 'ch2', req: { stunts: 0 }, missables: { 'stunt-pack': 'missed' as const } };
    expect(rowResult(tight, st, stunts)).toMatchObject({ kind: 'remaining', skipLeft: 0, impossible: true });
  });

  it('an unanswered or logged group, or one still ahead, uses no skips', () => {
    expect(lostFor(grouped, g({ chapterId: 'ch2' }), 'stunts')).toBe(0);
    expect(lostFor(grouped, g({ chapterId: 'ch2', missables: { 'stunt-pack': 'logged' } }), 'stunts')).toBe(0);
    expect(lostFor(grouped, g({ chapterId: 'ch1', missables: { 'stunt-pack': 'missed' } }), 'stunts')).toBe(0);
  });

  it('the real dataset sets a count only where its own text gives the quantity', () => {
    const counted = Object.fromEntries(realData.missables.filter((m) => m.count !== undefined).map((m) => [m.id, m.count]));
    expect(counted).toEqual({ 'magazines-first-safehouse': 5, 'magazines-starlet-motel': 2, 'magazines-bayside-apartment': 2 });
    const mags = realData.requirements.find((r) => r.id === 'magazines-books-comics')!;
    const st = { ...emptyState(realData), chapterId: 'story-finished', req: { [mags.id]: 0 }, missables: { 'magazines-first-safehouse': 'missed' as const } };
    // 34 total, 30 needed: 4 spare. Five lost reading items can't be made up.
    expect(rowResult(realData, st, mags)).toMatchObject({ kind: 'remaining', skipLeft: 0, impossible: true });
  });
});

describe('card goal already met', () => {
  it('shows achieved once enough sets are complete, whatever the other sets say', () => {
    const st = state({ cards: { a: 6, b: 8, c: 10, d: 99 } });
    expect(cardPlan(data, st)).toEqual({ kind: 'achieved', doneSetIds: ['a', 'b', 'c'] });
    const v = setVerdicts(data, st, cardPlan(data, st));
    expect(v).toEqual({ a: 'done', b: 'done', c: 'done', d: null, e: null });
  });

  it('two complete sets of three is not achieved yet', () => {
    expect(cardPlan(data, state({ cards: { ...allCards(0), a: 6, b: 8 } })).kind).toBe('exact');
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
    expect(p).toEqual({ kind: 'incomplete', missingSetIds: ['b', 'c', 'd', 'e'], invalidSetIds: [] });
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
        const min = needs.slice(0, 3).reduce((s, n) => s + n, 0);
        // Three finished sets settle it: the plan says so instead of listing sets to skip.
        return min === 0 ? p.kind === 'achieved' : p.kind === 'exact' && p.plan.min === min;
      }),
    );
  });
});

describe('per-set verdicts', () => {
  const answers = fc.constantFrom<MissableAnswer | undefined>('logged', 'missed', 'unknown', undefined);
  const arbFull = fc.record({
    counts: fc.tuple(...data.cardSets.map((s) => fc.integer({ min: 0, max: s.size }))),
    lose: fc.subarray(data.cardSets.map((s) => s.id)),
    a: answers,
    b: answers,
    chapterId: fc.constantFrom('ch2', 'post'),
  });
  const build = ({ counts, lose, a, b, chapterId }: { counts: number[]; lose: string[]; a?: MissableAnswer; b?: MissableAnswer; chapterId: string }) => {
    const missables: PlayerState['missables'] = {};
    if (a) missables['card-a'] = a;
    if (b) missables['card-b'] = b;
    return state({ chapterId, cards: Object.fromEntries(data.cardSets.map((s, i) => [s.id, counts[i]])), unobtainable: lose, missables });
  };

  it('property: in an exact plan every displayed verdict matches the plan', () => {
    fc.assert(
      fc.property(arbFull, (input) => {
        const st = build(input);
        const p = cardPlan(data, st);
        if (p.kind !== 'exact') return true;
        const v = setVerdicts(data, st, p);
        let finishCost = 0;
        for (const s of data.cardSets) {
          const need = p.needs.find((n) => n.set.id === s.id)!.needed;
          const inPlan = p.plan.setIds.includes(s.id);
          expect(v[s.id], s.id).not.toBeNull();
          if (v[s.id] === 'done') expect(need).toBe(0);
          if (v[s.id] === 'finish') {
            expect(inPlan).toBe(true);
            finishCost += need;
          }
          if (v[s.id] === 'skip') expect(inPlan).toBe(false);
          expect(v[s.id]).not.toBe('uncertain');
          if (inPlan) expect(['finish', 'done']).toContain(v[s.id]);
        }
        expect(finishCost).toBe(p.plan.min);
        return true;
      }),
    );
  });

  it('property: in a range plan, uncertain sets the best case finishes get the uncertain verdict', () => {
    fc.assert(
      fc.property(arbFull, (input) => {
        const st = build(input);
        const p = cardPlan(data, st);
        if (p.kind !== 'range') return true;
        const v = setVerdicts(data, st, p);
        for (const id of p.uncertainSetIds) {
          if (p.best.setIds.includes(id)) expect(v[id], id).toBe('uncertain');
          else expect(v[id], id).toBe('skip');
        }
        for (const s of data.cardSets) {
          // A firm verdict must hold in both cases.
          const worst = p.worst ? p.worst.setIds.includes(s.id) : p.needs.find((n) => n.set.id === s.id)!.availability === 'available';
          if (v[s.id] === 'finish') expect(p.best.setIds.includes(s.id) && worst).toBe(true);
          if (v[s.id] === 'skip') expect(p.best.setIds.includes(s.id) || worst).toBe(false);
        }
        return true;
      }),
    );
  });

  it('a fully logged set is done and never uncertain, even with an unanswered missable', () => {
    const st = state({ chapterId: 'post', cards: { ...allCards(0), a: 6 }, missables: { 'card-b': 'logged' } });
    const p = cardPlan(data, st);
    expect(p.kind).toBe('exact');
    expect(setVerdicts(data, st, p).a).toBe('done');
  });

  it('a set marked unobtainable is skipped', () => {
    const st = state({ cards: allCards(0), unobtainable: ['a'] });
    const v = setVerdicts(data, st, cardPlan(data, st));
    expect(v).toEqual({ a: 'skip', b: 'finish', c: 'finish', d: 'finish', e: 'skip' });
  });
});

describe('state', () => {
  it('round-trips through a share link', () => {
    const s = state({ chapterId: 'ch2', req: { stunts: 4 }, cards: { a: 2 }, unobtainable: ['e'], missables: { 'card-a': 'logged' } });
    expect(decodeState(data, encodeState(s))).toEqual(s);
  });

  it('drops unknown ids and bad values, but keeps an over-max count as typed', () => {
    const s = sanitize(data, { chapterId: 'nope', req: { stunts: -3, bogus: 9 }, cards: { a: 99 }, unobtainable: ['zzz'], missables: { 'card-a': 'hax' } });
    expect(s).toEqual({ ...emptyState(data), req: { stunts: 0 }, cards: { a: 99 } });
  });

  it('a share link keeps over-max counts, so the importer sees the same error as the sharer', () => {
    const s = state({ req: { stunts: 41, meditation: 5000 }, cards: { ...allCards(0), a: 7, b: 9999 } });
    const back = decodeState(data, encodeState(s))!;
    expect(back).toEqual(s);
    expect(rowResult(data, back, req('stunts'))).toEqual({ kind: 'invalid', value: 41, max: 40 });
    expect(cardPlan(data, back)).toMatchObject({ kind: 'incomplete', invalidSetIds: ['a', 'b'] });
  });

  it('a loaded state never marks a fully logged set unobtainable', () => {
    const s = sanitize(data, { cards: { a: 6, b: 3 }, unobtainable: ['a', 'b'] });
    expect(s.unobtainable).toEqual(['b']);
  });

  it('rejects garbage links', () => {
    expect(decodeState(data, 'not-a-real-link')).toBeNull();
  });
});

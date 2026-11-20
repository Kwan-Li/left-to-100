import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Dataset } from '../src/data/schema';

const raw = JSON.parse(readFileSync(new URL('../src/data/gta6.json', import.meta.url), 'utf8'));

describe('gta6.json', () => {
  const data = Dataset.parse(raw);
  const all = [...data.requirements, ...data.cardSets, ...data.missables, ...data.pointsOfNoReturn, ...data.exceptions];

  it('matches the declared totals', () => {
    expect(data.requirements.length).toBe(data.totals.requirements);
    expect(data.cardSets.length).toBe(data.totals.cardSets);
    expect(data.totals.cardSetsRequired).toBeLessThanOrEqual(data.totals.cardSets);
  });

  it('card set sizes add up to the card total', () => {
    expect(data.cardSets.reduce((s, c) => s + c.size, 0)).toBe(data.totals.cards);
  });

  it('ids are unique within each list', () => {
    for (const list of [data.categories, data.requirements, data.cardSets, data.chapters, data.missables, data.pointsOfNoReturn, data.exceptions]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('every reference points at something that exists', () => {
    const req = new Set(data.requirements.map((r) => r.id));
    const sets = new Set(data.cardSets.map((s) => s.id));
    const chapters = new Set(data.chapters.map((c) => c.id));
    const cats = new Set(data.categories.map((c) => c.id));
    for (const r of data.requirements) expect(cats.has(r.categoryId), r.id).toBe(true);
    for (const m of data.missables) {
      expect(req.has(m.requirementId), m.id).toBe(true);
      expect(chapters.has(m.lostAfterChapterId), m.id).toBe(true);
      if (m.cardSetId) expect(sets.has(m.cardSetId), m.id).toBe(true);
    }
    for (const p of data.pointsOfNoReturn) expect(chapters.has(p.chapterId), p.id).toBe(true);
    for (const e of data.exceptions) for (const id of e.requirementIds) expect(req.has(id), e.id).toBe(true);
  });

  it('thresholds never exceed totals', () => {
    for (const r of data.requirements) if (r.total !== null) expect(r.required, r.id).toBeLessThanOrEqual(r.total);
  });

  it('verified facts cite at least two different publishers', () => {
    for (const r of all.filter((x) => x.status === 'verified')) {
      expect(new Set(r.sources.map((s) => s.publisher)).size, r.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('disputed facts explain the conflict', () => {
    for (const r of all.filter((x) => x.status === 'disputed')) expect(r.note, r.id).toBeTruthy();
  });

  it('chapter order is unique', () => {
    const orders = data.chapters.map((c) => c.order);
    expect(new Set(orders).size).toBe(orders.length);
  });
});

import type { Dataset } from '../src/data/schema';

const prov = { status: 'verified' as const, sources: [{ publisher: 'Test', url: 'https://example.com' }], lastVerified: '2026-11-20' };

/** Synthetic dataset: 5 card sets, 3 required. Not real game data. */
export function fixture(overrides: Partial<Dataset> = {}): Dataset {
  return {
    version: 'test',
    game: 'Test',
    updated: '2026-11-20',
    totals: { requirements: 3, cardSets: 5, cards: 60, cardSetsRequired: 3 },
    categories: [{ id: 'main', name: 'Main' }],
    requirements: [
      { id: 'stunts', categoryId: 'main', name: 'Stunts', unit: 'count', required: 30, total: 40, ...prov },
      { id: 'meditation', categoryId: 'main', name: 'Meditation', unit: 'count', required: 15, total: 18, ...prov },
      { id: 'cash', categoryId: 'main', name: 'Cash', unit: 'dollars', required: 1000, total: null, ...prov },
    ],
    cardSets: [
      { id: 'a', name: 'A', size: 6, ...prov },
      { id: 'b', name: 'B', size: 8, ...prov },
      { id: 'c', name: 'C', size: 10, ...prov },
      { id: 'd', name: 'D', size: 12, ...prov },
      { id: 'e', name: 'E', size: 24, ...prov },
    ],
    chapters: [
      { id: 'pre', label: 'Not started', order: 0 },
      { id: 'ch1', label: 'Chapter 1', order: 1 },
      { id: 'ch2', label: 'Chapter 2', order: 2 },
      { id: 'post', label: 'Story finished', order: 3 },
    ],
    missables: [
      { id: 'med-1', requirementId: 'meditation', label: 'Balcony meditation', where: 'Home', lostAfterChapterId: 'ch1', effect: 'Uses one skip.', ...prov },
      { id: 'card-a', requirementId: 'cards', cardSetId: 'a', label: 'Card A1', where: 'Motel', lostAfterChapterId: 'ch2', effect: 'Set may be lost.', ...prov, status: 'reported' },
      { id: 'card-b', requirementId: 'cards', cardSetId: 'b', label: 'Card B1', where: 'Motel', lostAfterChapterId: 'ch2', effect: 'Set may be lost.', ...prov },
    ],
    pointsOfNoReturn: [],
    exceptions: [],
    ...overrides,
  };
}

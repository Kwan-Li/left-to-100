import raw from './gta6.json';
import { Dataset } from './schema';

/** Parsed at build time: an invalid dataset fails the build. */
export const data: Dataset = Dataset.parse(raw);

export const byId = <T extends { id: string }>(items: T[], id: string) => items.find((i) => i.id === id);

/** Sum of the smallest `cardSetsRequired` set sizes: the fewest cards that can reach 100%. */
export const minimumCards = [...data.cardSets]
  .map((s) => s.size)
  .sort((a, b) => a - b)
  .slice(0, data.totals.cardSetsRequired)
  .reduce((s, n) => s + n, 0);

export const statusCounts = (() => {
  const all = [...data.requirements, ...data.cardSets, ...data.missables, ...data.pointsOfNoReturn, ...data.exceptions];
  return {
    verified: all.filter((r) => r.status === 'verified').length,
    reported: all.filter((r) => r.status === 'reported').length,
    disputed: all.filter((r) => r.status === 'disputed').length,
    total: all.length,
  };
})();

/** Every distinct source, for the data page. */
export const allSources = (() => {
  const all = [...data.requirements, ...data.cardSets, ...data.missables, ...data.pointsOfNoReturn, ...data.exceptions];
  const map = new Map<string, string>();
  for (const r of all) for (const s of r.sources) map.set(s.url, s.publisher);
  return [...map].map(([url, publisher]) => ({ url, publisher })).sort((a, b) => a.publisher.localeCompare(b.publisher));
})();

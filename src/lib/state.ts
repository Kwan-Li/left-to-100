import LZString from 'lz-string';

const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = LZString;
import type { Dataset } from '../data/schema';
import { emptyState, type Count, type MissableAnswer, type PlayerState } from './plan';

const STORAGE_KEY = 'left-to-100:v1';
const HASH_KEY = 's';

/** Highest count kept from a link or saved progress. Far above any real total, so a typo survives as typed. */
export const MAX_COUNT = 9999;
/** Cash targets run into the hundreds of thousands, so dollar fields get a higher ceiling. */
export const MAX_DOLLARS = 999_999_999_999;

function toCount(v: unknown, cap: number): Count {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.min(cap, Math.max(0, Math.floor(v)));
}

/**
 * Rebuild a state from untrusted input, keeping only known ids and valid values.
 * Counts above the game's maximum are kept as typed (up to a sane cap), so a shared link or a reload shows the
 * same "too high" error the sharer saw instead of silently turning into a finished row or set.
 * A set that is fully logged can't also be marked unobtainable, so that mark is dropped.
 */
export function sanitize(data: Dataset, raw: unknown): PlayerState {
  const base = emptyState(data);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<PlayerState>;
  if (typeof r.chapterId === 'string' && data.chapters.some((c) => c.id === r.chapterId)) base.chapterId = r.chapterId;
  for (const q of data.requirements) {
    const v = toCount(r.req?.[q.id], q.unit === 'dollars' ? MAX_DOLLARS : MAX_COUNT);
    if (v !== null) base.req[q.id] = v;
  }
  for (const s of data.cardSets) {
    const v = toCount(r.cards?.[s.id], MAX_COUNT);
    if (v !== null) base.cards[s.id] = v;
  }
  if (Array.isArray(r.unobtainable)) {
    base.unobtainable = r.unobtainable.filter((id) => data.cardSets.some((s) => s.id === id && base.cards[id] !== s.size));
  }
  const answers: MissableAnswer[] = ['logged', 'missed', 'unknown'];
  for (const m of data.missables) {
    const a = r.missables?.[m.id];
    if (typeof a === 'string' && answers.includes(a as MissableAnswer)) base.missables[m.id] = a as MissableAnswer;
  }
  return base;
}

export function encodeState(state: PlayerState): string {
  return compressToEncodedURIComponent(JSON.stringify(state));
}

export function decodeState(data: Dataset, encoded: string): PlayerState | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return sanitize(data, JSON.parse(json));
  } catch {
    return null;
  }
}

export function shareUrl(state: PlayerState, base: string): string {
  const url = new URL(base);
  url.hash = `${HASH_KEY}=${encodeState(state)}`;
  return url.toString();
}

export function stateFromHash(data: Dataset, hash: string): PlayerState | null {
  const m = hash.replace(/^#/, '').match(new RegExp(`(?:^|&)${HASH_KEY}=([^&]+)`));
  return m ? decodeState(data, m[1]) : null;
}

/* ------------------------------------------------------------------ */
/* Browser store shared by every island on the page                    */
/* ------------------------------------------------------------------ */

type Listener = (s: PlayerState) => void;
const listeners = new Set<Listener>();
let current: PlayerState | null = null;

/** Forget the loaded state so the next loadState() reads the hash and storage again. Used by tests. */
export function forgetLoadedState() {
  current = null;
}

function readStorage(data: Dataset): PlayerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(data, JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeStorage(state: PlayerState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: state still lives in memory and in share links */
  }
}

/** Load once per page: a share link wins over saved progress, then the link is removed from the address bar. */
export function loadState(data: Dataset): PlayerState {
  if (current) return current;
  const fromHash = typeof location !== 'undefined' ? stateFromHash(data, location.hash) : null;
  if (fromHash) {
    writeStorage(fromHash);
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch {
      /* ignore */
    }
  }
  current = fromHash ?? readStorage(data) ?? emptyState(data);
  return current;
}

export function setState(next: PlayerState) {
  current = next;
  writeStorage(next);
  listeners.forEach((l) => l(next));
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function resetState(data: Dataset) {
  setState(emptyState(data));
}

import { useEffect, useState } from 'preact/hooks';
import type { Dataset } from '../data/schema';
import { emptyState, type PlayerState } from '../lib/plan';
import { loadState, setState, subscribe } from '../lib/state';

/**
 * Shared player state for every island on the page.
 * Renders the empty state on the server, then loads saved progress after hydration.
 */
export function useStore(data: Dataset): [PlayerState, (next: PlayerState) => void, boolean] {
  const [state, set] = useState<PlayerState>(() => emptyState(data));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    set(loadState(data));
    setReady(true);
    return subscribe(set);
  }, []);
  return [state, setState, ready];
}

/** Parse an <input type=number> value: blank means unknown. */
export function parseCount(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

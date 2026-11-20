import type { Dataset } from '../data/schema';
import type { PlayerState } from '../lib/plan';

export function ChapterPicker({ data, state, setState }: { data: Dataset; state: PlayerState; setState: (s: PlayerState) => void }) {
  const chapters = [...data.chapters].sort((a, b) => a.order - b.order);
  return (
    <label class="chapter-picker">
      <span>Where are you in the story?</span>
      <select value={state.chapterId} onChange={(e) => setState({ ...state, chapterId: (e.target as HTMLSelectElement).value })}>
        {chapters.map((c) => (
          <option value={c.id}>{c.label}</option>
        ))}
      </select>
      <small class="muted">Used only to hide anything past your chapter. No plot details are shown.</small>
    </label>
  );
}

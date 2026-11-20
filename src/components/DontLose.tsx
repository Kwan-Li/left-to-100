import { clientData } from '../data/client';
import type { Dataset } from '../data/schema';
import { currentChapter, passedMissables, upcomingMissables } from '../lib/plan';
import { ChapterPicker } from './ChapterPicker';
import { MissableQuestions } from './MissableQuestions';
import { StatusBadge } from './StatusBadge';
import { useStore } from './useStore';
import './planner.css';

/** Chapter-gated: only shows what is lost at the end of the player's current chapter. */
export default function DontLose({ data = clientData, showPicker = false }: { data?: Dataset; showPicker?: boolean }) {
  const [state, setState] = useStore(data);
  const chapter = currentChapter(data, state);
  const upcoming = upcomingMissables(data, state);
  const ponr = data.pointsOfNoReturn.filter((p) => p.chapterId === state.chapterId);
  const passed = passedMissables(data, state);

  return (
    <div class="dont-lose">
      {showPicker && (
        <div class="panel">
          <ChapterPicker data={data} state={state} setState={setState} />
        </div>
      )}
      <section class="panel" aria-live="polite">
        <h3>Before you finish {chapter?.label ?? 'this chapter'}</h3>
        {upcoming.length === 0 && ponr.length === 0 ? (
          <p class="muted">Nothing that counts toward 100% is reported lost at the end of your current chapter.</p>
        ) : (
          <ul class="dl-list">
            {ponr.map((p) => (
              <li class="dl save">
                <strong>Keep a separate save before you finish this chapter.</strong> {p.label} <StatusBadge status={p.status} sources={p.sources} note={p.note} />
              </li>
            ))}
            {upcoming.map((m) => (
              <li class="dl">
                <strong>{m.label}</strong> <StatusBadge status={m.status} sources={m.sources} note={m.note} />
                <div class="muted">{m.where}</div>
                <div>{m.effect}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {passed.length > 0 && (
        <section class="panel">
          <h3>Did you get these?</h3>
          <p class="muted">You're past the point where these were reported lost. Your answers update the calculator and card planner.</p>
          <MissableQuestions data={data} items={passed} state={state} setState={setState} />
        </section>
      )}
    </div>
  );
}

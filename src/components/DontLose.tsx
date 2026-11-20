import { clientData } from '../data/client';
import type { Dataset } from '../data/schema';
import { currentChapter, passedMissables, upcomingMissables } from '../lib/plan';
import { ChapterPicker } from './ChapterPicker';
import { MissableQuestions } from './MissableQuestions';
import { r1 } from '../copy/r1';
import { FormBadge } from './StatusBadge';
import { useStore } from './useStore';
import './planner.css';

/**
 * Chapter-gated: only shows what is lost at the end of the player's current chapter.
 * Renders the section's single h2 itself; `headingId` makes it a jump target (#dont-lose on the home page).
 */
export default function DontLose({
  data = clientData,
  showPicker = false,
  headingId,
}: {
  data?: Dataset;
  showPicker?: boolean;
  headingId?: string;
}) {
  const [state, setState] = useStore(data);
  const chapter = currentChapter(data, state);
  const upcoming = upcomingMissables(data, state);
  const ponr = data.pointsOfNoReturn.filter((p) => p.chapterId === state.chapterId);
  const passed = passedMissables(data, state);
  const label = chapter?.label ?? 'this chapter';
  const heading =
    state.chapterId === 'not-started' ? 'Before you start' : state.chapterId === 'story-finished' ? 'After the story' : r1.dontLoseHeading(label);
  const empty =
    state.chapterId === 'not-started'
      ? 'Pick your current chapter above to see spoiler-safe warnings for anything lost at the end of it.'
      : state.chapterId === 'story-finished'
        ? "You've finished the story—no chapter lockouts ahead. Answer the checks below if you want your calculator to account for earlier missables."
        : `Nothing that counts toward 100% is reported lost at the end of ${label}.`;

  return (
    <div class="dont-lose">
      {showPicker && (
        <div class="panel">
          <ChapterPicker data={data} state={state} setState={setState} />
        </div>
      )}
      <h2 id={headingId} class="dl-heading">
        {heading}
      </h2>
      <section class="panel" aria-live="polite">
        {upcoming.length === 0 && ponr.length === 0 ? (
          <p class="muted">{empty}</p>
        ) : (
          <ul class="dl-list">
            {ponr.map((p) => (
              <li key={p.id} class="dl save">
                <strong>Keep a manual save:</strong> {p.label} <FormBadge status={p.status} sources={p.sources} note={p.note} />
              </li>
            ))}
            {upcoming.map((m) => (
              <li key={m.id} class="dl">
                <strong>{m.label}</strong> <FormBadge status={m.status} sources={m.sources} note={m.note} />
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
          <p class="muted">You're past the point where these were reported lost. Your answers update the calculator and card set planner.</p>
          <MissableQuestions data={data} items={passed} state={state} setState={setState} />
        </section>
      )}
    </div>
  );
}

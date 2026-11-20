import type { Dataset, Missable } from '../data/schema';
import type { MissableAnswer, PlayerState } from '../lib/plan';
import { r1 } from '../copy/r1';
import { FormBadge } from './StatusBadge';

const OPTIONS: { value: MissableAnswer; label: string }[] = [
  { value: 'logged', label: 'Got it' },
  { value: 'missed', label: 'Missed it' },
  { value: 'unknown', label: 'Not sure' },
];

/**
 * Asks about missables the player has already passed. An unanswered question shows no selection
 * (the plan still treats it as 'unknown').
 */
export function MissableQuestions({
  items,
  state,
  setState,
}: {
  data: Dataset;
  items: Missable[];
  state: PlayerState;
  setState: (s: PlayerState) => void;
}) {
  if (!items.length) return null;
  return (
    <ul class="mq-list">
      {items.map((m) => {
        const answer: MissableAnswer | undefined = state.missables[m.id];
        return (
          <li key={m.id} class="mq">
            <fieldset>
              <legend>
                {m.label} <FormBadge status={m.status} sources={m.sources} note={m.note} />
              </legend>
              <p class="muted">{m.where}</p>
              <div class="mq-options">
                {OPTIONS.map((o) => (
                  <label key={o.value} class={`seg ${answer === o.value ? 'on' : ''}`}>
                    <input
                      type="radio"
                      name={`mq-${m.id}`}
                      value={o.value}
                      checked={answer === o.value}
                      onChange={() => setState({ ...state, missables: { ...state.missables, [m.id]: o.value } })}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
              {answer === undefined && <p class="mq-hint muted">{r1.missableUnanswered}</p>}
            </fieldset>
          </li>
        );
      })}
    </ul>
  );
}

import type { Dataset, Missable } from '../data/schema';
import type { MissableAnswer, PlayerState } from '../lib/plan';
import { StatusBadge } from './StatusBadge';

const OPTIONS: { value: MissableAnswer; label: string }[] = [
  { value: 'logged', label: 'Got it' },
  { value: 'missed', label: 'Missed it' },
  { value: 'unknown', label: 'Not sure' },
];

/** Asks about missables the player has already passed. */
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
        const answer = state.missables[m.id] ?? 'unknown';
        return (
          <li class="mq">
            <fieldset>
              <legend>
                {m.label} <StatusBadge status={m.status} sources={m.sources} note={m.note} />
              </legend>
              <p class="muted">{m.where}</p>
              <div class="mq-options">
                {OPTIONS.map((o) => (
                  <label class={`seg ${answer === o.value ? 'on' : ''}`}>
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
            </fieldset>
          </li>
        );
      })}
    </ul>
  );
}

import type { TargetedKeyboardEvent, TargetedWheelEvent } from 'preact';
import { r4 } from '../copy/r4';
import { isOverMax, type Count } from '../lib/plan';
import { parseCount } from './useStore';

/**
 * Event dispatched on the next count input when Enter moves into a tab panel that is hidden. The Planner listens for
 * it, shows that panel synchronously (so focus can land in the same keystroke) and selects its tab.
 */
export const REVEAL_EVENT = 'lt100:reveal';

/** Enter moves to the next count input on the page, or closes the keyboard on the last one. */
function enterToNext(e: TargetedKeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const all = [...document.querySelectorAll<HTMLInputElement>('input[data-count]')];
  const next = all[all.indexOf(e.currentTarget) + 1];
  if (!next) {
    e.currentTarget.blur();
    return;
  }
  if (next.closest('[hidden]')) next.dispatchEvent(new CustomEvent(REVEAL_EVENT, { bubbles: true }));
  next.focus();
}

/** Stop the mouse wheel from changing a focused number. */
function noWheel(e: TargetedWheelEvent<HTMLInputElement>) {
  if (document.activeElement === e.currentTarget) e.preventDefault();
}

/** The value a − / + press gives. Blank counts as nothing entered yet: + gives 1, − gives 0. Never below 0. */
export function stepValue(value: Count | undefined, delta: 1 | -1, max: number | null): number {
  if (value === null || value === undefined) return delta > 0 ? 1 : 0;
  const next = Math.max(0, value + delta);
  // Above the maximum, + does nothing (−  still walks back toward a valid count).
  if (delta > 0 && max !== null && value >= max) return value;
  return next;
}

/**
 * Number input for a count, with − / + steppers on each side. Blank stays blank (unknown), and a value above `max`
 * is kept as typed and marked invalid so the player can see and fix it.
 *
 * The steppers are out of the Tab order (Tab moves between counts; the arrow keys step a focused input) and don't
 * take focus on press, so a tap never moves the keyboard or the focus ring. Dollar amounts get no steppers.
 */
export function CountInput({
  id,
  value,
  max,
  unit = 'count',
  name,
  suffix,
  suffixId,
  describedBy,
  last = false,
  onValue,
  onStep,
  onFocus,
  onBlur,
}: {
  id: string;
  value: Count | undefined;
  max: number | null;
  unit?: 'count' | 'dollars' | 'percent';
  /** Requirement or set name, for the stepper labels. */
  name: string;
  /** Muted text inside the input's right edge, e.g. "/ 24" on card tiles. */
  suffix?: string;
  suffixId?: string;
  describedBy?: string;
  /** The last count input on the page: the Enter key reads "done" (it closes the keyboard). */
  last?: boolean;
  onValue: (v: number | null) => void;
  /** Called after a − / + press has set the new value. */
  onStep?: (v: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const invalid = isOverMax(value, max);
  const input = (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      pattern="[0-9]*"
      enterKeyHint={last ? 'done' : 'next'}
      min={0}
      max={max ?? undefined}
      placeholder="?"
      value={value ?? ''}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={describedBy}
      data-count=""
      onInput={(e) => onValue(parseCount(e.currentTarget.value))}
      onKeyDown={enterToNext}
      onWheel={noWheel}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
  const field = (
    <span class={`field ${unit}${suffix ? ' has-suffix' : ''}`}>
      {unit === 'dollars' && (
        <span class="affix-sym" aria-hidden="true">
          $
        </span>
      )}
      {input}
      {unit === 'percent' && (
        <span class="affix-sym" aria-hidden="true">
          %
        </span>
      )}
      {suffix && (
        <span class="field-suffix" id={suffixId}>
          {suffix}
        </span>
      )}
    </span>
  );
  if (unit === 'dollars') return <span class="stepper no-steps">{field}</span>;
  const step = (delta: 1 | -1) => {
    const v = stepValue(value, delta, max);
    if (v === value) return;
    onValue(v);
    onStep?.(v);
  };
  return (
    <span class="stepper">
      <button
        type="button"
        class="step down"
        tabIndex={-1}
        aria-label={r4.stepDown(name)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => step(-1)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 8h9" />
        </svg>
      </button>
      {field}
      <button
        type="button"
        class="step up"
        tabIndex={-1}
        aria-label={r4.stepUp(name)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => step(1)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.5 8h9M8 3.5v9" />
        </svg>
      </button>
    </span>
  );
}

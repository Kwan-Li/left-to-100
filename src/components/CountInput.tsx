import type { TargetedKeyboardEvent, TargetedWheelEvent } from 'preact';
import { isOverMax, type Count } from '../lib/plan';
import { parseCount } from './useStore';

/** Enter moves to the next count input on the page, or closes the keyboard on the last one. */
function enterToNext(e: TargetedKeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const all = [...document.querySelectorAll<HTMLInputElement>('input[data-count]')];
  const next = all[all.indexOf(e.currentTarget) + 1];
  if (next) next.focus();
  else e.currentTarget.blur();
}

/** Stop the mouse wheel from changing a focused number. */
function noWheel(e: TargetedWheelEvent<HTMLInputElement>) {
  if (document.activeElement === e.currentTarget) e.preventDefault();
}

/**
 * Number input for a count. Blank stays blank (unknown), and a value above `max` is kept as typed
 * and marked invalid so the player can see and fix it.
 */
export function CountInput({
  id,
  value,
  max,
  unit = 'count',
  describedBy,
  onValue,
  onFocus,
  onBlur,
}: {
  id: string;
  value: Count | undefined;
  max: number | null;
  unit?: 'count' | 'dollars' | 'percent';
  describedBy?: string;
  onValue: (v: number | null) => void;
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
      enterKeyHint="next"
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
  if (unit === 'count') return input;
  return (
    <span class={`affix ${unit}`}>
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
    </span>
  );
}

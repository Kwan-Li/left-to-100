import { clientData } from '../data/client';
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { r1 } from '../copy/r1';
import { r2 } from '../copy/r2';
import { r3 } from '../copy/r3';
import { r4 } from '../copy/r4';
import type { Dataset, Requirement } from '../data/schema';
import {
  currentChapter,
  lostFor,
  requirementMax,
  rowResult,
  summary,
  upcomingMissables,
  type Count,
  type PlayerState,
  type RowResult,
} from '../lib/plan';
import { ChapterPicker } from './ChapterPicker';
import { CountInput, REVEAL_EVENT } from './CountInput';
import { ShareBar } from './ShareBar';
import { FormBadge } from './StatusBadge';
import { Highlight, WarnIcon, InfoIcon } from './ui';
import { useStore } from './useStore';
import './planner.css';

const fmt = (r: Requirement, n: number) =>
  r.unit === 'dollars' ? `$${n.toLocaleString('en-US')}` : r.unit === 'percent' ? `${n}%` : n.toLocaleString('en-US');

const skipText = (skipLeft: number) => (skipLeft === 0 ? 'no skips' : `skip up to ${skipLeft.toLocaleString('en-US')}`);
const impossibleText = "to go. Can't reach the target with the items you marked missed.";

/** How long the pointer must be idle before rows held through a run of taps are released (see `held`). */
const HOLD_MS = 1200;
/**
 * After that release takes rows out of the list, − / + presses on any other row are ignored for this long: the list
 * has just moved under the finger, so a tap already on its way would land on a row that slid into its place.
 */
const STEP_GUARD_MS = 400;

type Filter = 'all' | 'left' | 'done';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: r4.filterAll },
  { id: 'left', label: r4.filterLeft },
  { id: 'done', label: r4.filterDone },
];

/** The row outcome as plain text, for the screen-reader announcement. Same words as <Outcome>. */
function outcomeText(r: Requirement, res: RowResult): string {
  if (res.kind === 'unknown') return 'Enter your count';
  if (res.kind === 'invalid') return r1.errMax(res.max);
  if (res.kind === 'done') return 'Done';
  if (res.impossible) return `${fmt(r, res.remaining)} ${impossibleText}`;
  if (res.atRisk) return r3.rowAtRisk(fmt(r, res.remaining));
  return `${fmt(r, res.remaining)} to go${res.skipLeft !== null ? ` · ${skipText(res.skipLeft)}` : ''}`;
}

function Outcome({ id, r, res }: { id: string; r: Requirement; res: RowResult }) {
  if (res.kind === 'unknown')
    return (
      <span id={id} class="out unknown">
        Enter your count
      </span>
    );
  if (res.kind === 'invalid')
    return (
      <span id={id} class="out bad">
        {r1.errMax(res.max)}
      </span>
    );
  if (res.kind === 'done')
    return (
      <span id={id} class="out done">
        Done
      </span>
    );
  if (res.impossible)
    return (
      <span id={id} class="out bad">
        <strong>{fmt(r, res.remaining)}</strong> {impossibleText}
      </span>
    );
  // Out of reach only if unconfirmed losses are real: a warning, not the definite "can't reach".
  if (res.atRisk)
    return (
      <span id={id} class="out risk">
        <Highlight text={r3.rowAtRisk(fmt(r, res.remaining))} part={fmt(r, res.remaining)} />
      </span>
    );
  return (
    <span id={id} class="out todo">
      <strong>{fmt(r, res.remaining)}</strong> to go
      {res.skipLeft !== null && (
        <>
          {' '}
          <span class="sep">·</span> <span class={`skip${res.skipLeft === 0 ? ' none' : ''}`}>{skipText(res.skipLeft)}</span>
        </>
      )}
    </span>
  );
}

/**
 * How many items the row can still skip: the same allowance the outcome text gives ("skip up to n" / "no skips"),
 * so 0 when the row is at risk or can't be reached. Rows without a text outcome (not entered, done, over the
 * maximum) use the same sum: the game's total, minus items marked missed, minus the requirement.
 */
function skipAllowance(data: Dataset, state: PlayerState, r: Requirement, res: RowResult): number {
  if (r.total === null) return 0;
  if (res.kind === 'remaining') return res.skipLeft ?? 0;
  return Math.max(0, r.total - lostFor(data, state, r.id) - r.required);
}

/**
 * The row's meter (decorative; the numbers are in the text). Segments up to the game's total, a lime fill up to your
 * count, a tick at the required mark, a striped cyan zone after the tick for what you can still skip (only as wide
 * as the outcome's allowance, so none when the row is at risk or out of reach), and a marker at your count.
 */
function Meter({ r, value, res, skip }: { r: Requirement; value: Count | undefined; res: RowResult; skip: number }) {
  const max = r.total ?? r.required;
  const segs = Math.max(1, Math.min(max, 40));
  const pct = (x: number) => Math.max(0, Math.min(100, (x / max) * 100));
  const v = typeof value === 'number' ? Math.min(value, max) : null;
  const tick = r.total !== null && r.required < r.total;
  const over = res.kind === 'invalid';
  // Over the maximum the whole bar is the red fill: no zone underneath it.
  const skipW = tick && !over ? Math.min(pct(skip), 100 - pct(r.required)) : 0;
  return (
    <div class={`meter${tick ? '' : ' no-tick'}`} aria-hidden="true">
      <div class="bar" style={{ '--segs': segs }}>
        {skipW > 0 && <span class="skipzone" style={{ left: `${pct(r.required)}%`, width: `${skipW}%` }} />}
        <span class="fill" style={{ width: `${over ? 100 : v === null ? 0 : pct(v)}%` }} />
      </div>
      {tick && (
        <span class="tick" style={{ left: `${pct(r.required)}%` }}>
          <span>{fmt(r, r.required)}</span>
        </span>
      )}
      {v !== null && <span class="notch" style={{ left: `${over ? 100 : pct(v)}%` }} />}
    </div>
  );
}

/**
 * One line under the chapter picker: what the "before you finish" panel holds, with a link to it.
 * `n` counts checklist missables only; a save reminder (point of no return) alone gets its own line.
 */
function ChapterStrip({ data, state }: { data: Dataset; state: PlayerState }) {
  // A non-breaking space keeps "Chapter 2" on one line inside the strip.
  const label = (currentChapter(data, state)?.label ?? '').replace(/ /g, ' ');
  const n = upcomingMissables(data, state).length;
  const saveReminder = data.pointsOfNoReturn.some((p) => p.chapterId === state.chapterId);
  const notStarted = state.chapterId === 'not-started';
  const text = notStarted
    ? r1.chapterStrip.notStarted
    : state.chapterId === 'story-finished'
      ? r1.chapterStrip.finished
      : n > 0
        ? r1.chapterStrip.some(n, label)
        : saveReminder
          ? r2.chapterStrip.saveOnly(label)
          : r1.chapterStrip.none(label);
  return (
    <p class={`chapter-strip ${n > 0 ? 'warn' : ''}`}>
      {n > 0 ? <WarnIcon /> : <InfoIcon />}
      <span>
        {text}
        {!notStarted && (
          <>
            {' '}
            <a href="#dont-lose">{n > 0 ? r1.chapterStripLink : r3.chapterStripLinkNeutral}</a>
          </>
        )}
      </span>
    </p>
  );
}

export default function Planner({
  data = clientData,
  pageUrl,
  children,
}: {
  data?: Dataset;
  pageUrl: string;
  /** The page's hero copy, shown beside the plan summary. */
  children?: ComponentChildren;
}) {
  const [state, setState, ready] = useStore(data);
  const [cat, setCat] = useState(data.categories[0]?.id ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  /**
   * The row with focus anywhere inside it (its input, "Watch out" toggle or a badge) stays visible even when the
   * filter would remove it, so Tab from a row that just became Done lands on its next control, not on <body>.
   */
  const [focusId, setFocusId] = useState<string | null>(null);
  /**
   * The row whose input was focused last shows its "where to check" hint. Kept on blur: if the hint collapsed when
   * focus left, the rows below would jump up under a tap that is already landing.
   */
  const [hintId, setHintId] = useState<string | null>(null);
  /**
   * Rows the filter leaves in place during a run of taps: rows changed with − / + (the steppers never take focus)
   * and rows whose input lost focus to a tap. The list never reflows mid-sequence, so a repeat tap lands on the
   * row it was aimed at. They are released together once the pointer has been idle for HOLD_MS, at once when
   * keyboard focus moves, and when the tab or filter changes.
   */
  const [held, setHeldState] = useState<ReadonlySet<string>>(new Set());
  const heldRef = useRef<ReadonlySet<string>>(held);
  const setHeld = (next: ReadonlySet<string>) => {
    heldRef.current = next;
    setHeldState(next);
  };
  const pointer = useRef({ down: false, upAt: -Infinity });
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** The row under the last pointer press: kept visually fixed when held rows are released. */
  const pressedRow = useRef<string | null>(null);
  /**
   * Rows measured just before a release (the pressed or newly focused row first, then the rows after it), for the
   * scroll fix. Kept until the current task ends, so every render it causes (a row leaving, hints moving) is corrected.
   */
  const anchor = useRef<[Element, number][] | null>(null);
  /** The rows on screen when the idle timer released held rows: if any of them left, STEP_GUARD_MS starts. */
  const released = useRef<{ rows: HTMLElement[]; anchorId: string | null } | null>(null);
  /** Until `until`, − / + presses count only on `row` (the row kept in place by the release). */
  const stepGuard = useRef<{ until: number; row: string | null }>({ until: -Infinity, row: null });
  /**
   * The staggered row entrance and meter growth play once, on first load. Switching tabs or filters shows the
   * new rows at once instead of replaying it.
   */
  const [intro, setIntro] = useState(true);
  /** Rows whose "Watch out" notes are open. */
  const [openTraps, setOpenTraps] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState('');
  const valueAtFocus = useRef<Count | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const s = summary(data, state);
  /** A repeat of the same text is changed by a trailing no-break space so the polite region still speaks. */
  const announce = (text: string) => setAnnouncement((prev) => (prev === text ? `${text} ` : text));

  const visibleRows = () => [...(rootRef.current?.querySelectorAll<HTMLElement>('[role="tabpanel"]:not([hidden]) li[data-row]') ?? [])];
  /**
   * Measure `el` for the scroll fix: its row and the rows after it (the first of them still in the list after the
   * next render keeps its place), or `el` alone outside the rows. A measurement already pending in this task wins.
   * `inViewOnly`: skip it unless `el` is fully on screen (below the sticky bars), so focus moving to a control off
   * screen still scrolls it into view.
   */
  const anchorOn = (el: Element | null, inViewOnly = false) => {
    if (anchor.current || !el) return;
    if (inViewOnly) {
      const r = el.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      if (r.top < top || r.bottom > window.innerHeight) return;
    }
    const rows = visibleRows();
    const row = el.closest<HTMLElement>('li[data-row]');
    const i = row ? rows.indexOf(row) : -1;
    const els = i >= 0 ? rows.slice(i) : [el];
    anchor.current = els.map((x) => [x, x.getBoundingClientRect().top]);
    setTimeout(() => (anchor.current = null));
  };
  /**
   * Release every held row now. `anchorId`'s row (or the first row after it that stays) keeps its place on screen.
   * `fromIdle`: released by the idle timer, so a tap may already be on its way (see STEP_GUARD_MS).
   */
  const releaseHeld = (anchorId: string | null, fromIdle = false) => {
    clearTimeout(releaseTimer.current);
    if (heldRef.current.size === 0) return;
    const rows = visibleRows();
    anchorOn(rows.find((el) => el.dataset.row === anchorId) ?? null);
    released.current = fromIdle ? { rows, anchorId } : null;
    setHeld(new Set());
  };
  /** (Re)start the idle countdown; it only runs while no pointer is down. */
  const armRelease = () => {
    clearTimeout(releaseTimer.current);
    if (!pointer.current.down && heldRef.current.size > 0)
      releaseTimer.current = setTimeout(() => releaseHeld(pressedRow.current, true), HOLD_MS);
  };
  /** Whether a − / + press on `id`'s row counts (see STEP_GUARD_MS). */
  const stepAllowed = (id: string) => id === stepGuard.current.row || performance.now() >= stepGuard.current.until;
  const hold = (id: string) => {
    if (!heldRef.current.has(id)) setHeld(new Set([...heldRef.current, id]));
    armRelease();
  };
  /** A new view (tab or filter): held rows go at once, with no scroll fix. */
  const dropHeld = () => {
    clearTimeout(releaseTimer.current);
    if (heldRef.current.size > 0) setHeld(new Set());
    setIntro(false);
  };

  // Safari has no scroll anchoring (and Chromium anchors to content above the rows): when released rows leave the
  // list, scroll by however far the pressed row moved, so it stays exactly where it was under the finger. The same
  // goes for the newly focused row when keyboard focus leaves a row that then leaves the list.
  useLayoutEffect(() => {
    const rel = released.current;
    released.current = null;
    if (rel?.rows.some((el) => !el.isConnected)) stepGuard.current = { until: performance.now() + STEP_GUARD_MS, row: rel.anchorId };
    const kept = anchor.current?.find(([el]) => el.isConnected);
    if (!kept) return;
    const dy = kept[0].getBoundingClientRect().top - kept[1];
    if (Math.abs(dy) >= 0.5) window.scrollBy(0, dy);
  }, [held, focusId, hintId]);

  // The entrance has finished by now (the longest delay is ~1.5s); later renders never replay it.
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 1600);
    return () => clearTimeout(t);
  }, []);

  // Pointer tracking for `held`. Touch fires blur only after pointerup (on the compatibility mousedown), so a
  // blur within 300ms of pointerup still belongs to the same tap.
  useEffect(() => {
    // Any press (a repeat tap, a scroll) restarts the idle countdown; it runs again once the pointer lifts.
    const down = (e: PointerEvent) => {
      pointer.current.down = true;
      clearTimeout(releaseTimer.current);
      const row = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-row]') : null;
      if (row && rootRef.current?.contains(row)) pressedRow.current = row.dataset.row ?? null;
    };
    const up = () => {
      pointer.current = { down: false, upAt: performance.now() };
      armRelease();
    };
    // Keyboard focus moving releases held rows at once, keeping the newly focused row in place.
    const focusin = (e: FocusEvent) => {
      if (pointerBusy() || heldRef.current.size === 0) return;
      const row = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-row]') : null;
      releaseHeld(row?.dataset.row ?? null);
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    document.addEventListener('focusin', focusin, true);
    return () => {
      clearTimeout(releaseTimer.current);
      clearTimeout(stepTimer.current);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      document.removeEventListener('focusin', focusin, true);
    };
  }, []);
  function pointerBusy() {
    return pointer.current.down || performance.now() - pointer.current.upAt < 300;
  }

  // Enter on the last count of a category moves into the next category's hidden panel: show it in the same
  // keystroke (so focus can land there), then select its tab.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reveal = (e: Event) => {
      const panel = e.target instanceof Element ? e.target.closest<HTMLElement>('[role="tabpanel"]') : null;
      if (!panel?.dataset.cat) return;
      panel.hidden = false;
      setCat(panel.dataset.cat);
      setIntro(false);
    };
    el.addEventListener(REVEAL_EVENT, reveal);
    return () => el.removeEventListener(REVEAL_EVENT, reveal);
  }, []);

  const isDone = (r: Requirement) => rowResult(data, state, r).kind === 'done';
  const matches = (r: Requirement) => filter === 'all' || (filter === 'done') === isDone(r);
  const groups = data.categories.map((c) => {
    const rows = data.requirements.filter((r) => r.categoryId === c.id);
    const visible = rows.filter((r) => matches(r) || r.id === focusId || held.has(r.id));
    const done = rows.filter(isDone).length;
    return { cat: c, rows, visible, done };
  });
  const active = groups.find((g) => g.cat.id === cat) ?? groups[0];
  /** The last input on the page gets a "done" Enter key instead of "next". */
  const lastId = groups.flatMap((g) => g.visible).at(-1)?.id;

  const setReq = (id: string, v: number | null) => {
    const req = { ...state.req };
    if (v === null) delete req[id];
    else req[id] = v;
    const next = { ...state, req } as PlayerState;
    setState(next);
    // A row that becomes Done starts with its notes collapsed.
    const r = data.requirements.find((x) => x.id === id);
    if (r && openTraps.has(id) && rowResult(data, next, r).kind === 'done') setTrapOpen(id, false);
    return next;
  };
  const setTrapOpen = (id: string, open: boolean) =>
    setOpenTraps((cur) => {
      if (cur.has(id) === open) return cur;
      const nextSet = new Set(cur);
      if (open) nextSet.add(id);
      else nextSet.delete(id);
      return nextSet;
    });

  const onFocus = (r: Requirement) => {
    setHintId(r.id);
    valueAtFocus.current = state.req[r.id];
  };
  const onBlur = (r: Requirement) => {
    if (state.req[r.id] !== valueAtFocus.current) announce(r1.announce(r.name, outcomeText(r, rowResult(data, state, r))));
  };
  /** − / +: keep the row in place, and read the new outcome once the presses pause (unless its input has focus). */
  const onStep = (r: Requirement, v: number) => {
    hold(r.id);
    const inputFocused = document.activeElement?.id === `req-${r.id}`;
    clearTimeout(stepTimer.current);
    if (inputFocused) return; // its blur announces
    const next = { ...state, req: { ...state.req, [r.id]: v } } as PlayerState;
    const text = r1.announce(r.name, outcomeText(r, rowResult(data, next, r)));
    stepTimer.current = setTimeout(() => announce(text), 450);
  };
  const onRowFocusIn = (r: Requirement) => setFocusId(r.id);
  /**
   * Focus moving between controls in the same row keeps it; leaving the row releases it (or holds it for a tap).
   * Keyboard focus leaving keeps the newly focused control where it is if this row then leaves the list.
   */
  const onRowFocusOut = (r: Requirement, e: FocusEvent) => {
    const to = e.relatedTarget;
    if (to instanceof Node && (e.currentTarget as HTMLElement).contains(to)) return;
    if (pointerBusy()) hold(r.id);
    else if (to instanceof Element) anchorOn(to, true);
    setFocusId((id) => (id === r.id ? null : id));
  };

  /** Select a category. If the tabs are stuck to the top of the screen, bring the start of the list into view. */
  const selectCat = (id: string, focusTab = false) => {
    dropHeld();
    setCat(id);
    if (focusTab) tabRefs.current[data.categories.findIndex((c) => c.id === id)]?.focus();
    const board = boardRef.current;
    if (!board) return;
    // Scrolled past the board's top (the tabs are stuck): put the board's top right under the sticky header, so the
    // tabs stay where they are and the new list starts at its first row.
    const stickyTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-top')) || 0;
    const top = board.getBoundingClientRect().top;
    if (top < stickyTop) window.scrollBy(0, top - stickyTop);
  };
  const onTabKey = (e: KeyboardEvent, i: number) => {
    const n = data.categories.length;
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (i + 1) % n
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (i - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    selectCat(data.categories[to].id, true);
  };

  const counts = { all: active.rows.length, done: active.done, left: active.rows.length - active.done };
  const cells = Array.from({ length: s.total }, (_, i) => (i < s.done ? 'd' : i < s.done + s.remaining ? 'p' : ''));

  return (
    <div class={`planner${intro ? ' intro' : ''}`} aria-busy={!ready} ref={rootRef}>
      <div class={`hero${children ? '' : ' no-copy'}`}>
        {children && <div class="hero-copy">{children}</div>}
        <section class="hud summary" aria-labelledby="calculator">
          <div class="hud-head">
            <h2 id="calculator" class="hud-title">
              Your 100% plan
            </h2>
            <span class="hud-of">
              of {s.total} {s.total === 1 ? 'requirement' : 'requirements'}
            </span>
          </div>
          <div class="cells" aria-hidden="true">
            {cells.map((c, i) => (
              <span key={i} class={`cell ${c}`} style={{ '--i': i }} />
            ))}
          </div>
          <div class="stats">
            <p class="stat ok">
              <strong class="n">{s.done}</strong> <span class="l">done</span>
            </p>
            <p class="stat todo">
              <strong class="n">{s.remaining}</strong> <span class="l">in progress</span>
            </p>
            <p class="stat unknown">
              <strong class="n">{s.unknown}</strong> <span class="l">not entered</span>
            </p>
          </div>
        </section>
      </div>

      {/* The hero's "Enter your counts" link lands here, so the chapter picker and the first count are both in view. */}
      <div id="start" class={`chapter-bar${upcomingMissables(data, state).length > 0 ? ' warn' : ''}`}>
        <ChapterPicker data={data} state={state} setState={setState} />
        <ChapterStrip data={data} state={state} />
      </div>

      <div class="board" id="board" ref={boardRef}>
        <div class="rail">
          <div class="tabs" role="tablist" aria-label={r1.jumpNavLabel}>
            {groups.map((g, i) => {
              const selected = g.cat.id === active.cat.id;
              return (
                <button
                  key={g.cat.id}
                  type="button"
                  role="tab"
                  id={`tab-${g.cat.id}`}
                  aria-selected={selected ? 'true' : 'false'}
                  aria-controls={`panel-${g.cat.id}`}
                  tabIndex={selected ? 0 : -1}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  onClick={() => selectCat(g.cat.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  <span class="tn">{g.cat.name}</span>
                  <span class="tc">
                    <Highlight text={r4.tabProgress(g.done, g.rows.length)} part={String(g.done)} />
                  </span>
                  <span class="tc-short" aria-hidden="true">
                    {g.done}/{g.rows.length}
                  </span>
                  <span class="mini" aria-hidden="true">
                    <i style={{ width: `${(g.done / Math.max(1, g.rows.length)) * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
          <a class="rail-link" href="#dont-lose">
            <WarnIcon /> {r1.jumpBeforeFinish}
          </a>
          <p class="kbd-hint">
            <kbd>Tab</kbd> {r4.kbdHint.tab}{' '}
            <kbd>
              <span aria-hidden="true">↵</span>
              <span class="sr-only">Enter</span>
            </kbd>{' '}
            {r4.kbdHint.enter}
          </p>
        </div>

        <div class="board-main">
          <div class="board-head">
            <h3 class="cat-title" id="cat-title">
              {active.cat.name} <small>{active.rows.length}</small>
            </h3>
          </div>
          <div class="toolbar">
            <div class="filter" role="group" aria-label={r4.filterLabel}>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  data-filter={f.id}
                  aria-pressed={filter === f.id ? 'true' : 'false'}
                  onClick={() => {
                    dropHeld();
                    setFilter(f.id);
                  }}
                >
                  {f.label} <span class="ct">{counts[f.id]}</span>
                </button>
              ))}
            </div>
            <p class="legend" aria-hidden="true">
              <span>
                <i class="lg-need" />
                {r4.legendNeeded}
              </span>
              <span>
                <i class="lg-skip" />
                {r4.legendSkip}
              </span>
            </p>
          </div>

          {groups.map(({ cat: c, visible }) => (
            <div
              key={c.id}
              class="cat-panel"
              role="tabpanel"
              id={`panel-${c.id}`}
              aria-labelledby={`tab-${c.id}`}
              data-cat={c.id}
              hidden={c.id !== active.cat.id}
            >
              {visible.length === 0 ? (
                <p class="empty">{filter === 'done' ? r4.filterEmptyDone : 'All done in this group.'}</p>
              ) : (
                <ul class="req-list">
                  {visible.map((r, k) => {
                    const res = rowResult(data, state, r);
                    const traps = data.exceptions.filter((e) => e.requirementIds.includes(r.id));
                    const inputId = `req-${r.id}`;
                    const ids = {
                      target: `${inputId}-target`,
                      hint: `${inputId}-hint`,
                      risk: `${inputId}-risk`,
                      out: `${inputId}-out`,
                      notes: `${inputId}-notes`,
                    };
                    const atRisk = res.kind === 'remaining' && res.atRisk;
                    const riskHint = atRisk && r3.rowAtRiskHint ? r3.rowAtRiskHint : null;
                    const trapsOpen = openTraps.has(r.id);
                    const tone =
                      res.kind === 'invalid' || (res.kind === 'remaining' && res.impossible) ? ' t-bad' : atRisk ? ' t-risk' : '';
                    return (
                      <li
                        key={r.id}
                        data-row={r.id}
                        class={`req ${res.kind}${tone}${r.id === hintId ? ' show-hint' : ''}`}
                        style={{ '--i': Math.min(k, 14) }}
                        onFocusIn={() => onRowFocusIn(r)}
                        onFocusOut={(e) => onRowFocusOut(r, e)}
                      >
                        <div class="req-title">
                          <label for={inputId} class="req-name">
                            {r.name}
                          </label>{' '}
                          <FormBadge status={r.status} sources={r.sources} note={r.note} />
                        </div>
                        <div class="req-meta" id={ids.target}>
                          Need <b>{fmt(r, r.required)}</b>
                          {r.total !== null && (
                            <>
                              {' '}
                              <span class="of">of {fmt(r, r.total)}</span>
                            </>
                          )}
                        </div>
                        <Outcome id={ids.out} r={r} res={res} />
                        <Meter r={r} value={state.req[r.id]} res={res} skip={skipAllowance(data, state, r, res)} />
                        <div class="req-input">
                          <CountInput
                            id={inputId}
                            name={r.name}
                            value={state.req[r.id]}
                            max={requirementMax(r)}
                            unit={r.unit}
                            last={r.id === lastId}
                            describedBy={[ids.target, r.whereToCount ? ids.hint : null, ids.out, riskHint ? ids.risk : null]
                              .filter(Boolean)
                              .join(' ')}
                            onValue={(v) => setReq(r.id, v)}
                            onStep={(v) => onStep(r, v)}
                            canStep={() => stepAllowed(r.id)}
                            onFocus={() => onFocus(r)}
                            onBlur={() => onBlur(r)}
                          />
                        </div>
                        {traps.length > 0 && (
                          // The toggle keeps its own grid cell when opened; the notes come right after it in the
                          // DOM (input, toggle, notes in Tab and reading order) but render in a full-width cell at
                          // the bottom of the row, so neither the "Watch out" label nor the stepper moves under the tap.
                          <>
                            <button
                              type="button"
                              class="req-traps"
                              aria-expanded={trapsOpen ? 'true' : 'false'}
                              aria-controls={ids.notes}
                              onClick={() => setTrapOpen(r.id, !trapsOpen)}
                            >
                              <WarnIcon />
                              {r1.trapToggle(traps.length)}
                              <svg class="chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                                <path d="m4 6 4 4 4-4" />
                              </svg>
                            </button>
                            <div class="req-notes" id={ids.notes} hidden={!trapsOpen}>
                              {traps.map((t) => (
                                <div key={t.id} class="req-trap">
                                  <strong>Watch out:</strong> {t.title}. {t.detail} <FormBadge status={t.status} sources={t.sources} />
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        {r.whereToCount && (
                          <div class="req-hint" id={ids.hint}>
                            Where to check: {r.whereToCount}
                          </div>
                        )}
                        {riskHint && (
                          <div class="req-hint req-risk" id={ids.risk}>
                            {riskHint}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
          <p class="badge-legend">{r1.badgeLegend}</p>
        </div>
      </div>

      <p class="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {/* Share and reset sit after the last row, so the calculator's first rows come first on small screens. */}
      <div class="share-panel">
        <ShareBar data={data} state={state} pageUrl={pageUrl} />
      </div>
    </div>
  );
}

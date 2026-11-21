import { clientData } from '../data/client';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { r1 } from '../copy/r1';
import { r2 } from '../copy/r2';
import { r3 } from '../copy/r3';
import { r4 } from '../copy/r4';
import type { Dataset, Requirement } from '../data/schema';
import {
  currentChapter,
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
          <span class="sep">·</span> <span class="skip">{skipText(res.skipLeft)}</span>
        </>
      )}
    </span>
  );
}

/**
 * The row's meter (decorative; the numbers are in the text). Segments up to the game's total, a lime fill up to your
 * count, a tick at the required mark, a striped cyan zone for what you can skip, and a marker at your count.
 */
function Meter({ r, value, res }: { r: Requirement; value: Count | undefined; res: RowResult }) {
  const max = r.total ?? r.required;
  const segs = Math.max(1, Math.min(max, 40));
  const pct = (x: number) => Math.max(0, Math.min(100, (x / max) * 100));
  const v = typeof value === 'number' ? Math.min(value, max) : null;
  const skipW = r.total === null ? 0 : 100 - pct(r.required);
  const over = res.kind === 'invalid';
  return (
    <div class="meter" aria-hidden="true">
      <div class="bar" style={{ '--segs': segs }}>
        {skipW > 0 && <span class="skipzone" style={{ width: `${skipW}%` }} />}
        <span class="fill" style={{ width: `${over ? 100 : v === null ? 0 : pct(v)}%` }} />
      </div>
      {skipW > 0 && (
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
   * A row whose input lost focus during a tap or click elsewhere. The filter leaves it in place until that
   * interaction lands (click, or 300ms after the pointer lifts), so nothing moves under the finger.
   */
  const [heldId, setHeldId] = useState<string | null>(null);
  /**
   * The row last changed with its − / + buttons. The steppers never take focus, so this keeps the row on screen
   * while the finger is still on it; the next pointer press outside the row hands it to `heldId`.
   */
  const [stepId, setStepIdState] = useState<string | null>(null);
  const stepRef = useRef<string | null>(null);
  const setStepId = (id: string | null) => {
    stepRef.current = id;
    setStepIdState(id);
  };
  const pointer = useRef({ down: false, upAt: -Infinity });
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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

  // Pointer tracking for `heldId`. Touch fires blur only after pointerup (on the compatibility mousedown), so a
  // blur within 300ms of pointerup still belongs to the same tap.
  useEffect(() => {
    const release = (ms: number) => {
      clearTimeout(releaseTimer.current);
      releaseTimer.current = setTimeout(() => setHeldId(null), ms);
    };
    const outsideStepRow = (t: EventTarget | null) => {
      const id = stepRef.current;
      return id !== null && !(t instanceof Element && t.closest(`[data-row="${id}"]`));
    };
    const down = (e: PointerEvent) => {
      pointer.current.down = true;
      clearTimeout(releaseTimer.current);
      // A press outside the row last changed with − / +: hold that row until this interaction lands.
      if (outsideStepRow(e.target)) {
        setHeldId(stepRef.current);
        setStepId(null);
      }
    };
    const up = () => {
      pointer.current = { down: false, upAt: performance.now() };
      release(300);
    };
    // After the click's own handlers and default action (e.g. a <details> toggling open) have run.
    const click = () => {
      if (pointer.current.down) return;
      pointer.current.upAt = -Infinity;
      release(0);
    };
    // Keyboard focus moving elsewhere releases the stepped row at once.
    const focusin = (e: FocusEvent) => {
      if (outsideStepRow(e.target)) setStepId(null);
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    document.addEventListener('click', click, true);
    document.addEventListener('focusin', focusin, true);
    return () => {
      clearTimeout(releaseTimer.current);
      clearTimeout(stepTimer.current);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('focusin', focusin, true);
    };
  }, []);
  const pointerBusy = () => pointer.current.down || performance.now() - pointer.current.upAt < 300;

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
    };
    el.addEventListener(REVEAL_EVENT, reveal);
    return () => el.removeEventListener(REVEAL_EVENT, reveal);
  }, []);

  const isDone = (r: Requirement) => rowResult(data, state, r).kind === 'done';
  const matches = (r: Requirement) => filter === 'all' || (filter === 'done') === isDone(r);
  const groups = data.categories.map((c) => {
    const rows = data.requirements.filter((r) => r.categoryId === c.id);
    const visible = rows.filter((r) => matches(r) || r.id === focusId || r.id === heldId || r.id === stepId);
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
    setStepId(r.id);
    const inputFocused = document.activeElement?.id === `req-${r.id}`;
    clearTimeout(stepTimer.current);
    if (inputFocused) return; // its blur announces
    const next = { ...state, req: { ...state.req, [r.id]: v } } as PlayerState;
    const text = r1.announce(r.name, outcomeText(r, rowResult(data, next, r)));
    stepTimer.current = setTimeout(() => announce(text), 450);
  };
  const onRowFocusIn = (r: Requirement) => setFocusId(r.id);
  /** Focus moving between controls in the same row keeps it; leaving the row releases it (or holds it for a tap). */
  const onRowFocusOut = (r: Requirement, e: FocusEvent) => {
    const to = e.relatedTarget;
    if (to instanceof Node && (e.currentTarget as HTMLElement).contains(to)) return;
    if (pointerBusy()) setHeldId(r.id);
    setFocusId((id) => (id === r.id ? null : id));
  };

  /** Select a category. If the tabs are stuck to the top of the screen, bring the start of the list into view. */
  const selectCat = (id: string, focusTab = false) => {
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
    <div class="planner" aria-busy={!ready} ref={rootRef}>
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

      <div class={`chapter-bar${upcomingMissables(data, state).length > 0 ? ' warn' : ''}`}>
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
                  onClick={() => setFilter(f.id)}
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
                          {r.total !== null && <> of {fmt(r, r.total)}</>}
                        </div>
                        <Outcome id={ids.out} r={r} res={res} />
                        {traps.length > 0 && (
                          // The summary keeps its own grid cell when opened; the notes render after it in a
                          // full-width cell at the bottom of the row, so neither the "Watch out" label nor the
                          // stepper moves under the tap.
                          <details
                            class="req-traps"
                            open={trapsOpen}
                            onToggle={(e) => setTrapOpen(r.id, (e.currentTarget as HTMLDetailsElement).open)}
                          >
                            <summary aria-controls={ids.notes}>
                              <WarnIcon />
                              {r1.trapToggle(traps.length)}
                            </summary>
                          </details>
                        )}
                        <Meter r={r} value={state.req[r.id]} res={res} />
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
                            onFocus={() => onFocus(r)}
                            onBlur={() => onBlur(r)}
                          />
                        </div>
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
                        {traps.length > 0 && (
                          <div class="req-notes" id={ids.notes} hidden={!trapsOpen}>
                            {traps.map((t) => (
                              <div key={t.id} class="req-trap">
                                <strong>Watch out:</strong> {t.title}. {t.detail} <FormBadge status={t.status} sources={t.sources} />
                              </div>
                            ))}
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

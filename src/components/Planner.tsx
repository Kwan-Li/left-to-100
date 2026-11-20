import { clientData } from '../data/client';
import { useEffect, useRef, useState } from 'preact/hooks';
import { r1 } from '../copy/r1';
import { r2 } from '../copy/r2';
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
import { edgeFades } from '../lib/edgeFades';
import { ChapterPicker } from './ChapterPicker';
import { CountInput } from './CountInput';
import { ShareBar } from './ShareBar';
import { FormBadge } from './StatusBadge';
import { useStore } from './useStore';
import './planner.css';

const fmt = (r: Requirement, n: number) =>
  r.unit === 'dollars' ? `$${n.toLocaleString('en-US')}` : r.unit === 'percent' ? `${n}%` : n.toLocaleString('en-US');

const skipText = (skipLeft: number) => (skipLeft === 0 ? 'no skips' : `skip up to ${skipLeft.toLocaleString('en-US')}`);
const impossibleText = "to go. Can't reach the target with the items you marked missed.";

/** The row outcome as plain text, for the screen-reader announcement. Same words as <Outcome>. */
function outcomeText(r: Requirement, res: RowResult): string {
  if (res.kind === 'unknown') return 'Enter your count';
  if (res.kind === 'invalid') return r1.errMax(res.max);
  if (res.kind === 'done') return 'Done';
  if (res.impossible) return `${fmt(r, res.remaining)} ${impossibleText}`;
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
        {fmt(r, res.remaining)} {impossibleText}
      </span>
    );
  return (
    <span id={id} class="out todo">
      <strong>{fmt(r, res.remaining)}</strong> to go
      {res.skipLeft !== null && (
        <>
          {' '}
          · <span class="skip">{skipText(res.skipLeft)}</span>
        </>
      )}
    </span>
  );
}

/**
 * One line under the chapter picker: what the "before you finish" panel holds, with a link to it.
 * `n` counts checklist missables only; a save reminder (point of no return) alone gets its own line.
 */
function ChapterStrip({ data, state }: { data: Dataset; state: PlayerState }) {
  const label = currentChapter(data, state)?.label ?? '';
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
      <span>{text}</span>
      {!notStarted && (
        <>
          {' '}
          <a href="#dont-lose">{r1.chapterStripLink}</a>
        </>
      )}
    </p>
  );
}

export default function Planner({ data = clientData, pageUrl }: { data?: Dataset; pageUrl: string }) {
  const [state, setState, ready] = useStore(data);
  const [hideDone, setHideDone] = useState(false);
  /** The row whose input has focus stays visible even when Hide done would remove it. */
  const [focusId, setFocusId] = useState<string | null>(null);
  /**
   * The row whose input was focused last shows its "where to check" hint on phones. Kept on blur: if the hint
   * collapsed when focus left, the rows below would jump up under a tap that is already landing.
   */
  const [hintId, setHintId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const valueAtFocus = useRef<Count | undefined>(undefined);
  const jumpNav = useRef<HTMLElement>(null);
  const s = summary(data, state);

  useEffect(() => (jumpNav.current ? edgeFades(jumpNav.current) : undefined), []);

  const groups = data.categories.map((cat) => {
    const rows = data.requirements.filter((r) => r.categoryId === cat.id);
    const visible = rows.filter((r) => !hideDone || r.id === focusId || rowResult(data, state, r).kind !== 'done');
    return { cat, rows, visible };
  });
  /** The last input on the page gets a "done" Enter key instead of "next". */
  const lastId = groups.flatMap((g) => g.visible).at(-1)?.id;

  const setReq = (id: string, v: number | null) => {
    const req = { ...state.req };
    if (v === null) delete req[id];
    else req[id] = v;
    setState({ ...state, req } as PlayerState);
  };

  const onFocus = (r: Requirement) => {
    setFocusId(r.id);
    setHintId(r.id);
    valueAtFocus.current = state.req[r.id];
  };
  const onBlur = (r: Requirement) => {
    setFocusId((id) => (id === r.id ? null : id));
    if (state.req[r.id] !== valueAtFocus.current) setAnnouncement(r1.announce(r.name, outcomeText(r, rowResult(data, state, r))));
  };

  return (
    <div class="planner" aria-busy={!ready}>
      <div class="panel planner-top">
        <div class="chapter-block">
          <ChapterPicker data={data} state={state} setState={setState} />
          <ChapterStrip data={data} state={state} />
        </div>
        <div class="summary">
          <div class="chip ok">
            <strong>{s.done}</strong> done
          </div>
          <div class="chip todo">
            <strong>{s.remaining}</strong> in progress
          </div>
          <div class="chip unknown">
            <strong>{s.unknown}</strong> not entered
          </div>
          <span class="summary-total muted">
            of {s.total} {s.total === 1 ? 'requirement' : 'requirements'}
          </span>
        </div>
        <nav class="jump-nav" aria-label={r1.jumpNavLabel} ref={jumpNav}>
          {data.categories.map((cat) => (
            <a key={cat.id} href={`#cat-${cat.id}`}>
              {cat.name}
            </a>
          ))}
          <a href="#dont-lose">{r1.jumpBeforeFinish}</a>
        </nav>
        <div class="planner-actions">
          <label class="toggle">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone((e.target as HTMLInputElement).checked)} />
            Hide done
          </label>
        </div>
      </div>

      <p class="badge-legend muted">{r1.badgeLegend}</p>
      <p class="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {groups.map(({ cat, rows, visible }) => {
        return (
          <section key={cat.id} class="panel req-group" aria-labelledby={`cat-${cat.id}`}>
            <h3 id={`cat-${cat.id}`}>
              {cat.name} <span class="muted">({rows.length})</span>
            </h3>
            {visible.length === 0 ? (
              <p class="muted">All done in this group.</p>
            ) : (
              <ul class="req-list">
                {visible.map((r) => {
                  const res = rowResult(data, state, r);
                  const traps = data.exceptions.filter((e) => e.requirementIds.includes(r.id));
                  const inputId = `req-${r.id}`;
                  const ids = { target: `${inputId}-target`, hint: `${inputId}-hint`, out: `${inputId}-out` };
                  return (
                    <li key={r.id} class={`req ${res.kind}${r.id === hintId ? ' show-hint' : ''}`}>
                      <label for={inputId} class="req-name">
                        {r.name}
                      </label>
                      <div class="req-meta" id={ids.target}>
                        Need {fmt(r, r.required)}
                        {r.total !== null && <> of {fmt(r, r.total)}</>} <FormBadge status={r.status} sources={r.sources} note={r.note} />
                      </div>
                      {r.whereToCount && (
                        <div class="req-hint" id={ids.hint}>
                          Where to check: {r.whereToCount}
                        </div>
                      )}
                      <div class="req-input">
                        <CountInput
                          id={inputId}
                          value={state.req[r.id]}
                          max={requirementMax(r)}
                          unit={r.unit}
                          last={r.id === lastId}
                          describedBy={[ids.target, r.whereToCount ? ids.hint : null, ids.out].filter(Boolean).join(' ')}
                          onValue={(v) => setReq(r.id, v)}
                          onFocus={() => onFocus(r)}
                          onBlur={() => onBlur(r)}
                        />
                        <Outcome id={ids.out} r={r} res={res} />
                      </div>
                      {traps.length > 0 && (
                        // Keyed on done-ness so a row that becomes Done starts with its traps collapsed.
                        <details key={`${r.id}-${res.kind === 'done'}`} class="req-traps">
                          <summary>{r1.trapToggle(traps.length)}</summary>
                          {traps.map((t) => (
                            <div key={t.id} class="req-trap">
                              <strong>Watch out:</strong> {t.title}. {t.detail} <FormBadge status={t.status} sources={t.sources} />
                            </div>
                          ))}
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {/* Share and reset sit after the last row, so the calculator's first rows come first on small screens. */}
      <div class="panel share-panel">
        <ShareBar data={data} state={state} pageUrl={pageUrl} />
      </div>
    </div>
  );
}

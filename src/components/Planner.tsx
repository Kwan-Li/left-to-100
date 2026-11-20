import { clientData } from '../data/client';
import { useState } from 'preact/hooks';
import type { Dataset, Requirement } from '../data/schema';
import { rowResult, summary, type PlayerState, type RowResult } from '../lib/plan';
import { ChapterPicker } from './ChapterPicker';
import { ShareBar } from './ShareBar';
import { StatusBadge } from './StatusBadge';
import { parseCount, useStore } from './useStore';
import './planner.css';

const fmt = (r: Requirement, n: number) =>
  r.unit === 'dollars' ? `$${n.toLocaleString('en-US')}` : r.unit === 'percent' ? `${n}%` : n.toLocaleString('en-US');

function Outcome({ r, res }: { r: Requirement; res: RowResult }) {
  if (res.kind === 'unknown') return <span class="out unknown">Enter your count</span>;
  if (res.kind === 'done') return <span class="out done">Done</span>;
  if (res.impossible)
    return (
      <span class="out bad">
        {fmt(r, res.remaining)} to go. Can't be reached with the items you marked missed.
      </span>
    );
  return (
    <span class="out todo">
      <strong>{fmt(r, res.remaining)}</strong> to go
      {res.skipLeft !== null && (
        <>
          {' '}
          · <span class="skip">skip up to {res.skipLeft.toLocaleString('en-US')}</span>
        </>
      )}
    </span>
  );
}

export default function Planner({ data = clientData, pageUrl }: { data?: Dataset; pageUrl: string }) {
  const [state, setState, ready] = useStore(data);
  const [hideDone, setHideDone] = useState(false);
  const s = summary(data, state);

  const setReq = (id: string, v: number | null) => {
    const req = { ...state.req };
    if (v === null) delete req[id];
    else req[id] = v;
    setState({ ...state, req } as PlayerState);
  };

  return (
    <div class="planner" aria-busy={!ready}>
      <div class="panel planner-top">
        <ChapterPicker data={data} state={state} setState={setState} />
        <div class="summary" role="status" aria-live="polite">
          <div class="chip ok">
            <strong>{s.done}</strong> done
          </div>
          <div class="chip todo">
            <strong>{s.remaining}</strong> in progress
          </div>
          <div class="chip unknown">
            <strong>{s.unknown}</strong> not entered
          </div>
          <div class="chip">of {s.total} requirements</div>
        </div>
        <div class="planner-actions">
          <label class="toggle">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone((e.target as HTMLInputElement).checked)} />
            Hide finished
          </label>
          <ShareBar data={data} state={state} pageUrl={pageUrl} />
        </div>
      </div>

      {data.categories.map((cat) => {
        const rows = data.requirements.filter((r) => r.categoryId === cat.id);
        const visible = rows.filter((r) => !hideDone || rowResult(data, state, r).kind !== 'done');
        return (
          <section class="panel req-group" aria-labelledby={`cat-${cat.id}`}>
            <h3 id={`cat-${cat.id}`}>
              {cat.name} <span class="muted">({rows.length})</span>
            </h3>
            {visible.length === 0 ? (
              <p class="muted">All finished in this group.</p>
            ) : (
              <ul class="req-list">
                {visible.map((r) => {
                  const res = rowResult(data, state, r);
                  const traps = data.exceptions.filter((e) => e.requirementIds.includes(r.id));
                  const inputId = `req-${r.id}`;
                  return (
                    <li class={`req ${res.kind}`}>
                      <div class="req-main">
                        <label for={inputId} class="req-name">
                          {r.name}
                        </label>
                        <div class="req-meta">
                          Need {fmt(r, r.required)}
                          {r.total !== null && <> of {fmt(r, r.total)}</>} <StatusBadge status={r.status} sources={r.sources} note={r.note} />
                        </div>
                        {r.whereToCount && <div class="req-hint">Count it: {r.whereToCount}</div>}
                        {traps.map((t) => (
                          <div class="req-trap">
                            <strong>Watch out:</strong> {t.title}. {t.detail} <StatusBadge status={t.status} sources={t.sources} />
                          </div>
                        ))}
                      </div>
                      <div class="req-input">
                        <input
                          id={inputId}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="?"
                          value={state.req[r.id] ?? ''}
                          onInput={(e) => setReq(r.id, parseCount((e.target as HTMLInputElement).value))}
                        />
                        <Outcome r={r} res={res} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

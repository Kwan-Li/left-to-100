import { clientData } from '../data/client';
import type { Dataset } from '../data/schema';
import { r1 } from '../copy/r1';
import { cardPlan, isOverMax, passedMissables, setVerdicts, type CardPlan, type SetVerdict } from '../lib/plan';
import { ChapterPicker } from './ChapterPicker';
import { CountInput } from './CountInput';
import { MissableQuestions } from './MissableQuestions';
import { ShareBar } from './ShareBar';
import { FormBadge } from './StatusBadge';
import { useStore } from './useStore';
import './planner.css';

const VERDICT_TEXT: Record<SetVerdict, string> = {
  done: r1.verdictDone,
  finish: 'Finish',
  skip: 'Skip',
  uncertain: r1.verdictUncertain,
};

function Result({ data, plan, blank, onFill }: { data: Dataset; plan: CardPlan; blank: number; onFill: () => void }) {
  const name = (id: string) => data.cardSets.find((s) => s.id === id)?.name ?? id;
  const k = data.totals.cardSetsRequired;
  const skipNames = (ids: string[]) => data.cardSets.filter((s) => !ids.includes(s.id)).map((s) => s.name);

  if (plan.kind === 'incomplete')
    return (
      <div class="result">
        <p class="result-big">Enter a count for every set to get your plan.</p>
        {/* Sets with an out-of-range count show their own error; only truly blank sets are counted here. */}
        {blank > 0 && (
          <>
            <p class="muted">
              {blank} of {data.cardSets.length} {blank === 1 ? 'set is' : 'sets are'} blank. Enter 0 for sets you haven't started.
            </p>
            <button type="button" class="btn primary" onClick={onFill}>
              Set blank sets to 0
            </button>
          </>
        )}
      </div>
    );

  if (plan.kind === 'impossible')
    return (
      <div class="result bad">
        <p class="result-big">
          Only {plan.available} {plan.available === 1 ? 'set is' : 'sets are'} still possible, but you need {k}.
        </p>
        <p class="muted">Check any sets you marked unobtainable or missed. A missed card may still have another copy in the game.</p>
      </div>
    );

  if (plan.kind === 'exact')
    return (
      <div class="result">
        <p class="result-big">
          {plan.plan.min === 0 ? (
            <>You've already finished {k} sets—0 more cards needed.</>
          ) : (
            <>
              You need <strong>{plan.plan.min}</strong> more {plan.plan.min === 1 ? 'card' : 'cards'} to finish {k} sets.
            </>
          )}
        </p>
        <p>
          <span class="muted">Skip:</span> {skipNames(plan.plan.setIds).join(', ')}.
        </p>
      </div>
    );

  const uncertain = plan.uncertainSetIds.map(name).join(' and ');
  return (
    <div class="result range">
      <p class="result-big">
        {plan.worst ? (
          <>
            You need <strong>{plan.best.min}</strong> to <strong>{plan.worst.min}</strong> more cards, depending on whether{' '}
            {uncertain} can still be finished.
          </>
        ) : (
          <>
            Best case: <strong>{plan.best.min}</strong> more {plan.best.min === 1 ? 'card' : 'cards'}. Worst case: not enough sets
            left if {uncertain} can't be finished.
          </>
        )}
      </p>
      <p>
        <span class="muted">Best case, skip:</span> {skipNames(plan.best.setIds).join(', ')}.
      </p>
      {plan.worst && (
        <p>
          <span class="muted">Worst case, skip:</span> {skipNames(plan.worst.setIds).join(', ')}.
        </p>
      )}
      <p class="muted">
        This stays a range until the missable card is verified or you mark the set unobtainable yourself.
      </p>
    </div>
  );
}

export default function CardOptimizer({ data = clientData, pageUrl }: { data?: Dataset; pageUrl: string }) {
  const [state, setState, ready] = useStore(data);
  const plan = cardPlan(data, state);
  const verdicts = setVerdicts(data, state, plan);
  const needs = 'needs' in plan ? plan.needs : [];
  const blank = data.cardSets.filter((s) => state.cards[s.id] === undefined || state.cards[s.id] === null).length;
  const cardMissables = passedMissables(data, state).filter((m) => m.cardSetId);

  const setCards = (id: string, v: number | null) => {
    const cards = { ...state.cards };
    if (v === null) delete cards[id];
    else cards[id] = v;
    setState({ ...state, cards });
  };
  const toggleLost = (id: string, on: boolean) =>
    setState({ ...state, unobtainable: on ? [...state.unobtainable, id] : state.unobtainable.filter((x) => x !== id) });
  const fillZero = () => {
    const cards = { ...state.cards };
    for (const s of data.cardSets) if (cards[s.id] === undefined || cards[s.id] === null) cards[s.id] = 0;
    setState({ ...state, cards });
  };

  return (
    <div class="optimizer" aria-busy={!ready}>
      <div class="panel planner-top">
        <ChapterPicker data={data} state={state} setState={setState} />
        <div id="card-result" role="status" aria-live="polite">
          <Result data={data} plan={plan} blank={blank} onFill={fillZero} />
        </div>
        <ShareBar data={data} state={state} pageUrl={pageUrl} />
      </div>

      {cardMissables.length > 0 && (
        <section class="panel">
          <h3>Cards you may have missed</h3>
          <p class="muted">You're past the point where these were reported lost. Check Progress &gt; Collections in-game.</p>
          <MissableQuestions data={data} items={cardMissables} state={state} setState={setState} />
        </section>
      )}

      <section class="panel">
        <h3>Your card sets</h3>
        <p class="muted">Enter how many cards from each set are logged in your collection. Sold cards still count.</p>
        <p class="badge-legend muted">{r1.badgeLegend}</p>
        <ul class="set-grid">
          {data.cardSets.map((s) => {
            const n = needs.find((x) => x.set.id === s.id);
            const verdict = verdicts[s.id];
            const value = state.cards[s.id];
            const invalid = isOverMax(value, s.size);
            const marked = state.unobtainable.includes(s.id);
            const inputId = `set-${s.id}`;
            const outId = `${inputId}-out`;
            return (
              <li key={s.id} class={`set ${verdict ? `v-${verdict}` : ''} ${n?.availability ?? ''}`}>
                <div class="set-head">
                  <label for={inputId} class="set-name">
                    {s.name}
                  </label>
                  <span class="set-tags">
                    <FormBadge status={s.status} sources={s.sources} note={s.note} />
                    {verdict && <span class={`set-verdict ${verdict}`}>{VERDICT_TEXT[verdict]}</span>}
                  </span>
                </div>
                <div class="set-row">
                  <CountInput
                    id={inputId}
                    value={value}
                    max={s.size}
                    describedBy={`${inputId}-size ${outId}`}
                    onValue={(v) => setCards(s.id, v)}
                  />
                  <span class="muted" id={`${inputId}-size`}>
                    / {s.size}
                  </span>
                  <span id={outId} class={invalid ? 'out bad' : 'set-need'}>
                    {invalid ? r1.errMax(s.size) : n && n.needed > 0 ? `${n.needed} to go` : ''}
                  </span>
                </div>
                <div class="set-reasons">
                  {n?.reasons.map((r) => (
                    <p key={r} class="set-reason">
                      {r}
                    </p>
                  ))}
                </div>
                <div class="set-foot">
                  {/* A finished set can't be lost; keep the toggle only so an old mark can still be cleared. */}
                  {(verdict !== 'done' || marked) && (
                    <label class="toggle small">
                      <input type="checkbox" checked={marked} onChange={(e) => toggleLost(s.id, (e.target as HTMLInputElement).checked)} />
                      I can't finish this set
                    </label>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p class="back-link">
          <a href="#card-result">{r1.backToResult}</a>
        </p>
      </section>
    </div>
  );
}

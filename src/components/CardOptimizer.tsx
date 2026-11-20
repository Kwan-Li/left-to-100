import { clientData } from '../data/client';
import type { Dataset } from '../data/schema';
import { cardPlan, passedMissables, type CardPlan } from '../lib/plan';
import { ChapterPicker } from './ChapterPicker';
import { MissableQuestions } from './MissableQuestions';
import { ShareBar } from './ShareBar';
import { StatusBadge } from './StatusBadge';
import { parseCount, useStore } from './useStore';
import './planner.css';

function Result({ data, plan, onFill }: { data: Dataset; plan: CardPlan; onFill: () => void }) {
  const name = (id: string) => data.cardSets.find((s) => s.id === id)?.name ?? id;
  const k = data.totals.cardSetsRequired;
  const skipNames = (ids: string[]) => data.cardSets.filter((s) => !ids.includes(s.id)).map((s) => s.name);

  if (plan.kind === 'incomplete')
    return (
      <div class="result">
        <p class="result-big">Enter a count for every set to get your plan.</p>
        <p class="muted">
          {plan.missingSetIds.length} of {data.cardSets.length} sets are blank. Type 0 for sets you haven't started.
        </p>
        <button type="button" class="btn" onClick={onFill}>
          Set blank sets to 0
        </button>
      </div>
    );

  if (plan.kind === 'impossible')
    return (
      <div class="result bad">
        <p class="result-big">Only {plan.available} sets are still possible, but {k} are needed.</p>
        <p class="muted">Check the sets you marked unobtainable or missed. A missed card may still have another copy.</p>
      </div>
    );

  if (plan.kind === 'exact')
    return (
      <div class="result">
        <p class="result-big">
          <strong>{plan.plan.min}</strong> more cards finishes {k} sets.
        </p>
        <p>
          <span class="muted">Skip:</span> {skipNames(plan.plan.setIds).join(', ')}.
        </p>
      </div>
    );

  return (
    <div class="result range">
      <p class="result-big">
        <strong>{plan.best.min}</strong> to <strong>{plan.worst ? plan.worst.min : 'not possible'}</strong> more cards, depending on
        whether {plan.uncertainSetIds.map(name).join(' and ')} can still be finished.
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
        This stays a range until the loss is verified or you mark the set unobtainable yourself.
      </p>
    </div>
  );
}

export default function CardOptimizer({ data = clientData, pageUrl }: { data?: Dataset; pageUrl: string }) {
  const [state, setState, ready] = useStore(data);
  const plan = cardPlan(data, state);
  const chosen = plan.kind === 'exact' ? plan.plan.setIds : plan.kind === 'range' ? plan.best.setIds : [];
  const needs = 'needs' in plan ? plan.needs : [];
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
        <div role="status" aria-live="polite">
          <Result data={data} plan={plan} onFill={fillZero} />
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
        <ul class="set-grid">
          {data.cardSets.map((s) => {
            const n = needs.find((x) => x.set.id === s.id);
            const pick = chosen.includes(s.id);
            const inputId = `set-${s.id}`;
            return (
              <li class={`set ${pick ? 'pick' : ''} ${n?.availability ?? ''}`}>
                <div class="set-head">
                  <label for={inputId} class="set-name">
                    {s.name}
                  </label>
                  <StatusBadge status={s.status} sources={s.sources} note={s.note} />
                </div>
                <div class="set-row">
                  <input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={s.size}
                    placeholder="?"
                    value={state.cards[s.id] ?? ''}
                    onInput={(e) => setCards(s.id, parseCount((e.target as HTMLInputElement).value))}
                  />
                  <span class="muted">/ {s.size}</span>
                  {n && <span class={`set-need ${n.needed === 0 ? 'done' : ''}`}>{n.needed === 0 ? 'Complete' : `${n.needed} to go`}</span>}
                </div>
                {chosen.length > 0 && <div class={`set-verdict ${pick ? 'go' : 'skip'}`}>{pick ? 'Finish' : 'Skip'}</div>}
                {n?.reasons.map((r) => <p class="set-reason">{r}</p>)}
                <label class="toggle small">
                  <input type="checkbox" checked={state.unobtainable.includes(s.id)} onChange={(e) => toggleLost(s.id, (e.target as HTMLInputElement).checked)} />
                  I can't finish this set
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

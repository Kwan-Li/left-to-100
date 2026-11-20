import { clientData } from '../data/client';
import type { Dataset } from '../data/schema';
import { useEffect, useRef, useState } from 'preact/hooks';
import { r1 } from '../copy/r1';
import { r2 } from '../copy/r2';
import { cardPlan, isOverMax, passedMissables, setVerdicts, type CardPlan, type Count, type SetVerdict } from '../lib/plan';
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

  if (plan.kind === 'achieved')
    return (
      <div class="result">
        <p class="result-big">{r2.cardsAchieved}</p>
      </div>
    );

  if (plan.kind === 'incomplete') {
    const invalid = plan.invalidSetIds;
    /** Jump to the first set whose count is too high and put the cursor in it. */
    const toFirstInvalid = (e: Event) => {
      const input = document.getElementById(`set-${invalid[0]}`);
      if (!input) return;
      e.preventDefault();
      input.focus();
      input.scrollIntoView({ block: 'center' });
    };
    return (
      <div class={`result ${invalid.length ? 'bad' : ''}`}>
        {invalid.length > 0 ? (
          <>
            <p class="result-big">{r2.cardsInvalid(invalid.length)}</p>
            <p>
              <a class="result-link" href={`#set-${invalid[0]}`} onClick={toFirstInvalid}>
                {r2.cardsInvalidLink}
              </a>
            </p>
          </>
        ) : (
          <p class="result-big">Enter a count for every set to get your plan.</p>
        )}
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
  }

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
  const resultRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const valueAtFocus = useRef<Count | undefined>(undefined);
  /** Set by a toggle or a missable answer: read the result out once it has re-rendered. */
  const announceNext = useRef(false);
  const resultText = () => [...(resultRef.current?.querySelectorAll('p') ?? [])].map((p) => p.textContent?.trim()).join(' ');
  /** A repeat of the same text is changed by a trailing no-break space so the polite region still speaks. */
  const announce = (text: string) => setAnnouncement((prev) => (prev === text ? `${text}\u00a0` : text));
  useEffect(() => {
    if (!announceNext.current) return;
    announceNext.current = false;
    announce(resultText());
  });
  /** setState for changes that announce the updated plan as soon as it renders. */
  const setStateAndAnnounce = (s: typeof state) => {
    announceNext.current = true;
    setState(s);
  };

  const setCards = (id: string, v: number | null) => {
    const cards = { ...state.cards };
    if (v === null) delete cards[id];
    else cards[id] = v;
    const size = data.cardSets.find((s) => s.id === id)?.size;
    // A finished set can't be unobtainable: clear the mark so Done never sits next to a checked toggle.
    const unobtainable = v !== null && v === size ? state.unobtainable.filter((x) => x !== id) : state.unobtainable;
    setState({ ...state, cards, unobtainable });
  };
  /** On leaving a changed input, read the updated plan out once (the result box itself is not a live region). */
  const onBlur = (id: string) => {
    if (state.cards[id] === valueAtFocus.current) return;
    announce(resultText());
  };
  const toggleLost = (id: string, on: boolean) =>
    setStateAndAnnounce({
      ...state,
      unobtainable: on ? [...state.unobtainable, id] : state.unobtainable.filter((x) => x !== id),
    });
  const fillZero = () => {
    const cards = { ...state.cards };
    for (const s of data.cardSets) if (cards[s.id] === undefined || cards[s.id] === null) cards[s.id] = 0;
    setState({ ...state, cards });
    // The button disappears with the blanks; land on the new result instead of losing focus to the page.
    requestAnimationFrame(() => resultRef.current?.focus());
  };

  return (
    <div class="optimizer" aria-busy={!ready}>
      <div class="panel planner-top">
        <ChapterPicker data={data} state={state} setState={setState} />
        <div id="card-result" ref={resultRef} tabIndex={-1}>
          <Result data={data} plan={plan} blank={blank} onFill={fillZero} />
        </div>
      </div>

      {cardMissables.length > 0 && (
        <section class="panel">
          <h2 class="panel-title">Cards you may have missed</h2>
          <p class="muted">You're past the point where these were reported lost. Check Progress &gt; Collections in-game.</p>
          <MissableQuestions data={data} items={cardMissables} state={state} setState={setStateAndAnnounce} />
        </section>
      )}

      <section class="panel">
        <h2 class="panel-title">Your card sets</h2>
        <p class="muted">Enter how many cards from each set are logged in your collection. Sold cards still count.</p>
        <p class="badge-legend muted">{r1.badgeLegend}</p>
        <ul class="set-grid">
          {data.cardSets.map((s, i) => {
            const n = needs.find((x) => x.set.id === s.id);
            const verdict = verdicts[s.id];
            const value = state.cards[s.id];
            const invalid = isOverMax(value, s.size);
            const marked = state.unobtainable.includes(s.id);
            const inputId = `set-${s.id}`;
            const outId = `${inputId}-out`;
            const nameId = `${inputId}-name`;
            const lostTextId = `${inputId}-lost`;
            return (
              <li key={s.id} class={`set ${verdict ? `v-${verdict}` : ''} ${n?.availability ?? ''}`}>
                <div class="set-head">
                  <label for={inputId} class="set-name" id={nameId}>
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
                    last={i === data.cardSets.length - 1}
                    onValue={(v) => setCards(s.id, v)}
                    onFocus={() => (valueAtFocus.current = state.cards[s.id])}
                    onBlur={() => onBlur(s.id)}
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
                  {/* A finished set can't be lost, and finishing it clears any old mark. */}
                  {verdict !== 'done' && (
                    <label class="toggle small">
                      {/* Named "I can't finish this set" plus the set name, so each toggle is distinct out of context. */}
                      <input
                        type="checkbox"
                        checked={marked}
                        aria-labelledby={`${lostTextId} ${nameId}`}
                        onChange={(e) => toggleLost(s.id, (e.target as HTMLInputElement).checked)}
                      />
                      <span id={lostTextId}>I can't finish this set</span>
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

      {/* Share and reset sit after the grid, so the result and the first sets come first on small screens. */}
      <div class="panel share-panel">
        <ShareBar data={data} state={state} pageUrl={pageUrl} />
      </div>
      <p class="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

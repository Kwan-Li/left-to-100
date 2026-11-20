// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import raw from '../src/data/gta6.json';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import CardOptimizer from '../src/components/CardOptimizer';
import DontLose from '../src/components/DontLose';
import Planner from '../src/components/Planner';
import { r1 } from '../src/copy/r1';
import { Dataset } from '../src/data/schema';
import { emptyState } from '../src/lib/plan';
import { encodeState, forgetLoadedState } from '../src/lib/state';

const data = Dataset.parse(raw);
const pageUrl = 'https://example.com/left-to-100/';

beforeEach(() => {
  localStorage.clear();
  location.hash = '';
  forgetLoadedState();
});
afterEach(cleanup);

describe('Planner', () => {
  it('shows every requirement and updates a row when a count is typed', async () => {
    render(<Planner data={data} pageUrl={pageUrl} />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(data.requirements.length);
    const bank = data.requirements.find((r) => r.id === 'bank-jobs')!;
    const input = screen.getByLabelText(bank.name) as HTMLInputElement;
    fireEvent.input(input, { target: { value: '10' } });
    await waitFor(() => expect(input.closest('li')!.textContent).toContain(`${bank.required - 10} to go`));
    fireEvent.input(input, { target: { value: String(bank.required) } });
    await waitFor(() => expect(input.closest('li')!.textContent).toContain('Done'));
    expect(document.querySelector('.summary')!.textContent).toContain('1 done');
  });

  it('saves progress to this device', async () => {
    render(<Planner data={data} pageUrl={pageUrl} />);
    const r = data.requirements[1];
    fireEvent.input(screen.getByLabelText(r.name), { target: { value: '5' } });
    await waitFor(() => expect(localStorage.getItem('left-to-100:v1')).toContain(`"${r.id}":5`));
  });

  it('loads progress from a share link', async () => {
    const r = data.requirements[2];
    location.hash = `s=${encodeState({ ...emptyState(data), req: { [r.id]: 3 } })}`;
    render(<Planner data={data} pageUrl={pageUrl} />);
    await waitFor(() => expect((screen.getByLabelText(r.name) as HTMLInputElement).value).toBe('3'));
  });
});

describe('Planner: hide done keeps the focused row', () => {
  it('does not hide a row while its input has focus, then hides it on blur', async () => {
    render(<Planner data={data} pageUrl={pageUrl} />);
    fireEvent.click(screen.getByLabelText('Hide done'));
    const bank = data.requirements.find((r) => r.id === 'bank-jobs')!;
    const input = screen.getByLabelText(bank.name) as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.input(input, { target: { value: String(bank.required) } });
    await waitFor(() => expect(input.closest('li')!.textContent).toContain('Done'));
    // Still on screen, same element, still focused.
    expect(input.isConnected).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(screen.getByLabelText(bank.name)).toBe(input);
    input.blur();
    await waitFor(() => expect(screen.queryByLabelText(bank.name)).toBeNull());
  });

  it('keeps focus on the next input when Enter leaves a row that hides', async () => {
    render(<Planner data={data} pageUrl={pageUrl} />);
    fireEvent.click(screen.getByLabelText('Hide done'));
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    const [first, second] = inputs;
    const firstReq = data.requirements[0];
    first.focus();
    fireEvent.input(first, { target: { value: String(firstReq.required) } });
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(document.activeElement).toBe(second);
    await waitFor(() => expect(screen.queryByLabelText(firstReq.name)).toBeNull());
    expect(document.activeElement).toBe(second);
    expect(second.isConnected).toBe(true);
  });
});

describe('Planner: out-of-range counts', () => {
  it('keeps the typed value, marks it invalid, and never counts it as done', async () => {
    render(<Planner data={data} pageUrl={pageUrl} />);
    const bank = data.requirements.find((r) => r.id === 'bank-jobs')!;
    const input = screen.getByLabelText(bank.name) as HTMLInputElement;
    expect(input.max).toBe(String(bank.total));
    fireEvent.input(input, { target: { value: String(bank.total! + 5) } });
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
    const row = input.closest('li')!;
    expect(row.textContent).toContain(r1.errMax(bank.total!));
    expect(row.textContent).not.toContain('Done');
    expect(document.querySelector('.summary')!.textContent).toContain('0 done');
    expect(input.value).toBe(String(bank.total! + 5));
    // The error is wired to the input.
    const describedBy = input.getAttribute('aria-describedby')!.split(' ');
    expect(describedBy.map((id) => document.getElementById(id)?.textContent).join(' ')).toContain(r1.errMax(bank.total!));
    fireEvent.input(input, { target: { value: String(bank.total) } });
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBeNull());
    expect(row.textContent).toContain('Done');
  });

  it('blank and 0 are different', async () => {
    render(<Planner data={data} pageUrl={pageUrl} />);
    const bank = data.requirements.find((r) => r.id === 'bank-jobs')!;
    const input = screen.getByLabelText(bank.name) as HTMLInputElement;
    expect(input.closest('li')!.textContent).toContain('Enter your count');
    fireEvent.input(input, { target: { value: '0' } });
    await waitFor(() => expect(input.closest('li')!.textContent).toContain(`${bank.required} to go`));
    fireEvent.input(input, { target: { value: '' } });
    await waitFor(() => expect(input.closest('li')!.textContent).toContain('Enter your count'));
  });
});

describe('ShareBar reset', () => {
  it('asks inline before resetting, and cancel keeps progress', async () => {
    const r = data.requirements[1];
    render(<Planner data={data} pageUrl={pageUrl} />);
    fireEvent.input(screen.getByLabelText(r.name), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Reset progress'));
    fireEvent.click(screen.getByText(r1.resetCancel));
    expect((screen.getByLabelText(r.name) as HTMLInputElement).value).toBe('5');
    fireEvent.click(screen.getByText('Reset progress'));
    fireEvent.click(screen.getByText(r1.resetConfirm));
    await waitFor(() => expect((screen.getByLabelText(r.name) as HTMLInputElement).value).toBe(''));
    expect(document.body.textContent).toContain('Progress reset.');
  });
});

describe('CardOptimizer', () => {
  it('shows one verdict per set that matches the plan; a complete set shows only Done', async () => {
    const full = data.cardSets.find((s) => s.id === 'backyard-wrestling')!;
    const cards = Object.fromEntries(data.cardSets.map((s) => [s.id, 0]));
    cards[full.id] = full.size;
    location.hash = `s=${encodeState({ ...emptyState(data), cards })}`;
    render(<CardOptimizer data={data} pageUrl={pageUrl} />);
    await waitFor(() => expect(document.querySelectorAll('.set-verdict')).toHaveLength(data.cardSets.length));
    const verdicts = [...document.querySelectorAll('.set')].map((li) => li.querySelectorAll('.set-verdict'));
    for (const v of verdicts) expect(v).toHaveLength(1);
    const text = verdicts.map((v) => v[0].textContent);
    expect(text.filter((t) => t === 'Finish')).toHaveLength(data.totals.cardSetsRequired - 1);
    expect(text.filter((t) => t === r1.verdictDone)).toHaveLength(1);
    expect(text.filter((t) => t === 'Skip')).toHaveLength(data.cardSets.length - data.totals.cardSetsRequired);
    const tile = (screen.getByLabelText(full.name) as HTMLInputElement).closest('li')!;
    expect(tile.querySelector('.set-verdict')!.textContent).toBe(r1.verdictDone);
    expect(tile.textContent).not.toContain("I can't finish this set");
    expect(tile.textContent).not.toContain('Finish');
  });

  it('marks an out-of-range card count invalid and gives no plan until it is fixed', async () => {
    const cards = Object.fromEntries(data.cardSets.map((s) => [s.id, 0]));
    location.hash = `s=${encodeState({ ...emptyState(data), cards })}`;
    render(<CardOptimizer data={data} pageUrl={pageUrl} />);
    const set = data.cardSets[0];
    const input = screen.getByLabelText(set.name) as HTMLInputElement;
    await waitFor(() => expect(document.body.textContent).toContain('more cards to finish'));
    fireEvent.input(input, { target: { value: String(set.size + 1) } });
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
    expect(input.closest('li')!.textContent).toContain(r1.errMax(set.size));
    expect(document.body.textContent).toContain('Enter a count for every set to get your plan.');
    expect(input.closest('li')!.querySelector('.set-verdict')).toBeNull();
  });

  it('asks for every set, then fills blanks with zero and gives the from-scratch minimum', async () => {
    render(<CardOptimizer data={data} pageUrl={pageUrl} />);
    expect(screen.getByText(/Enter a count for every set/)).toBeTruthy();
    fireEvent.click(screen.getByText('Set blank sets to 0'));
    await waitFor(() => expect(document.body.textContent).toContain('You need 372 more cards to finish 15 sets.'));
  });

  it('shows a range when a reported-only missable card was missed', async () => {
    const cards = Object.fromEntries(data.cardSets.map((s) => [s.id, 0]));
    location.hash = `s=${encodeState({
      ...emptyState(data),
      chapterId: 'story-finished',
      cards,
      missables: { 'card-vicki': 'missed', 'card-victor-maravilla': 'logged' },
    })}`;
    render(<CardOptimizer data={data} pageUrl={pageUrl} />);
    await waitFor(() => expect(document.body.textContent).toMatch(/to\s+\d+ more cards, depending on/));
    expect(document.body.textContent).toContain('Delights Dancers');
  });
});

describe('MissableQuestions', () => {
  it('shows no selection and a hint until a missable is answered', async () => {
    location.hash = `s=${encodeState({ ...emptyState(data), chapterId: 'story-finished' })}`;
    render(<DontLose data={data} />);
    await waitFor(() => expect(document.querySelectorAll('.mq').length).toBeGreaterThan(0));
    const first = document.querySelector('.mq')!;
    expect(first.querySelector('.seg.on')).toBeNull();
    expect(first.textContent).toContain(r1.missableUnanswered);
    fireEvent.click(first.querySelectorAll('input[type=radio]')[2]);
    await waitFor(() => expect(first.querySelector('.seg.on')!.textContent).toContain('Not sure'));
    expect(first.textContent).not.toContain(r1.missableUnanswered);
  });
});

describe('DontLose', () => {
  it('reveals nothing before the story starts and only the current chapter after', async () => {
    const { rerender } = render(<DontLose data={data} showPicker />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(document.body.textContent).toContain('Pick your current chapter above to see spoiler-safe warnings');
    fireEvent.change(select, { target: { value: 'chapter-1' } });
    rerender(<DontLose data={data} showPicker />);
    const ch1 = data.missables.filter((m) => m.lostAfterChapterId === 'chapter-1');
    const ch2 = data.missables.filter((m) => m.lostAfterChapterId === 'chapter-2');
    await waitFor(() => expect(document.body.textContent).toContain(ch1[0].label));
    for (const m of ch2) expect(document.body.textContent).not.toContain(m.label);
  });
});

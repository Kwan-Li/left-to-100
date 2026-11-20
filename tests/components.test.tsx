// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import raw from '../src/data/gta6.json';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import CardOptimizer from '../src/components/CardOptimizer';
import DontLose from '../src/components/DontLose';
import Planner from '../src/components/Planner';
import { Dataset } from '../src/data/schema';
import { emptyState } from '../src/lib/plan';
import { encodeState, forgetLoadedState } from '../src/lib/state';

const data = Dataset.parse(raw);
const pageUrl = 'https://example.com/skip-budget/';

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
    await waitFor(() => expect(localStorage.getItem('skip-budget:v1')).toContain(`"${r.id}":5`));
  });

  it('loads progress from a share link', async () => {
    const r = data.requirements[2];
    location.hash = `s=${encodeState({ ...emptyState(data), req: { [r.id]: 3 } })}`;
    render(<Planner data={data} pageUrl={pageUrl} />);
    await waitFor(() => expect((screen.getByLabelText(r.name) as HTMLInputElement).value).toBe('3'));
  });
});

describe('CardOptimizer', () => {
  it('asks for every set, then fills blanks with zero and gives the from-scratch minimum', async () => {
    render(<CardOptimizer data={data} pageUrl={pageUrl} />);
    expect(screen.getByText(/Enter a count for every set/)).toBeTruthy();
    fireEvent.click(screen.getByText('Set blank sets to 0'));
    await waitFor(() => expect(document.body.textContent).toContain('372 more cards finishes 15 sets'));
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

describe('DontLose', () => {
  it('reveals nothing before the story starts and only the current chapter after', async () => {
    const { rerender } = render(<DontLose data={data} showPicker />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(document.body.textContent).toContain('Nothing that counts toward 100%');
    fireEvent.change(select, { target: { value: 'chapter-1' } });
    rerender(<DontLose data={data} showPicker />);
    const ch1 = data.missables.filter((m) => m.lostAfterChapterId === 'chapter-1');
    const ch2 = data.missables.filter((m) => m.lostAfterChapterId === 'chapter-2');
    await waitFor(() => expect(document.body.textContent).toContain(ch1[0].label));
    for (const m of ch2) expect(document.body.textContent).not.toContain(m.label);
  });
});

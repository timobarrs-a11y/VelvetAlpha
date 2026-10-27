import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { searchTopics, searchMessage } from '../searchTopics';
import { buildSearchBrief, parseSearchRequest } from '../../../../supabase/functions/_shared/webSearch';
import type { CoachingCommitment, CoachingGoal, CoachPlan } from '../../../services/coachingService';

const goals = [
  { id: 'g1', title: 'Move into IT', status: 'active', source_companion_id: 'c1' },
  { id: 'g2', title: 'Run a 10K', status: 'active', source_companion_id: 'c2' },
  { id: 'g3', title: 'Old goal', status: 'completed', source_companion_id: 'c1' },
] as unknown as CoachingGoal[];
const commitments = [
  { id: 'k2', companion_id: 'c1', goal_id: 'g1', description: 'Pick a course', due_date: '2026-11-02', status: 'pending' },
  { id: 'k1', companion_id: 'c1', goal_id: 'g1', description: 'Update CV', due_date: '2026-10-28', status: 'pending' },
  { id: 'k3', companion_id: 'c1', goal_id: 'g1', description: 'Done thing', due_date: '2026-10-20', status: 'completed' },
] as unknown as CoachingCommitment[];
const plans = [
  { id: 'p1', companion_id: 'c1', status: 'active', title: 'IT switch', steps: [
    { id: 's1', title: 'Pick a course', status: 'pending' },
    { id: 's2', title: 'Book the CompTIA exam', status: 'pending' },
    { id: 's3', title: 'Read intro', status: 'completed' },
  ] },
] as unknown as CoachPlan[];

vi.mock('../../../services/coachingService', () => ({
  getGoals: async () => goals,
  getCommitments: async () => commitments,
  getPlans: async () => plans,
}));

const { HelperSearchSheet } = await import('../HelperSearchSheet');

describe('searchTopics', () => {
  it("lists this helper's goals, open commitments soonest first, then open plan steps", () => {
    expect(searchTopics('c1', goals, commitments, plans).map(t => `${t.kind}:${t.title}`)).toEqual([
      'goal:Move into IT',
      'commitment:Update CV',
      'commitment:Pick a course',
      'step:Book the CompTIA exam',
    ]);
  });
});

describe('searchMessage', () => {
  it('says what the search is for in the chat', () => {
    expect(searchMessage({ query: '', about: { kind: 'step', id: 's2', title: 'Book the CompTIA exam' } })).toBe('Search the web for "Book the CompTIA exam"');
    expect(searchMessage({ query: 'test centres near me', about: { kind: 'step', id: 's2', title: 'Book the CompTIA exam' } })).toBe('Search for "Book the CompTIA exam": test centres near me');
    expect(searchMessage({ query: 'what does a sysadmin do', about: null })).toBe('Search: what does a sysadmin do');
  });
});

describe('the search brief', () => {
  it('accepts only a well-formed request', () => {
    expect(parseSearchRequest({ query: ' x ', about: { kind: 'goal', id: 'g1' } })).toEqual({ query: 'x', about: { kind: 'goal', id: 'g1' } });
    expect(parseSearchRequest({ query: '', about: null })).toBeNull();
    expect(parseSearchRequest({ query: 'y', about: { kind: 'hack', id: 'z' } })).toEqual({ query: 'y', about: null });
    expect(parseSearchRequest('nope')).toBeNull();
  });

  it('hands the helper the item and tells it to search first', () => {
    const brief = buildSearchBrief('', { kind: 'commitment', title: 'Pick a course', date: '2026-11-02', goalTitle: 'Move into IT' });
    expect(brief).toContain('their commitment "Pick a course" (due 2026-11-02, for the goal "Move into IT")');
    expect(brief).toContain('choose the one search that would help most');
    expect(brief).toContain('Search the web now');
    expect(buildSearchBrief('nursing to IT salaries', null)).toContain("isn't about one of their current goals");
  });
});

describe('HelperSearchSheet', () => {
  it('asks what the search is about, then sends it with that item', async () => {
    const onSearch = vi.fn();
    const onClose = vi.fn();
    render(<HelperSearchSheet userId="u1" companionId="c1" helperName="Maya" onSearch={onSearch} onClose={onClose} />);
    expect(screen.getByText('Is this search about…')).toBeTruthy();
    fireEvent.click(await screen.findByText('Book the CompTIA exam'));
    fireEvent.change(screen.getByPlaceholderText(/What should Maya look up/), { target: { value: 'test centres' } });
    fireEvent.click(screen.getByText('Search'));
    expect(onSearch).toHaveBeenCalledWith({ query: 'test centres', about: { kind: 'step', id: 's2', title: 'Book the CompTIA exam' } });
    expect(onClose).toHaveBeenCalled();
  });

  it('lets them search for something else, and points general searches to Atlas', async () => {
    const onSearch = vi.fn();
    const opened = vi.fn();
    window.addEventListener('hub:open-bot', opened);
    render(<HelperSearchSheet userId="u1" companionId="c1" helperName="Maya" onSearch={onSearch} onClose={() => {}} />);
    fireEvent.click(await screen.findByText('Something else'));
    expect((screen.getByText('Search') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('What do you want to look up?'), { target: { value: 'what does a sysadmin do' } });
    fireEvent.click(screen.getByText('Search'));
    expect(onSearch).toHaveBeenCalledWith({ query: 'what does a sysadmin do', about: null });

    render(<HelperSearchSheet userId="u1" companionId="c1" helperName="Maya" onSearch={onSearch} onClose={() => {}} />);
    fireEvent.click(screen.getAllByText(/Atlas is best for that/)[0]);
    expect(opened).toHaveBeenCalled();
  });
});

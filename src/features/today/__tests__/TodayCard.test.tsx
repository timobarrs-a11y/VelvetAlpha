import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { UserEvent } from '../../../services/calendarService';
import type { CoachingCommitment } from '../../../services/coachingService';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
const auth = { user: { id: 'u1' } };
vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('../../../shared/ui/Toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const calendar = {
  getUserEvents: vi.fn(),
  getUpcomingEvents: vi.fn(),
  setCompleted: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
};
vi.mock('../../../services/calendarService', () => ({ calendarService: calendar }));

const coaching = {
  getTodayCommitments: vi.fn(),
  getNextOpenCommitment: vi.fn(),
  getGoals: vi.fn(),
  updateCommitmentStatus: vi.fn(),
  createUserGoal: vi.fn(),
};
vi.mock('../../../services/coachingService', () => coaching);

const tier = { value: 'free' };
vi.mock('../../../shared/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { subscription_tier: tier.value } }) }) }) }) },
}));

const people = { getAll: vi.fn(), create: vi.fn() };
vi.mock('../../../services/realPeopleService', () => ({ realPeopleService: people }));

const dock = { current: null as null | { companions: Array<{ id: string }>; draftToCompanion: ReturnType<typeof vi.fn> } };
vi.mock('../../../components/dock/DockContext', () => ({ useDockOptional: () => dock.current }));

const { TodayCard } = await import('../TodayCard');

function event(overrides: Partial<UserEvent>): UserEvent {
  const today = new Date();
  return {
    id: 'e1', user_id: 'u1', companion_id: null, title: 'Event', description: '',
    event_type: 'task', event_date: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9).toISOString(),
    reminder_time: null, all_day: false, location: null, completed: false,
    recurring: 'none', metadata: {}, created_at: '', updated_at: '',
    ...overrides,
  };
}

function commitment(overrides: Partial<CoachingCommitment>): CoachingCommitment {
  const today = new Date();
  return {
    id: 'c1', companion_id: 'coach1', goal_id: null, description: 'Commitment',
    due_date: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23).toISOString(),
    status: 'pending', completed_at: null, created_at: '', companion_name: 'Maya',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  calendar.getUserEvents.mockResolvedValue([]);
  calendar.getUpcomingEvents.mockResolvedValue([]);
  calendar.setCompleted.mockImplementation(async (e: UserEvent) => e);
  calendar.updateEvent.mockImplementation(async (id: string) => ({ id }));
  calendar.deleteEvent.mockResolvedValue(true);
  coaching.getTodayCommitments.mockResolvedValue([]);
  coaching.getNextOpenCommitment.mockResolvedValue(null);
  coaching.getGoals.mockResolvedValue([]);
  coaching.updateCommitmentStatus.mockResolvedValue(undefined);
  people.getAll.mockResolvedValue([]);
  localStorage.clear();
});

function isoDay(offset: number, birthYear: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${birthYear}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('TodayCard', () => {
  it("shows today's events and commitments with who set them up and the done count", async () => {
    calendar.getUserEvents.mockResolvedValue([event({ title: 'Pick a game and buy tickets', metadata: { source: 'atlas' } })]);
    coaching.getTodayCommitments.mockResolvedValue([commitment({ description: 'Draft section 2', goal_id: 'g1' })]);
    coaching.getGoals.mockResolvedValue([{ id: 'g1', title: 'Finish my portfolio' }]);

    render(<TodayCard />);

    expect(await screen.findByText('Pick a game and buy tickets')).toBeTruthy();
    expect(screen.getByText('Draft section 2')).toBeTruthy();
    expect(screen.getByText(/Maya · Finish my portfolio/)).toBeTruthy();
    expect(screen.getByText(/0 of 2 done/)).toBeTruthy();
  });

  it('ticks off an event through the calendar and a commitment through coaching', async () => {
    const e = event({ title: 'Walk in the park' });
    calendar.getUserEvents.mockResolvedValue([e]);
    coaching.getTodayCommitments.mockResolvedValue([commitment({ id: 'c9', description: 'Call the lender' })]);

    render(<TodayCard />);
    fireEvent.click(await screen.findByLabelText('Mark "Walk in the park" done'));
    fireEvent.click(screen.getByLabelText('Mark "Call the lender" done'));

    await waitFor(() => expect(calendar.setCompleted).toHaveBeenCalledWith(e, true));
    expect(coaching.updateCommitmentStatus).toHaveBeenCalledWith('c9', 'completed');
    expect(await screen.findByText(/2 of 2 done/)).toBeTruthy();
  });

  it('puts the tick back if saving fails', async () => {
    calendar.getUserEvents.mockResolvedValue([event({ title: 'Walk in the park' })]);
    calendar.setCompleted.mockResolvedValue(null);

    render(<TodayCard />);
    fireEvent.click(await screen.findByLabelText('Mark "Walk in the park" done'));

    expect(await screen.findByLabelText('Mark "Walk in the park" done')).toBeTruthy();
    expect(screen.getByText(/0 of 1 done/)).toBeTruthy();
  });

  it('confirms or drops a pencilled-in plan', async () => {
    calendar.getUserEvents.mockResolvedValue([
      event({ id: 'keep', title: 'Buy tickets', metadata: { source: 'atlas', tentative: true } }),
      event({ id: 'drop', title: 'Park walk', metadata: { source: 'atlas', tentative: true } }),
    ]);

    render(<TodayCard />);
    await screen.findByText('Buy tickets');
    const [confirm] = screen.getAllByText('Confirm');
    fireEvent.click(confirm);
    await waitFor(() => expect(calendar.updateEvent).toHaveBeenCalledWith('keep', { metadata: { source: 'atlas', tentative: false } }));

    fireEvent.click(screen.getAllByText('Drop')[0]);
    await waitFor(() => expect(calendar.deleteEvent).toHaveBeenCalledWith('drop'));
    await waitFor(() => expect(screen.queryByText('Park walk')).toBeNull());
    expect(screen.queryByText('Pencilled in')).toBeNull();
  });

  it('shows what is next when nothing is left today', async () => {
    const saturday = new Date();
    saturday.setDate(saturday.getDate() + 12);
    calendar.getUpcomingEvents.mockResolvedValue([event({ title: 'Pick a game', event_date: saturday.toISOString() })]);

    render(<TodayCard />);

    expect(await screen.findByText('Pick a game')).toBeTruthy();
    expect(screen.getByText(/Next:/)).toBeTruthy();
  });

  it('invites them to plan with Atlas when nothing is planned at all', async () => {
    render(<TodayCard />);
    fireEvent.click(await screen.findByText('Plan something with Atlas'));
    expect(navigate).toHaveBeenCalledWith('/atlas');
  });

  it('shows at most five rows and links the rest to the calendar', async () => {
    calendar.getUserEvents.mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => event({ id: `e${i}`, title: `Item ${i}` })),
    );
    render(<TodayCard />);
    await screen.findByText('Item 0');
    expect(screen.queryByText('Item 5')).toBeNull();
    fireEvent.click(screen.getByText('+2 more'));
    expect(navigate).toHaveBeenCalledWith('/calendar');
  });

  it("leads with today's birthdays, with the age worked out", async () => {
    const birthYear = new Date().getFullYear() - 57;
    people.getAll.mockResolvedValue([{ id: 'p1', name: 'Queen', birthday: isoDay(0, birthYear), birthday_year_known: true }]);
    render(<TodayCard />);
    expect(await screen.findByText("Queen's 57th birthday")).toBeTruthy();
  });

  it('shows the next birthday in the week ahead', async () => {
    people.getAll.mockResolvedValue([
      { id: 'p2', name: 'Sam', birthday: isoDay(3, 2000), birthday_year_known: false },
      { id: 'p3', name: 'Ana', birthday: isoDay(5, 1990), birthday_year_known: true },
    ]);
    render(<TodayCard />);
    expect(await screen.findByText(/Coming up:/)).toBeTruthy();
    expect(screen.getByText(/Sam's birthday/)).toBeTruthy();
    expect(screen.getByText(/and 1 more/)).toBeTruthy();
  });

  it('asks once for their people, and remembers "not now"', async () => {
    const { unmount } = render(<TodayCard />);
    expect(await screen.findByText('Add your people')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Not now'));
    expect(screen.queryByText('Add your people')).toBeNull();
    unmount();

    render(<TodayCard />);
    await screen.findByText('Plan something with Atlas');
    expect(screen.queryByText('Add your people')).toBeNull();
  });

  it('opens quick add from the + button', async () => {
    render(<TodayCard />);
    fireEvent.click(await screen.findByLabelText('Add something to your days'));
    expect(await screen.findByText('Add to your days')).toBeTruthy();
  });

  it('mentions Velvet Plus once, after the first thing they tick off, if they are not a member', async () => {
    tier.value = 'free';
    calendar.getUserEvents.mockResolvedValue([event({ title: 'Walk in the park' })]);
    const { unmount } = render(<TodayCard />);
    fireEvent.click(await screen.findByLabelText('Mark "Walk in the park" done'));
    expect(await screen.findByText(/With Velvet Plus/)).toBeTruthy();
    unmount();

    render(<TodayCard />);
    fireEvent.click(await screen.findByLabelText('Mark "Walk in the park" done'));
    await waitFor(() => expect(calendar.setCompleted).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/With Velvet Plus/)).toBeNull();
  });

  it('never mentions it to members', async () => {
    tier.value = 'plus';
    calendar.getUserEvents.mockResolvedValue([event({ title: 'Walk in the park' })]);
    render(<TodayCard />);
    fireEvent.click(await screen.findByLabelText('Mark "Walk in the park" done'));
    await waitFor(() => expect(calendar.setCompleted).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByText(/With Velvet Plus/)).toBeNull();
  });
});


describe('Get help from the coach on a task', () => {
  it('types the question into that coach\'s chat box (not sent), with the task, its goal and its date', async () => {
    dock.current = { companions: [{ id: 'coach1' }], draftToCompanion: vi.fn() };
    coaching.getTodayCommitments.mockResolvedValue([commitment({ id: 'c9', description: 'File the trademark', goal_id: 'g1' })]);
    coaching.getGoals.mockResolvedValue([{ id: 'g1', title: 'Start my own company' }]);
    render(<TodayCard />);
    fireEvent.click(await screen.findByText('Get help from Maya'));
    expect(dock.current.draftToCompanion).toHaveBeenCalledTimes(1);
    const [companionId, text] = dock.current.draftToCompanion.mock.calls[0];
    expect(companionId).toBe('coach1');
    expect(text).toContain('"File the trademark"');
    expect(text).toContain('my goal: Start my own company');
    expect(text).toContain('Break it down into small steps');
  });

  it('is not offered for a done task, a calendar event, or a coach that is not in the dock', async () => {
    dock.current = { companions: [{ id: 'someone-else' }], draftToCompanion: vi.fn() };
    coaching.getTodayCommitments.mockResolvedValue([commitment({ description: 'Open task' })]);
    calendar.getUserEvents.mockResolvedValue([event({ title: 'Dentist' })]);
    render(<TodayCard />);
    await screen.findByText('Open task');
    expect(screen.queryByText(/Get help from/)).toBeNull();
    dock.current = null;
  });
});

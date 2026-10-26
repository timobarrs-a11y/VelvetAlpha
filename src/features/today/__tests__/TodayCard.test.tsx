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
};
vi.mock('../../../services/coachingService', () => coaching);

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
});

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
});

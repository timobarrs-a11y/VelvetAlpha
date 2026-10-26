import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../shared/ui/Toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const calendar = { createEvent: vi.fn() };
vi.mock('../../../services/calendarService', () => ({ calendarService: calendar }));

const coaching = { createUserGoal: vi.fn() };
vi.mock('../../../services/coachingService', () => coaching);

const { QuickAddSheet } = await import('../QuickAddSheet');

const onSaved = vi.fn();
const onClose = vi.fn();
const onBirthday = vi.fn();

function open() {
  render(<QuickAddSheet isOpen onClose={onClose} onSaved={onSaved} onBirthday={onBirthday} userId="u1" />);
}

beforeEach(() => {
  vi.clearAllMocks();
  calendar.createEvent.mockImplementation(async (e: object) => ({ id: 'new', ...e }));
  coaching.createUserGoal.mockResolvedValue({ id: 'g1', title: 'Finish my portfolio' });
});

describe('QuickAddSheet', () => {
  it("adds a doctor's appointment today at a time", async () => {
    open();
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Doctor appointment' } });
    fireEvent.click(screen.getByText('Appointment'));
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '14:30' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(calendar.createEvent).toHaveBeenCalled());
    const saved = calendar.createEvent.mock.calls[0][0];
    const at = new Date(saved.event_date);
    const today = new Date();
    expect(saved).toMatchObject({ user_id: 'u1', title: 'Doctor appointment', event_type: 'appointment', all_day: false, metadata: { source: 'user' } });
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()])
      .toEqual([today.getFullYear(), today.getMonth(), today.getDate(), 14, 30]);
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('adds an all-day task tomorrow when no time is given', async () => {
    open();
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Pay rent' } });
    fireEvent.click(screen.getByText('Tomorrow'));
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(calendar.createEvent).toHaveBeenCalled());
    const saved = calendar.createEvent.mock.calls[0][0];
    const at = new Date(saved.event_date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(saved).toMatchObject({ event_type: 'task', all_day: true });
    expect([at.getDate(), at.getHours()]).toEqual([tomorrow.getDate(), 0]);
  });

  it('creates a goal with its deadline on the calendar', async () => {
    open();
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Finish my portfolio' } });
    fireEvent.click(screen.getByText('Goal'));
    fireEvent.click(screen.getByText('Pick a date'));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2099-12-01' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(coaching.createUserGoal).toHaveBeenCalledWith('u1', 'Finish my portfolio', '2099-12-01'));
    await waitFor(() => expect(calendar.createEvent).toHaveBeenCalled());
    expect(calendar.createEvent.mock.calls[0][0]).toMatchObject({
      event_type: 'goal_deadline', all_day: true, metadata: { source: 'user', goal: 'Finish my portfolio', goal_id: 'g1' },
    });
  });

  it('creates a goal without a date and nothing on the calendar', async () => {
    open();
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Learn to sail' } });
    fireEvent.click(screen.getByText('Goal'));
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(coaching.createUserGoal).toHaveBeenCalledWith('u1', 'Learn to sail', null));
    expect(calendar.createEvent).not.toHaveBeenCalled();
  });

  it('hands birthdays to the people form with the name typed', () => {
    open();
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'Queen' } });
    fireEvent.click(screen.getByText('Birthday'));
    expect(onBirthday).toHaveBeenCalledWith('Queen');
  });

  it("won't add without a title", () => {
    open();
    expect((screen.getByText('Add').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

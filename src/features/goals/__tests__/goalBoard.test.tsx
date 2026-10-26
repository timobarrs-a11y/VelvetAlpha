import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { finishDate, timeline, thisWeek, targetProgress, phasesOf } from '../goalBoard';
import type { CoachingCommitment, CoachingGoal, CoachPlan } from '../../../services/coachingService';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../../shared/supabase/client', () => ({ supabase: {} }));

const { GoalBoard } = await import('../GoalBoard');

const now = new Date(2026, 9, 26, 12);
const plan = (steps: Array<Record<string, unknown>>) => ({ id: 'p', steps } as unknown as CoachPlan);
const commitment = (id: string, due: string | null, status = 'pending') =>
  ({ id, description: `Do ${id}`, due_date: due, status } as unknown as CoachingCommitment);

describe('finishDate', () => {
  it('uses the target date, else the last scheduled step', () => {
    expect(finishDate({ target_date: '2027-06-01' }, [])).toBe('2027-06-01');
    const plans = [plan([{ scheduled_for: '2026-11-02' }, { scheduled_for: '2026-12-20' }, { scheduled_for: null }])];
    expect(finishDate({ target_date: null }, plans)).toBe('2026-12-20');
    expect(finishDate({ target_date: null }, [])).toBeNull();
  });
});

describe('timeline', () => {
  it('places today between start and finish', () => {
    const t = timeline('2026-10-16', '2026-11-05', now);
    expect(t.pct).toBe(50);
    expect(t.daysLeft).toBe(10);
    expect(t.runTime).toBe('3 weeks');
  });

  it('clamps before the start and past the finish', () => {
    expect(timeline('2026-11-01', '2026-12-01', now).pct).toBe(0);
    const late = timeline('2026-01-01', '2026-10-20', now);
    expect(late.pct).toBe(100);
    expect(late.daysLeft).toBe(-6);
    expect(late.runTime).toBe('10 months');
  });
});

describe('thisWeek', () => {
  it('keeps open commitments due within seven days, overdue first', () => {
    const list = [
      commitment('later', '2026-11-20T12:00:00'),
      commitment('soon', '2026-10-28T12:00:00'),
      commitment('late', '2026-10-20T12:00:00', 'missed'),
      commitment('done', '2026-10-27T12:00:00', 'completed'),
      commitment('undated', null),
    ];
    expect(thisWeek(list, now).map(c => c.id)).toEqual(['late', 'soon']);
  });
});

describe('targetProgress', () => {
  it('reads the numbers, money with a dollar sign', () => {
    expect(targetProgress({ current_value: 2500, target_value: 10000, unit: '$' })).toEqual({ label: '$2,500 of $10,000', pct: 25 });
    expect(targetProgress({ current_value: null, target_value: 20, unit: 'books' })).toEqual({ label: '0 books of 20 books', pct: 0 });
    expect(targetProgress({ current_value: 5, target_value: null, unit: null })).toBeNull();
  });
});

describe('phasesOf', () => {
  it('groups consecutive steps by phase', () => {
    const steps = [{ id: 'a', phase: 'Plan' }, { id: 'b', phase: 'Plan' }, { id: 'c', phase: 'Book' }, { id: 'd' }] as unknown as NonNullable<CoachPlan['steps']>;
    expect(phasesOf(steps).map(g => [g.phase, g.steps.length])).toEqual([['Plan', 2], ['Book', 1], [null, 1]]);
  });
});

describe('GoalBoard', () => {
  const goal = { id: 'g', start_date: '2026-10-01', target_date: '2027-01-01', current_value: null, target_value: null, unit: null } as unknown as CoachingGoal;
  const color = { base: '#6a5acd' } as never;

  it('shows who carries the goal and what is due this week', () => {
    const onComplete = vi.fn();
    render(
      <GoalBoard
        goal={goal}
        plans={[]}
        commitments={[commitment('c1', new Date(Date.now() + 86_400_000).toISOString())]}
        helper={{ id: 'm1', name: 'Maya', kind: 'assistant' }}
        coachColor={color}
        onComplete={onComplete}
        updatingId={null}
      />,
    );
    expect(screen.getByText('Maya, your assistant')).toBeTruthy();
    fireEvent.click(screen.getByText('Maya, your assistant'));
    expect(navigate).toHaveBeenCalledWith('/chat?companion=m1');
    expect(screen.getByRole('progressbar')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Mark "Do c1" done'));
    expect(onComplete).toHaveBeenCalledWith('c1');
  });

  it('says so when nothing is due, and names the teacher for a coach', () => {
    render(<GoalBoard goal={goal} plans={[]} commitments={[]} helper={{ id: 's', name: 'Sofia', kind: 'coach' }} coachColor={color} onComplete={() => {}} updatingId={null} />);
    expect(screen.getByText('Taught by Sofia')).toBeTruthy();
    expect(screen.getByText('Nothing due this week.')).toBeTruthy();
  });
});

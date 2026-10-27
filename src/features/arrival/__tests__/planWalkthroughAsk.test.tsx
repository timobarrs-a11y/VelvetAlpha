import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanWalkthrough } from '../PlanWalkthrough';
import type { ArrivalPlan } from '../../../../supabase/functions/_shared/atlasArrival';

const plan = {
  goal: { title: 'Start my own company', targetDate: '2027-03-01', measure: null },
  phases: [{ title: 'Set up', steps: [] }],
  commitments: [
    { description: 'File the trademark', dueDate: '2026-10-30' },
    { description: 'Open a business bank account', dueDate: '2026-11-02' },
  ],
  weeklyRhythm: [],
  checkIns: 'Every Sunday',
} as unknown as ArrivalPlan;

function mount(onAsk?: (c: { description: string; dueDate: string }) => void) {
  render(<PlanWalkthrough plan={plan} summary={{ finishDate: '2027-03-01', runTime: '5 months' }} helper={{ name: 'Priya', kind: 'coach' }} onChangeCommitmentDate={() => {}} onConfirm={() => {}} onAsk={onAsk} busy={false} />);
  fireEvent.click(screen.getByRole('button', { name: /next|continue|looks right/i }));
}

describe('the plan walkthrough: asking about a first step', () => {
  it('offers to ask the coach about each first step, and says what that does', async () => {
    const onAsk = vi.fn();
    mount(onAsk);
    expect(await screen.findAllByRole('button', { name: /Ask Priya about this/ })).toHaveLength(2);
    expect(screen.getByText(/puts this plan on your calendar and takes you to Priya's chat/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /Ask Priya about this/ })[0]);
    expect(onAsk).toHaveBeenCalledWith({ description: 'File the trademark', dueDate: '2026-10-30' });
  });

  it('shows nothing extra when there is nowhere to send them', async () => {
    mount(undefined);
    await screen.findByText('File the trademark');
    expect(screen.queryByRole('button', { name: /Ask Priya/ })).toBeNull();
  });
});

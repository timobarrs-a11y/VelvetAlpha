import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { accentVars, formatDay } from '../arrivalUtils';
import { PlanWalkthrough } from '../PlanWalkthrough';
import type { ArrivalPlan } from '../../../../supabase/functions/_shared/atlasArrival';

vi.mock('../../../shared/supabase/client', () => ({ supabase: {} }));

describe('accentVars', () => {
  it('uses their favorite color as the accent, with readable bubble text', () => {
    const vars = accentVars('#14b8a6');
    expect(vars['--shell-accent']).toBe('#14b8a6');
    expect(vars['--shell-accent-soft']).toBe('rgba(20, 184, 166, 0.14)');
    expect(vars['--shell-user-bubble-text']).toBe('#1A202C');
  });

  it('lifts a very dark color so it shows on the dark background', () => {
    const accent = accentVars('#000000')['--shell-accent'];
    expect(accent).not.toBe('#000000');
    const n = parseInt(accent.slice(1), 16);
    expect((n >> 16) & 255).toBeGreaterThan(100);
  });

  it('changes nothing without a color', () => {
    expect(accentVars(null)).toEqual({});
    expect(accentVars('not a color at all')).toEqual(expect.any(Object));
  });
});

const plan: ArrivalPlan = {
  goal: { title: 'Buy a home', targetDate: '2027-09-30', measure: { what: 'down payment saved', unit: '$', target: 30000 } },
  phases: [
    { title: 'Get the money ready', steps: [{ title: 'Check your credit score', scheduledFor: '2026-10-29', durationMinutes: 30 }] },
    { title: 'Search', steps: [{ title: 'Tour homes', scheduledFor: null, durationMinutes: null }] },
  ],
  commitments: [{ description: 'Check your credit score', dueDate: '2026-10-29' }],
  weeklyRhythm: [{ day: 'Monday', what: 'Move $150 to the down payment fund' }],
  checkIns: 'Every Monday',
};

describe('PlanWalkthrough', () => {
  it('goes plan, commitments, progress, then calendar, and only then offers to save', async () => {
    const onConfirm = vi.fn();
    const onChange = vi.fn();
    render(
      <PlanWalkthrough
        plan={plan}
        summary={{ finishDate: '2027-09-30', runTime: '11 months' }}
        helper={{ name: 'Maya', kind: 'assistant' }}
        onChangeCommitmentDate={onChange}
        onConfirm={onConfirm}
        busy={false}
      />,
    );

    expect(screen.getByText(/whole road/)).toBeTruthy();
    expect(screen.getByText('1. Get the money ready')).toBeTruthy();
    expect(screen.queryByText('Put it on my calendar')).toBeNull();

    fireEvent.click(screen.getByText('Looks right'));
    fireEvent.change(await screen.findByLabelText('Date for Check your credit score'), { target: { value: '2026-10-30' } });
    expect(onChange).toHaveBeenCalledWith(0, '2026-10-30');

    fireEvent.click(screen.getByText('Looks right'));
    expect(await screen.findByText(/down payment saved · target \$30,000/)).toBeTruthy();
    expect(screen.getByText('Every Monday, with Maya.')).toBeTruthy();

    fireEvent.click(screen.getByText('Looks right'));
    expect(await screen.findByText(/Buy a home · with Maya · 11 months · estimated finish September 30, 2027/)).toBeTruthy();
    expect(screen.getByText(/Move \$150 to the down payment fund/)).toBeTruthy();

    fireEvent.click(await screen.findByText('Put it on my calendar'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('writes dates as a person reads them', () => {
    expect(formatDay('2026-10-29')).toBe('Thu, Oct 29');
    expect(formatDay('2027-09-30', true)).toBe('September 30, 2027');
  });
});

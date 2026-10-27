import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let rows: Array<{ key: string; done: boolean }> = [];
const rpc = vi.fn(async (fn: string, args?: unknown) => {
  void args;
  if (fn === 'get_daily_objectives') return { data: rows, error: null };
  return { data: null, error: null };
});
vi.mock('../../../shared/supabase/client', () => ({ supabase: { rpc: (...a: [string, unknown?]) => rpc(...a) } }));

const navigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useNavigate: () => navigate,
}));

import { ObjectivesButton } from '../ObjectivesButton';
import { localDayStart, notifyObjectivesChanged, reportActivity } from '../../../services/dailyObjectivesService';

const KEYS = ['visit_town', 'post_in_space', 'cheer_a_win', 'complete_step', 'play_game'];
const setDone = (done: string[]) => { rows = KEYS.map(key => ({ key, done: done.includes(key) })); };

beforeEach(() => { vi.clearAllMocks(); setDone([]); });

function renderButton() {
  return render(<MemoryRouter><ObjectivesButton /></MemoryRouter>);
}

describe('daily objectives button', () => {
  it('shows how many are done today, and ticks them off as they happen', async () => {
    renderButton();
    expect(await screen.findByLabelText('Daily objectives, 0 of 5 done today')).toBeTruthy();

    setDone(['visit_town', 'play_game']);
    await act(async () => { notifyObjectivesChanged(); });
    expect(await screen.findByLabelText('Daily objectives, 2 of 5 done today')).toBeTruthy();
  });

  it('drops down the five, and a tap goes where you do it', async () => {
    setDone(['visit_town']);
    renderButton();
    fireEvent.click(await screen.findByLabelText(/Daily objectives, 1 of 5/));
    for (const label of ['Visit the Town', 'Join in a Space', 'Cheer a win', 'Finish a step', 'Play a game']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    fireEvent.click(screen.getByText('Cheer a win'));
    expect(navigate).toHaveBeenCalledWith('/discover');
  });

  it('links to the leaderboard and says when the day is complete', async () => {
    setDone(KEYS);
    renderButton();
    fireEvent.click(await screen.findByLabelText(/5 of 5/));
    expect(screen.getByText('A full day. Nicely done.')).toBeTruthy();
    fireEvent.click(screen.getByText('Leaderboard'));
    expect(navigate).toHaveBeenCalledWith('/leaderboard');
  });
});

describe('objectives service', () => {
  it('asks for today by the user\'s own midnight', async () => {
    renderButton();
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('get_daily_objectives', { p_day_start: localDayStart() }));
    const d = new Date(localDayStart());
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });

  it('reports a visit and tells the toolbar to look again', async () => {
    const heard = vi.fn();
    window.addEventListener('velvet:objectives-changed', heard);
    await reportActivity('visit_town');
    expect(rpc).toHaveBeenCalledWith('report_activity', { p_key: 'visit_town' });
    expect(heard).toHaveBeenCalled();
    window.removeEventListener('velvet:objectives-changed', heard);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

type Row = { key: string; progress: number; target: number; done: boolean; hard: boolean; points: number; core: boolean };
let rows: Row[] = [];
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
import { localDayStart, notifyObjectivesChanged, reportActivity, OBJECTIVE_DEFS, XP_PER_OBJECTIVE } from '../../../services/dailyObjectivesService';

const CORE = ['visit_town', 'comment_in_space', 'create_companion', 'play_velvet_sims', 'read_feed'];
const DAILY = ['react_in_space', 'view_medals', 'play_checkers', 'ask_atlas', 'complete_step'];
const coreRows = (done: string[]): Row[] => CORE.map(key => ({ key, progress: done.includes(key) ? 1 : 0, target: 1, done: done.includes(key), hard: false, core: true }));
const dailyRows = (done: string[]): Row[] => DAILY.map(key => ({ key, progress: done.includes(key) ? 1 : 0, target: key === 'react_in_space' ? 3 : 1, done: done.includes(key), hard: key === 'complete_step', core: false }));

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); rows = coreRows([]); });

function renderButton() {
  return render(<MemoryRouter><ObjectivesButton /></MemoryRouter>);
}

describe('objectives button', () => {
  it('starts on the core five, and ticks them off as they happen', async () => {
    renderButton();
    expect(await screen.findByLabelText('Daily objectives, 0 of 5 done to get started')).toBeTruthy();

    rows = coreRows(['visit_town', 'read_feed']);
    await act(async () => { notifyObjectivesChanged(); });
    expect(await screen.findByLabelText('Daily objectives, 2 of 5 done to get started')).toBeTruthy();
  });

  it('lists the core five in words, says the rest unlock after them, and a tap goes where you do it', async () => {
    renderButton();
    fireEvent.click(await screen.findByLabelText(/0 of 5/));
    expect(screen.getByText('Getting started')).toBeTruthy();
    for (const key of CORE) expect(screen.getByText(OBJECTIVE_DEFS[key as keyof typeof OBJECTIVE_DEFS].label)).toBeTruthy();
    expect(screen.getByText(/a fresh set opens up every day. Each one is worth 10 XP/)).toBeTruthy();
    fireEvent.click(screen.getByText('Check out your Daily Feed'));
    expect(navigate).toHaveBeenCalledWith('/daily-feed');
  });

  it('draws the eye until it has been opened once', async () => {
    const { container } = renderButton();
    const button = await screen.findByLabelText(/0 of 5/);
    expect(container.querySelector('.animate-ping')).toBeTruthy();
    fireEvent.click(button);
    expect(container.querySelector('.animate-ping')).toBeNull();
    expect(localStorage.getItem('velvet.objectives.seen')).toBe('1');
  });

  it('shows the day\'s set once the core is done, with counts and the hard one marked', async () => {
    rows = dailyRows(['view_medals']);
    renderButton();
    fireEvent.click(await screen.findByLabelText(/1 of 5 done today/));
    expect(screen.getByText("Today's objectives")).toBeTruthy();
    expect(screen.getByText('0/3')).toBeTruthy();
    expect(screen.getByText('Challenge')).toBeTruthy();
    expect(screen.getByText(/Each one is worth 10 XP/)).toBeTruthy();
    fireEvent.click(screen.getByText('Play Checkers'));
    expect(navigate).toHaveBeenCalledWith('/checkers');
  });

  it('links to the leaderboard and says when the set is complete', async () => {
    rows = dailyRows(DAILY).map(r => ({ ...r, progress: r.target }));
    renderButton();
    fireEvent.click(await screen.findByLabelText(/5 of 5/));
    expect(screen.getByText('A full day. Nicely done.')).toBeTruthy();
    fireEvent.click(screen.getByText('Leaderboard'));
    expect(navigate).toHaveBeenCalledWith('/leaderboard');
  });
});

describe('objectives service', () => {
  it('has words and a destination for every objective', () => {
    expect(Object.keys(OBJECTIVE_DEFS)).toHaveLength(45);
    for (const def of Object.values(OBJECTIVE_DEFS)) {
      expect(def.label.length).toBeGreaterThan(3);
      expect(def.to.startsWith('/')).toBe(true);
    }
  });

  it('sends the Space objectives to Spaces (the chat rooms), the same place as the toolbar', () => {
    expect(OBJECTIVE_DEFS.comment_in_space.to).toBe('/spaces');
    expect(OBJECTIVE_DEFS.browse_spaces.to).toBe('/spaces');
    expect(OBJECTIVE_DEFS.join_a_space.to).toBe('/spaces/browse');
  });

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

describe('catalogue stays in step with the database', () => {
  it('has the same objectives in the migration and in the app', async () => {
    const { readFileSync } = await import('node:fs');
    const sql = readFileSync('supabase/migrations/20261106100000_objective_xp.sql', 'utf8');
    const catalog = sql.slice(sql.indexOf('FROM (VALUES'), sql.indexOf('AS c(key, core_target'));
    const keys = [...catalog.matchAll(/^\s*\('([a-z_]+)',/gm)].map(m => m[1]).sort();
    expect(keys).toEqual(Object.keys(OBJECTIVE_DEFS).sort());
  });

  it('agrees with the database on how much XP an objective is worth', async () => {
    const { readFileSync } = await import('node:fs');
    const sql = readFileSync('supabase/migrations/20261106100000_objective_xp.sql', 'utf8');
    expect(Number(/objective_xp\(\)\s*RETURNS int\s*LANGUAGE sql IMMUTABLE\s*AS \$\$ SELECT (\d+) \$\$/.exec(sql)?.[1])).toBe(XP_PER_OBJECTIVE);
  });
});

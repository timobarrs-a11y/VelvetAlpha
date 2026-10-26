import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// ── Mocks: the shell, the visual extras, and Supabase ─────────────────────
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../shells/ShellProvider', () => ({
  ShellProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useShell: () => ({ manifest: { motion: { ease: [0, 0, 1, 1], durationBase: 0 }, copy: { inputPlaceholder: 'Type here' } } }),
}));
vi.mock('../../shells/slots/AtlasBackgroundScene', () => ({ AtlasBackgroundScene: () => null }));
vi.mock('../../shells/slots/AtlasFadeTyping', () => ({ AtlasFadeTyping: () => <p>Atlas is writing</p> }));
vi.mock('../../hooks/useTypingEffect', () => ({
  useTypingEffect: (text: string) => ({ displayedText: text, showCursor: false }),
  useWritingIndicator: () => 'Writing',
}));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../components/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
vi.mock('../../components/AvatarCreatorV2', () => ({ coherentRandomize: (g: string) => ({ gender: g, glasses: 'none' }) }));
vi.mock('../../services/avatarSaveService', () => ({ sanitizeAvatarConfigForSave: async (c: unknown) => c }));
vi.mock('../../features/arrival/ArrivalTheme', () => ({ ArrivalTheme: ({ children }: { children: ReactNode }) => <>{children}</> }));
const setupProgress = vi.fn();
vi.mock('../../services/setupProgressService', () => ({ updateSetupProgress: (...a: unknown[]) => setupProgress(...a) }));

const updates: Array<{ table: string; patch: unknown; id: unknown }> = [];
vi.mock('../../shared/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 't', user: { id: 'u1' } } } }),
      getUser: async () => ({ data: { user: { id: 'u1' } } }),
    },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { profile_completed: true } }) }) }),
      update: (patch: unknown) => ({ eq: async (_c: string, id: unknown) => { updates.push({ table, patch, id }); return { error: null }; } }),
    }),
  },
}));

// ── The server, phase by phase ───────────────────────────────────────────
const PLAN = {
  goal: { title: 'Buy a home', targetDate: '2027-09-30', measure: { what: 'down payment saved', unit: '$', target: 30000 } },
  phases: [{ title: 'Get the money ready', steps: [{ title: 'Check your credit score', scheduledFor: '2099-10-29', durationMinutes: 30 }] }],
  commitments: [{ description: 'Check your credit score', dueDate: '2099-10-29' }],
  weeklyRhythm: [{ day: 'Monday', what: 'Move $150 to savings' }],
  checkIns: 'Every Monday',
};

const requests: Array<Record<string, unknown>> = [];
function respond(body: Record<string, unknown>) {
  switch (body.phase) {
    case 'goal':
      if ((body.messages as unknown[]).length === 0) {
        return { reply: 'Good evening, Master Tim.\n\nWhere do things stand?', chips: ["I'm already working on something.", 'I have an idea.', "I don't have a goal yet."] };
      }
      return {
        reply: 'A home of your own. I know just the person.',
        chips: [],
        pencilled: [{ title: 'Check your credit score', date: '2099-10-29' }],
        isComplete: true,
      };
    case 'confirm':
      return { recommendation: {
        helperName: 'Maya', helperGender: 'female', kind: 'assistant', expertDomain: 'buying your first home', expertId: null,
        isCustomExpert: false, accountabilityLevel: 'moderate', goalText: 'Buy a home', recommendationText: 'Maya will see this through with you.',
      } };
    case 'provisioning':
      return { helperId: 'h1', goalId: 'g1', goalText: 'Buy a home', helperName: 'Maya', kind: 'assistant' };
    case 'plan':
      return { plan: PLAN, summary: { finishDate: '2027-09-30', runTime: '11 months' } };
    case 'commit_plan':
      return { success: true, planId: 'p1' };
    default:
      return {};
  }
}

// jsdom doesn't lay anything out, so it has no scrollIntoView.
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  requests.length = 0;
  updates.length = 0;
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    return { ok: true, json: async () => respond(body) };
  }));
});

const { AtlasConciergePage } = await import('../AtlasConciergePage');

describe('AtlasConciergePage', () => {
  it('runs the whole arrival: opening, the goal, meet, the plan, the calendar, the billboard, Today', async () => {
    render(<AtlasConciergePage />);

    // The opening, with the three choices; it sends where and when the user is.
    fireEvent.click(await screen.findByText("I'm already working on something."));
    expect(requests[0]).toMatchObject({ phase: 'goal', messages: [] });
    expect(requests[0]).toEqual(expect.objectContaining({ localHour: expect.any(Number), localDate: expect.any(String), tzOffset: expect.any(Number) }));

    // Atlas replies, pencils something in, and finds who'll carry it.
    expect(await screen.findByText(/Pencilled in: Check your credit score/)).toBeTruthy();
    expect(await screen.findByText('Meet your assistant')).toBeTruthy();
    expect(screen.getByText('Maya')).toBeTruthy();

    // Continue creates Maya and the goal, then drafts the plan.
    fireEvent.click(screen.getByText('Continue'));
    expect(await screen.findByText(/whole road/)).toBeTruthy();
    expect(requests.find(r => r.phase === 'provisioning')).toMatchObject({ helperName: 'Maya', avatarConfig: { gender: 'female' } });

    // Through the walkthrough to the calendar.
    for (let i = 0; i < 3; i++) fireEvent.click(await screen.findByText('Looks right'));
    fireEvent.click(await screen.findByText('Put it on my calendar'));
    await waitFor(() => expect(requests.find(r => r.phase === 'commit_plan')).toMatchObject({ goalId: 'g1', helperId: 'h1', plan: PLAN }));

    // The billboard question, then off to Today.
    fireEvent.click(await screen.findByText('Yes, put it up'));
    await waitFor(() => expect(updates).toContainEqual({ table: 'user_goals', patch: { show_on_profile: true }, id: 'g1' }));
    expect(setupProgress).toHaveBeenCalledWith('u1', { step: 'complete' });
    fireEvent.click(await screen.findByText('Go to Today'));
    expect(navigate).toHaveBeenCalledWith('/lobby?arrived=1', { replace: true });
  });

  it('creates the helper only once, even if Change anything and Continue are both pressed', async () => {
    render(<AtlasConciergePage />);
    fireEvent.click(await screen.findByText("I'm already working on something."));
    await screen.findByText('Meet your assistant');

    fireEvent.click(screen.getByText('Change anything'));
    await screen.findByText('Change their look');
    fireEvent.click(screen.getByText('Done'));
    fireEvent.click(screen.getByText('Continue'));
    await screen.findByText(/whole road/);

    expect(requests.filter(r => r.phase === 'provisioning')).toHaveLength(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

// The avatar creator: a stand-in that can randomize, then have glasses picked by hand.
vi.mock('../../../components/AvatarCreatorV2', () => ({
  AvatarCreatorV2: ({ initialConfig, onChange, onRandomize }: {
    initialConfig: Record<string, unknown>;
    onChange: (c: Record<string, unknown>) => void;
    onRandomize: (c: Record<string, unknown>) => void;
  }) => (
    <div>
      <p>seeded as {String(initialConfig.gender)}</p>
      <button onClick={() => onRandomize({ ...initialConfig, hairStyle: 'afro', glasses: 'none' })}>Randomize</button>
      <button onClick={() => onChange({ ...initialConfig, hairStyle: 'afro', glasses: 'round' })}>Pick glasses</button>
    </div>
  ),
}));
// The house picker: a stand-in that moves in with a cabin they chose.
vi.mock('../../../features/velvet-world/MoveInSheet', () => ({
  MoveInPanel: ({ onMoved }: { onMoved: (h: Record<string, unknown>, chosen: boolean) => void }) => (
    <button onClick={() => onMoved({ style: 'cabin', body: '#aa5533' }, true)}>Move in</button>
  ),
}));
vi.mock('../../../services/avatarSaveService', () => ({ sanitizeAvatarConfigForSave: async (c: unknown) => c }));
vi.mock('../../../services/worldService', () => ({ getMyPlot: async () => null }));
const upsertMember = vi.fn(async () => null);
vi.mock('../../../services/memberProfileService', () => ({ upsertMyMemberProfile: (...a: unknown[]) => upsertMember(...a) }));
const setupProgress = vi.fn(async () => {});
vi.mock('../../../services/setupProgressService', () => ({ updateSetupProgress: (...a: unknown[]) => setupProgress(...a) }));
vi.mock('../../../components/auth/AuthSpinner', () => ({ AuthSpinner: () => <p>Loading</p> }));

const updates: Array<Record<string, unknown>> = [];
const profile = { gender: 'Male', favorite_color: 'Teal', avatar_config: null, arrival_choices: {}, name: 'Tim' };
vi.mock('../../../shared/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
      update: (patch: Record<string, unknown>) => ({ eq: async () => { updates.push(patch); return { error: null }; } }),
    }),
  },
}));

const { ArrivalLookPage } = await import('../ArrivalLookPage');
const { ArrivalHomePage } = await import('../ArrivalHomePage');

beforeEach(() => {
  vi.clearAllMocks();
  updates.length = 0;
});

describe('Your look', () => {
  it('explains why, starts from Act 1, and records only what they chose by hand', async () => {
    render(<ArrivalLookPage />);
    expect(await screen.findByText('Now for the fun part.')).toBeTruthy();
    expect(screen.getByText(/in Spaces, in your chats/)).toBeTruthy();
    fireEvent.click(screen.getByText('Make my avatar'));
    expect(screen.getByText('seeded as male')).toBeTruthy();

    fireEvent.click(screen.getByText('Randomize'));
    fireEvent.click(screen.getByText('Pick glasses'));
    fireEvent.click(screen.getByText("That's me"));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/arrival/home'));
    expect(updates[0].arrival_choices).toEqual({ avatar: [{ field: 'glasses', value: 'round' }] });
    expect(updates[0].avatar_config).toMatchObject({ gender: 'male', glasses: 'round' });
    expect(setupProgress).toHaveBeenCalledWith('u1', { step: 'arrival_home' });
  });
});

describe('Your home', () => {
  it('records the house they chose, then puts up the billboard and goes to town', async () => {
    render(<ArrivalHomePage />);
    expect(await screen.findByText('Every member has a home on the street.')).toBeTruthy();
    fireEvent.click(screen.getByText('Move in'));

    expect(await screen.findByText('Your billboard')).toBeTruthy();
    expect(updates[0].arrival_choices).toEqual({ house: { style: 'cabin', color: '#aa5533', chosen: true } });
    fireEvent.click(screen.getByText('Always planning the next trip'));
    fireEvent.click(screen.getByText('Put it up'));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/world?arrival=1'));
    expect(upsertMember).toHaveBeenCalledWith({ display_name: 'Tim', headline: 'Always planning the next trip' });
    expect(setupProgress).toHaveBeenCalledWith('u1', { step: 'arrival_town' });
  });
});

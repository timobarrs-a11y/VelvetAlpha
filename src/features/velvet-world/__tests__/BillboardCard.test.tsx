import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const recordVisit = vi.fn();
const getCardDetails = vi.fn();
vi.mock('../../../services/worldService', () => ({
  recordVisit: (...a: unknown[]) => recordVisit(...a),
  getCardDetails: (...a: unknown[]) => getCardDetails(...a),
}));
vi.mock('../../../shared/supabase/queries/messaging', () => ({
  sendFriendRequest: vi.fn(),
  getFriends: () => Promise.resolve([]),
  getOutgoingRequests: () => Promise.resolve([]),
}));
vi.mock('../../../components/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));
vi.mock('../art/streetArt', () => ({
  resolvePlot: () => ({ member: false, houseBy: 'starter', house: { style: 'standard' }, sign: { color: '#C2416B' } }),
  houseInfo: () => ({ label: 'Cottage' }),
  MEDALS: {},
  TIER_COLORS: {},
  glyph: () => {},
}));

import { BillboardCard, neighborSince, medalName } from '../BillboardCard';

const plot = {
  id: 'maya',
  member: false,
  config: { house: {}, sign: {} },
  profile: { name: 'Maya Lee', headline: 'Learning to paint', address: '4 Velvet Lane', medalCount: 2, medals: [] },
} as never;

function renderCard(isYou: boolean) {
  return render(
    <MemoryRouter>
      <BillboardCard plot={plot} isYou={isYou} onClose={() => {}} onCustomize={() => {}} />
    </MemoryRouter>,
  );
}

describe('BillboardCard', () => {
  beforeEach(() => {
    recordVisit.mockReset().mockResolvedValue(13);
    getCardDetails.mockReset().mockResolvedValue({
      visitors: 13, visitors_week: 4, friends: 7, streak: 12, mutual_friends: 2,
      shared_spaces: ['Creative Corner'], bio: 'Weekend painter.', avatar_config: { gender: 'female' },
      goals: [{ label: 'Paint 30 canvases', pct: 40, done: false }],
    });
  });

  it("counts a visit on someone else's billboard and shows what's useful to know", async () => {
    renderCard(false);
    expect(await screen.findByText('13')).toBeTruthy();
    expect(recordVisit).toHaveBeenCalledWith('maya');
    expect(screen.getByText('visitors')).toBeTruthy();
    expect(screen.getByText('4 stopped by this week')).toBeTruthy();
    expect(screen.getByText("2 friends in common · You're both in Creative Corner")).toBeTruthy();
    expect(screen.getByText('Weekend painter.')).toBeTruthy();
    expect(screen.getByText('Paint 30 canvases')).toBeTruthy();
    expect(screen.getByTestId('avatar')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add Maya/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeTruthy();
  });

  it("doesn't count a visit to your own house", async () => {
    renderCard(true);
    await waitFor(() => expect(getCardDetails).toHaveBeenCalledWith('maya'));
    expect(recordVisit).not.toHaveBeenCalled();
    expect(await screen.findByText('4 new visitors this week')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Customize my plot' })).toBeTruthy();
  });
});

describe('neighborSince', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  it('says this week for new arrivals', () => {
    expect(neighborSince('2026-10-24T12:00:00Z', now)).toBe('Moved in this week');
  });
  it('gives the month otherwise', () => {
    expect(neighborSince('2026-08-02T12:00:00Z', now)).toMatch(/^Neighbor since Aug/);
  });
  it('handles nothing', () => {
    expect(neighborSince(undefined, now)).toBeNull();
  });
});

describe('medalName', () => {
  it('turns a slug into a name', () => {
    expect(medalName('conversation-starter')).toBe('Conversation starter');
  });
});

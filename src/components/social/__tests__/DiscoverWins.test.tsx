import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../shared/ui/Toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../PublicProfileImage', () => ({ PublicProfileImage: () => null }));
vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('../../../shared/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));
const getDiscoverAccomplishments = vi.fn();
vi.mock('../../../services/progressFeedService', async (orig) => ({
  ...(await orig<typeof import('../../../services/progressFeedService')>()),
  getDiscoverAccomplishments: (...a: unknown[]) => getDiscoverAccomplishments(...a),
}));
vi.mock('../../../services/postInteractionService', () => ({
  toggleLike: vi.fn(), getLikedPostIds: vi.fn(async () => new Set<string>()), getComments: vi.fn(async () => []), addComment: vi.fn(), deleteComment: vi.fn(),
}));

const { DiscoverWins } = await import('../DiscoverWins');

const win = (id: string, title: string) => ({
  id, user_id: 'stranger', post_type: 'goal_completed', title, body: null, ref_target_type: 'user_goals', ref_target_id: id,
  goal_id: id, like_count: 2, comment_count: 1, is_auto_generated: true, created_at: new Date().toISOString(),
  author_name: 'Ace', author_avatar_config: null, author_profile_image_type: 'avatar', author_profile_smilie_code: null, author_is_bot: false,
});

beforeEach(() => vi.clearAllMocks());

describe('DiscoverWins', () => {
  it('lists what people finished, with a way to cheer them on and a link to turn sharing off', async () => {
    getDiscoverAccomplishments.mockResolvedValue([win('a', 'Finished Run a 5K 🏆'), win('b', 'Kept a commitment: Practice 20 minutes')]);
    render(<MemoryRouter><DiscoverWins /></MemoryRouter>);
    expect(await screen.findByText('Finished Run a 5K 🏆')).toBeTruthy();
    expect(screen.getByText('Kept a commitment: Practice 20 minutes')).toBeTruthy();
    expect(screen.getAllByLabelText('Like')).toHaveLength(2);
    const link = screen.getByText('your profile settings') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/my-profile/edit');
  });

  it('says so when there are no wins yet', async () => {
    getDiscoverAccomplishments.mockResolvedValue([]);
    render(<MemoryRouter><DiscoverWins /></MemoryRouter>);
    expect(await screen.findByText('No wins yet')).toBeTruthy();
  });
});

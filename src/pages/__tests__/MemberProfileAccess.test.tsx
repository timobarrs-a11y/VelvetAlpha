import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../components/PublicProfileImage', () => ({ PublicProfileImage: () => null }));
vi.mock('../../components/medals/MedalShowcase', () => ({ MedalShowcase: () => null }));
vi.mock('../../components/medals/MedalBadge', () => ({ MedalBadge: () => null }));
vi.mock('../../components/social/ProfilePosts', () => ({ ProfilePosts: ({ fullAccess }: { fullAccess?: boolean }) => <p>{fullAccess === false ? 'Recent wins' : 'Posts'}</p> }));
vi.mock('../../services/coachingService', () => ({ GOAL_TYPE_LABELS: { fitness: 'Fitness' } }));
vi.mock('../../services/medalsService', () => ({ getUserMedals: vi.fn(async () => []) }));
vi.mock('../../services/memberProfileService', () => ({ followUser: vi.fn(), unfollowUser: vi.fn(), isFollowing: vi.fn(async () => false) }));
const getPublicProfile = vi.fn();
const getProfileCard = vi.fn();
vi.mock('../../services/publicProfileService', () => ({ getPublicProfile: (...a: unknown[]) => getPublicProfile(...a), getProfileCard: (...a: unknown[]) => getProfileCard(...a) }));
const sendFriendRequest = vi.fn();
vi.mock('../../shared/supabase/queries/messaging', () => ({ sendFriendRequest: (...a: unknown[]) => sendFriendRequest(...a) }));

const { default: MemberProfilePage } = await import('../MemberProfilePage');

const profile = { user_id: 'u1', display_name: 'Ace', headline: 'Gets things done', bio: null, profile_image_type: 'avatar', profile_smilie_code: null, is_public: true, follower_count: 0, following_count: 0, is_bot: false };
const counts = { active_goals: 1, goals_completed: 0, commitments_kept: 0, plan_steps_done: 0, current_streak: 0 };
const card = (over: Record<string, unknown> = {}) => ({
  card: { user_id: 'u1', display_name: 'Ace', headline: null, profile_image_type: 'avatar', profile_smilie_code: null, is_bot: false, interests: ['Running'], favorite_color: 'teal', zodiac_sign: 'Leo', goal_areas: ['fitness'] },
  relation: { is_self: false, is_friend: false, has_full_access: false, friend_request: 'none' },
  reach: { who_can_message: 'friends', accepts_friend_requests: true, shares_accomplishments: true },
  ...over,
});

function renderPage() {
  render(<MemoryRouter initialEntries={['/member/u1']}><Routes><Route path="/member/:userId" element={<MemberProfilePage />} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  getPublicProfile.mockResolvedValue({ profile, counts, goals: [], commitments: [], is_owner: false, has_full_access: false });
});

describe('a member profile you are not friends with', () => {
  it('shows the front card, a recent-wins list and a way in, but not the full page', async () => {
    getProfileCard.mockResolvedValue(card());
    renderPage();
    expect(await screen.findByText('Running')).toBeTruthy();
    expect(screen.getByText(/Leo/)).toBeTruthy();
    expect(screen.getByText('Their full page is for friends')).toBeTruthy();
    expect(screen.getByText('Recent wins')).toBeTruthy();
    expect(screen.queryByText('Shown on profile')).toBeNull();
  });

  it('sends a friend request and says so', async () => {
    getProfileCard.mockResolvedValue(card());
    sendFriendRequest.mockResolvedValue(undefined);
    renderPage();
    fireEvent.click(await screen.findByText('Add as friend'));
    await waitFor(() => expect(sendFriendRequest).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText('Friend request sent.')).toBeTruthy();
  });

  it('says so when they are not accepting requests', async () => {
    getProfileCard.mockResolvedValue(card({ reach: { who_can_message: 'nobody', accepts_friend_requests: false, shares_accomplishments: true } }));
    renderPage();
    expect(await screen.findByText(/isn't accepting friend requests right now/)).toBeTruthy();
    expect(screen.queryByText('Add as friend')).toBeNull();
  });

  it('shows the full page to a friend', async () => {
    getPublicProfile.mockResolvedValue({ profile: { ...profile, bio: 'Runner and cook' }, counts, goals: [], commitments: [], is_owner: false, has_full_access: true });
    getProfileCard.mockResolvedValue(card({ relation: { is_self: false, is_friend: true, has_full_access: true, friend_request: 'none' } }));
    renderPage();
    expect(await screen.findByText('Runner and cook')).toBeTruthy();
    expect(screen.queryByText('Their full page is for friends')).toBeNull();
    expect(screen.getByText('Posts')).toBeTruthy();
  });
});

describe('the order of a member profile', () => {
  it('goes follow button, posts, goals and streak, then interests', async () => {
    getPublicProfile.mockResolvedValue({ profile, counts: { ...counts, current_streak: 3 }, goals: [], commitments: [], is_owner: false, has_full_access: true });
    getProfileCard.mockResolvedValue(card({ relation: { is_self: false, is_friend: true, has_full_access: true, friend_request: 'none' } }));
    renderPage();
    const follow = await screen.findByText('Follow');
    const posts = screen.getByText('Posts');
    const streak = screen.getByText(/-day streak/);
    const interests = screen.getByText('Running');
    const before = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(follow, posts)).toBe(true);
    expect(before(posts, streak)).toBe(true);
    expect(before(streak, interests)).toBe(true);
  });

  it('explains what following is, next to the button', async () => {
    getProfileCard.mockResolvedValue(card());
    renderPage();
    expect(await screen.findByText(/Following puts their wins in your feed/)).toBeTruthy();
  });
});

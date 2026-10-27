import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('../../shared/ui/Toast', () => ({ toast }));
vi.mock('../../shared/supabase/client', () => ({ supabase: { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'me' } } })) } } }));
vi.mock('../PublicProfileImage', () => ({ PublicProfileImage: () => null }));

const profile = {
  user_id: 'me', display_name: 'Member', headline: null, bio: null, avatar_config: null, profile_image_type: 'avatar', profile_smilie_code: null,
  is_public: true, shared_goal_ids: [], follower_count: 0, following_count: 0, discoverable: true, is_bot: false,
  profile_mode: 'friends', share_accomplishments: true, who_can_message: 'everyone', accepts_friend_requests: true, accepts_mail: true, comments_from: 'everyone',
  created_at: '', updated_at: '',
};
const upsertMyMemberProfile = vi.fn();
vi.mock('../../services/memberProfileService', () => ({
  getMyMemberProfile: vi.fn(async () => profile),
  upsertMyMemberProfile: (...a: unknown[]) => upsertMyMemberProfile(...a),
}));
vi.mock('../../services/coachingService', () => ({ getGoals: vi.fn(async () => []), getCommitments: vi.fn(async () => []) }));
vi.mock('../../services/publicProfileService', () => ({ toggleGoalShowOnProfile: vi.fn(), toggleCommitmentShowOnProfile: vi.fn() }));
const updateProfile = vi.fn();
vi.mock('../../services/userProfileService', () => ({ userProfileService: { updateProfile: (...a: unknown[]) => updateProfile(...a) } }));
const syncDiscoveryFromProfile = vi.fn(async () => {});
vi.mock('../../shared/supabase/queries/messaging', () => ({ syncDiscoveryFromProfile: (...a: unknown[]) => syncDiscoveryFromProfile(...a) }));

const { PublicProfileSettings } = await import('../PublicProfileSettings');

beforeEach(() => {
  vi.clearAllMocks();
  upsertMyMemberProfile.mockResolvedValue(profile);
  updateProfile.mockResolvedValue({});
});

describe('changing your nickname in settings', () => {
  it('saves a new nickname everywhere it is used', async () => {
    render(<PublicProfileSettings />);
    const box = (await screen.findByLabelText('Nickname')) as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'Ace' } });
    fireEvent.click(screen.getByText('Save public profile'));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ nickname: 'Ace' }));
    expect(upsertMyMemberProfile).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Ace' }));
    expect(syncDiscoveryFromProfile).toHaveBeenCalledWith({ nickname: 'Ace' });
  });

  it('can pick a random nickname for you', async () => {
    render(<PublicProfileSettings />);
    const box = (await screen.findByLabelText('Nickname')) as HTMLInputElement;
    fireEvent.click(screen.getByText('Pick one for me'));
    expect(box.value.length).toBeGreaterThan(1);
    expect(box.value).not.toBe('Member');
  });

  it('refuses a nickname with an email in it, and does not save', async () => {
    render(<PublicProfileSettings />);
    const box = (await screen.findByLabelText('Nickname')) as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'me@mail.com' } });
    fireEvent.click(screen.getByText('Save public profile'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Leave out emails/)));
    expect(upsertMyMemberProfile).not.toHaveBeenCalled();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('leaves the nickname alone when it did not change', async () => {
    render(<PublicProfileSettings />);
    await screen.findByLabelText('Nickname');
    fireEvent.click(screen.getByText('Save public profile'));
    await waitFor(() => expect(upsertMyMemberProfile).toHaveBeenCalled());
    expect(updateProfile).not.toHaveBeenCalled();
  });
});

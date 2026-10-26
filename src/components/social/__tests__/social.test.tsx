import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../shared/ui/Toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../PublicProfileImage', () => ({ PublicProfileImage: () => null }));
vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));

const rpc = vi.fn();
vi.mock('../../../shared/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const interactions = {
  toggleLike: vi.fn(),
  getLikedPostIds: vi.fn(),
  getComments: vi.fn(async () => []),
  addComment: vi.fn(),
  deleteComment: vi.fn(),
};
vi.mock('../../../services/postInteractionService', () => interactions);

const { toast } = await import('../../../shared/ui/Toast');
const { createStatus } = await import('../../../services/progressFeedService');
const { StatusComposer } = await import('../StatusComposer');
const { ProfilePosts } = await import('../ProfilePosts');

function post(id: string, over: Record<string, unknown> = {}) {
  return {
    id, user_id: 'friend', post_type: 'status', title: 'Status', body: `post ${id}`,
    ref_target_type: 'status', ref_target_id: id, goal_id: null, like_count: 0, comment_count: 0,
    is_auto_generated: false, created_at: new Date().toISOString(), author_name: 'Priya',
    author_avatar_config: null, author_profile_image_type: 'avatar', author_profile_smilie_code: null,
    author_is_bot: false, ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createStatus', () => {
  it('returns the new id', async () => {
    rpc.mockResolvedValue({ data: { success: true, id: 'p1' }, error: null });
    await expect(createStatus('hello')).resolves.toBe('p1');
    expect(rpc).toHaveBeenCalledWith('create_status_post', { p_body: 'hello' });
  });

  it('passes the hate-speech block message through as is', async () => {
    const message = "That includes a slur or hate speech, which Velvet doesn't allow. Swearing is fine. Please rephrase.";
    rpc.mockResolvedValue({ data: null, error: { code: 'VM001', message } });
    await expect(createStatus('...')).rejects.toThrow(message);
  });

  it('turns server refusals into readable messages', async () => {
    rpc.mockResolvedValue({ data: { success: false, error: 'rate_limited' }, error: null });
    await expect(createStatus('hello')).rejects.toThrow(/posted a lot/);
    rpc.mockResolvedValue({ data: { success: false, error: 'no_access' }, error: null });
    await expect(createStatus('hello')).rejects.toThrow(/membership or trial/);
  });
});

describe('StatusComposer', () => {
  it('posts the trimmed text, clears the box and tells the parent', async () => {
    rpc.mockResolvedValue({ data: { success: true, id: 'p1' }, error: null });
    const onPosted = vi.fn();
    render(<StatusComposer onPosted={onPosted} />);
    const box = screen.getByLabelText('Write a status') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: '  Ran my first 5K today  ' } });
    fireEvent.click(screen.getByText('Post'));
    await waitFor(() => expect(onPosted).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith('create_status_post', { p_body: 'Ran my first 5K today' });
    expect(box.value).toBe('');
  });

  it('keeps the text and shows the reason when posting fails', async () => {
    rpc.mockResolvedValue({ data: { success: false, error: 'too_long' }, error: null });
    const onPosted = vi.fn();
    render(<StatusComposer onPosted={onPosted} />);
    const box = screen.getByLabelText('Write a status') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Post'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/under 500/)));
    expect(onPosted).not.toHaveBeenCalled();
    expect(box.value).toBe('hello');
  });
});

describe('likes on a profile', () => {
  function renderPosts(posts: ReturnType<typeof post>[], liked: string[]) {
    rpc.mockResolvedValue({ data: { success: true, posts }, error: null });
    interactions.getLikedPostIds.mockResolvedValue(new Set(liked));
    render(<MemoryRouter><ProfilePosts userId="friend" isOwn={false} /></MemoryRouter>);
  }

  it("doesn't count your own like twice on a post you'd already liked", async () => {
    renderPosts([post('a', { like_count: 3 })], ['a']);
    const like = await screen.findByLabelText('Unlike');
    expect(like.textContent).toBe('3');
  });

  it('adds and removes one like per tap', async () => {
    renderPosts([post('a', { like_count: 3 })], []);
    interactions.toggleLike.mockResolvedValue(true);
    fireEvent.click(await screen.findByLabelText('Like'));
    await waitFor(() => expect(screen.getByLabelText('Unlike').textContent).toBe('4'));

    interactions.toggleLike.mockResolvedValue(false);
    fireEvent.click(screen.getByLabelText('Unlike'));
    await waitFor(() => expect(screen.getByLabelText('Like').textContent).toBe('3'));
  });

  it('puts the count back when the like fails to save', async () => {
    renderPosts([post('a', { like_count: 3 })], []);
    interactions.toggleLike.mockResolvedValue(false);
    fireEvent.click(await screen.findByLabelText('Like'));
    await waitFor(() => expect(interactions.toggleLike).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText('Like').textContent).toBe('3'));
  });

  it('shows why a comment was refused', async () => {
    const { ModerationBlockedError } = await import('../../../services/moderation');
    renderPosts([post('a')], []);
    interactions.addComment.mockRejectedValue(new ModerationBlockedError('That includes a slur or hate speech.'));
    fireEvent.click(await screen.findByLabelText('Comments'));
    fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: 'bad words' } });
    fireEvent.click(screen.getByLabelText('Send comment'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That includes a slur or hate speech.'));
    expect((screen.getByLabelText('Write a comment') as HTMLInputElement).value).toBe('bad words');
  });

  it('shows a status as its text', async () => {
    renderPosts([post('a', { body: 'Ran my first 5K today' })], []);
    expect(await screen.findByText('Ran my first 5K today')).toBeTruthy();
  });
});

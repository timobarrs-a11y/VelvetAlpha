import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../shared/ui/Toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const rpc = vi.fn();
vi.mock('../../../shared/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
const getMyMemberProfile = vi.fn();
vi.mock('../../../services/memberProfileService', () => ({ getMyMemberProfile: () => getMyMemberProfile() }));

const { StatusComposer } = await import('../StatusComposer');

beforeEach(() => vi.clearAllMocks());

describe('StatusComposer on a friends-only full page', () => {
  it('has no audience choice, says friends, and posts without naming one', async () => {
    getMyMemberProfile.mockResolvedValue({ profile_mode: 'friends' });
    rpc.mockResolvedValue({ data: { success: true, id: 'p1' }, error: null });
    const onPosted = vi.fn();
    render(<MemoryRouter><StatusComposer onPosted={onPosted} /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole('radiogroup')).toBeNull());
    expect(screen.getByText('Only your friends will see this')).toBeTruthy();
    expect(screen.getByText('Make it public')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Write a status'), { target: { value: 'Rough week' } });
    fireEvent.click(screen.getByText('Post'));
    await waitFor(() => expect(onPosted).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith('create_status_post', { p_body: 'Rough week' });
  });

  it('keeps the audience choice on a public-facing page', async () => {
    getMyMemberProfile.mockResolvedValue({ profile_mode: 'open' });
    render(<MemoryRouter><StatusComposer onPosted={() => {}} /></MemoryRouter>);
    expect(await screen.findByRole('radiogroup', { name: 'Who can see this post' })).toBeTruthy();
    expect(screen.queryByText('Make it public')).toBeNull();
  });
});

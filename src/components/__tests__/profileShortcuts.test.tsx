import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../../shared/supabase/client', () => ({ supabase: { channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }), removeChannel: () => {} } }));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('../MessagingOverlay', async (orig) => ({
  ...(await orig<typeof import('../MessagingOverlay')>()),
  ChatView: () => <div>the chat</div>,
}));
vi.mock('../dock/FriendCheckers', () => ({ FriendCheckers: () => null }));
vi.mock('../dock/FriendDrawGuess', () => ({ FriendDrawGuess: () => null }));
vi.mock('../dock/FriendPaint', () => ({ FriendPaint: () => null }));
vi.mock('../dock/FriendRps', () => ({ FriendRps: () => null }));

import { FriendsView } from '../MessagingOverlay';
import { FriendChatWindow } from '../dock/FriendChatWindow';
import type { FriendPeer } from '../../shared/supabase/queries/messaging';

const peer = (over: Partial<FriendPeer>): FriendPeer => ({
  user_id: 'u-leah', display_name: 'Leah', avatar_url: null, headline: null, alias: null, age_range: null,
  intro: null, intro_message: null, friendship_id: 'f1', status: 'accepted', created_at: '2026-10-01T00:00:00Z',
  is_online: false, last_seen_at: '2026-10-20T00:00:00Z', presence: 'offline', available_to_chat: true, ...over,
});

function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }

describe('tap a face to see their profile', () => {
  it('buddy list: the avatar opens the profile, the name still opens the chat, offline friends included', () => {
    const onOpenProfile = vi.fn();
    const onOpenChat = vi.fn();
    render(
      <FriendsView
        friends={[peer({ user_id: 'u-leah', display_name: 'Leah', presence: 'offline' }), peer({ user_id: 'u-kai', display_name: 'Kai', friendship_id: 'f2', presence: 'online', is_online: true })]}
        onOpenChat={onOpenChat}
        onOpenProfile={onOpenProfile}
        onUnfriend={() => {}}
      />,
    );
    // Offline starts folded, like a buddy list.
    fireEvent.click(screen.getByText(/Offline \(1\)/));
    fireEvent.click(screen.getByLabelText("View Leah's profile"));
    expect(onOpenProfile).toHaveBeenCalledWith('u-leah');
    fireEvent.click(screen.getByLabelText("View Kai's profile"));
    expect(onOpenProfile).toHaveBeenCalledWith('u-kai');
    expect(onOpenChat).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Kai'));
    expect(onOpenChat).toHaveBeenCalledTimes(1);
  });

  it('instant message window: the face and name at the top open their profile', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Where />
        <Routes>
          <Route
            path="*"
            element={<FriendChatWindow friend={{ conversationId: 'c1', peerId: 'u-leah', peerName: 'Leah', peerAvatarUrl: null }} onMinimize={() => {}} onClose={() => {}} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('where').textContent).toBe('/chat');
    fireEvent.click(screen.getByLabelText("View Leah's profile"));
    expect(screen.getByTestId('where').textContent).toBe('/member/u-leah');
  });
});

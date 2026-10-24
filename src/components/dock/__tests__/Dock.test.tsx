import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dock } from '../Dock';
import { DockProvider, useDockCoach } from '../DockContext';

const sendMessageWithSignals = vi.fn();
const getCompanionUnreadCounts = vi.fn();
const markCompanionRead = vi.fn();

vi.mock('../../../services/companionReadService', () => ({
  getCompanionUnreadCounts: () => getCompanionUnreadCounts(),
  markCompanionRead: (id: string) => markCompanionRead(id),
}));

const realtime: Record<string, Array<(p: unknown) => void>> = {};
vi.mock('../../../shared/supabase/client', () => {
  const channel = {
    on: (_t: string, f: { table: string }, cb: (p: unknown) => void) => { (realtime[f.table] ??= []).push(cb); return channel; },
    subscribe: () => channel,
  };
  return { supabase: { channel: () => channel, removeChannel: () => {} } };
});
vi.mock('../../../shared/supabase/queries/messaging', () => ({
  getConversationList: vi.fn(async () => [{ unread_count: 2 }]),
  getIncomingRequests: vi.fn(async () => []),
  setOnline: vi.fn(async () => {}),
  messagePreview: (t: string) => t,
  parseGameInvite: () => null,
  FRIEND_GAMES: { draw: { icon: 'd', label: 'Draw' }, paint: { icon: 'p', label: 'Paint' }, rps: { icon: 'r', label: 'RPS' }, checkers: { icon: 'c', label: 'Checkers' } },
  gameInvite: () => '',
  sendMessage: vi.fn(async () => null),
  displayNames: vi.fn(async (ids: string[]) => new Map(ids.map(id => [id, 'Leah']))),
  getOrCreateConversation: vi.fn(async () => 'c1'),
}));
vi.mock('../../MessagingOverlay', () => ({
  MessagingOverlay: () => <div>friends inbox</div>,
  ChatView: ({ target }: { target: { peerName: string } }) => <div>chat with {target.peerName}</div>,
}));
vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../../services/companionService', () => ({ updateLastMessageTime: vi.fn(async () => {}) }));
vi.mock('../../../services/chatService', () => ({
  ChatService: {
    getUserProfile: vi.fn(async () => ({ id: 'u1' })),
    sendMessageWithSignals: (...args: unknown[]) => sendMessageWithSignals(...args),
  },
}));
vi.mock('../../../services/messageTrackingService', () => ({
  getMessageTrackingInfo: vi.fn(async () => ({ canSendMessage: true })),
}));
vi.mock('../../../features/chat/hooks', () => ({
  // Each companion's existing thread: the dock window must show it.
  useMessages: (_userId: string, companionId: string) => {
    const [added, setAdded] = useState<unknown[]>([]);
    return {
      data: [{ id: `h-${companionId}`, role: 'assistant', content: `Earlier with ${companionId}`, message_type: 'text' }, ...added],
      appendOptimistic: (m: unknown) => setAdded(prev => [...prev, m]),
      replaceOptimistic: () => {},
      removeOptimistic: () => {},
      setMessages: () => {},
    };
  },
  useSendMessage: (cb: { appendOptimistic: (m: unknown) => void }) =>
    async (input: { role: string; content: string; metadata?: unknown }) => {
      cb.appendOptimistic({ id: `${input.role}-${input.content}`, ...input });
    },
}));
vi.mock('../../Avatar', () => ({ Avatar: () => null }));
vi.mock('../../lobby', () => ({ companionAvatarConfig: () => ({}) }));

const companions = [
  { id: 'friendly', custom_name: 'Kelicia', relationship_type: 'romantic' },
  { id: 'coach', custom_name: 'Coach Kim', relationship_type: 'mentor' },
  { id: 'buddy', custom_name: 'Andre', relationship_type: 'friend' },
] as never[];

function CoachingPage({ onChanged }: { onChanged: (ids: string[]) => void }) {
  const coach = useDockCoach({ surface: 'plans', quickPrompts: ['Build me a plan'], onCoachChanged: onChanged });
  return <button onClick={() => coach.ask('Set my goal')}>page ask</button>;
}

function renderDock(page?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/coaching-commitments']}>
      <DockProvider companions={companions}>
        {page}
        <Dock />
      </DockProvider>
    </MemoryRouter>,
  );
}

function setWidth(px: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: px });
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('1024') ? px >= 1024 : false,
    addEventListener: () => {}, removeEventListener: () => {},
  }));
}

beforeEach(() => {
  sessionStorage.clear();
  getCompanionUnreadCounts.mockReset();
  getCompanionUnreadCounts.mockResolvedValue({});
  markCompanionRead.mockReset();
  markCompanionRead.mockResolvedValue(undefined);
  sendMessageWithSignals.mockReset();
  sendMessageWithSignals.mockResolvedValue({
    assistantMessage: 'Goal set, and here is your plan.',
    coachingChanges: [
      { entityType: 'goal', entityId: 'goal-1', action: 'created' },
      { entityType: 'plan_step', entityId: 'step-1', action: 'created' },
      { entityType: 'plan_step', entityId: 'step-2', action: 'created' },
    ],
    uiActions: [],
    coachArtifacts: [],
  });
  setWidth(1400);
});

describe('Dock', () => {
  it('opens a companion from its chat head on their existing thread, alongside Messages', async () => {
    renderDock();
    fireEvent.click(screen.getByTitle('Friends HQ'));
    fireEvent.click(screen.getByTitle('Andre'));
    expect(await screen.findByText('friends inbox')).toBeTruthy();
    expect(screen.getByText('Earlier with buddy')).toBeTruthy();
    expect(await screen.findByText('2')).toBeTruthy(); // unread badge
  });

  it('fits three windows side by side and keeps the rest as heads', async () => {
    renderDock();
    fireEvent.click(screen.getByTitle('Kelicia'));
    fireEvent.click(screen.getByTitle('Coach Kim · coach'));
    fireEvent.click(screen.getByTitle('Andre'));
    fireEvent.click(screen.getByTitle('Friends HQ'));
    await screen.findByText('friends inbox');
    expect(screen.queryByText('Earlier with friendly')).toBeNull();
    expect(screen.getByText('Earlier with coach')).toBeTruthy();
    expect(screen.getByText('Earlier with buddy')).toBeTruthy();
  });

  it('shows one window at a time on a phone', async () => {
    setWidth(400);
    renderDock();
    fireEvent.click(screen.getByTitle('Kelicia'));
    fireEvent.click(screen.getByTitle('Andre'));
    await screen.findByText('Earlier with buddy');
    expect(screen.queryByText('Earlier with friendly')).toBeNull();
  });

  it('brings in the coach on a coaching page and sends page requests with the page attached', async () => {
    const onChanged = vi.fn();
    renderDock(<CoachingPage onChanged={onChanged} />);

    // Auto-opened, tagged with the page, with the page's prompts.
    expect(await screen.findByText('Earlier with coach')).toBeTruthy();
    expect(screen.getByText('on Plans')).toBeTruthy();
    expect(screen.getByText('Build me a plan')).toBeTruthy();

    fireEvent.click(screen.getByText('page ask'));
    expect(await screen.findByText('Goal set, and here is your plan.')).toBeTruthy();
    expect(sendMessageWithSignals).toHaveBeenCalledTimes(1);
    expect(sendMessageWithSignals).toHaveBeenCalledWith('Set my goal', 'coach', { id: 'u1' }, 'plans');
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(['goal-1', 'step-1', 'step-2']));

    // Done cards summarise what the coach made.
    expect(screen.getByText('Goal created')).toBeTruthy();
    expect(screen.getByText('2 steps created')).toBeTruthy();
  });

  it('does not tag a companion chat with the coaching page', async () => {
    renderDock(<CoachingPage onChanged={() => {}} />);
    await screen.findByText('Earlier with coach');
    fireEvent.click(screen.getByTitle('Kelicia'));
    const input = await screen.findByPlaceholderText('Message Kelicia…');
    fireEvent.change(input, { target: { value: 'hey' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(sendMessageWithSignals).toHaveBeenCalledWith('hey', 'friendly', { id: 'u1' }, undefined));
    const kelicia = screen.getByLabelText('Close Kelicia').closest('div')!.parentElement!;
    expect(within(kelicia).queryByText('on Plans')).toBeNull();
  });

  it('shows who messaged you, and clears it when you open their chat', async () => {
    getCompanionUnreadCounts.mockResolvedValue({ friendly: 2 });
    renderDock(<CoachingPage onChanged={() => {}} />);
    // Talking to the coach while Kelicia has two new messages.
    await screen.findByText('Earlier with coach');
    expect(await screen.findByLabelText('2 unread from Kelicia')).toBeTruthy();
    expect(markCompanionRead).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Kelicia · 2 new'));
    await waitFor(() => expect(markCompanionRead).toHaveBeenCalledWith('friendly'));
    expect(screen.queryByLabelText('2 unread from Kelicia')).toBeNull();
  });

  it('stops auto-opening the coach after the user closes it', async () => {
    const { unmount } = renderDock(<CoachingPage onChanged={() => {}} />);
    await screen.findByText('Earlier with coach');
    fireEvent.click(screen.getByLabelText('Close Coach Kim'));
    unmount();
    renderDock(<CoachingPage onChanged={() => {}} />);
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByText('Earlier with coach')).toBeNull();
  });

  it('pops up a friend message with a yellow tab, and opens their chat on tap', async () => {
    renderDock();
    await waitFor(() => expect(realtime.im_messages?.length).toBeGreaterThan(0));
    for (const cb of realtime.im_messages) cb({ new: { conversation_id: 'c1', sender_id: 'leah', content: 'hey you' } });
    expect(await screen.findByText('hey you')).toBeTruthy();
    expect(screen.getAllByTitle('Leah · friend · 1 new').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('hey you'));
    expect(await screen.findByText('chat with Leah')).toBeTruthy();
  });

  it('welcomes you back with the friends who messaged while you were away', async () => {
    const { getConversationList } = await import('../../../shared/supabase/queries/messaging');
    vi.mocked(getConversationList).mockResolvedValue([
      { id: 'c1', peer_id: 'leah', peer_name: 'Leah', peer_avatar_url: null, unread_count: 3, last_message_at: '2026-10-24T09:00:00Z' },
    ] as never);
    renderDock();
    expect(await screen.findByText('sent you 3 messages while you were away')).toBeTruthy();
    expect(screen.getAllByTitle('Leah · friend · 3 new').length).toBeGreaterThan(0);
  });
});

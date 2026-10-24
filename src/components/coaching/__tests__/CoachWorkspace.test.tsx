import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoachWorkspace } from '../CoachWorkspace';
import { useCoachPanel } from '../useCoachPanel';

const sendMessageWithSignals = vi.fn();

vi.mock('../../../shared/supabase/client', () => ({ supabase: {} }));
vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../../services/companionService', () => ({
  getCompanions: vi.fn(async () => [
    { id: 'friend-1', custom_name: 'Pal', relationship_type: 'friend' },
    { id: 'coach-1', custom_name: 'Coach Kim', relationship_type: 'mentor' },
  ]),
  updateLastMessageTime: vi.fn(async () => {}),
}));
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
  // The coach's existing thread: the panel must show it (persistent memory).
  useMessages: (_userId: string, companionId: string | null) => {
    const [added, setAdded] = useState<unknown[]>([]);
    const history = companionId === 'coach-1'
      ? [{ id: 'm1', role: 'assistant', content: 'Earlier we talked about running.', message_type: 'text' }]
      : [];
    return {
      data: [...history, ...added],
      appendOptimistic: (m: unknown) => setAdded(prev => [...prev, m]),
      replaceOptimistic: () => {},
      removeOptimistic: () => {},
    };
  },
  useSendMessage: (cb: { appendOptimistic: (m: unknown) => void }) =>
    async (input: { role: string; content: string }) => {
      cb.appendOptimistic({ id: `${input.role}-${input.content}`, ...input });
    },
}));
vi.mock('../../Avatar', () => ({ Avatar: () => null }));
vi.mock('../../lobby', () => ({ companionAvatarConfig: () => ({}) }));

function Harness({ onChanged }: { onChanged: (ids: string[]) => void }) {
  const coach = useCoachPanel();
  return (
    <MemoryRouter>
      <button onClick={() => coach.ask('Set my goal')}>page ask</button>
      <CoachWorkspace surface="plans" coach={coach} quickPrompts={[]} onCoachChanged={onChanged}>
        <p>page content</p>
      </CoachWorkspace>
    </MemoryRouter>
  );
}

beforeEach(() => {
  sendMessageWithSignals.mockReset();
  sendMessageWithSignals.mockResolvedValue({
    assistantMessage: 'Goal set, and here is your plan.',
    coachingChanges: [{ entityType: 'goal', entityId: 'goal-1', action: 'created' }],
    uiActions: [{ tab: 'plan', highlightIds: ['plan-1', 'step-1'] }],
    coachArtifacts: [],
  });
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
});

describe('CoachWorkspace', () => {
  it('opens the existing coach thread, skipping non-coach companions', async () => {
    render(<Harness onChanged={() => {}} />);
    expect(await screen.findByText('Coach Kim')).toBeTruthy();
    expect(screen.getByText('Earlier we talked about running.')).toBeTruthy();
    expect(screen.queryByText('Pal')).toBeNull();
  });

  it('sends a page request once, tagged with the page, and reports what the coach changed', async () => {
    const onChanged = vi.fn();
    render(<Harness onChanged={onChanged} />);
    await screen.findByText('Coach Kim');

    fireEvent.click(screen.getByText('page ask'));

    expect(await screen.findByText('Goal set, and here is your plan.')).toBeTruthy();
    expect(screen.getByText('Set my goal')).toBeTruthy();
    expect(sendMessageWithSignals).toHaveBeenCalledTimes(1);
    expect(sendMessageWithSignals).toHaveBeenCalledWith('Set my goal', 'coach-1', { id: 'u1' }, 'plans');
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(['goal-1', 'plan-1', 'step-1']));

    // Later renders must not re-send the consumed request.
    fireEvent.change(screen.getByPlaceholderText('Ask Coach Kim…'), { target: { value: 'x' } });
    await waitFor(() => expect(sendMessageWithSignals).toHaveBeenCalledTimes(1));
  });
});

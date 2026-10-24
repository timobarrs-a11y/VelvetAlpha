import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { FriendCheckers } from '../FriendCheckers';

// A fake broadcast bus: what one player sends, the other receives.
type Handler = (msg: { payload: unknown }) => void;
const bus: Array<{ id: number; handlers: Record<string, Handler> }> = [];
let nextId = 0;
vi.mock('../../../shared/supabase/client', () => ({
  supabase: {
    channel: () => {
      const me = { id: nextId++, handlers: {} as Record<string, Handler> };
      bus.push(me);
      const ch = {
        on: (_t: string, f: { event: string }, cb: Handler) => { me.handlers[f.event] = cb; return ch; },
        subscribe: (cb?: (s: string) => void) => { cb?.('SUBSCRIBED'); return ch; },
        send: ({ event, payload }: { event: string; payload: unknown }) => {
          for (const other of bus) if (other !== me) other.handlers[event]?.({ payload });
        },
      };
      return ch;
    },
    removeChannel: () => {},
  },
}));


beforeEach(() => { bus.length = 0; localStorage.clear(); });

describe('FriendCheckers', () => {
  it('plays a move on one side and shows it on the other', async () => {
    // 'a' < 'b', so a is red and moves first.
    const { container: a } = render(<div data-testid="a"><FriendCheckers conversationId="c1" myId="a" peerId="b" peerName="Bee" /></div>);
    const { container: b } = render(<div data-testid="b"><FriendCheckers conversationId="c1" myId="b" peerId="a" peerName="Ay" /></div>);
    expect(within(a).getByText('Your move')).toBeTruthy();
    expect(within(b).getByText("Ay's move")).toBeTruthy();

    // Red piece at row 5, col 0 moves to row 4, col 1. Red is drawn at the bottom for 'a',
    // so squares are in board order: index = row * 8 + col.
    const squares = () => a.querySelectorAll('.aspect-square');
    act(() => { fireEvent.click(squares()[5 * 8 + 0]); });
    act(() => { fireEvent.click(squares()[4 * 8 + 1]); });

    expect(within(a).getByText("Bee's move")).toBeTruthy();
    expect(within(b).getByText('Your move')).toBeTruthy();
    void screen;
  });
});

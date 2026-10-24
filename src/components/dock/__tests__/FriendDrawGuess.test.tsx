import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, within, act } from '@testing-library/react';
import { FriendDrawGuess } from '../FriendDrawGuess';

// A fake broadcast bus: what one player sends, the other receives.
type Handler = (msg: { event: string; payload: unknown }) => void;
const bus: Array<{ handlers: Handler[]; open: boolean }> = [];
vi.mock('../../../shared/supabase/client', () => ({
  supabase: {
    channel: () => {
      const me = { handlers: [] as Handler[], open: true };
      bus.push(me);
      const ch = {
        on: (_t: string, _f: unknown, cb: Handler) => { me.handlers.push(cb); return ch; },
        subscribe: (cb?: (s: string) => void) => { setTimeout(() => cb?.('SUBSCRIBED'), 0); return ch; },
        send: ({ event, payload }: { event: string; payload: unknown }) => {
          for (const other of bus) if (other !== me && other.open) other.handlers.forEach(h => h({ event, payload }));
        },
      };
      return ch;
    },
    removeChannel: () => { const last = bus.find(b => b.open); if (last) last.open = false; },
  },
}));

HTMLCanvasElement.prototype.getContext = (() => null) as never;

beforeEach(() => { bus.length = 0; localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true); });

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 5)); });

// Each player keeps their own copy, like two phones: different storage keys
// (the fake bus ignores channel names, so they still talk).
describe('Draw & Guess', () => {
  it('lets the guesser chat a guess, ends the round on the right word, and both see it', async () => {
    localStorage.setItem('velvet.dg.word.A.0', JSON.stringify('banana'));
    const a = render(<FriendDrawGuess conversationId="A" myId="a" peerId="b" peerName="Bee" />);
    const b = render(<FriendDrawGuess conversationId="B" myId="b" peerId="a" peerName="Ay" />);
    await flush();
    const A = within(a.container), B = within(b.container);
    expect(A.getByText('banana')).toBeTruthy();
    expect(B.getByText('Ay is drawing…')).toBeTruthy();

    // The drawer chats; the guesser answers with a wrong guess, then the right one.
    fireEvent.change(A.getByPlaceholderText('Message Bee…'), { target: { value: 'hint: yellow' } });
    fireEvent.submit(A.getByPlaceholderText('Message Bee…').closest('form')!);
    await flush();
    expect(B.getByText('hint: yellow')).toBeTruthy();

    fireEvent.change(B.getByPlaceholderText('Guess or chat…'), { target: { value: 'lemon?' } });
    fireEvent.submit(B.getByPlaceholderText('Guess or chat…').closest('form')!);
    await flush();
    expect(A.getByText('lemon?')).toBeTruthy();
    expect(A.queryByText(/got it/)).toBeNull();

    fireEvent.change(B.getByPlaceholderText('Guess or chat…'), { target: { value: 'Banana' } });
    fireEvent.submit(B.getByPlaceholderText('Guess or chat…').closest('form')!);
    await flush();
    expect(A.getAllByText('Bee got it: banana! 🎉').length).toBeGreaterThan(0);
    expect(B.getAllByText('You got it: banana! 🎉').length).toBeGreaterThan(0);
  });

  it("doesn't let the drawer type the word", async () => {
    localStorage.setItem('velvet.dg.word.A.0', JSON.stringify('banana'));
    const a = render(<FriendDrawGuess conversationId="A" myId="a" peerId="b" peerName="Bee" />);
    await flush();
    const A = within(a.container);
    fireEvent.change(A.getByPlaceholderText('Message Bee…'), { target: { value: 'its a BANANA' } });
    fireEvent.submit(A.getByPlaceholderText('Message Bee…').closest('form')!);
    await flush();
    expect(A.getByText("That's the word! No spoilers 😄")).toBeTruthy();
    expect(A.queryByText('its a BANANA')).toBeNull();
  });

  it('comes back exactly where it was after leaving', async () => {
    localStorage.setItem('velvet.dg.word.A.0', JSON.stringify('banana'));
    const first = render(<FriendDrawGuess conversationId="A" myId="a" peerId="b" peerName="Bee" />);
    await flush();
    fireEvent.change(within(first.container).getByPlaceholderText('Message Bee…'), { target: { value: 'brb' } });
    fireEvent.submit(within(first.container).getByPlaceholderText('Message Bee…').closest('form')!);
    await flush();
    first.unmount();

    const again = render(<FriendDrawGuess conversationId="A" myId="a" peerId="b" peerName="Bee" />);
    await flush();
    const A = within(again.container);
    expect(A.getByText('banana')).toBeTruthy(); // same word, no skip
    expect(A.getByText('brb')).toBeTruthy();    // chat kept
  });
});

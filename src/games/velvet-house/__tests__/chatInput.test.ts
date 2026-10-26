import { describe, it, expect } from 'vitest';
import { toGameTurnInput } from '../bridge/chatInput';
import { isSampleRequestMessage, isSampleResultMessage } from '../bridge/protocol';

describe('toGameTurnInput', () => {
  it('puts the persona first, then alternates the chat, ending on the player', () => {
    const msgs = toGameTurnInput(['You are Maya.', 'Player: hi', 'Partner: hey you', 'Player: how was your day', 'state\nwhat now?']);
    expect(msgs).toEqual([
      { role: 'user', content: 'You are Maya.' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hey you' },
      { role: 'user', content: 'how was your day' },
      { role: 'user', content: 'state\nwhat now?' },
    ]);
  });

  it('wraps a lone prompt (the memory extractor) so it is not mistaken for a persona', () => {
    const msgs = toGameTurnInput(['Extract memories.\n\nPlayer: x']);
    expect(msgs).toHaveLength(2);
    expect(msgs[1]).toEqual({ role: 'user', content: 'Extract memories.\n\nPlayer: x' });
  });

  it('never ends on an assistant turn, even if the last line looks like one', () => {
    const msgs = toGameTurnInput(['persona', 'Partner: hello']);
    expect(msgs[msgs.length - 1].role).toBe('user');
  });

  it('ignores empty input', () => {
    expect(toGameTurnInput([])).toEqual([]);
    expect(toGameTurnInput(['', '  '])).toEqual([]);
  });
});

describe('sample bridge messages', () => {
  it('accepts well-formed requests and rejects oversized or malformed ones', () => {
    expect(isSampleRequestMessage({ type: 'velvet:sample', game: 'velvet-house', seq: 1, input: ['a', 'b'] })).toBe(true);
    expect(isSampleRequestMessage({ type: 'velvet:sample', seq: 1, input: [] })).toBe(false);
    expect(isSampleRequestMessage({ type: 'velvet:sample', seq: 1, input: [1] })).toBe(false);
    expect(isSampleRequestMessage({ type: 'velvet:sample', seq: 1, input: ['x'.repeat(30000)] })).toBe(false);
    expect(isSampleRequestMessage({ type: 'velvet:sample', seq: 'a', input: ['x'] })).toBe(false);
  });

  it('accepts results with text or an error', () => {
    expect(isSampleResultMessage({ type: 'velvet:sampleResult', seq: 2, text: 'hi' })).toBe(true);
    expect(isSampleResultMessage({ type: 'velvet:sampleResult', seq: 2, error: 'refused' })).toBe(true);
    expect(isSampleResultMessage({ type: 'velvet:sampleResult', seq: 2, text: 5 })).toBe(false);
  });
});

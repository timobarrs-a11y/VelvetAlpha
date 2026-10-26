import { describe, it, expect } from 'vitest';
import { talk, cannedFor, type PersonaContext, type SampleFn } from '../state/companionAI';

const ctx = {
  partnerName: 'Maya', simName: 'Sam', townName: 'Honeysuckle Hollow',
  companion: { name: 'Maya', pronoun: 'she', preset: 'bubbly', bio: '', source: 'game' },
  style: {}, bond: 50, day: 1, minutes: 600, money: 100, fridgeBasic: 1, fridgeFresh: 0, dishes: 0, laundryPile: 0, power: true,
  mayaStatus: 'idle', jordanStatus: 'idle', mayaWhere: 'Main floor', jordanWhere: 'Main floor', recentLog: [],
  coreMem: [], memories: [], pastMem: [],
} as unknown as PersonaContext;

const failing = (code: string): SampleFn => async () => { throw new Error(code); };

describe('when the AI cannot answer', () => {
  it('says so in her own voice, for each personality', () => {
    for (const preset of ['warm', 'calm', 'bubbly', 'dry']) {
      for (const code of ['budget', 'rate_limited', 'unavailable', 'refused']) {
        expect(cannedFor(code, preset).length, `${preset}/${code}`).toBeGreaterThan(10);
      }
    }
    expect(cannedFor('budget', 'bubbly')).not.toBe(cannedFor('budget', 'dry'));
    expect(cannedFor('anything-else', 'nonsense')).toBe(cannedFor('unavailable', 'warm'));
  });

  it('running out of replies gives the canned line and keeps the player\'s message', async () => {
    const r = await talk('hello', [], ctx, failing('budget'));
    expect(r.failed).toBe('budget');
    expect(r.text).toBe(cannedFor('budget', 'bubbly'));
    expect(r.turns).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('a refused message is not added to the conversation', async () => {
    for (const code of ['refused', 'blocked']) {
      const r = await talk('something bad', [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hey' }], ctx, failing(code));
      expect(r.turns).toHaveLength(2);
      expect(r.text).toBe(cannedFor('refused', 'bubbly'));
    }
  });

  it('a cancelled request says nothing, and a normal reply works', async () => {
    expect((await talk('x', [], ctx, failing('cancelled'))).text).toBe('');
    const ok: SampleFn = async () => 'Hi there [mood=happy; bond=1; emote=none; want=none; act=none; pick=none]';
    const r = await talk('hello', [], ctx, ok);
    expect(r.failed).toBeUndefined();
    expect(r.text).toBe('Hi there');
    expect(r.tag?.mood).toBe('happy');
  });
});

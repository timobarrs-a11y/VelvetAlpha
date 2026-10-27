import { describe, it, expect } from 'vitest';
import { handoffLine } from '../handoffLine';

describe('handoffLine', () => {
  it('names the helper, what they are best at, and uses the right pronoun', () => {
    expect(handoffLine({ name: 'Dana', gender: 'female', kind: 'coach', domain: '5K running training' }))
      .toBe("Splendid work. Your plan is ready for you to look over. You want this done properly, so I've brought you the best there is: Dana, your coach. There is none better for 5K running training. Whatever you need, take it to her.");
    expect(handoffLine({ name: 'Marcus', gender: 'male', kind: 'assistant', domain: 'buying your first home' }))
      .toContain('Marcus, your assistant. There is none better for buying your first home. Whatever you need, take it to him.');
  });

  it('says "this" when there is no label, or it is too long to read well', () => {
    expect(handoffLine({ name: 'Dana', gender: 'female', kind: 'coach', domain: '' })).toContain('none better for this.');
    expect(handoffLine({ name: 'Dana', gender: 'female', kind: 'coach', domain: 'x'.repeat(60) })).toContain('none better for this.');
    expect(handoffLine({ name: 'Dana', gender: 'female', kind: 'coach', domain: 'cooking!' })).toContain('none better for cooking.');
  });
});

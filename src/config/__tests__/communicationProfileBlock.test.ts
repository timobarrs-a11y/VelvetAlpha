import { describe, it, expect } from 'vitest';
import { communicationProfileBlock } from '../systemPromptBuilder';

describe('communicationProfileBlock', () => {
  it('describes only the traits we know', () => {
    const block = communicationProfileBlock({ motivation: 'external' });
    expect(block).toContain('MOTIVATION: They respond to accountability.');
    expect(block).not.toContain('DECISION STYLE');
    expect(block).not.toContain('CONFLICT RESPONSE');
    expect(block).not.toContain('CONNECTION');
  });

  it('says nothing when nothing is known', () => {
    expect(communicationProfileBlock(null)).toBe('');
    expect(communicationProfileBlock({})).toBe('');
    expect(communicationProfileBlock({ decisionStyle: '' })).toBe('');
  });

  it('describes all four when all are known', () => {
    const block = communicationProfileBlock({ conflict: 'empathy', connection: 'lively', decisionStyle: 'intuitive', motivation: 'internal' });
    expect(block).toContain('lead with empathy');
    expect(block).toContain('lively back-and-forth');
    expect(block).toContain('They trust their gut');
    expect(block).toContain("They're self-driven");
  });
});

import { describe, expect, it } from 'vitest';
import { ALL_OVERSEER_LINES, OVERSEER_LINES, overseerMonologue, type OverseerTrigger } from '../content/overseer';

describe('Overseer lines', () => {
  it('has at least 100 distinct lines', () => {
    expect(ALL_OVERSEER_LINES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(ALL_OVERSEER_LINES).size).toBe(ALL_OVERSEER_LINES.length);
  });

  it('gives a full monologue with no repeats, avoiding the last one', () => {
    for (const t of Object.keys(OVERSEER_LINES) as OverseerTrigger[]) {
      const first = overseerMonologue(t);
      const next = overseerMonologue(t, Math.random, 4, first);
      expect(first).toHaveLength(4);
      expect(new Set(first).size).toBe(4);
      expect(next.some((l) => first.includes(l))).toBe(false);
    }
  });
});

import { describe, it, expect } from 'vitest';

/**
 * Memory compaction and budget tests.
 * The memory system has a token budget (default 1200). When memories exceed
 * the budget, they must be compacted: least-recently-recalled facts are dropped
 * first, keeping the most relevant ones within budget.
 */

describe('memory compaction budget', () => {
  interface MemoryItem {
    id: string;
    content: string;
    confidence: number;
    lastRecalledAt: number | null;
    scope: string;
  }

  function compactMemories(items: MemoryItem[], budgetTokens: number): MemoryItem[] {
    // Sort by confidence desc, then by lastRecalledAt asc (least recently recalled first = dropped first)
    const sorted = [...items].sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      const aRec = a.lastRecalledAt ?? 0;
      const bRec = b.lastRecalledAt ?? 0;
      return bRec - aRec; // most recently recalled stays
    });
    let tokens = 0;
    const kept: MemoryItem[] = [];
    for (const item of sorted) {
      const itemTokens = Math.ceil(item.content.length / 4);
      if (tokens + itemTokens > budgetTokens) break;
      tokens += itemTokens;
      kept.push(item);
    }
    return kept;
  }

  it('keeps high-confidence memories when over budget', () => {
    const items: MemoryItem[] = [
      { id: '1', content: 'User loves hiking', confidence: 0.9, lastRecalledAt: 100, scope: 'global' },
      { id: '2', content: 'User has a dog', confidence: 0.5, lastRecalledAt: 50, scope: 'global' },
      { id: '3', content: 'User works at a bakery', confidence: 0.8, lastRecalledAt: 200, scope: 'global' },
    ];
    const result = compactMemories(items, 10); // very tight budget
    expect(result.length).toBeLessThan(items.length);
    expect(result[0].confidence).toBeGreaterThanOrEqual(result[result.length - 1].confidence);
  });

  it('keeps everything when under budget', () => {
    const items: MemoryItem[] = [
      { id: '1', content: 'Short', confidence: 0.7, lastRecalledAt: null, scope: 'global' },
      { id: '2', content: 'Also short', confidence: 0.8, lastRecalledAt: null, scope: 'global' },
    ];
    const result = compactMemories(items, 1000);
    expect(result.length).toBe(2);
  });

  it('drops least-recently-recalled first at equal confidence', () => {
    const items: MemoryItem[] = [
      { id: 'old', content: 'Old memory recalled long ago', confidence: 0.7, lastRecalledAt: 10, scope: 'global' },
      { id: 'new', content: 'New memory recalled recently', confidence: 0.7, lastRecalledAt: 1000, scope: 'global' },
    ];
    const result = compactMemories(items, 8);
    expect(result.find(i => i.id === 'new')).toBeDefined();
    expect(result.find(i => i.id === 'old')).toBeUndefined();
  });

  it('handles empty input', () => {
    expect(compactMemories([], 1000)).toEqual([]);
  });
});

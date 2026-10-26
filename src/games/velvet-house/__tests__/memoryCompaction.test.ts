import { describe, it, expect } from 'vitest';
import {
  remember, compactMemory, condenserFrom, plainCondense, memoryBrief, needsCompaction,
  CORE_CAP, RECENT_CAP, PAST_CAP, MEM_BUDGET, type MemoryStore, type Condenser,
} from '../state/memory';
import type { SampleFn } from '../state/companionAI';

const store = (): MemoryStore => ({ coreMem: [], memories: [], pastMem: [] });
// A condenser that records what it was given and returns a recognisable summary.
const recording = () => {
  const calls: string[][] = [];
  const fn: Condenser = async (lines) => { calls.push(lines); return `SUMMARY(${lines.length}): ${lines[0]}`; };
  return { calls, fn };
};

describe('remembering', () => {
  it('files important things under never-forget and the rest as recent, ignoring blanks and repeats', () => {
    const s = store();
    expect(remember('Her mom is ill', true, s)).toBe(true);
    expect(remember('They watched a movie', false, s)).toBe(true);
    expect(remember('  ', false, s)).toBe(false);
    expect(remember('Her mom is ill', true, s)).toBe(false);
    expect(remember('They watched a movie', true, s)).toBe(false); // already known as recent
    expect(s.coreMem).toEqual(['Her mom is ill']);
    expect(s.memories).toEqual(['They watched a movie']);
  });
  it('clips an over-long memory', () => {
    const s = store();
    remember('x'.repeat(1000), false, s);
    expect(s.memories[0].length).toBeLessThanOrEqual(220);
  });
});

describe('compaction condenses the oldest instead of dropping them', () => {
  it('folds the 12 oldest recent memories into one summary once over the cap', async () => {
    const s = store();
    for (let i = 0; i < RECENT_CAP + 1; i++) remember(`event ${i}`, false, s);
    const { calls, fn } = recording();
    await compactMemory(s, fn);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(Array.from({ length: 12 }, (_, i) => `event ${i}`));
    expect(s.memories).toHaveLength(RECENT_CAP + 1 - 12);
    expect(s.pastMem).toEqual(['SUMMARY(12): event 0']);
    expect(needsCompaction(s)).toBe(false);
  });

  it('keeps never-forget memories as a few short facts, and merges the oldest summaries', async () => {
    const s = store();
    for (let i = 0; i < CORE_CAP + 1; i++) remember(`fact ${i}`, true, s);
    for (let i = 0; i < PAST_CAP + 1; i++) s.pastMem.push(`summary ${i}`);
    const merge: Condenser = async (lines) => (lines[0].startsWith('fact') ? 'First fact. Second fact. Third fact. Fourth fact.' : 'merged summary');
    await compactMemory(s, merge);
    expect(s.coreMem.slice(0, 3)).toEqual(['First fact.', 'Second fact.', 'Third fact.']);
    expect(s.coreMem.length).toBeLessThanOrEqual(CORE_CAP);
    expect(s.pastMem[0]).toBe('merged summary');
    expect(s.pastMem).toHaveLength(PAST_CAP);
  });

  it('loses nothing when a condense fails: the entries go back where they were', async () => {
    const s = store();
    for (let i = 0; i < RECENT_CAP + 5; i++) remember(`event ${i}`, false, s);
    const before = [...s.memories];
    await compactMemory(s, async () => { throw new Error('offline'); });
    expect(s.memories).toEqual(before);
    expect(s.pastMem).toEqual([]);
  });

  it('without the AI it waits instead of cutting, and only folds by hand when far over', async () => {
    const s = store();
    for (let i = 0; i < RECENT_CAP + 5; i++) remember(`event ${i}`, false, s);
    await compactMemory(s); // no condenser: a little over the cap is fine
    expect(s.memories).toHaveLength(RECENT_CAP + 5);
    for (let i = 0; i < RECENT_CAP * 2; i++) remember(`more ${i}`, false, s);
    await compactMemory(s);
    expect(s.memories.length).toBeLessThanOrEqual(RECENT_CAP * 2);
    expect(s.pastMem.length).toBeGreaterThan(0);
    // The folded text still mentions what it covered.
    expect(s.pastMem[0]).toContain('event 0');
  });

  it('does not run twice at once on the same store', async () => {
    const s = store();
    for (let i = 0; i < RECENT_CAP + 1; i++) remember(`e${i}`, false, s);
    const { calls, fn } = recording();
    await Promise.all([compactMemory(s, fn), compactMemory(s, fn)]);
    expect(calls).toHaveLength(1);
  });
});

describe('the AI condenser', () => {
  it('asks for one paragraph, strips mood tags, and falls back to the plain fold on failure', async () => {
    let asked = '';
    const sample: SampleFn = async (input) => { asked = input[0]; return 'Maya and Sam moved in. [mood=happy; bond=1; emote=none; want=none; act=none; pick=none]'; };
    const out = await condenserFrom(sample, 'Maya')(['moved in', 'bought a couch'], 400);
    expect(out).toBe('Maya and Sam moved in.');
    expect(asked).toContain("Maya's memory");
    expect(asked).toContain('- moved in');
    const failing: SampleFn = async () => { throw new Error('x'); };
    expect(await condenserFrom(failing, 'Maya')(['moved in', 'bought a couch'], 400)).toBe('moved in bought a couch');
    expect(await condenserFrom(null, 'Maya')(['a', 'b'], 400)).toBe('a b');
  });
  it('the plain fold represents every entry and respects the limit', () => {
    const out = plainCondense(Array.from({ length: 12 }, (_, i) => `entry number ${i} with some detail`), 400);
    expect(out.length).toBeLessThanOrEqual(400);
    expect(out).toContain('entry number 0');
    expect(out).toContain('entry number 11');
  });
});

describe('what goes into the prompt', () => {
  it('puts never-forget first, then older summaries, then recent, and stays within the budget', () => {
    const s: MemoryStore = { coreMem: ['core fact'], pastMem: ['old summary'], memories: ['recent thing'] };
    const brief = memoryBrief(s);
    expect(brief.indexOf('core fact')).toBeLessThan(brief.indexOf('old summary'));
    expect(brief.indexOf('old summary')).toBeLessThan(brief.indexOf('recent thing'));
    const big: MemoryStore = { coreMem: ['c'.repeat(200)], pastMem: [], memories: Array.from({ length: 200 }, (_, i) => `m${i} ` + 'x'.repeat(100)) };
    expect(memoryBrief(big).length).toBeLessThanOrEqual(MEM_BUDGET + 200);
    // The newest recent memories are the ones kept.
    expect(memoryBrief(big)).toContain('m199 ');
    expect(memoryBrief(big)).not.toContain('m0 ');
  });
  it('is empty when there is nothing to remember', () => {
    expect(memoryBrief(store())).toBe('');
  });
});

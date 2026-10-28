import { describe, it, expect, vi, afterEach } from 'vitest';
import { unlockFor, UNLOCK_CODES } from '../state/unlockCodes';
import { createUnlocks } from '../systems/unlocks';
import { CATALOG, catalogById, visibleItems, itemsForTab, setQuote } from '../state/catalog';
import { readQueue, writeQueue, enqueue, QUEUE_MAX, type KeyValueStore } from '../state/codeQueue';
import { createCodeQueue, CODE_QUEUE_KEY } from '../systems/codeQueue';
import type { Game } from '../kernel/game';

const memory = (): KeyValueStore & { data: Record<string, string> } => { const data: Record<string, string> = {}; return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } }; };

describe('unlock codes', () => {
  it('are exact phrases, in any case, and every one points at a secret set that exists', () => {
    expect(unlockFor('rainbowhugs')?.setId).toBe('set-cloud');
    expect(unlockFor('  RainbowHugs ')?.setId).toBe('set-cloud');
    for (const t of ['', 'hi', 'rainbow', 'rainbowhugs please', 'say rainbowhugs', 'cloud']) expect(unlockFor(t), t).toBeNull();
    for (const c of Object.values(UNLOCK_CODES)) { const s = catalogById(c.setId); expect(s?.secret).toBe(true); expect(s?.set).toBeDefined(); }
  });
});

describe('a secret pack', () => {
  it('is not in the shop until the player has it, in any tab', () => {
    const cloud = CATALOG.filter((c) => c.id.endsWith('-cloud') || c.id === 'paper-cloudnine-sky' || c.id === 'floor-confetti');
    expect(cloud.length).toBe(9);
    for (const c of cloud) expect(c.secret, c.id).toBe(true);
    for (const tab of ['Today', 'Sets', 'Furniture', 'Wallpaper', 'Floors']) {
      expect(visibleItems(itemsForTab(tab), new Set()).some((c) => cloud.includes(c)), tab).toBe(false);
      expect(visibleItems(itemsForTab(tab), new Set(cloud.map((c) => c.id))).some((c) => cloud.includes(c)), tab).toBe(tab === 'Today' || cloud.some((c) => c.tab === tab));
    }
    // nothing else is secret
    expect(CATALOG.filter((c) => c.secret && !cloud.includes(c))).toEqual([]);
  });
});

describe('what a code does to the house', () => {
  const game = (level = 1, owned: string[] = []) => {
    const logs: string[] = [], applied: string[] = [], own = new Set(owned);
    const g = { view: { level }, owned: own, log: (m: string) => logs.push(m), refreshDrawer: () => {}, handleBuy: (m: { id: string }, _c: unknown, free: boolean) => { applied.push(m.id + (free ? ':free' : '')); own.add(m.id); } } as unknown as Game;
    return { logs, applied, own, tryUnlock: createUnlocks(g).tryUnlock! };
  };
  const ids = () => catalogById('set-cloud')!.set!.items;

  it('gives the whole set free and puts it on, when they are looking at a floor of the house', () => {
    const { own, applied, logs, tryUnlock } = game();
    expect(tryUnlock('rainbowhugs')).toBe(true);
    for (const id of [...ids(), 'set-cloud']) expect(own.has(id), id).toBe(true);
    expect(applied).toEqual(ids().map((id) => id + ':free'));
    expect(logs[0]).toMatch(/Cloud Nine is yours/);
  });

  it('on the backyard it is still theirs, just not put on yet', () => {
    const { own, applied, tryUnlock } = game(3);
    expect(tryUnlock('rainbowhugs')).toBe(true);
    expect(own.has('set-cloud')).toBe(true);
    expect(applied).toEqual([]);
  });

  it('the second time it says so and changes nothing; ordinary talk is not a code', () => {
    const { applied, logs, tryUnlock } = game(1, ['set-cloud']);
    expect(tryUnlock('rainbowhugs')).toBe(true);
    expect(applied).toEqual([]);
    expect(logs[0]).toMatch(/already have/);
    expect(tryUnlock('how are you')).toBe(false);
  });

  it('shows in the Sets tab once owned, as an Apply, with nothing to pay', () => {
    const quote = setQuote(catalogById('set-cloud')!, new Set(ids()));
    expect(quote.missing).toEqual([]);
    expect(quote.cost).toBe(0);
  });
});

describe('codes saved from the start menu', () => {
  it('are a small list that survives bad storage', () => {
    const s = memory();
    expect(readQueue(s, 'k')).toEqual([]);
    enqueue(s, 'k', '  kaching ');
    enqueue(s, 'k', 'rainbowhugs');
    expect(readQueue(s, 'k')).toEqual(['kaching', 'rainbowhugs']);
    s.data.k = 'not json'; expect(readQueue(s, 'k')).toEqual([]);
    s.data.k = '{"a":1}'; expect(readQueue(s, 'k')).toEqual([]);
    s.data.k = JSON.stringify(['ok', 5, null, 'fine']); expect(readQueue(s, 'k')).toEqual(['ok', 'fine']);
    writeQueue(s, 'k', Array.from({ length: QUEUE_MAX + 5 }, (_, i) => 'c' + i)); expect(readQueue(s, 'k')).toHaveLength(QUEUE_MAX);
    writeQueue(s, 'k', []); expect(s.data.k).toBeUndefined();
  });

  describe('redeeming', () => {
    afterEach(() => { vi.useRealTimers(); localStorage.clear(); });
    it('puts the codes saved at the start menu to use once the house is there, and empties the list', () => {
      vi.useFakeTimers();
      localStorage.clear();
      writeQueue(localStorage, CODE_QUEUE_KEY, ['rainbowhugs', 'xoxotimoisgodxoxo']);
      const calls: string[] = [];
      const g = { tryUnlock: (t: string) => { calls.push('unlock ' + t); return t === 'rainbowhugs'; }, tryDevMoney: (t: string) => { calls.push('money ' + t); return true; } } as unknown as Game;
      createCodeQueue(g);
      expect(calls).toEqual([]);
      vi.advanceTimersByTime(2000);
      // The unlock code is used as an unlock; anything the unlock does not take is tried as the money phrase.
      expect(calls).toEqual(['unlock rainbowhugs', 'unlock xoxotimoisgodxoxo', 'money xoxotimoisgodxoxo']);
      expect(readQueue(localStorage, CODE_QUEUE_KEY)).toEqual([]);
    });
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { unlockFor, UNLOCK_CODES } from '../state/unlockCodes';
import { createUnlocks } from '../systems/unlocks';
import { createCheats } from '../systems/cheats';
import { CATALOG, catalogById, visibleItems, itemsForTab, setQuote } from '../state/catalog';
import { readQueue, writeQueue, enqueue, QUEUE_MAX, type KeyValueStore } from '../state/codeQueue';
import { isPublicCode, setNames } from '../state/cheats';
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
    const cloud = CATALOG.filter((c) => c.id.endsWith('-cloud') || c.id === 'paper-clouds-sky' || c.id === 'floor-confetti');
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

describe('the public cheats cannot give the secret pack', () => {
  it('decorate refuses it, and still decorates a pack from the shelves', () => {
    const applied: string[] = [], logs: string[] = [];
    const g = { view: { level: 1 }, owned: new Set<string>(), log: (m: string) => logs.push(m), refreshDrawer: () => {}, handleBuy: (m: { id: string }) => { applied.push(m.id); }, s: { settleDone: true, scriptMode: '' } } as unknown as Game;
    const { runCheat } = createCheats(g);
    expect(runCheat('decorate cloud')).toMatch(/no "cloud" set/);
    expect(applied).toEqual([]);
    expect(runCheat('decorate winter')).toMatch(/is in/);
    expect(applied.length).toBe(8);
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

  it('only accepts public codes, typed in full', () => {
    for (const t of ['kaching', 'fillerup', 'lovebomb', 'stockup', 'decorate retro', 'DECORATE Winter']) expect(isPublicCode(t), t).toBe(true);
    for (const t of ['', 'help', 'kaching now', 'decorate', 'decorate nothing', 'decorate cloud', 'xoxotimoisgodxoxo', 'rainbowhugs', 'hello']) expect(isPublicCode(t), t).toBe(false);
    // The secret pack is not one a public cheat can give.
    expect(setNames()).not.toContain('cloud');
    expect(setNames()).toContain('winter');
  });

  describe('redeeming', () => {
    afterEach(() => { vi.useRealTimers(); localStorage.clear(); });
    const run = (blocked: string | null) => {
      vi.useFakeTimers();
      localStorage.clear();
      writeQueue(localStorage, CODE_QUEUE_KEY, ['rainbowhugs', 'kaching']);
      const calls: string[] = [];
      const g = { tryUnlock: (t: string) => { calls.push('unlock ' + t); return true; }, runCheat: (t: string) => { calls.push('cheat ' + t); return ''; }, cheatsBlocked: () => blocked } as unknown as Game;
      createCodeQueue(g);
      vi.advanceTimersByTime(2000);
      return calls;
    };
    it('an unlock code goes at once; a cheat waits for the move-in to be over, and is kept', () => {
      expect(run('Finish the move-in first.')).toEqual(['unlock rainbowhugs']);
      expect(readQueue(localStorage, CODE_QUEUE_KEY)).toEqual(['kaching']);
    });
    it('once the move-in is over everything runs and the list empties', () => {
      expect(run(null)).toEqual(['unlock rainbowhugs', 'cheat kaching']);
      expect(readQueue(localStorage, CODE_QUEUE_KEY)).toEqual([]);
    });
  });
});

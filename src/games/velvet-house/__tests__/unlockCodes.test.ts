import { describe, it, expect, vi, afterEach } from 'vitest';
import { unlockFor, UNLOCK_CODES } from '../state/unlockCodes';
import { createUnlocks } from '../systems/unlocks';
import { CATALOG, catalogById, promoLocked, itemsForTab, setQuote, TABS } from '../state/catalog';
import { readQueue, writeQueue, enqueue, QUEUE_MAX, type KeyValueStore } from '../state/codeQueue';
import { createCodeQueue, CODE_QUEUE_KEY } from '../systems/codeQueue';
import type { Game } from '../kernel/game';

const memory = (): KeyValueStore & { data: Record<string, string> } => { const data: Record<string, string> = {}; return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } }; };

describe('unlock codes', () => {
  it('are exact phrases, in any case, and every one points at promo sets that exist', () => {
    expect(unlockFor('rainbowhugs')?.setIds).toEqual(['set-cuddle', 'touches-cuddle']);
    expect(unlockFor('  RainbowHugs ')?.packName).toBe('Cuddle Clouds');
    for (const t of ['', 'hi', 'rainbow', 'rainbowhugs please', 'say rainbowhugs', 'cloud']) expect(unlockFor(t), t).toBeNull();
    for (const c of Object.values(UNLOCK_CODES)) for (const id of c.setIds) { const s = catalogById(id); expect(s?.promo, id).toBe(true); expect(s?.set, id).toBeDefined(); }
  });
});

describe('a promo pack', () => {
  // Both Cuddle Clouds packs and every piece in them.
  const packs = ['set-cuddle', 'touches-cuddle'].map((id) => catalogById(id)!);
  const cloud = [...packs, ...packs.flatMap((p) => p.set!.items.map((id) => catalogById(id)!))];

  it('is promo, every piece of it', () => {
    expect(cloud).toHaveLength(15);
    for (const c of cloud) expect(c.promo, c.id).toBe(true);
  });

  it('every promo item comes with some code, whole packs and every piece in them', () => {
    const given = new Set(Object.values(UNLOCK_CODES).flatMap((c) => c.setIds.flatMap((id) => [id, ...catalogById(id)!.set!.items])));
    for (const id of given) expect(catalogById(id)!.promo, id).toBe(true);
    expect(CATALOG.filter((c) => c.promo && !given.has(c.id)).map((c) => c.id)).toEqual([]);
  });

  it('shows in the shop by name, locked, until the player has it', () => {
    for (const tab of ['Today', 'Sets', 'Furniture', 'Wall', 'Decor', 'Hobbies', 'Wallpaper', 'Floors']) {
      const here = itemsForTab(tab).filter((c) => cloud.includes(c));
      expect(here.length > 0, tab).toBe(tab === 'Today' || cloud.some((c) => c.tab === tab));
      for (const c of here) expect(promoLocked(c, new Set()), c.id).toBe(true);
      for (const c of here) expect(promoLocked(c, new Set(cloud.map((x) => x.id))), c.id).toBe(false);
    }
    // An ordinary item is never locked this way.
    expect(promoLocked(catalogById('set-arcade')!, new Set())).toBe(false);
  });

  it('has its own Promo tab, listing the packs (not every piece again)', () => {
    expect(TABS).toContain('Promo');
    expect(itemsForTab('Promo').map((c) => c.id)).toEqual(['set-cuddle', 'touches-cuddle']);
  });
});

describe('what a code does to the house', () => {
  afterEach(() => { vi.useRealTimers(); });
  const game = (opts: { level?: number; owned?: string[]; settled?: boolean; script?: boolean } = {}) => {
    vi.useFakeTimers();
    const logs: string[] = [], applied: string[] = [], shown: Array<{ title: string; image?: string }> = [], own = new Set(opts.owned ?? []);
    const g = {
      view: { level: opts.level ?? 1 }, owned: own, flags: {}, s: { settleDone: opts.settled ?? true, scriptMode: opts.script ? 'cutscene' : null },
      canvas: { toDataURL: () => 'data:image/jpeg;base64,AAAA' },
      log: (m: string) => logs.push(m), refreshDrawer: () => {},
      setLevel: (l: number) => { (g.view as { level: number }).level = l; },
      celebrate: (o: { title: string; image?: string }) => shown.push(o),
      handleBuy: (m: { id: string }, _c: unknown, free: boolean) => { applied.push(m.id + (free ? ':free' : '')); own.add(m.id); },
    } as unknown as Game;
    return { g, logs, applied, shown, own, tryUnlock: createUnlocks(g).tryUnlock! };
  };
  const ids = () => [...catalogById('set-cuddle')!.set!.items, ...catalogById('touches-cuddle')!.set!.items];

  it('gives the whole set free, puts it on, and then pops up with a picture of it', () => {
    const { own, applied, shown, logs, tryUnlock } = game();
    expect(tryUnlock('rainbowhugs')).toBe(true);
    for (const id of [...ids(), 'set-cuddle', 'touches-cuddle']) expect(own.has(id), id).toBe(true);
    expect(applied).toEqual(ids().map((id) => id + ':free'));
    expect(shown).toEqual([]);
    vi.advanceTimersByTime(2000);
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe('Cuddle Clouds');
    expect(shown[0].image).toMatch(/^data:image/);
    expect(logs.join(' ')).toMatch(/Cuddle Clouds is yours/);
  });

  it('on the backyard it moves inside first, so the picture is of the pack', () => {
    const { g, own, applied, tryUnlock } = game({ level: 3 });
    expect(tryUnlock('rainbowhugs')).toBe(true);
    expect(own.has('set-cuddle')).toBe(true);
    expect(g.view.level).toBe(1);
    expect(applied.length).toBe(ids().length);
  });

  it('before they have moved in, or mid-story, it is theirs but waits for a quiet moment', () => {
    for (const opts of [{ settled: false }, { script: true }]) {
      const { g, own, applied, shown, logs, tryUnlock } = game(opts);
      expect(tryUnlock('rainbowhugs')).toBe(true);
      vi.advanceTimersByTime(3000);
      expect(own.has('set-cuddle')).toBe(true);
      expect(applied).toEqual([]);
      expect(shown).toEqual([]);
      expect(logs[0]).toMatch(/waiting once you have moved in/);
      expect((g.flags as { pendingUnlocks: string[] }).pendingUnlocks).toEqual(['set-cuddle']);
    }
  });

  it('the second time it says so and changes nothing; ordinary talk is not a code', () => {
    const { applied, shown, logs, tryUnlock } = game({ owned: ['set-cuddle', 'touches-cuddle'] });
    expect(tryUnlock('rainbowhugs')).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(applied).toEqual([]);
    expect(shown).toEqual([]);
    expect(logs[0]).toMatch(/already have/);
    expect(tryUnlock('how are you')).toBe(false);
  });

  it('shows in the Sets tab once owned, as an Apply, with nothing to pay', () => {
    for (const id of ['set-cuddle', 'touches-cuddle']) {
      const quote = setQuote(catalogById(id)!, new Set(ids()));
      expect(quote.missing).toEqual([]);
      expect(quote.cost).toBe(0);
    }
  });
});

describe('once per account, inside the app', () => {
  afterEach(() => { vi.useRealTimers(); });
  const inApp = (answer: 'ok' | 'used') => {
    vi.useFakeTimers();
    const logs: string[] = [], own = new Set<string>(), claimed: string[] = [];
    const g = {
      view: { level: 1 }, owned: own, flags: {}, s: { settleDone: true, scriptMode: null },
      canvas: { toDataURL: () => 'data:image/jpeg;base64,AAAA' },
      log: (m: string) => logs.push(m), refreshDrawer: () => {}, setLevel: () => {}, celebrate: () => {},
      handleBuy: (m: { id: string }) => { own.add(m.id); },
    } as unknown as Game;
    const { tryUnlock } = createUnlocks(g, async (code) => { claimed.push(code); return answer; });
    return { own, logs, claimed, tryUnlock: tryUnlock! };
  };

  it('claims the code for the account, then gives the packs', async () => {
    const { own, claimed, tryUnlock } = inApp('ok');
    expect(tryUnlock('RainbowHugs')).toBe(true);
    expect(claimed).toEqual(['rainbowhugs']);
    await vi.waitFor(() => expect(own.has('set-cuddle')).toBe(true));
    expect(own.has('touches-cuddle')).toBe(true);
  });

  it('used in another house: says so, and gives nothing', async () => {
    const { own, logs, tryUnlock } = inApp('used');
    expect(tryUnlock('rainbowhugs')).toBe(true);
    await vi.waitFor(() => expect(logs.join(' ')).toMatch(/already been used on your account/));
    expect(own.size).toBe(0);
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

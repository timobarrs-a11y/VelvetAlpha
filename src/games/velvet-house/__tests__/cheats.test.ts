import { describe, it, expect } from 'vitest';
import { runCheat, CHEATS, helpText, FOUND_MONEY, BOND_BOOST, type CheatHost } from '../state/cheats';
import { createShop } from '../systems/shop';
import { simsShopItems } from '../../../data/avatarCatalog';
import type { Game } from '../kernel/game';

function host(over: Partial<CheatHost> = {}): CheatHost & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    blocked: () => null,
    addMoney: (n) => { calls.push(`money ${n}`); },
    fillNeeds: () => { calls.push('needs'); },
    addBond: (n) => { calls.push(`bond ${n}`); return 70; },
    stockFridge: () => { calls.push('fridge'); },
    decorate: (t) => { calls.push(`decorate ${t}`); return `ok ${t}`; },
    ...over,
  };
}

describe('cheat codes', () => {
  it('run what was typed, in any case, and say what happened', () => {
    const h = host();
    expect(runCheat('  KaChing ', h)).toBe(`Found $${FOUND_MONEY} in the couch.`);
    expect(runCheat('fillerup', h)).toMatch(/great/);
    expect(runCheat('lovebomb', h)).toBe('Bond is 70.');
    expect(runCheat('stockup', h)).toMatch(/full/);
    expect(runCheat('decorate Retro', h)).toBe('ok retro');
    expect(h.calls).toEqual([`money ${FOUND_MONEY}`, 'needs', `bond ${BOND_BOOST}`, 'fridge', 'decorate retro']);
  });

  it('say so for a code that is not one, or for nothing', () => {
    const h = host();
    expect(runCheat('idkfa', h)).toMatch(/not a code/);
    expect(runCheat('   ', h)).toMatch(/Type a code/);
    expect(h.calls).toEqual([]);
  });

  it('do nothing while blocked (the move-in, a cutscene), but help still lists them', () => {
    const h = host({ blocked: () => 'Finish the move-in first.' });
    for (const c of ['kaching', 'fillerup', 'lovebomb', 'stockup', 'decorate retro']) expect(runCheat(c, h), c).toBe('Finish the move-in first.');
    expect(h.calls).toEqual([]);
    expect(runCheat('help', h)).toBe(helpText());
    for (const c of CHEATS) expect(helpText()).toContain(c.code);
  });
});

describe('the Salon and cheat money', () => {
  const game = (cheated: boolean) => {
    const logs: string[] = [], spent: number[] = [];
    const g = {
      world: { objs: [] }, partnerName: 'Maya', house: {}, view: { level: 1 }, owned: new Set<string>(), closet: [], flags: { cheated }, style: {}, tasteNorm: { key: '', mean: 0, sd: 1 },
      log: (m: string) => logs.push(m), art: {}, hasAttic: () => false, storage: [], spendOn: (_: string, n: number) => { spent.push(n); return true; }, refreshDrawer: () => {},
    } as unknown as Game;
    return { logs, spent, buy: createShop(g).handleBuyAvatarItem! };
  };
  it('takes only money the player earned: after a cheat nothing is bought', () => {
    const item = simsShopItems()[0];
    expect(item).toBeDefined();
    const cheated = game(true);
    cheated.buy(item.id);
    expect(cheated.spent).toEqual([]);
    expect(cheated.logs.join(' ')).toMatch(/only takes money you earned/);
  });
  it('still takes honest money', () => {
    const honest = game(false);
    honest.buy(simsShopItems()[0].id);
    expect(honest.spent).toHaveLength(1);
  });
});

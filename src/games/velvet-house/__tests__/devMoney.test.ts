import { describe, it, expect } from 'vitest';
import { parseFund, DEV_PHRASE, DEV_FUND } from '../state/devMoney';
import { createDevMoney } from '../systems/devMoney';
import type { Game } from '../kernel/game';

describe('the developer money phrase', () => {
  it('is exactly the phrase, in any case, and gives $500,000', () => {
    expect(DEV_FUND).toBe(500000);
    expect(parseFund('xoxotimoisgodxoxo')).toBe(500000);
    expect(parseFund('  XoXoTimoIsGodXoXo  ')).toBe(500000);
    expect(DEV_PHRASE).toBe('xoxotimoisgodxoxo');
  });

  it('is never found in ordinary talk, or in a sentence that merely contains it', () => {
    for (const t of ['', 'hi maya', 'how much money do we have', 'xoxo', 'timo is god', 'xoxotimoisgod', 'xoxotimoisgodxoxo!', 'say xoxotimoisgodxoxo', 'xoxotimoisgodxoxo please', 'kaching', 'help'])
      expect(parseFund(t), JSON.stringify(t)).toBeNull();
  });
});

describe('what the phrase does to the house', () => {
  const game = () => {
    const logs: string[] = [];
    const flags: Record<string, unknown> = {};
    const household = { money: 850, earnedToday: 0, spentToday: 0 };
    const life = { ledger: [] as Array<{ label: string; amount: number }> };
    const g = { world: { household, life, day: 1, minutes: 600 }, flags, log: (m: string) => logs.push(m), refreshDrawer: () => {} } as unknown as Game;
    return { flags, household, life, logs, tryDevMoney: createDevMoney(g).tryDevMoney! };
  };

  it('adds the money, goes through the bank as found money, marks the house and says so', () => {
    const { household, flags, logs, life, tryDevMoney } = game();
    expect(tryDevMoney('xoxotimoisgodxoxo')).toBe(true);
    expect(household.money).toBe(500850);
    expect(flags.cheated).toBe(true);
    expect(logs).toEqual(['+$500000']);
    expect(life.ledger[0]).toMatchObject({ label: 'Found money', amount: 500000 });
  });

  it('leaves ordinary talk alone, so it goes on to the partner', () => {
    const { household, flags, logs, tryDevMoney } = game();
    expect(tryDevMoney('can we afford the couch?')).toBe(false);
    expect(household.money).toBe(850);
    expect(flags.cheated).toBeUndefined();
    expect(logs).toEqual([]);
  });
});

/**
 * Cheat codes: a few typed codes for fun, in the spirit of life sims. They are for playing around with, never for getting
 * past the story: they only work once the move-in is over and never during a cutscene or a guided lesson, and they never
 * touch story flags. Money from a cheat is "found money" that the Salon will not take, because what the Salon sells
 * stays with the player's account outside the game.
 *
 * This file is the rules and the table; what a code does to the house is the host's (`systems/cheats.ts`).
 */

import { CATALOG } from './catalog';

export interface CheatHost {
  /** Why cheats can't be used right now, or null if they can. */
  blocked(): string | null;
  addMoney(amount: number): void;
  fillNeeds(): void;
  addBond(amount: number): number;
  stockFridge(): void;
  /** Put a whole themed set on, free. Returns what to say. */
  decorate(theme: string): string;
}

export interface Cheat {
  code: string;
  /** What to type after the code, if anything. */
  arg?: string;
  help: string;
  run(host: CheatHost, arg: string): string;
}

export const FOUND_MONEY = 1000;
export const BOND_BOOST = 15;

export const CHEATS: Cheat[] = [
  { code: 'kaching', help: `Find $${FOUND_MONEY} in the couch (the Salon won't take it).`, run: (h) => { h.addMoney(FOUND_MONEY); return `Found $${FOUND_MONEY} in the couch.`; } },
  { code: 'fillerup', help: 'Everyone is fed, rested, clean and happy.', run: (h) => { h.fillNeeds(); return 'Everyone feels great.'; } },
  { code: 'lovebomb', help: `Your bond with your partner goes up ${BOND_BOOST}.`, run: (h) => `Bond is ${h.addBond(BOND_BOOST)}.` },
  { code: 'stockup', help: 'The fridge is full.', run: (h) => { h.stockFridge(); return 'The fridge is full.'; } },
  { code: 'decorate', arg: '<set>', help: 'Put a whole set on the floor you are looking at, free (see the Sets tab: every set is a name here).', run: (h, a) => h.decorate(a) },
  { code: 'help', help: 'This list.', run: () => helpText() },
];

/** The sets `decorate` knows: every set on the shop's shelves, by its short name. */
/** Secret sets are not on the list: a public cheat must not give what only a code gives. */
export const setNames = (): string[] => CATALOG.filter((c) => c.set && !c.secret).map((c) => c.id.slice(4));

export function helpText(): string {
  return CHEATS.map((c) => `${c.code}${c.arg ? ' ' + c.arg : ''} — ${c.help}`).join('\n') + `\nsets: ${setNames().join(', ')}`;
}

/** Is this one of the public codes, typed fully (a code that takes a set needs a real set)? Used by the title screen. */
export function isPublicCode(input: string): boolean {
  const [word = '', ...rest] = input.trim().toLowerCase().split(/\s+/);
  const c = CHEATS.find((x) => x.code === word);
  if (!c || c.code === 'help') return false;
  if (!c.arg) return rest.length === 0;
  return c.code === 'decorate' ? setNames().includes(rest.join(' ')) : rest.length > 0;
}

/** Run what the player typed. Codes are not case sensitive. Returns what to show them. */
export function runCheat(input: string, host: CheatHost): string {
  const [word = '', ...rest] = input.trim().toLowerCase().split(/\s+/);
  if (!word) return 'Type a code. "help" lists them.';
  const cheat = CHEATS.find((c) => c.code === word);
  if (!cheat) return `"${word}" is not a code. "help" lists them.`;
  if (cheat.code !== 'help') {
    const why = host.blocked();
    if (why) return why;
  }
  return cheat.run(host, rest.join(' '));
}

import { describe, expect, it } from 'vitest';
import { buildWorld, createAgent, startChain } from '../state/agents';
import { INITIAL_OBJS, type ObjectInstance } from '../state/objects';
import { createInteract } from '../systems/interact';
import type { Game } from '../kernel/game';

// An order from a piece's tray when the other person has the piece: walking there, the order takes it over; already
// using it, a message says so instead of the order vanishing.
function setup() {
  const table: ObjectInstance = { id: 'g', type: 'glamtable', level: 1, x: 5.4, y: 5.6, rot: 0 };
  const objs = INITIAL_OBJS.map((o) => ({ ...o })).concat([table]);
  const house = buildWorld(objs);
  const look = { skin: '#a', hair: '#a', top: '#a', bottom: '#a', longHair: false } as never;
  const jordan = createAgent('jordan' as never, 'Jordan', undefined, look), maya = createAgent('maya' as never, 'Maya', undefined, look);
  Object.assign(jordan, { level: 1, x: 3, y: 4 }); Object.assign(maya, { level: 1, x: 7, y: 4 });
  const logs: string[] = [];
  const g = { world: { objs, life: { working: null } }, people: [jordan, maya], house, rng: { next: () => 0.5 }, view: { level: 1 }, log: (m: string) => logs.push(m),
    art: {}, tray: {}, setLevel: () => {}, syncControls: () => {} } as unknown as Game;
  return { g, house, jordan, maya, table, logs, order: createInteract(g).handleObjectAction! };
}

describe('ordering a piece the other person has', () => {
  it('takes it over when they are only walking there', () => {
    const s = setup();
    startChain(s.house, s.maya, 'glam', null, () => 0.5);
    expect(s.maya.task?.phase).toBe('walk');
    s.order(s.table, 'glam');
    expect(s.jordan.task?.act).toBe('glam');
    expect(s.maya.task).toBeNull();
  });
  it('says so when they are already using it', () => {
    const s = setup();
    startChain(s.house, s.maya, 'glam', null, () => 0.5);
    s.maya.task!.phase = 'do';
    s.order(s.table, 'glam');
    expect(s.jordan.task?.act).not.toBe('glam');
    expect(s.logs).toContain('Maya is using the hollywood dressing table right now.');
  });
});

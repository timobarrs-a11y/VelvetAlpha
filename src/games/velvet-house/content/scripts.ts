import type { ScriptDef, Step } from '../script/types';

/**
 * The story, as data: the move-in (docs/velvet-house/scenes/opening.moveIn.md), every delivery, and the rest of the
 * first day (chapters 8 to 15 of docs/velvet-house/opening-sequence.md). Each chapter starts when the one before it is done and plays while the game
 * runs; the opening is a cutscene. See script/types.ts for what each step does.
 */
const say = (who: string, line: string): Step => ({ do: 'say', who, line });
/**
 * How the partner reacts to something the player did, so it never feels like a reflex: the room settles first, she
 * turns to look, a "!" hangs on its own, and only then does she speak. Each part is short; together they read as her
 * noticing, not as a timer.
 */
const settle: Step = { do: 'wait', seconds: 0.7 };
const noticed = (what: string): Step[] => [settle, { do: 'face', who: 'maya', toward: what }, { do: 'wait', seconds: 0.4 }, { do: 'emote', who: 'maya', emote: 'alert' }, { do: 'wait', seconds: 1.0 }];
const knockIn = (carrying?: string): Step[] => [
  { do: 'spawn', npc: 'dez', at: 'door', ...(carrying ? { carrying } : {}) },
  { do: 'walk', who: 'dez', to: 'mark:entry.inside' },
];
const leave: Step[] = [
  { do: 'walk', who: 'dez', to: 'door' },
  { do: 'despawn', npc: 'dez' },
];
const exitLine: Step[] = [say('dez', 'dez.getErDone'), ...leave];

export const OPENING: ScriptDef = {
  id: 'opening.moveIn',
  trigger: { on: 'newGame' },
  mode: 'cutscene',
  // The lines say the real names in the companion's own voice, and the drive-up shows the player's own house: wait for
  // the host to send them (briefly). The two who live here are the script's until it is over.
  needs: { host: ['profile', 'plot'], timeoutMs: 1500, hold: ['jordan', 'maya'] },
  steps: [
    // A0. The drive-up: Dez's truck, a tree the worse for it, the house.
    { do: 'intro', kind: 'arrival' },
    { do: 'clock', day: 1, minutes: 9 * 60 },
    { do: 'camera', focus: 'wide', level: 1 },
    // A1. Dez comes in first with the couch box and sets it down in the gap between the entry and the kitchen; the two
    // who live here follow. Nobody speaks until all three are standing.
    { do: 'place', who: 'jordan', at: 'door' },
    { do: 'place', who: 'maya', at: 'door' },
    { do: 'spawn', npc: 'dez', at: 'door', carrying: 'pbox' },
    { do: 'walk', who: 'dez', to: 'mark:entry.drop', wait: false },
    { do: 'walk', who: 'jordan', to: 'mark:entry.you', wait: false },
    { do: 'walk', who: 'maya', to: 'mark:entry.partner', wait: false },
    { do: 'wait', arrive: ['dez'] },
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.drop', id: 'box.couch', contents: 'sofa' } },
    { do: 'carry', who: 'dez', carrying: null },
    { do: 'walk', who: 'dez', to: 'mark:entry.inside', wait: false },
    { do: 'wait', arrive: ['dez', 'jordan', 'maya'] },
    { do: 'face', who: 'dez', toward: 'jordan' },
    // A2. Welcome to town, and who Dez is: mayor, mover, delivery, the family's businesses.
    { do: 'camera', focus: 'dez', zoom: 1.8 },
    say('dez', 'dez.welcome'),
    say('dez', 'dez.intro.2'),
    say('dez', 'dez.intro.3'),
    // A3. The companion, on the way he drove them here.
    { do: 'camera', focus: 'wide' },
    { do: 'emote', who: 'maya', emote: 'alert' },
    { do: 'say', who: 'maya', line: { bank: 'humor', slot: 'truckOffRoad' } },
    // A4. Dez brushes it off.
    { do: 'camera', focus: 'dez', zoom: 1.8 },
    say('dez', 'dez.brushOff'),
    { do: 'if', cond: { flag: 'rel', equals: 'friend' }, then: [say('dez', 'dez.roommates')] },
    // A5. The clipboard: the names, confirmed with a tap.
    say('dez', 'dez.names'),
    // A6. The first box, and off to get the rest.
    say('dez', 'dez.firstBox'),
    { do: 'camera', focus: 'wide' },
    ...leave,
    // A7. Lesson: open the box. Only the box can be tapped; the lesson ends when the box is open, however it got there.
    { do: 'mode', mode: 'guided', allow: ['obj:box.couch'] },
    { do: 'card', title: 'Open the box', body: '**Tap** the box to open it.', spotlight: 'obj:box.couch' },
    { do: 'wait', until: { any: [{ event: 'obj.unpacked', match: { objId: 'box.couch' } }, { world: { obj: 'box.couch', is: 'sofa' } }] } },
    // A8. Lesson: place the couch where the partner asks. Letting go leaves it loose; Set it down in the Arrange bar
    // keeps it. Set down anywhere else, the partner says so and the lesson stays open. Then a turn, with Rotate, so it
    // faces the TV: the lesson ends when it stands in the outline facing the TV.
    settle,
    { do: 'face', who: 'maya', toward: 'obj:box.couch' },
    { do: 'wait', seconds: 0.5 },
    { do: 'say', who: 'maya', line: { bank: 'communication', slot: 'couchPlace' } },
    { do: 'outline', objType: 'sofa', at: 'mark:living.couchTv', rot: 2, color: 'player' },
    { do: 'card', title: 'Put it where it goes', body: 'Drag the couch into the outline, then tap **Set it down** in the Arrange bar.', misplaced: { who: 'maya', line: { bank: 'communication', slot: 'couchNotThere' } } },
    { do: 'wait', until: { world: { obj: 'box.couch', is: 'sofa', at: 'mark:living.couchTv', within: 0.6 } } },
    { do: 'if', cond: { not: { world: { obj: 'box.couch', is: 'sofa', at: 'mark:living.couchTv', within: 0.6, rot: 2 } } }, then: [
      { do: 'card', title: 'Turn it', body: 'Tap **Rotate** in the Arrange bar until the couch faces the TV, then **Set it down**.' },
      { do: 'wait', until: { world: { obj: 'box.couch', is: 'sofa', at: 'mark:living.couchTv', within: 0.6, rot: 2 } } },
    ] },
    // A9. The couch is down; the next knock at the door is the lamp.
    { do: 'set', flag: 'opening.done', value: true },
    { do: 'set', flag: 'dez.deliveries', value: true },
  ],
};

/** Every purchase and every order arrives at the door in Dez's arms. */
export const DEZ_DELIVERY: ScriptDef = {
  id: 'dez.delivery',
  trigger: { on: 'cond', cond: { event: 'delivery.due' } },
  mode: 'beat',
  once: false,
  priority: 5,
  vars: { category: '$event.category', deliveryId: '$event.deliveryId', carry: '$event.carry' },
  steps: [
    { do: 'spawn', npc: 'dez', at: 'door', carrying: '$carry' },
    { do: 'walk', who: 'dez', to: 'mark:entry.drop' },
    { do: 'deliver', category: '$category', id: '$deliveryId' },
    { do: 'carry', who: 'dez', carrying: null },
    { do: 'say', who: 'dez', line: { pool: 'dez.delivery.$category' } },
    ...exitLine,
    { do: 'set', flag: 'delivered.$category', value: true },
  ],
};

const chapter = (id: string, cond: ScriptDef['trigger'], steps: Step[], extra: Partial<ScriptDef> = {}): ScriptDef => ({ id, trigger: cond, mode: 'beat', priority: 1, steps, ...extra });

export const TUTORIAL: ScriptDef[] = [
  // 7. The lamp: Dez brings a box with no label; the partner wants it in the corner, then changes her mind.
  chapter('tutorial.ch7', { on: 'cond', cond: { flag: 'opening.done' } }, [
    // B1. The lamp box, and one more for later. Dez speaks once he has stopped.
    { do: 'wait', seconds: 2 },
    { do: 'camera', focus: 'mark:entry.inside', zoom: 1.6, level: 1 },
    ...knockIn('pbox'),
    { do: 'walk', who: 'dez', to: 'mark:entry.drop' },
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.drop', id: 'box.lamp', contents: 'lamp' } },
    { do: 'carry', who: 'dez', carrying: null },
    say('dez', 'dez.ch7.noLabel'),
    ...exitLine,
    { do: 'camera', focus: 'wide' },
    // B2. Lesson: open the box.
    { do: 'mode', mode: 'guided', allow: ['obj:box.lamp'] },
    { do: 'card', title: 'Open the box', body: '**Tap** the box to open it.', spotlight: 'obj:box.lamp' },
    { do: 'wait', until: { any: [{ event: 'obj.unpacked', match: { objId: 'box.lamp' } }, { world: { obj: 'box.lamp', is: 'lamp' } }] } },
    // B3. The partner notices: a "!" with her and the lamp both in frame, then she asks for the corner by the TV.
    { do: 'mode', mode: 'cutscene' },
    { do: 'camera', focus: ['maya', 'obj:box.lamp'], zoom: 1.6 },
    ...noticed('obj:box.lamp'),
    { do: 'say', who: 'maya', line: { bank: 'communication', slot: 'lampCorner' } },
    // B4. Lesson: the corner by the TV.
    { do: 'mode', mode: 'guided', allow: ['obj:box.lamp'] },
    { do: 'outline', objType: 'lamp', at: 'mark:living.lampCorner', rot: 0, color: 'player' },
    { do: 'card', title: 'The corner', body: 'Drag the lamp into the outline by the TV, then tap **Set it down**.', misplaced: { who: 'maya', line: { bank: 'communication', slot: 'lampNotThere' } } },
    { do: 'wait', until: { world: { obj: 'box.lamp', is: 'lamp', at: 'mark:living.lampCorner', within: 0.6 } } },
    // B5. She sees it there and changes her mind: by the couch, to read at night.
    { do: 'mode', mode: 'cutscene' },
    { do: 'camera', focus: ['maya', 'obj:box.lamp'], zoom: 1.6 },
    ...noticed('obj:box.lamp'),
    { do: 'say', who: 'maya', line: { bank: 'humor', slot: 'lampByCouch' } },
    // B6. Lesson: beside the couch. Evening comes up, so the lamp has something to light.
    { do: 'dim', amount: 0.38 },
    { do: 'mode', mode: 'guided', allow: ['obj:box.lamp'] },
    { do: 'outline', objType: 'lamp', at: 'mark:living.lamp', rot: 0, color: 'player' },
    { do: 'card', title: 'By the couch', body: 'Move the lamp to the right-hand end of the couch, then tap **Set it down**.', misplaced: { who: 'maya', line: { bank: 'communication', slot: 'lampNotThere' } } },
    { do: 'wait', until: { world: { obj: 'box.lamp', is: 'lamp', at: 'mark:living.lamp', within: 0.6 } } },
    // B7. Lesson: lights are yours to switch.
    { do: 'card', title: 'Let there be light', body: 'Lights can be switched on and off by hand: tap the lamp.', spotlight: 'obj:box.lamp' },
    { do: 'wait', until: { any: [{ event: 'light.toggled', match: { objType: 'lamp' } }, { world: { obj: 'box.lamp', lightOn: true } }] } },
    // B8. The light, and the house is theirs again.
    { do: 'highlight', target: null },
    { do: 'mode', mode: 'cutscene' },
    { do: 'camera', focus: ['maya', 'obj:box.lamp'], zoom: 1.6 },
    settle,
    { do: 'face', who: 'maya', toward: 'obj:box.lamp' },
    { do: 'wait', seconds: 0.6 },
    { do: 'say', who: 'maya', line: { bank: 'humor', slot: 'lampOn' } },
    { do: 'wait', seconds: 1.5 },
    { do: 'dim', amount: 0 },
    { do: 'camera', focus: 'wide' },
    { do: 'mode', mode: 'beat' },
    { do: 'set', flag: 'tutorial.lamp', value: true },
  ], { mode: 'cutscene', needs: { hold: ['jordan', 'maya'] } }),
  // 7b. The rest of the truck, one box per visit: the plant (no help), the bed (carried upstairs), then three at once
  // (the kitchen, and something for the basement). See docs/velvet-house/scenes/tutorial.restOfTruck.md.
  chapter('tutorial.ch7b', { on: 'cond', cond: { flag: 'tutorial.lamp' } }, [
    // P1. The plant: open it and put it anywhere on this floor.
    { do: 'wait', seconds: 2 },
    { do: 'camera', focus: 'mark:entry.inside', zoom: 1.6, level: 1 },
    ...knockIn('pbox'),
    { do: 'walk', who: 'dez', to: 'mark:entry.drop' },
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.drop', id: 'box.plant', contents: 'plant' } },
    { do: 'carry', who: 'dez', carrying: null },
    say('dez', 'dez.ch7.plant'),
    ...exitLine,
    { do: 'camera', focus: 'wide' },
    { do: 'mode', mode: 'guided', allow: ['obj:box.plant'] },
    { do: 'card', title: 'You know the drill', body: 'Open the box and put the plant wherever you like on this floor, then tap **Set it down**.', spotlight: 'obj:box.plant' },
    { do: 'wait', until: { any: [{ event: 'obj.placed', match: { objId: 'box.plant' } }, { all: [{ world: { obj: 'box.plant', is: 'plant', level: 1 } }, { flag: 'did.placed.plant' }] }] } },
    { do: 'highlight', target: null },
    // B1. The bed, in a box too big for the entry: it goes upstairs with Carry to.
    { do: 'mode', mode: 'cutscene' },
    { do: 'wait', seconds: 2 },
    { do: 'camera', focus: 'mark:entry.inside', zoom: 1.6, level: 1 },
    ...knockIn('pbox'),
    { do: 'walk', who: 'dez', to: 'mark:entry.drop' },
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.drop', id: 'box.bed', contents: 'bed' } },
    { do: 'carry', who: 'dez', carrying: null },
    say('dez', 'dez.ch7.bed'),
    ...leave,
    { do: 'camera', focus: 'wide' },
    // B2. Open it, then carry it upstairs from the Arrange bar.
    { do: 'mode', mode: 'guided', allow: ['obj:box.bed'] },
    { do: 'card', title: 'The bed', body: '**Tap** the box to open it.', spotlight: 'obj:box.bed' },
    { do: 'wait', until: { any: [{ event: 'obj.unpacked', match: { objId: 'box.bed' } }, { world: { obj: 'box.bed', is: 'bed' } }] } },
    { do: 'card', title: 'Carry it upstairs', body: 'Big pieces move between floors from the Arrange bar: with the bed selected, tap **Carry to → Upstairs**.' },
    { do: 'wait', until: { world: { obj: 'box.bed', is: 'bed', level: 2 } } },
    // B3. Upstairs: the bedroom outline.
    { do: 'camera', focus: 'mark:upstairs.bed', zoom: 1.4, level: 2 },
    { do: 'outline', objType: 'bed', at: 'mark:upstairs.bed', rot: 0, color: 'player' },
    { do: 'card', title: 'Put it where it goes', body: 'Drag the bed into the outline, then tap **Set it down**.', misplaced: { who: 'maya', line: { bank: 'communication', slot: 'bedNotThere' } } },
    { do: 'wait', until: { world: { obj: 'box.bed', is: 'bed', at: 'mark:upstairs.bed', within: 0.6 } } },
    { do: 'highlight', target: null },
    // B4. A beat, then Dez calls from downstairs.
    { do: 'mode', mode: 'cutscene' },
    settle,
    { do: 'wait', seconds: 1.3 },
    { do: 'spawn', npc: 'dez', at: 'door', carrying: 'pbox' },
    { do: 'walk', who: 'dez', to: 'mark:entry.inside' },
    { do: 'camera', focus: 'dez', zoom: 1.6, level: 1 },
    say('dez', 'dez.ch7.comeDown'),
    // K1. Three boxes on the floor by the door: the fridge, the dining set, and the gym.
    { do: 'walk', who: 'dez', to: 'mark:entry.drop' },
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.drop', id: 'box.fridge', contents: 'fridge' } },
    { do: 'carry', who: 'dez', carrying: null },
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.stack1', id: 'box.table', contents: 'dining' } },
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.stack2', id: 'box.gear', contents: 'tread' } },
    say('dez', 'dez.ch7.threeBoxes'),
    ...leave,
    { do: 'camera', focus: 'wide' },
    // K2. The fridge, into the kitchen.
    { do: 'mode', mode: 'guided', allow: ['obj:box.fridge'] },
    { do: 'card', title: 'The fridge', body: '**Tap** the box to open it.', spotlight: 'obj:box.fridge' },
    { do: 'wait', until: { any: [{ event: 'obj.unpacked', match: { objId: 'box.fridge' } }, { world: { obj: 'box.fridge', is: 'fridge' } }] } },
    { do: 'outline', objType: 'fridge', at: 'mark:kitchen.fridge', rot: 0, color: 'player' },
    { do: 'card', title: 'Into the kitchen', body: 'Drag the fridge into the outline, then tap **Set it down**.', misplaced: { who: 'maya', line: { bank: 'communication', slot: 'fridgeNotThere' } } },
    { do: 'wait', until: { world: { obj: 'box.fridge', is: 'fridge', at: 'mark:kitchen.fridge', within: 0.6 } } },
    // K3. The dining set.
    { do: 'mode', mode: 'guided', allow: ['obj:box.table'] },
    { do: 'card', title: 'The table', body: '**Tap** the box to open it.', spotlight: 'obj:box.table' },
    { do: 'wait', until: { any: [{ event: 'obj.unpacked', match: { objId: 'box.table' } }, { world: { obj: 'box.table', is: 'dining' } }] } },
    { do: 'outline', objType: 'dining', at: 'mark:kitchen.table', rot: 1, color: 'player' },
    { do: 'card', title: 'Somewhere to eat', body: 'Drag the table into the outline. Turn it with **Rotate** if it needs it, then tap **Set it down**.', misplaced: { who: 'maya', line: { bank: 'communication', slot: 'tableNotThere' } } },
    { do: 'wait', until: { world: { obj: 'box.table', is: 'dining', at: 'mark:kitchen.table', within: 0.6 } } },
    // K4. The treadmill goes down to the basement.
    { do: 'mode', mode: 'guided', allow: ['obj:box.gear'] },
    { do: 'card', title: 'For downstairs', body: '**Tap** the box to open it.', spotlight: 'obj:box.gear' },
    { do: 'wait', until: { any: [{ event: 'obj.unpacked', match: { objId: 'box.gear' } }, { world: { obj: 'box.gear', is: 'tread' } }] } },
    { do: 'card', title: 'Carry it down', body: 'With the treadmill selected, tap **Carry to → Basement** in the Arrange bar.' },
    { do: 'wait', until: { world: { obj: 'box.gear', is: 'tread', level: 0 } } },
    { do: 'camera', focus: 'mark:basement.gear', zoom: 1.4, level: 0 },
    { do: 'outline', objType: 'tread', at: 'mark:basement.gear', rot: 0, color: 'player' },
    { do: 'card', title: 'The gym', body: 'Drag it into the outline, then tap **Set it down**.', misplaced: { who: 'maya', line: { bank: 'communication', slot: 'gearNotThere' } } },
    { do: 'wait', until: { world: { obj: 'box.gear', is: 'tread', at: 'mark:basement.gear', within: 0.6 } } },
    { do: 'highlight', target: null },
    { do: 'camera', focus: 'wide', level: 1 },
    { do: 'mode', mode: 'beat' },
    { do: 'set', flag: 'tutorial.truck', value: true },
  ], { mode: 'cutscene', needs: { hold: ['jordan', 'maya'] } }),
  // 8. Dez's card: the store.
  chapter('tutorial.ch8', { on: 'cond', cond: { flag: 'tutorial.truck' } }, [
    { do: 'wait', seconds: 2 },
    ...knockIn(),
    say('dez', 'dez.ch8.card'),
    say('dez', 'dez.ch8.store'),
    { do: 'card', title: 'The shop', body: 'Everything in the shop is delivered by Dez. Orders take a little while to arrive, so plan ahead.', spotlight: 'tab:shop' },
    { do: 'wait', until: { any: [{ flag: 'did.tab.shop' }, { event: 'tab.opened', match: { tab: 'shop' } }] } },
    say('dez', 'dez.ch8.groceries'),
    ...exitLine,
    { do: 'highlight', target: null },
    { do: 'set', flag: 'tutorial.shop', value: true },
  ]),
  // 9. Echo fridge: order groceries, wait for Dez, they get put away.
  chapter('tutorial.ch9', { on: 'cond', cond: { flag: 'tutorial.shop' } }, [
    // The fridge is in, and empty: a beat, she looks at it, then the idea.
    settle,
    { do: 'face', who: 'maya', toward: 'obj:box.fridge' },
    { do: 'wait', seconds: 1.3 },
    { do: 'say', who: 'maya', line: { bank: 'humor', slot: 'fridgeEmpty' } },
    { do: 'card', title: 'Order groceries', body: 'Open Household and order groceries. Time keeps moving while you wait: use the speed button to skip ahead.', spotlight: 'tab:home' },
    { do: 'wait', until: { any: [{ flag: 'did.groceries.ordered' }, { event: 'groceries.ordered' }] } },
    { do: 'highlight', target: null },
    { do: 'card', title: 'Dupree Delivers', body: 'Dez brings the groceries in a bag. When it is at the door, **tap** it to open it, then in Arrange drag the food onto the fridge: it goes right in.' },
    { do: 'wait', until: { any: [{ flag: 'did.groceries.putaway' }, { event: 'groceries.putaway' }] } },
    { do: 'set', flag: 'tutorial.groceries', value: true },
  ]),
  // 10. First meal: needs, the stove and the sink.
  chapter('tutorial.ch10', { on: 'cond', cond: { flag: 'tutorial.groceries' } }, [
    { do: 'card', title: 'Needs', body: 'You and your partner both get hungry, tired and bored. Keep an eye on the bars under their names.', spotlight: 'needs' },
    say('maya', 'maya.ch10.cook'),
    { do: 'card', title: 'Cook something', body: 'Tap the kitchen counter and choose Cook, or open Orders and pick Cook a meal.', spotlight: 'objType:counter' },
    { do: 'wait', until: { any: [{ flag: 'did.meal.cooked' }, { event: 'meal.cooked' }] } },
    say('maya', 'maya.ch10.dishes'),
    { do: 'card', title: 'Wash up', body: 'Tap the counter again and choose Wash dishes, or open Orders and pick Clean up.' },
    { do: 'wait', until: { any: [{ flag: 'did.dishes.washed' }, { event: 'dishes.washed' }] } },
    { do: 'highlight', target: null },
    { do: 'set', flag: 'tutorial.dishes', value: true },
  ]),
  // 11. Sit down with me: the first chat, opened with a line about the couch.
  chapter('tutorial.ch11', { on: 'cond', cond: { flag: 'tutorial.dishes' } }, [
    { do: 'walk', who: 'maya', to: 'mark:living.center', wait: false },
    { do: 'emote', who: 'maya', emote: 'alert' },
    { do: 'deliver', category: 'chatLine', id: 'maya.ch11.kept' },
    { do: 'card', title: 'Talk to your partner', body: 'Tap your partner to talk. You can say anything, not just things about the house. They remember what you tell them.' },
    { do: 'wait', until: { any: [{ flag: 'did.chat.closed' }, { event: 'chat.closed' }] } },
    { do: 'set', flag: 'tutorial.talked', value: true },
  ]),
  // 12. Primer white: paint and the partner's taste, with Dez in his hard hat.
  chapter('tutorial.ch12', { on: 'cond', cond: { flag: 'tutorial.talked' } }, [
    say('maya', 'maya.ch12.walls'),
    ...knockIn('paint'),
    { do: 'carry', who: 'dez', carrying: null },
    say('dez', 'dez.ch12.1'),
    say('dez', 'dez.ch12.2'),
    ...exitLine,
    { do: 'card', title: 'Make one room yours', body: 'Open the Shop and pick a paint, a wallpaper or a floor. Your partner has their own taste, so watch what they love, or ask them.', spotlight: 'tab:shop' },
    { do: 'wait', until: { any: [{ flag: 'did.room.styled' }, { event: 'room.styled' }] } },
    { do: 'if', cond: { event: 'room.styled', match: { liked: true } }, then: [say('maya', 'maya.ch12.likes')], else: [say('maya', 'maya.ch12.hides')] },
    { do: 'highlight', target: null },
    { do: 'set', flag: 'tutorial.room', value: true },
  ]),
  // 13. Upstairs: floors and the camera.
  chapter('tutorial.ch13', { on: 'cond', cond: { flag: 'tutorial.room' } }, [
    { do: 'walk', who: 'maya', to: 'mark:upstairs.bedroom', wait: false },
    say('maya', 'maya.ch13.call'),
    { do: 'card', title: 'Floors and the camera', body: 'Switch floors here, and turn the camera to see around corners.', spotlight: 'floorbar' },
    { do: 'highlight', target: 'camera' },
    { do: 'wait', until: { any: [{ flag: 'did.level.2' }, { event: 'level.visited', match: { level: 2 } }] } },
    say('maya', 'maya.ch13.bed'),
    { do: 'highlight', target: null },
    { do: 'set', flag: 'tutorial.upstairs', value: true },
  ]),
  // 14. Rent's due Monday: the mayor, with a clipboard, in the late afternoon.
  chapter('tutorial.ch14', { on: 'cond', cond: { all: [{ flag: 'tutorial.upstairs' }, { time: { after: 15 * 60 } }] } }, [
    ...knockIn(),
    say('dez', 'dez.ch14.1'),
    say('dez', 'dez.ch14.2'),
    say('maya', 'maya.ch14.power'),
    say('dez', 'dez.ch14.3'),
    { do: 'card', title: 'Money and bills', body: 'Your pay comes in and the bills go out. Pay them on time and the lights stay on.', spotlight: 'wallet' },
    ...exitLine,
    { do: 'set', flag: 'tutorial.rent', value: true },
  ]),
  // 15. Get 'er done: the welcome check, a life goal, and free will.
  chapter('tutorial.ch15', { on: 'cond', cond: { all: [{ flag: 'tutorial.rent' }, { flag: 'tutorial.room' }, { flag: 'tutorial.talked' }, { flag: 'tutorial.groceries' }] } }, [
    ...knockIn(),
    say('dez', 'dez.ch15.1'),
    say('dez', 'dez.ch15.2'),
    { do: 'give', money: 100 },
    say('dez', 'dez.ch15.3'),
    ...exitLine,
    say('maya', 'maya.ch15.kept'),
    { do: 'mode', mode: 'guided' },
    {
      do: 'choice',
      options: [
        { label: 'Career climber', default: true, steps: [{ do: 'deliver', category: 'lifeGoal', id: 'career' }] },
        { label: 'Hopeless romantic', steps: [{ do: 'deliver', category: 'lifeGoal', id: 'romance' }] },
        { label: 'Homebody', steps: [{ do: 'deliver', category: 'lifeGoal', id: 'homebody' }] },
        { label: 'Green thumb', steps: [{ do: 'deliver', category: 'lifeGoal', id: 'green' }] },
      ],
    },
    { do: 'mode', mode: 'beat' },
    { do: 'deliver', category: 'settle' },
    { do: 'unlock', what: 'freeWill' },
    { do: 'card', title: 'The tutorial is over', body: 'You and your partner will now take care of yourselves when you are not giving orders. Make it yours.' },
    { do: 'set', flag: 'tutorial.done', value: true },
  ]),
];

export const SCRIPTS: ScriptDef[] = [OPENING, DEZ_DELIVERY, ...TUTORIAL];

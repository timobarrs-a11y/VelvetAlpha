import type { ScriptDef, Step } from '../script/types';

/**
 * The story, as data: the Dez opening, every delivery, and the rest of the first day (chapters 7 to 15 of
 * docs/velvet-house/opening-sequence.md). Each chapter starts when the one before it is done and plays while the game
 * runs; the opening is a cutscene. See script/types.ts for what each step does.
 */
const say = (who: string, line: string): Step => ({ do: 'say', who, line });
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
  skippable: true,
  steps: [
    { do: 'intro', kind: 'arrival' },
    { do: 'clock', day: 1, minutes: 9 * 60 },
    { do: 'camera', focus: 'wide', level: 1 },
    { do: 'place', who: 'jordan', at: 'mark:living.center' },
    { do: 'place', who: 'maya', at: 'mark:living.window', face: 'jordan' },
    // 1. Arrival: they walk in together behind Dez, who has already driven off the road once today
    { do: 'place', who: 'jordan', at: 'door' },
    { do: 'place', who: 'maya', at: 'door' },
    { do: 'spawn', npc: 'dez', at: 'door' },
    { do: 'walk', who: 'jordan', to: 'mark:entry.you', wait: false },
    { do: 'walk', who: 'maya', to: 'mark:entry.partner', wait: false },
    { do: 'walk', who: 'dez', to: 'mark:entry.inside' },
    { do: 'camera', focus: 'dez', zoom: 1.8 },
    say('dez', 'dez.welcome'),
    { do: 'camera', focus: 'wide' },
    { do: 'emote', who: 'maya', emote: 'alert' },
    { do: 'say', who: 'maya', line: { bank: 'humor', slot: 'truckOffRoad' } },
    { do: 'camera', focus: 'dez', zoom: 1.8 },
    say('dez', 'dez.brushOff'),
    say('dez', 'dez.intro.2'), say('dez', 'dez.intro.3'), say('dez', 'dez.intro.4'),
    { do: 'camera', focus: 'wide' },
    ...leave,
    { do: 'wait', seconds: 1 },
    ...knockIn('pbox'),
    { do: 'walk', who: 'dez', to: 'mark:entry.drop' },
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.drop', id: 'box.couch', contents: 'sofa' } },
    { do: 'carry', who: 'dez', carrying: null },
    ...leave,
    { do: 'emote', who: 'maya', emote: 'alert' },
    { do: 'say', who: 'maya', line: { bank: 'humor', slot: 'couchCarried' } },
    { do: 'checkpoint' },
    // 3. Touch: only the box can be tapped
    { do: 'mode', mode: 'guided', allow: ['obj:box.couch'] },
    { do: 'card', title: 'Tap anything', body: 'Tap anything in your home to see what you can do with it.', spotlight: 'obj:box.couch' },
    { do: 'wait', until: { event: 'obj.unpacked', match: { objId: 'box.couch' } } },
    // 4. Placement
    { do: 'say', who: 'maya', line: { bank: 'communication', slot: 'couchPlace' } },
    { do: 'outline', objType: 'sofa', at: 'mark:living.couchTv', rot: 2, color: 'player' },
    { do: 'card', title: 'Put it where it goes', body: 'Drag to move · ↻ to turn it. Tap Set it down when it is just right.', button: 'Set it down' },
    { do: 'outline', objType: 'sofa', at: 'mark:living.couchTv', rot: 2 },
    { do: 'checkpoint' },
    // 5. The ask
    { do: 'mode', mode: 'cutscene' },
    { do: 'act', who: 'maya', act: 'tv', wait: false },
    { do: 'wait', seconds: 2.5 },
    { do: 'say', who: 'maya', line: { bank: 'communication', slot: 'windowAsk' } },
    // 6. The first choice
    {
      do: 'choice',
      options: [
        { label: 'Keep it by the TV', default: true, set: { couch: 'mine' }, steps: [{ do: 'say', who: 'maya', line: { bank: 'humor', slot: 'keepIt' } }] },
        {
          label: 'Move it to the window', set: { couch: 'theirs' },
          steps: [
            { do: 'mode', mode: 'guided', allow: ['objType:sofa'] },
            { do: 'outline', objType: 'sofa', at: 'mark:living.couchWindow', rot: 0, color: 'partner' },
            { do: 'card', title: 'By the window', body: 'Drag the couch into the pink outline. Tap Set it down when it is there.', button: 'Set it down' },
            { do: 'mode', mode: 'cutscene' },
            { do: 'say', who: 'maya', line: { bank: 'humor', slot: 'movedIt' } },
          ],
        },
      ],
    },
    { do: 'set', flag: 'opening.done', value: true },
    { do: 'set', flag: 'dez.deliveries', value: true },
  ],
  onSkip: [
    { do: 'clock', day: 1, minutes: 9 * 60 + 20 },
    { do: 'despawn', npc: 'dez' },
    { do: 'give', object: { type: 'sofa', at: 'mark:living.couchTv', id: 'sofa' } },
    { do: 'set', flag: 'couch', value: 'mine' },
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

const chapter = (id: string, cond: ScriptDef['trigger'], steps: Step[]): ScriptDef => ({ id, trigger: cond, mode: 'beat', priority: 1, steps });

export const TUTORIAL: ScriptDef[] = [
  // 7. The rest of the truck: the player unpacks alone, and Maya unpacks one on her own.
  chapter('tutorial.ch7', { on: 'cond', cond: { flag: 'opening.done' } }, [
    { do: 'wait', seconds: 2 },
    ...knockIn('pbox'),
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.drop', id: 'box.lamp', contents: 'lamp' } },
    { do: 'carry', who: 'dez', carrying: null },
    say('dez', 'dez.ch7.lamp'),
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.stack1', id: 'box.plant', contents: 'plant' } },
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.stack2', id: 'box.plant2', contents: 'plant' } },
    say('dez', 'dez.ch7.stack'),
    ...exitLine,
    { do: 'act', who: 'maya', act: 'unpack', wait: true },
    { do: 'deliver', category: 'mayaUnpack' },
    say('maya', 'maya.ch7.unpacked'),
    { do: 'wait', until: { any: [{ flag: 'did.placed.lamp' }, { event: 'obj.placed', match: { objType: 'lamp' } }] } },
    { do: 'set', flag: 'tutorial.lamp', value: true },
  ]),
  // 8. Dez's card: the store.
  chapter('tutorial.ch8', { on: 'cond', cond: { flag: 'tutorial.lamp' } }, [
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
    say('maya', 'maya.ch9.fridge'),
    { do: 'card', title: 'Order groceries', body: 'Open Household and order groceries. Time keeps moving while you wait: use the speed button to skip ahead.', spotlight: 'tab:home' },
    { do: 'wait', until: { any: [{ flag: 'did.groceries.ordered' }, { event: 'groceries.ordered' }] } },
    { do: 'highlight', target: null },
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
    { do: 'if', cond: { flag: 'couch', equals: 'theirs' }, then: [{ do: 'deliver', category: 'chatLine', id: 'maya.ch11.moved' }], else: [{ do: 'deliver', category: 'chatLine', id: 'maya.ch11.kept' }] },
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
    { do: 'if', cond: { flag: 'couch', equals: 'theirs' }, then: [say('maya', 'maya.ch12.handOver')] },
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
    { do: 'if', cond: { flag: 'couch', equals: 'theirs' }, then: [say('maya', 'maya.ch15.moved')], else: [say('maya', 'maya.ch15.kept')] },
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

import { DOOR } from '../state/house';

/**
 * Named places in the house a script can send people to. Everything is on the main floor (level 1): the front door is on
 * the left wall of the entry, and the entry opens into the living room.
 */
export interface Spot { level: number; x: number; y: number }

export const MARKS: Record<string, Spot> = {
  // The front door: just outside it, and just inside.
  door: { level: 1, x: 0.5, y: DOOR[1] },
  'entry.inside': { level: 1, x: 1.7, y: 5.3 },
  // Where a delivery is set down, and the stack of boxes that waits by the door.
  // The gap in the wall between the entry and the kitchen: in plain view with the walls down.
  // Where the player and their partner stand while Dez shows them in.
  'entry.you': { level: 1, x: 2.6, y: 5.4 },
  'entry.partner': { level: 1, x: 2.2, y: 6.5 },
  'entry.drop': { level: 1, x: 2.3, y: 4.1 },
  'entry.stack1': { level: 1, x: 3.7, y: 6.3 },
  'entry.stack2': { level: 1, x: 4.4, y: 5.9 },
  'entry.stack3': { level: 1, x: 3.2, y: 6.9 },
  'living.center': { level: 1, x: 7.0, y: 4.6 },
  'living.window': { level: 1, x: 8.2, y: 1.2 },
  'living.tvWall': { level: 1, x: 5.6, y: 3.3 },
  // The two spots the couch can go: against the wall facing the TV, or by the window.
  'living.couchTv': { level: 1, x: 5.6, y: 3.3 },
  // Out of the way in the far front corner of the living room, where Maya first asks for the lamp.
  'living.lampCorner': { level: 1, x: 9.3, y: 7.2 },
  // On the right-hand side of the couch as you look at the room (the far end of its length).
  'living.lamp': { level: 1, x: 8.15, y: 3.5 },
  'kitchen.stove': { level: 1, x: 1.2, y: 1.2 },
  'upstairs.bedroom': { level: 2, x: 3.0, y: 2.2 },
};

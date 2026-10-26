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
  'entry.drop': { level: 1, x: 1.5, y: 6.1 },
  'entry.stack1': { level: 1, x: 0.55, y: 6.5 },
  'entry.stack2': { level: 1, x: 0.55, y: 7.1 },
  'entry.stack3': { level: 1, x: 1.2, y: 7.3 },
  'living.center': { level: 1, x: 7.0, y: 4.6 },
  'living.window': { level: 1, x: 8.2, y: 1.2 },
  'living.tvWall': { level: 1, x: 5.6, y: 3.3 },
  // The two spots the couch can go: against the wall facing the TV, or by the window.
  'living.couchTv': { level: 1, x: 5.6, y: 3.3 },
  'living.couchWindow': { level: 1, x: 7.0, y: 6.8 },
  'living.lamp': { level: 1, x: 5.1, y: 3.4 },
  'kitchen.stove': { level: 1, x: 1.2, y: 1.2 },
  'upstairs.bedroom': { level: 2, x: 3.0, y: 2.2 },
};

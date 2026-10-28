/* eslint-disable @typescript-eslint/no-unused-vars */

export type NeedKey = 'energy' | 'food' | 'hygiene' | 'fun' | 'comfort' | 'social';

export interface ActivityGives {
  energy?: number;
  food?: number;
  hygiene?: number;
  fun?: number;
  comfort?: number;
  social?: number;
}

export interface ActivityRate {
  energy?: number;
  food?: number;
  hygiene?: number;
  fun?: number;
  comfort?: number;
  social?: number;
}

export interface ActivityMeta {
  gives?: ActivityGives;
  rate?: ActivityRate;
  dur: number;
  pose: string;
  verb: string;
  level?: number;
  store?: boolean;
  fixed?: boolean;
  rug?: boolean;
  wall?: boolean;
  // How much someone just likes doing this, whatever their needs. Gives a
  // content character something to do instead of standing around, the way
  // a Sim with full needs still potters, tidies and plays.
  appeal?: number;
  // Done anywhere free on its level (`level`), not at an object.
  open?: boolean;
}

export const ACTIVITIES: Record<string, ActivityMeta> = {
  sleep: { pose: 'sleep', dur: Infinity, rate: { energy: 0.22, comfort: 0.05 }, verb: 'Sleeping' },
  nap: { pose: 'sleep', dur: 90, gives: { energy: 30, comfort: 10 }, verb: 'Napping' },
  cook: { pose: 'cook', dur: 25, gives: {}, verb: 'Cooking' },
  eat: { pose: 'eat', dur: 25, gives: { food: 72, energy: 6 }, verb: 'Eating' },
  coffee: { pose: 'cook', dur: 10, gives: {}, verb: 'Making coffee' },
  sip: { pose: 'sip', dur: 30, gives: { energy: 15, social: 10, fun: 5 }, verb: 'Having coffee' },
  shower: { pose: 'shower', dur: 20, gives: { hygiene: 95 }, verb: 'Showering' },
  read: { pose: 'read', dur: 40, gives: { fun: 35, comfort: 30 }, verb: 'Reading' },
  phone: { pose: 'phone', dur: 30, gives: { fun: 25, social: 15 }, verb: 'On her phone' },
  tv: { pose: 'tv', dur: 50, gives: { fun: 45, comfort: 25 }, verb: 'Watching TV', level: 1 },
  workout: { pose: 'run', dur: 25, gives: { fun: 15, energy: -12, hygiene: -25 }, verb: 'Running' },
  lift: { pose: 'lift', dur: 15, gives: { energy: -6, hygiene: -10, fun: 5 }, verb: 'Lifting weights' },
  stretch: { pose: 'stretch', dur: 15, gives: { comfort: 20, energy: 5 }, verb: 'stretching on the mat' },
  lightsOn: { pose: 'switch', dur: 2, gives: {}, verb: 'Hitting the lights' },
  lightsOff: { pose: 'switch', dur: 2, gives: {}, verb: 'Turning the lights back' },
  dance: { pose: 'dance', dur: 25, gives: { fun: 50, energy: -8 }, verb: 'Dancing' },
  danceTogether: { pose: 'dance', dur: 30, gives: { fun: 45, social: 30 }, verb: 'Dancing with Maya' },
  clean: { pose: 'reach', dur: 3, gives: {}, verb: 'Clearing the table' },
  wash: { pose: 'cook', dur: 15, gives: { comfort: 10 }, verb: 'Doing the dishes' },
  grabBox: { pose: 'reach', dur: 2, gives: {}, verb: 'Picking up the groceries' },
  stock: { pose: 'reach', dur: 6, gives: {}, verb: 'Putting groceries away' },
  grabBag: { pose: 'reach', dur: 2, gives: {}, verb: 'Grabbing the takeout' },
  eatOut: { pose: 'eatOut', dur: 20, gives: { food: 70, energy: 4 }, verb: 'Eating takeout' },
  records: { pose: 'listen', dur: 30, gives: { fun: 35, comfort: 10 }, verb: 'Playing records' },
  arcade: { pose: 'arcade', dur: 30, gives: { fun: 50, energy: -3 }, verb: 'Playing arcade' },
  claw: { pose: 'arcade', dur: 10, gives: { fun: 30, energy: -1 }, verb: 'Working the claw machine' },
  pinball: { pose: 'arcade', dur: 15, gives: { fun: 40, energy: -2 }, verb: 'Playing pinball' },
  swing: { pose: 'tv', dur: 15, gives: { fun: 30, comfort: 15 }, verb: 'Swinging under the cloud' },
  vr: { pose: 'tv', dur: 25, gives: { fun: 45, energy: -4 }, verb: 'In VR' },
  fortune: { pose: 'arcade', dur: 8, gives: { fun: 25, comfort: 10 }, verb: 'Asking the fortune teller' },
  gumball: { pose: 'reach', dur: 4, gives: { fun: 15, food: 5 }, verb: 'Getting a gumball' },
  tiki: { pose: 'cook', dur: 12, gives: { fun: 30, comfort: 10, food: 10 }, verb: 'Mixing a drink at the tiki bar' },
  plants: { pose: 'water', dur: 15, gives: { fun: 15, comfort: 5 }, verb: 'Watering the plants' },
  window: { pose: 'stand', dur: 10, gives: { comfort: 10 }, verb: 'Looking out the window' },
  freelance: { pose: 'desk', dur: 90, gives: { fun: 10 }, verb: 'Freelancing' },
  // Side jobs (sideJobs.ts): until the job's done or the player stops; main.ts ends them.
  sideDesk: { pose: 'desk', dur: Infinity, gives: {}, verb: 'Working on a side job' },
  sideBake: { pose: 'cook', dur: Infinity, gives: {}, verb: 'Baking for the café' },
  errand: { pose: 'stand', dur: Infinity, gives: {}, verb: 'Heading out' },
  hangout: { pose: 'stand', dur: 25, gives: { social: 45, fun: 10 }, verb: 'Catching up with Maya' },
  chat: { pose: 'stand', dur: Infinity, gives: {}, verb: 'Talking with Maya' },
  approach: { pose: 'stand', dur: 60, gives: {}, verb: 'Waiting to tell you something' },
  wander: { pose: 'stand', dur: 8, gives: {}, verb: 'Taking a breather' },
  scrub: { pose: 'mop', dur: 7, gives: { comfort: 5 }, verb: 'Scrubbing' },
  feedPet: { pose: 'reach', dur: 3, gives: { comfort: 4 }, verb: 'Filling the pet bowl' },
  petPet: { pose: 'pet', dur: 6, gives: { comfort: 14, social: 8, fun: 6 }, verb: 'Petting' },
  playPet: { pose: 'play', dur: 15, gives: { fun: 40, social: 6, energy: -3 }, verb: 'Playing with the pet' },
  walkDog: { pose: 'stand', dur: 1, gives: {}, verb: 'Walking the dog' },
  unpack: { pose: 'reach', dur: 6, gives: { comfort: 4 }, verb: 'Unpacking a box' },
  mow: { pose: 'mow', dur: Infinity, gives: { energy: -8, comfort: 6 }, verb: 'Mowing the lawn' },
  sprinkle: { pose: 'reach', dur: 2, gives: {}, verb: 'Turning on the sprinkler' },
  weed: { pose: 'pet', dur: 3, gives: { comfort: 3 }, verb: 'Pulling weeds' },
  rake: { pose: 'mop', dur: 4, gives: { fun: 3 }, verb: 'Raking leaves' },
  snowman: { pose: 'reach', dur: 25, gives: { fun: 40, social: 15 }, verb: 'Building a snowman' },
  snowmanHelp: { pose: 'reach', dur: Infinity, gives: { fun: 30 }, verb: 'Building a snowman' },
  tend: { pose: 'water', dur: 8, gives: { comfort: 10, fun: 12 }, verb: 'Tending the garden' },
  movie: { pose: 'tv', dur: Infinity, gives: { fun: 45, comfort: 25 }, verb: 'Watching a video' },
  fire: { pose: 'stand', dur: 30, gives: { comfort: 45, fun: 10 }, verb: 'Warming up by the fire' },
  fireJoin: { pose: 'stand', dur: Infinity, gives: { comfort: 40, social: 20 }, verb: 'By the fire' },
  bath: { pose: 'shower', dur: 35, gives: { hygiene: 100, comfort: 40 }, verb: 'Taking a bath' },
  mixDrinks: { pose: 'cook', dur: 15, gives: { fun: 25, social: 10 }, verb: 'Mixing drinks' },
  swim: { pose: 'swim', dur: 30, gives: { fun: 50, hygiene: 15, energy: -8 }, verb: 'Swimming' },
  gSit: { pose: 'sip', dur: 25, gives: {}, verb: 'Hanging out' },
  gChat: { pose: 'stand', dur: 18, gives: {}, verb: 'Chatting' },
  gDance: { pose: 'dance', dur: 20, gives: {}, verb: 'Dancing' },
  gLeave: { pose: 'stand', dur: 1, gives: {}, verb: 'Leaving' },
  laundry: { pose: 'reach', dur: 10, gives: { comfort: 15, hygiene: 8 }, verb: 'Doing laundry' },
  rummage: { pose: 'reach', dur: 20, gives: { fun: 20, comfort: 10 }, verb: 'Going through old boxes' },
  moveObj: { pose: 'reach', dur: 4, gives: {}, verb: 'Moving furniture' },
  paintWalls: { pose: 'roll', dur: 40, gives: { fun: 10 }, verb: 'Painting the walls' },
  piano: { pose: 'desk', dur: 30, gives: { fun: 40, comfort: 10 }, verb: 'Playing piano' },
  easel: { pose: 'wipe', dur: 40, gives: { fun: 40, comfort: 10 }, verb: 'Painting' },
  aquarium: { pose: 'stand', dur: 15, gives: { comfort: 30, fun: 10 }, verb: 'Watching the fish' },
  stargaze: { pose: 'arcade', dur: 25, gives: { fun: 35, comfort: 15 }, verb: 'Stargazing' },
  boxing: { pose: 'arcade', dur: 15, gives: { fun: 15, energy: -8, hygiene: -15 }, verb: 'Hitting the heavy bag' },
  bike: { pose: 'desk', dur: 25, gives: { fun: 15, energy: -10, hygiene: -20 }, verb: 'Riding the bike' },
  massage: { pose: 'tv', dur: 30, gives: { comfort: 60, energy: 8 }, verb: 'In the massage chair' },
  hammock: { pose: 'sleep', dur: 45, gives: { energy: 20, comfort: 35 }, verb: 'Swinging in the hammock' },
  grill: { pose: 'cook', dur: 25, gives: { food: 60, fun: 15 }, verb: 'Grilling' },
  birds: { pose: 'stand', dur: 12, gives: { comfort: 20, fun: 8 }, verb: 'Watching the birds' },
  jukebox: { pose: 'dance', dur: 20, gives: { fun: 45, energy: -4 }, verb: 'Dancing to the jukebox' },
  guitar: { pose: 'listen', dur: 25, gives: { fun: 35 }, verb: 'Playing guitar' },
  scoop: { pose: 'reach', dur: 5, gives: {}, verb: 'Scooping the litter box' },

  // ---- Everyday life around the house: things to do when nothing's urgent ----
  // Yard
  newspaper: { pose: 'read', dur: 30, gives: { comfort: 20, fun: 15 }, verb: 'Reading the paper on the bench', level: 3, appeal: 6 },
  rakeYard: { pose: 'mop', dur: 20, gives: { comfort: 10, fun: 4 }, verb: 'Raking the yard', level: 3, open: true, appeal: 3 },
  yardWorkout: { pose: 'jacks', dur: 15, gives: { fun: 12, energy: -8, hygiene: -12 }, verb: 'Doing jumping jacks in the yard', level: 3, open: true, appeal: 3 },
  phonePace: { pose: 'phone', dur: 20, gives: { social: 22, fun: 8 }, verb: 'Pacing the yard on a call', level: 3, open: true, appeal: 4 },
  // Main floor
  snack: { pose: 'snack', dur: 8, gives: { food: 22, fun: 5 }, verb: 'Grabbing a snack', appeal: 2 },
  wipeCounter: { pose: 'wipe', dur: 12, gives: { comfort: 12 }, verb: 'Wiping down the counters', appeal: 4 },
  soloDance: { pose: 'dance', dur: 20, gives: { fun: 35, energy: -5 }, verb: 'Dancing around the living room', level: 1, open: true, appeal: 3 },
  // Upstairs
  journal: { pose: 'desk', dur: 25, gives: { comfort: 15, fun: 15 }, verb: 'Writing in a journal', appeal: 5 },
  mirror: { pose: 'stand', dur: 10, gives: { hygiene: 10, comfort: 10 }, verb: 'Getting ready at the mirror', appeal: 4 },
  foldClothes: { pose: 'reach', dur: 12, gives: { comfort: 12 }, verb: 'Folding clothes', appeal: 4 },
  makeBed: { pose: 'reach', dur: 8, gives: { comfort: 15 }, verb: 'Making the bed', appeal: 4 },
  meditate: { pose: 'meditate', dur: 20, gives: { comfort: 30, energy: 5 }, verb: 'Meditating', level: 2, open: true, appeal: 4 },
  // Basement
  jumprope: { pose: 'jumprope', dur: 12, gives: { fun: 15, energy: -8, hygiene: -12 }, verb: 'Skipping rope', level: 0, open: true, appeal: 3 },
  shadowbox: { pose: 'arcade', dur: 12, gives: { fun: 15, energy: -6, hygiene: -10 }, verb: 'Shadowboxing', level: 0, open: true, appeal: 3 },
};

// Everyday activities that already existed, now also chosen on their own.
for (const [act, appeal] of Object.entries({ tend: 6, window: 4, freelance: 3, laundry: 4, rummage: 3, lift: 3, plants: 3 })) {
  ACTIVITIES[act] = { ...ACTIVITIES[act], appeal };
}

export const CHAINS: Record<string, string[]> = {
  cookeat: ['cook', 'eat'],
  coffee: ['coffee', 'sip'],
  workout: ['workout', 'lift'],
  dance: ['lightsOn', 'dance', 'lightsOff'],
  danceTogether: ['lightsOn', 'danceTogether', 'lightsOff'],
  clean: ['clean', 'wash'],
  putaway: ['grabBox', 'stock'],
  takeout: ['grabBag', 'eatOut'],
};

export const GAIN_OF: Record<string, string> = {
  cookeat: 'eat',
  coffee: 'sip',
  workout: 'workout',
  dance: 'dance',
  danceTogether: 'danceTogether',
  clean: 'wash',
  takeout: 'eatOut',
};

export interface ErrandMeta {
  label: string;
  cost?: number;
  baseDur: number;
  durVar: number;
}

export const ERRANDS: Record<string, ErrandMeta> = {
  work: { label: 'At work', baseDur: 0, durVar: 0 },
  market: { label: 'At the market', baseDur: 55, durVar: 25 },
  shop: { label: 'At the store', baseDur: 35, durVar: 20 },
  dogwalk: { label: 'Walking the dog', baseDur: 30, durVar: 20 },
  friends: { label: 'Out with friends', baseDur: 150, durVar: 60, cost: 20 },
};

export function chainOf(name: string): string[] {
  return CHAINS[name] || [name];
}

export function activityGives(actName: string): ActivityGives {
  const a = ACTIVITIES[actName];
  return a?.gives || {};
}

export function activityDur(actName: string): number {
  const a = ACTIVITIES[actName];
  return a?.dur ?? 30;
}

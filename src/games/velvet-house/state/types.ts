/**
 * Core type definitions for Velvet House game state.
 * These mirror the v1 snapshot() output and extend to v2.
 */

export type Pronoun = 'she' | 'he' | 'they';
export type Gender = 'male' | 'female';

export interface Vec2 {
  x: number;
  y: number;
}

export interface CharacterLook {
  skin: string;
  hair: string;
  hairColor: string;
  top: string;
  eyeColor: string;
  facialHair: string;
  glasses: string;
  gender: Gender;
  paper?: string | null;
}

export interface CharacterNeeds {
  hunger: number;
  energy: number;
  fun: number;
  social: number;
  hygiene: number;
  bladder: number;
}

export interface CharacterSkills {
  cooking: number;
  fitness: number;
  logic: number;
  creativity: number;
  charisma: number;
}

export interface CharacterMood {
  happy: number;
  sad: number;
  angry: number;
  tired: number;
  playful: number;
  affectionate: number;
}

export interface WorkSchedule {
  days: number[];
  start: number;
  end: number;
  wage: number;
}

export interface Character {
  level: number;
  x: number;
  y: number;
  z: number;
  alpha: number;
  front: boolean;
  flip: number;
  route: number[][];
  state: string;
  pose: string;
  timer: number;
  idle: number;
  task: Task | null;
  queue: Task[];
  away: string | null;
  carry: string | null;
  needs: CharacterNeeds;
  skills: CharacterSkills;
  mood: CharacterMood;
  workedDay: boolean;
  friendsDay: boolean;
  sched: {
    sleep: number;
    wake: number;
    work: WorkSchedule;
  };
}

export interface Task {
  name: string;
  level?: number;
  x?: number;
  y?: number;
  target?: unknown;
  path?: number[][];
  dur?: number;
  act?: string;
  at?: string;
  join?: string;
  [key: string]: unknown;
}

export interface GameObject {
  id: string;
  type: string;
  level: number;
  x: number;
  y: number;
  rot: number;
  pet?: string | null;
  pot?: boolean;
  attach?: string | null;
  home?: string | null;
  grudge?: number;
  movedAt?: number;
  mine?: boolean;
  grow?: number;
  wet?: number;
  contains?: string | null;
  col?: string | null;
  art?: string | null;
  ripeLogged?: boolean;
}

export interface Pet {
  id: string;
  kind: string;
  name: string;
  coat: { rgb: [number, number, number] };
  level: number;
  x: number;
  y: number;
  needs: number;
  bowlFood: number;
  litterUses: number;
  litterT: number;
  seed: number;
  bowl: string | null;
  bed: string | null;
  litter: string | null;
}

export interface DirtSpot {
  id: string;
  level: number;
  x: number;
  y: number;
  amount: number;
  claim: string | null;
}

export interface YardTile {
  i: number;
  j: number;
  len: number;
  water: number;
  weed: number;
  seed: number;
  burn: number;
  mowedAt: number;
  leaves: number;
  snow: number;
}

export interface YardState {
  tiles: YardTile[];
  rainAt: number;
  rainUntil: number;
  rainCheck: number;
  rainLogged: boolean;
}

export interface ChangeRecord {
  id: string;
  at: number;
  text: string;
  undo: Record<string, unknown>;
  undone: boolean;
  seen: boolean;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompanionInfo {
  source: 'game' | 'velvet';
  preset: 'warm' | 'calm' | 'bubbly' | 'dry';
  pronoun: Pronoun;
  gender: Gender;
  bio: string;
  memories: never[];
}

export interface TasteAxes {
  natural: number;
  vintage: number;
  minimal: number;
  modern: number;
  cozy: number;
  soft: number;
  playful: number;
  bold: number;
  luxe: number;
  industrial: number;
  warm: number;
  cool: number;
}

export interface Flags {
  arranged: boolean;
  stocked: boolean;
  styled: boolean;
  talked: boolean;
  danced: boolean;
  watched: boolean;
  dinners: number;
  harvests: number;
  mowed: boolean;
  tvVideo: boolean;
  furniture: number;
  spotless: number;
  styledSet: string[];
  settleSeen: string[];
  lifeStep: number;
  unlockedSeen: string[];
  story: unknown[];
  events: unknown[];
  firstPay: boolean;
  billPaid: boolean;
  house?: string;
}

export interface CareerState {
  level: number;
  perf: number;
}

/**
 * The v1 save schema — exactly what snapshot() produces today.
 * Used for loading existing saves during migration.
 */
export interface SaveDataV1 {
  v: 1;
  basementV?: number;
  houseV?: number;
  setupDone: boolean;
  partnerName: string;
  lifeGoal: string | null;
  settleDone: boolean;
  flags: Flags;
  career: CareerState;
  mcareer: CareerState;
  pboxes: boolean;
  wallMode: string;
  yard: {
    t: [number, number, number, number, number][];
    rainAt: number;
    rainUntil: number;
    rainCheck: number;
  };
  laundryPile: number;
  savedAt: number;
  minutes: number;
  day: number;
  money: number;
  earnedToday: number;
  spentToday: number;
  power: boolean;
  fridge: Record<string, number>;
  bill: number;
  nextBillAt: number;
  owned: string[];
  LOOKS: CharacterLook[];
  ROOMLOOK: Record<string, string>[];
  WALLOBJS: unknown[];
  bond: number;
  support: number;
  together: number;
  memories: string[];
  coreMem: string[];
  pastMem: string[];
  townName: string;
  dishes: number;
  petFood: number;
  petSeq: number;
  dirtId: number;
  changeSeq: number;
  simName: string;
  autonomy: string;
  mayaCap: number;
  mayaSpent: { day: number; amt: number };
  TASTE: TasteAxes;
  style: TasteAxes;
  look: CharacterLook;
  companion: CompanionInfo;
  mayaLook: CharacterLook;
  CHANGES: ChangeRecord[];
  projectAt: number | null;
  objs: GameObject[];
  pets: Pet[];
  dirt: DirtSpot[];
  jordan: { needs: CharacterNeeds; skills: CharacterSkills; mood: CharacterMood; workedDay: boolean; friendsDay: boolean };
  maya: { needs: CharacterNeeds; skills: CharacterSkills; mood: CharacterMood; workedDay: boolean; friendsDay: boolean };
  turns: ChatTurn[];
}

/**
 * The v2 save schema — same data, typed, with a seeded RNG value stored.
 * Migration from v1 is additive: no fields removed, `rngSeed` added.
 */
export interface SaveDataV2 extends Omit<SaveDataV1, 'v'> {
  v: 2;
  rngSeed: number;
}

export type SaveData = SaveDataV1 | SaveDataV2;

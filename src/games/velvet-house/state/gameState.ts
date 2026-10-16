import type { Character, Pet, DirtSpot, YardTile, Flags, CareerState, ChatTurn, CompanionInfo } from './types';
import type { ObjectInstance } from './objects';
import type { RNG } from './rng';

export interface Wish {
  kind: string;
  until: number;
  source: string;
}

export interface Noticed {
  topic: string;
  until: number;
}

export interface Sparkle {
  level: number;
  pt: [number, number, number];
  t: number;
}

export interface ScrubLogEntry {
  level: number;
  at: number;
  who: Character;
}

export interface EventEntry {
  act: string;
  at: number;
}

export interface FridgeState {
  fresh: number;
  basic: number;
}

export interface BillState {
  amount: number;
  due: number;
  overdue: boolean;
}

export interface ParcelState {
  kind: 'groceries' | 'takeout';
  servings: number;
  fresh: boolean;
  taken: boolean;
  for?: Character;
}

export interface DeliveryState {
  kind: 'groceries' | 'takeout';
  arrive: number;
  for: Character;
  servings?: number;
  fresh?: boolean;
}

export interface GameState {
  rng: RNG;
  rngSeed: number;

  day: number;
  minutes: number;
  paused: boolean;
  speed: number;
  freeWill: boolean;
  autonomy: 'on' | 'shop' | 'off';

  jordan: Character;
  maya: Character;
  guests: Character[];

  bond: number;
  together: number;
  support: number;

  money: number;
  earnedToday: number;
  spentToday: number;
  bill: BillState | null;
  nextBillAt: number | null;
  power: boolean;
  party: boolean;

  fridge: FridgeState;
  dishes: number;
  laundryPile: number;
  petFood: number;

  parcel: ParcelState | null;
  delivery: DeliveryState | null;

  objs: ObjectInstance[];
  dirt: DirtSpot[];
  sparkles: Sparkle[];
  scrubLog: ScrubLogEntry[];
  pets: Pet[];
  yard: { tiles: YardTile[] };

  wish: Wish | null;
  noticed: Noticed | null;
  sparkClock: number;
  tvShared: number;
  tvCounted: boolean;

  memories: string[];
  coreMem: string[];
  pastMem: string[];
  events: EventEntry[];
  fired: Record<string, number>;
  warned: Record<string, boolean>;

  flags: Flags;
  mcareer: CareerState;
  chat: { open: boolean };
  chatLog: ChatTurn[];

  companion: CompanionInfo | null;
}

export function createInitialState(seed: number, jordan: Character, maya: Character): GameState {
  return {
    rng: null as unknown as RNG,
    rngSeed: seed,
    day: 0,
    minutes: 6 * 60,
    paused: false,
    speed: 1,
    freeWill: true,
    autonomy: 'on',
    jordan,
    maya,
    guests: [],
    bond: 50,
    together: 0,
    support: 0,
    money: 250,
    earnedToday: 0,
    spentToday: 0,
    bill: null,
    nextBillAt: 3 * 1440 + 9 * 60,
    power: true,
    party: false,
    fridge: { fresh: 4, basic: 8 },
    dishes: 0,
    laundryPile: 0,
    petFood: 6,
    parcel: null,
    delivery: null,
    objs: [],
    dirt: [],
    sparkles: [],
    scrubLog: [],
    pets: [],
    yard: { tiles: [] },
    wish: null,
    noticed: null,
    sparkClock: 0,
    tvShared: 0,
    tvCounted: false,
    memories: [],
    coreMem: [],
    pastMem: [],
    events: [],
    fired: {},
    warned: {},
    flags: {} as Flags,
    mcareer: { level: 0, perf: 0, studio: false, offerDay: null, offer: false } as CareerState,
    chat: { open: false },
    chatLog: [],
    companion: null,
  };
}

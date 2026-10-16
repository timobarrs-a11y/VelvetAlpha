export type WishKind = 'coffee' | 'dance' | 'tv';
export type WishSource = 'talk' | 'spark';

export interface WishDef {
  label: string;
  chain: string;
  ttl: number;
  words: string;
  memory: () => string;
}

export const WISHES: Record<WishKind, WishDef> = {
  coffee: { label: 'Make coffee for Maya', chain: 'coffee', ttl: 150, words: 'coffee', memory: () => 'You made Maya coffee when she wanted some, and they drank it together.' },
  dance: { label: 'Dance with Maya', chain: 'danceTogether', ttl: 120, words: 'to dance', memory: () => 'You hit the party lights and danced with Maya when she was in the mood.' },
  tv: { label: 'Watch TV with Maya', chain: 'tv', ttl: 150, words: 'to watch something together', memory: () => 'You curled up with Maya to watch TV when she asked.' },
};

export interface WishState {
  kind: WishKind;
  until: number;
  source: WishSource;
}

export interface WishLogMessage {
  talk: string;
  spark: Partial<Record<WishKind, string>>;
}

export const WISH_LOG: WishLogMessage = {
  talk: 'Maya mentioned she wants {words}.',
  spark: {
    coffee: 'Maya yawned and eyed the coffee maker.',
    dance: "A song Maya loves came on. She's looking right at you.",
    tv: 'Maya flopped onto the couch and patted the cushion next to her.',
  },
};

export const FULFIL_LOG: Record<WishKind, string> = {
  coffee: 'Maya loved that you remembered the coffee.',
  dance: 'Maya is still smiling from the dance.',
  tv: 'Maya fell asleep on your shoulder halfway through. Worth it.',
};

export const FULFIL_BOND = 4;
export const FULFIL_BOND_NO_WISH = 1.5;
export const WISH_EXPIRE_BOND_LOSS = 1;

export interface SetWishInput {
  kind: WishKind;
  source: WishSource;
  currentWish: WishState | null;
  absMin: number;
  mayaAround: boolean;
}

export function shouldSetWish(input: SetWishInput): boolean {
  if (!WISHES[input.kind]) return false;
  if (input.currentWish && input.currentWish.kind === input.kind) return false;
  if (!input.mayaAround) return false;
  return true;
}

export function createWish(input: SetWishInput): WishState {
  return {
    kind: input.kind,
    until: input.absMin + WISHES[input.kind].ttl,
    source: input.source,
  };
}

export function wishLogMessage(kind: WishKind, source: WishSource): string {
  if (source === 'talk') {
    return WISH_LOG.talk.replace('{words}', WISHES[kind].words);
  }
  return WISH_LOG.spark[kind] || '';
}

export interface FulfilResult {
  matchedWish: boolean;
  bondGain: number;
  supportGain: number;
  logMessage: string;
  memory: string | null;
}

export function fulfilWish(kind: WishKind, currentWish: WishState | null): FulfilResult {
  if (currentWish && currentWish.kind === kind) {
    return {
      matchedWish: true,
      bondGain: FULFIL_BOND,
      supportGain: 1,
      logMessage: FULFIL_LOG[kind],
      memory: WISHES[kind].memory(),
    };
  }
  return {
    matchedWish: false,
    bondGain: FULFIL_BOND_NO_WISH,
    supportGain: 1,
    logMessage: '',
    memory: null,
  };
}

export interface WishExpiryInput {
  wish: WishState;
  absMin: number;
  mayaAround: boolean;
  isBusy: boolean;
}

export function shouldExpireWish(input: WishExpiryInput): boolean {
  if (input.isBusy) return false;
  if (input.absMin > input.wish.until) return true;
  if (!input.mayaAround) return true;
  return false;
}

export function wishExpiryMessage(kind: WishKind, mayaAround: boolean): string {
  if (mayaAround) {
    return {
      coffee: 'Maya gave up and made her own coffee.',
      dance: 'The song ended. Maya went back to what she was doing.',
      tv: 'Maya started the show without you.',
    }[kind];
  }
  return '';
}

/**
 * Typed bridge protocol between the React host and the game iframe.
 * All messages are validated on receipt.
 */

export type BridgeMessageType =
  | 'velvet:ready'
  | 'velvet:profile'
  | 'velvet:profileApplied'
  | 'velvet:companionCreated'
  | 'velvet:vidSearch'
  | 'velvet:vidResults'
  | 'velvet:restarted'
  | 'velvet:avatarItemBought'
  | 'velvet:avatarInventory';

export interface BridgeMessage {
  type: BridgeMessageType;
  game?: string;
  [key: string]: unknown;
}

export interface ReadyMessage extends BridgeMessage {
  type: 'velvet:ready';
  game: 'velvet-house';
  day: number;
  needsProfile: boolean;
}

export interface GameLook {
  skin?: string;
  hair?: string;
  hairColor?: string;
  top?: string;
  eyeColor?: string;
  facialHair?: string;
  glasses?: string;
  gender?: 'male' | 'female';
  // The real avatar head as SVG frames (see state/headSprites.ts).
  sprites?: Record<string, string>;
  // The avatar's outfit, worn as the signature look (see state/clothing.ts).
  outfit?: { style: string; color: string; accent: string; bottom: string; key: string };
}

export interface ProfileMessage extends BridgeMessage {
  type: 'velvet:profile';
  player: {
    name: string;
    look?: GameLook | undefined;
  };
  companion: {
    name: string;
    pronoun: 'she' | 'he' | 'they';
    gender: 'male' | 'female';
    personality: string;
    look?: GameLook | undefined;
    memories: never[];
    likes: string[];
    dislikes: string[];
  };
}

export interface ProfileAppliedMessage extends BridgeMessage {
  type: 'velvet:profileApplied';
  game: 'velvet-house';
  day: number;
  player: string;
  companion: string;
}

export interface VidSearchMessage extends BridgeMessage {
  type: 'velvet:vidSearch';
  game: 'velvet-house';
  query: string;
  seq: number;
}

export interface VidResultsMessage extends BridgeMessage {
  type: 'velvet:vidResults';
  seq: number;
  videos: unknown[];
}

export interface RestartedMessage extends BridgeMessage {
  type: 'velvet:restarted';
  game: 'velvet-house';
  day: number;
}

// Bought in the game's shop (a hairstyle at the salon, clothes at the
// boutique): the host records it to the player's account, so it can be worn
// everywhere outside the game too. `itemId` is an avatar catalog id such as
// 'hairStyle:bantu_knots' (see src/data/avatarCatalog.ts).
export interface AvatarItemBoughtMessage extends BridgeMessage {
  type: 'velvet:avatarItemBought';
  game: 'velvet-house';
  itemId: string;
}

// Everything the player owns for their avatar, sent by the host when the game
// starts and after each purchase, so the shop can show what's already theirs.
export interface AvatarInventoryMessage extends BridgeMessage {
  type: 'velvet:avatarInventory';
  owned: string[];
}

export function isAvatarItemBoughtMessage(data: unknown): data is AvatarItemBoughtMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:avatarItemBought' && typeof m.itemId === 'string' && m.itemId.length <= 64;
}

export function isAvatarInventoryMessage(data: unknown): data is AvatarInventoryMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:avatarInventory' && Array.isArray(m.owned) && m.owned.every(x => typeof x === 'string');
}

export function isBridgeMessage(data: unknown): data is BridgeMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as BridgeMessage).type === 'string' &&
    (data as BridgeMessage).type.startsWith('velvet:')
  );
}

export function isProfileMessage(data: unknown): data is ProfileMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return (
    m.type === 'velvet:profile' &&
    typeof m.player === 'object' && m.player !== null &&
    typeof m.companion === 'object' && m.companion !== null
  );
}

export function isReadyMessage(data: unknown): data is ReadyMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:ready' && typeof m.day === 'number';
}

export function isVidSearchMessage(data: unknown): data is VidSearchMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:vidSearch' && typeof m.query === 'string';
}

export function isVidResultsMessage(data: unknown): data is VidResultsMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:vidResults' && typeof m.seq === 'number';
}

export function isRestartedMessage(data: unknown): data is RestartedMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:restarted' && typeof m.day === 'number';
}

/**
 * The game sends messages to the parent window.
 * Uses document.referrer origin for targetOrigin, falling back to '*'
 * only when referrer is empty (standalone testing).
 */
export function postToParent(msg: BridgeMessage): void {
  try {
    if (!window.parent || window.parent === window) return;
    let origin = '*';
    try {
      origin = new URL(document.referrer).origin;
    } catch {
      // standalone testing — keep '*'
    }
    window.parent.postMessage(msg, origin);
  } catch {
    // no parent or blocked
  }
}

/**
 * Strip unknown fields from a message, keeping only whitelisted keys per type.
 * Prevents unexpected data from reaching the game or host.
 */
const FIELD_WHITELISTS: Record<string, string[]> = {
  'velvet:ready': ['type', 'game', 'day', 'needsProfile'],
  'velvet:profile': ['type', 'player', 'companion'],
  'velvet:profileApplied': ['type', 'game', 'day', 'player', 'companion'],
  'velvet:companionCreated': ['type', 'game'],
  'velvet:vidSearch': ['type', 'game', 'query', 'seq'],
  'velvet:vidResults': ['type', 'seq', 'videos'],
  'velvet:restarted': ['type', 'game', 'day'],
  'velvet:avatarItemBought': ['type', 'game', 'itemId'],
  'velvet:avatarInventory': ['type', 'owned'],
};

export function sanitizeMessage(msg: Record<string, unknown>): Record<string, unknown> {
  const allowed = FIELD_WHITELISTS[msg.type as string];
  if (!allowed) return { type: msg.type };
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in msg) out[key] = msg[key];
  }
  return out;
}

/**
 * Validate incoming message origin against expected parent origins.
 * Returns true if the message should be accepted.
 */
export function isValidOrigin(eventOrigin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return false;
  return allowedOrigins.includes(eventOrigin);
}

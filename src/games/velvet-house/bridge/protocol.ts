/**
 * Typed bridge protocol between the React host and the game iframe.
 * All messages are validated on receipt.
 */

import { IS_DEMO } from '../kernel/config';

export type BridgeMessageType =
  | 'velvet:ready'
  | 'velvet:profile'
  | 'velvet:profileApplied'
  | 'velvet:companionCreated'
  | 'velvet:vidSearch'
  | 'velvet:vidResults'
  | 'velvet:restarted'
  | 'velvet:avatarItemBought'
  | 'velvet:avatarInventory'
  | 'velvet:lookChanged'
  | 'velvet:sample'
  | 'velvet:sampleCancel'
  | 'velvet:sampleResult'
  | 'velvet:designs'
  | 'velvet:designsResult'
  | 'velvet:avatarLook'
  | 'velvet:plot'
  | 'velvet:companions'
  | 'velvet:menuReady'
  | 'velvet:startRequested'
  | 'velvet:startGo'
  | 'velvet:startCancel'
  | 'velvet:promo'
  | 'velvet:promos'
  | 'velvet:houses'
  | 'velvet:housesResult'
  | 'velvet:visit'
  | 'velvet:visitEnd';

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
  // The avatar's hands as SVG pieces (see state/bodySprites.ts).
  body?: Record<string, string>;
  // The avatar's outfit, worn as the signature look (see state/clothing.ts).
  outfit?: { style: string; color: string; accent: string; bottom: string; key: string; bottomStyle?: string; bottomAccent?: string };
  // What the player may wear from the avatar wardrobe, and its personas (see state/clothing.ts).
  wardrobe?: unknown;
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
    /** What they picked when they were made: how they joke, how they say things, and what they are to the player. */
    humor?: string;
    communication?: string;
    relationship?: string;
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

// The player changed clothes in the game: the host saves it to their avatar,
// so the avatar screen, toolbar and chats match what they're wearing.
export interface LookChangedMessage extends BridgeMessage {
  type: 'velvet:lookChanged';
  game: 'velvet-house';
  who: 'player';
  // Whichever pieces changed: a shirt, pants, or a hat (an avatar headwear id).
  top?: { style: string; color: string; accent?: string };
  bottom?: { style: string; color: string; accent?: string };
  hat?: string;
}

// The game asks the host to run one AI turn (the game itself holds no keys or
// accounts): `input` is the game's prompt lines, answered by a sampleResult
// with the same `seq`. See bridge/chatInput.ts for how the lines become a chat.
export interface SampleRequestMessage extends BridgeMessage {
  type: 'velvet:sample';
  game: 'velvet-house';
  seq: number;
  input: string[];
}

export interface SampleCancelMessage extends BridgeMessage {
  type: 'velvet:sampleCancel';
  game: 'velvet-house';
  seq: number;
}

export interface SampleResultMessage extends BridgeMessage {
  type: 'velvet:sampleResult';
  seq: number;
  text?: string;
  // 'unavailable' | 'rate_limited' | 'refused' | 'cancelled'
  error?: string;
}

// Sharing garment designs (see supabase/migrations/20261029100001_velvet_designs.sql). The game asks the host to
// publish, list, report, delete or review; the host runs it with the player's account and answers with the same seq.
export const DESIGN_OPS = ['caps', 'friends', 'gallery', 'mine', 'publish', 'delete', 'report', 'pending', 'review'] as const;
export type DesignOp = typeof DESIGN_OPS[number];

export interface DesignsRequestMessage extends BridgeMessage {
  type: 'velvet:designs';
  game: 'velvet-house';
  seq: number;
  op: DesignOp;
  args?: Record<string, string | number | boolean>;
}

export interface DesignsResultMessage extends BridgeMessage {
  type: 'velvet:designsResult';
  seq: number;
  ok: boolean;
  data?: unknown;
  // 'unavailable' | 'blocked' | 'slow_down' | 'too_many' | 'bad_request' | 'banned' | 'not_allowed'
  error?: string;
}

const DESIGN_ARG_LIMITS: Record<string, number> = { name: 24, code: 700, visibility: 10, id: 40, reason: 200 };

export function isDesignsRequestMessage(data: unknown): data is DesignsRequestMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  if (m.type !== 'velvet:designs' || typeof m.seq !== 'number' || typeof m.op !== 'string') return false;
  if (!(DESIGN_OPS as readonly string[]).includes(m.op)) return false;
  if (m.args === undefined) return true;
  if (!m.args || typeof m.args !== 'object' || Array.isArray(m.args)) return false;
  return Object.entries(m.args as Record<string, unknown>).every(([k, v]) => {
    if (typeof v === 'boolean') return k === 'approve';
    if (typeof v === 'number') return k === 'offset' && Number.isFinite(v) && v >= 0 && v < 10000;
    return typeof v === 'string' && k in DESIGN_ARG_LIMITS && v.length <= DESIGN_ARG_LIMITS[k];
  });
}

export function isDesignsResultMessage(data: unknown): data is DesignsResultMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:designsResult' && typeof m.seq === 'number' && typeof m.ok === 'boolean'
    && (m.error === undefined || typeof m.error === 'string');
}

const MAX_SAMPLE_LINES = 40;
const MAX_SAMPLE_CHARS = 24000;

export function isSampleRequestMessage(data: unknown): data is SampleRequestMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:sample' && typeof m.seq === 'number' && Array.isArray(m.input)
    && m.input.length > 0 && m.input.length <= MAX_SAMPLE_LINES
    && m.input.every(x => typeof x === 'string')
    && (m.input as string[]).reduce((n, x) => n + x.length, 0) <= MAX_SAMPLE_CHARS;
}

export function isSampleCancelMessage(data: unknown): data is SampleCancelMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:sampleCancel' && typeof m.seq === 'number';
}

export function isSampleResultMessage(data: unknown): data is SampleResultMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:sampleResult' && typeof m.seq === 'number'
    && (m.text === undefined || typeof m.text === 'string') && (m.error === undefined || typeof m.error === 'string');
}

const piece = (v: unknown): boolean => {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return typeof p.style === 'string' && p.style.length <= 40 && typeof p.color === 'string' && p.color.length <= 9;
};

export function isLookChangedMessage(data: unknown): data is LookChangedMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  if (m.type !== 'velvet:lookChanged' || m.who !== 'player') return false;
  const hasTop = m.top !== undefined, hasBottom = m.bottom !== undefined, hasHat = m.hat !== undefined;
  if (!hasTop && !hasBottom && !hasHat) return false;
  if (hasTop && !piece(m.top)) return false;
  if (hasBottom && !piece(m.bottom)) return false;
  if (hasHat && (typeof m.hat !== 'string' || m.hat.length > 40)) return false;
  return true;
}

// The host's answer after a look change that alters the head (a new hat): fresh head frames and hands.
export interface AvatarLookMessage extends BridgeMessage {
  type: 'velvet:avatarLook';
  who: 'player';
  sprites?: Record<string, string>;
  body?: Record<string, string>;
}

/** The player's own house in town, as the street kit draws it (the host sends it so the move-in can start with the drive-up). */
export interface PlotMessage extends BridgeMessage {
  type: 'velvet:plot';
  plot: { member: boolean; config: Record<string, unknown>; earned?: string[]; address?: string };
}

export function isPlotMessage(data: unknown): data is PlotMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  const p = m.plot as Record<string, unknown> | null;
  return m.type === 'velvet:plot' && typeof p === 'object' && p !== null && typeof p.config === 'object' && p.config !== null;
}

/** Host to game: how many companions the player could move in with (more than one means Start asks the host who). */
export interface CompanionsMessage extends BridgeMessage { type: 'velvet:companions'; count: number; /** How many of them already have a house. */ houses?: number }
export function isCompanionsMessage(data: unknown): data is CompanionsMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:companions' && typeof m.count === 'number';
}
/** The host's answer to Start: go on with this companion, or the player backed out. */
export function isStartAnswerMessage(data: unknown): data is BridgeMessage & { type: 'velvet:startGo' | 'velvet:startCancel' } {
  if (!isBridgeMessage(data)) return false;
  const t = (data as Record<string, unknown>).type;
  return t === 'velvet:startGo' || t === 'velvet:startCancel';
}
/** Game to host: the player chose Start and there is more than one companion to pick from. */
/** Game to host: the title screen is up (there is no host bridge yet), so tell me how many companions there are. */
export function isMenuReadyMessage(data: unknown): data is BridgeMessage & { type: 'velvet:menuReady' } {
  return isBridgeMessage(data) && (data as Record<string, unknown>).type === 'velvet:menuReady';
}

export type StartMode = 'new' | 'continue';
export function isStartRequestedMessage(data: unknown): data is BridgeMessage & { type: 'velvet:startRequested'; mode: StartMode } {
  return isBridgeMessage(data) && (data as Record<string, unknown>).type === 'velvet:startRequested'
    && ((data as Record<string, unknown>).mode === 'new' || (data as Record<string, unknown>).mode === 'continue');
}

export function isAvatarLookMessage(data: unknown): data is AvatarLookMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:avatarLook' && m.who === 'player' && typeof m.sprites === 'object' && m.sprites !== null;
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

// A promo code the player redeemed in this house: the host records it for the account.
export interface PromoRedeemedMessage extends BridgeMessage {
  type: 'velvet:promo';
  game: 'velvet-house';
  code: string;
}

// The promo codes redeemed on the player's account (in any house): every house of theirs gets those packs.
export interface AccountPromosMessage extends BridgeMessage {
  type: 'velvet:promos';
  codes: string[];
}

export function isPromoRedeemedMessage(data: unknown): data is PromoRedeemedMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:promo' && typeof m.code === 'string' && m.code.length > 0 && m.code.length <= 40;
}

export function isAccountPromosMessage(data: unknown): data is AccountPromosMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:promos' && Array.isArray(m.codes) && m.codes.length <= 100
    && m.codes.every((c) => typeof c === 'string' && c.length <= 40);
}

/**
 * The game sends messages to the parent window.
 * Uses document.referrer origin for targetOrigin, falling back to '*'
 * only when referrer is empty (standalone testing).
 */
export function postToParent(msg: BridgeMessage): void {
  // The demo is not part of the account: nothing it does (saves, promo codes, restarts) goes up to the host.
  if (IS_DEMO) return;
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
  'velvet:lookChanged': ['type', 'game', 'who', 'top', 'bottom', 'hat'],
  'velvet:sample': ['type', 'game', 'seq', 'input'],
  'velvet:sampleCancel': ['type', 'game', 'seq'],
  'velvet:sampleResult': ['type', 'seq', 'text', 'error'],
  'velvet:designs': ['type', 'game', 'seq', 'op', 'args'],
  'velvet:designsResult': ['type', 'seq', 'ok', 'data', 'error'],
  'velvet:avatarLook': ['type', 'who', 'sprites', 'body'],
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

// Visiting friends' houses (see supabase/migrations/20261111100000_velvet_house_visits.sql). The game asks the host for
// the friends whose houses are open, whether the player's own house is open, or to open or close it; the host runs it
// with the player's account and answers with the same seq. To go on a visit the game asks the host to open the friend's
// house; the visit's game asks to come home.
export const HOUSE_OPS = ['friends', 'open', 'setOpen'] as const;
export type HouseOp = typeof HOUSE_OPS[number];

export interface HousesRequestMessage extends BridgeMessage {
  type: 'velvet:houses';
  game: 'velvet-house';
  seq: number;
  op: HouseOp;
  /** setOpen only: whether friends can visit. */
  open?: boolean;
}

/** A friend's house the player can visit. */
export interface FriendHouse { ownerId: string; name: string; day: number | null }

export interface HousesResultMessage extends BridgeMessage {
  type: 'velvet:housesResult';
  seq: number;
  ok: boolean;
  /** friends: FriendHouse[]; open and setOpen: boolean. */
  data?: unknown;
}

export interface VisitMessage extends BridgeMessage {
  type: 'velvet:visit';
  game: 'velvet-house';
  owner: string;
}

export interface VisitEndMessage extends BridgeMessage {
  type: 'velvet:visitEnd';
  game: 'velvet-house';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isHousesRequestMessage(data: unknown): data is HousesRequestMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  if (m.type !== 'velvet:houses' || typeof m.seq !== 'number' || !(HOUSE_OPS as readonly string[]).includes(m.op as string)) return false;
  return m.op === 'setOpen' ? typeof m.open === 'boolean' : m.open === undefined;
}

export function isHousesResultMessage(data: unknown): data is HousesResultMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:housesResult' && typeof m.seq === 'number' && typeof m.ok === 'boolean';
}

export function isVisitMessage(data: unknown): data is VisitMessage {
  if (!isBridgeMessage(data)) return false;
  const m = data as Record<string, unknown>;
  return m.type === 'velvet:visit' && typeof m.owner === 'string' && UUID.test(m.owner);
}

export function isVisitEndMessage(data: unknown): data is VisitEndMessage {
  return isBridgeMessage(data) && (data as BridgeMessage).type === 'velvet:visitEnd';
}

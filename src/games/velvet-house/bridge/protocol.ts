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
  | 'velvet:restarted';

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
}

export interface ProfileMessage extends BridgeMessage {
  type: 'velvet:profile';
  player: {
    name: string;
    look?: GameLook | undefined;
  };
  companion: {
    name: string;
    pronoun: 'she' | 'he';
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
 * Validate incoming message origin against expected parent origins.
 * Returns true if the message should be accepted.
 */
export function isValidOrigin(eventOrigin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.length === 0) return true; // prototyping mode
  return allowedOrigins.includes(eventOrigin);
}

import { describe, it, expect } from 'vitest';
import {
  isBridgeMessage,
  isProfileMessage,
  isReadyMessage,
  isVidSearchMessage,
  isValidOrigin,
} from '../bridge/protocol';

describe('bridge protocol', () => {
  describe('isBridgeMessage', () => {
    it('accepts valid velvet messages', () => {
      expect(isBridgeMessage({ type: 'velvet:ready', game: 'velvet-house', day: 1 })).toBe(true);
      expect(isBridgeMessage({ type: 'velvet:profile', player: {}, companion: {} })).toBe(true);
    });

    it('rejects non-velvet messages', () => {
      expect(isBridgeMessage(null)).toBe(false);
      expect(isBridgeMessage('string')).toBe(false);
      expect(isBridgeMessage({ type: 'something:else' })).toBe(false);
      expect(isBridgeMessage({})).toBe(false);
    });
  });

  describe('isReadyMessage', () => {
    it('accepts a valid ready message', () => {
      expect(isReadyMessage({ type: 'velvet:ready', game: 'velvet-house', day: 3, needsProfile: true })).toBe(true);
    });

    it('rejects missing day', () => {
      expect(isReadyMessage({ type: 'velvet:ready', game: 'velvet-house', needsProfile: true })).toBe(false);
    });
  });

  describe('isProfileMessage', () => {
    it('accepts a valid profile message', () => {
      expect(isProfileMessage({
        type: 'velvet:profile',
        player: { name: 'Alex' },
        companion: { name: 'Maya', pronoun: 'she', gender: 'female', personality: 'warm', memories: [], likes: [], dislikes: [] },
      })).toBe(true);
    });

    it('rejects missing player or companion', () => {
      expect(isProfileMessage({ type: 'velvet:profile', player: null, companion: {} })).toBe(false);
      expect(isProfileMessage({ type: 'velvet:profile', player: {}, companion: null })).toBe(false);
    });
  });

  describe('isVidSearchMessage', () => {
    it('accepts a valid vid search message', () => {
      expect(isVidSearchMessage({ type: 'velvet:vidSearch', game: 'velvet-house', query: 'cats', seq: 1 })).toBe(true);
    });

    it('rejects missing query', () => {
      expect(isVidSearchMessage({ type: 'velvet:vidSearch', game: 'velvet-house', seq: 1 })).toBe(false);
    });
  });

  describe('isValidOrigin', () => {
    it('allows all when no origins specified (prototyping)', () => {
      expect(isValidOrigin('https://evil.com', [])).toBe(true);
    });

    it('allows listed origins', () => {
      expect(isValidOrigin('https://app.example.com', ['https://app.example.com'])).toBe(true);
    });

    it('rejects unlisted origins', () => {
      expect(isValidOrigin('https://evil.com', ['https://app.example.com'])).toBe(false);
    });
  });
});

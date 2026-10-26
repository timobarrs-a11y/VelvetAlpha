import { describe, it, expect } from 'vitest';
import {
  LEVELS,
  STAIRS,
  DOOR,
  WALL_LIGHTS,
  LEVEL_NAMES,
  roomName,
  roomFor,
  PRIVATE_ROOMS,
  ROOM_ALIASES,
  WX,
  WY,
} from '../state/house';

describe('house', () => {
  describe('LEVELS', () => {
    it('has 5 levels (the attic is the last)', () => {
      expect(LEVELS).toHaveLength(5);
    });

    it('level 0 is basement with 3 rooms', () => {
      expect(LEVELS[0].rooms).toHaveLength(3);
      expect(LEVELS[0].rooms[0].n).toBe('Gym');
    });

    it('level 1 is main floor with kitchen, entry, living room', () => {
      expect(LEVELS[1].rooms.map((r) => r.n)).toEqual(['Kitchen', 'Entry', 'Living room']);
    });

    it('level 3 is backyard with single room', () => {
      expect(LEVELS[3].rooms).toHaveLength(1);
      expect(LEVELS[3].rooms[0].n).toBe('Backyard');
      expect(LEVELS[3].yard).toBe(true);
    });

    it('every level has an anchor point', () => {
      for (const lv of LEVELS) {
        expect(lv.anchor).toBeDefined();
        expect(lv.anchor).toHaveLength(2);
      }
    });

    it('every level has walls array', () => {
      for (const lv of LEVELS) {
        expect(Array.isArray(lv.walls)).toBe(true);
      }
    });

    it('every level has feats array', () => {
      for (const lv of LEVELS) {
        expect(Array.isArray(lv.feats)).toBe(true);
      }
    });
  });

  describe('STAIRS', () => {
    it('has 4 stair connections (the attic stairs are the last)', () => {
      expect(STAIRS).toHaveLength(4);
    });

    it('connects basement to main floor', () => {
      const s = STAIRS.find((s) => s.lower === 0 && s.upper === 1);
      expect(s).toBeDefined();
      expect(s!.id).toBe('S01');
    });

    it('connects main floor to upstairs', () => {
      const s = STAIRS.find((s) => s.lower === 1 && s.upper === 2);
      expect(s).toBeDefined();
      expect(s!.id).toBe('S12');
    });

    it('door connection from main floor to backyard', () => {
      const s = STAIRS.find((s) => s.id === 'D13');
      expect(s).toBeDefined();
      expect(s!.door).toBe(true);
      expect(s!.lower).toBe(1);
      expect(s!.upper).toBe(3);
    });

    it('every stair has lowerNode and upperNode', () => {
      for (const s of STAIRS) {
        expect(s.lowerNode).toHaveLength(2);
        expect(s.upperNode).toHaveLength(2);
      }
    });
  });

  describe('DOOR', () => {
    it('is at entry anchor position', () => {
      expect(DOOR).toEqual([0.6, 5.05]);
    });
  });

  describe('WALL_LIGHTS', () => {
    it('has lights across multiple levels', () => {
      const levels = new Set(WALL_LIGHTS.map((l) => l.level));
      expect(levels.size).toBeGreaterThanOrEqual(4);
    });

    it('every light has required fields', () => {
      for (const l of WALL_LIGHTS) {
        expect(l.p).toBeDefined();
        expect(l.u).toHaveLength(2);
        expect(l.z).toBeTypeOf('number');
        expect(l.k).toBeTypeOf('string');
        expect(l.r).toBeTypeOf('number');
      }
    });

    it('has string lights that need stringlights upgrade', () => {
      const sl = WALL_LIGHTS.find((l) => l.k === 'string');
      expect(sl).toBeDefined();
      expect(sl!.need).toBe('stringlights');
    });
  });

  describe('LEVEL_NAMES', () => {
    it('matches the 5 levels', () => {
      expect(LEVEL_NAMES).toEqual(['Basement', 'Main floor', 'Upstairs', 'Backyard', 'Attic']);
    });
  });

  describe('roomName', () => {
    it('returns Gym for basement center-left', () => {
      expect(roomName(0, 2, 2)).toBe('Gym');
    });

    it('returns Kitchen for main floor top-left', () => {
      expect(roomName(1, 2, 2)).toBe('Kitchen');
    });

    it('returns Living room for main floor right side', () => {
      expect(roomName(1, 7, 4)).toBe('Living room');
    });

    it('returns Backyard for level 3', () => {
      expect(roomName(3, 5, 4)).toBe('Backyard');
    });

    it('clamps coordinates to world bounds', () => {
      expect(roomName(1, -5, -5)).toBeDefined();
      expect(roomName(1, 100, 100)).toBeDefined();
    });
  });

  describe('roomFor', () => {
    it('returns original name without craftsman style', () => {
      expect(roomFor('Bedroom')).toBe('Bedroom');
    });

    it('returns aliased name with craftsman style', () => {
      expect(roomFor('Bedroom', 'craftsman')).toBe('Primary bedroom');
      expect(roomFor('Gym', 'craftsman')).toBe('Home gym');
    });

    it('returns original for unaliased rooms even with craftsman', () => {
      expect(roomFor('Kitchen', 'craftsman')).toBe('Kitchen');
    });
  });

  describe('PRIVATE_ROOMS', () => {
    it('contains bedroom and bathroom', () => {
      expect(PRIVATE_ROOMS.has('Bedroom')).toBe(true);
      expect(PRIVATE_ROOMS.has('Bathroom')).toBe(true);
    });

    it('does not contain public rooms', () => {
      expect(PRIVATE_ROOMS.has('Kitchen')).toBe(false);
      expect(PRIVATE_ROOMS.has('Living room')).toBe(false);
    });
  });

  describe('ROOM_ALIASES', () => {
    it('maps Rec room to Theater', () => {
      expect(ROOM_ALIASES['Rec room']).toBe('Theater');
    });
  });

  describe('world dimensions', () => {
    it('WX is 10 and WY is 8', () => {
      expect(WX).toBe(10);
      expect(WY).toBe(8);
    });
  });
});

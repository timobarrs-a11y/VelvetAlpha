import { describe, it, expect } from 'vitest';
import { SCENES, FLOOR_ORDER, sceneOf, isOutdoor, isPaintable, levelOfKind, LEVEL_COUNT } from '../state/scenes';
import { LEVELS, LEVEL_NAMES, ATTIC } from '../state/house';

describe('scenes', () => {
  it('each scene sits at its own level number', () => {
    SCENES.forEach((s, i) => expect(s.level).toBe(i));
    expect(LEVEL_COUNT).toBe(LEVELS.length);
  });

  it('the floor bar lists every scene once, bottom to top, with the attic below the yard', () => {
    expect([...FLOOR_ORDER].sort()).toEqual(SCENES.map((s) => s.level).sort());
    expect(FLOOR_ORDER).toEqual([0, 1, 2, ATTIC, 3]);
  });

  it('only the yard is outdoors and cannot be painted', () => {
    expect(SCENES.filter((s) => s.outdoor).map((s) => s.id)).toEqual(['yard']);
    expect(isOutdoor(3)).toBe(true);
    expect(isPaintable(3)).toBe(false);
    expect(isPaintable(ATTIC)).toBe(true);
  });

  it('names and the attic level come from the scene list', () => {
    expect([...LEVEL_NAMES]).toEqual(SCENES.map((s) => s.name));
    expect(levelOfKind('attic')).toBe(ATTIC);
    expect(sceneOf(99).id).toBe('main');
  });

  it('the yard in the level data matches the yard scene', () => {
    LEVELS.forEach((l, i) => expect(Boolean(l.yard)).toBe(SCENES[i].kind === 'yard'));
  });
});

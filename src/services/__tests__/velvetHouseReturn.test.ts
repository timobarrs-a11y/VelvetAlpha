import { describe, it, expect, beforeEach } from 'vitest';
import { markReturnToHouse, takeReturnToHouse, clearReturnToHouse } from '../velvetHouseReturn';

describe('coming back to the house after meeting a companion', () => {
  beforeEach(() => sessionStorage.clear());

  it('is true once after the house sent them out', () => {
    markReturnToHouse(1000);
    expect(takeReturnToHouse(2000)).toBe(true);
    expect(takeReturnToHouse(2500)).toBe(false);
  });
  it('is false when they never came from the house', () => {
    expect(takeReturnToHouse()).toBe(false);
  });
  it('expires, so an old mark never lands them in the game', () => {
    markReturnToHouse(0);
    expect(takeReturnToHouse(3 * 60 * 60 * 1000)).toBe(false);
  });
  it('can be put away unused', () => {
    markReturnToHouse(1000);
    clearReturnToHouse();
    expect(takeReturnToHouse(1500)).toBe(false);
  });
});

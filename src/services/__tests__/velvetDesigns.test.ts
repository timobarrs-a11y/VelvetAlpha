import { describe, it, expect } from 'vitest';
import { designError } from '../velvetDesigns';

describe('designError', () => {
  it('maps database and function errors to the short codes the game has words for', () => {
    expect(designError('new row ... raised exception: slow_down')).toBe('slow_down');
    expect(designError('too_many')).toBe('too_many');
    expect(designError('bad_name')).toBe('bad_name');
    expect(designError('blocked')).toBe('blocked');
    expect(designError('not_allowed')).toBe('not_allowed');
  });
  it('says unavailable for anything else, including nothing', () => {
    expect(designError('connection reset')).toBe('unavailable');
    expect(designError(undefined)).toBe('unavailable');
  });
});

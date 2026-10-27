import { describe, it, expect } from 'vitest';
import { helperPronouns } from '../helperPronouns';

describe('helperPronouns', () => {
  it('follows the helper\'s gender', () => {
    expect(helperPronouns('male').object).toBe('him');
    expect(helperPronouns('female').object).toBe('her');
  });
});

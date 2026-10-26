import { describe, it, expect } from 'vitest';
import { SCRIPTS } from '../content/scripts';
import { LINE_BOOK } from '../content/lines';
import { NPC_IDS } from '../content/characters';
import { validateContent } from '../script/validate';

describe('story content', () => {
  it('has no broken references, missing lines or unreachable steps', () => {
    expect(validateContent(SCRIPTS, LINE_BOOK, NPC_IDS)).toEqual([]);
  });
});

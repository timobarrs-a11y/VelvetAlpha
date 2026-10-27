import { describe, it, expect } from 'vitest';
import { clothToGarment } from '../state/legacyClothes';
import { CLOTHES, clothId } from '../state/clothing';
import type { OwnedCloth } from '../state/clothing';

describe('the classic range as recipes', () => {
  it('turns every shirt and pair of pants the shop sells into a valid recipe in its own colour', () => {
    for (const def of CLOTHES.filter((c) => c.slot === 'top' || c.slot === 'bottom')) {
      const piece: OwnedCloth = { slot: def.slot, style: def.style, col: def.colors[0], name: def.name, id: clothId(def.key) };
      const g = clothToGarment(piece);
      expect(g, def.key).not.toBeNull();
      expect(g!.base).toBe(def.colors[0].toLowerCase());
      expect(g!.name).toBe(def.name.slice(0, 24));
    }
  });

  it('knows a flannel is a plaid button-up and jeans are denim', () => {
    const flannel = clothToGarment({ slot: 'top', style: 'flannel', col: '#a63a2c', name: 'Flannel shirt', id: 'c-flannel' })!;
    expect(flannel.fabric).toBe('flannel');
    expect(flannel.pattern!.kind).toBe('plaid');
    const jeans = clothToGarment({ slot: 'bottom', style: 'pants', col: '#3d5b8a', name: 'Jeans', id: 'c-jeans' })!;
    expect(jeans.fabric).toBe('denim');
  });

  it('leaves the avatar pieces, hats and shoes alone', () => {
    expect(clothToGarment({ slot: 'top', style: 'blazer', col: '#2b2b30', name: 'Signature', id: 'sig-top' })).toBeNull();
    expect(clothToGarment({ slot: 'top', style: 'chef', col: '#ffffff', name: 'Chef', id: 'w-chef' })).toBeNull();
    expect(clothToGarment({ slot: 'hat', style: 'cap', col: '#2b2b30', name: 'Cap', id: 'c-cap' })).toBeNull();
  });

  it('hands back a recipe unchanged', () => {
    const g = clothToGarment({ slot: 'top', style: 'tee', col: '#112233', name: 'x', id: 'c-tee' })!;
    expect(clothToGarment({ slot: 'top', style: 'tee', col: '#112233', name: 'x', id: 'g-1', recipe: g })).toBe(g);
  });
});

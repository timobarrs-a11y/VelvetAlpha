import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GLASSES_COLORS, DEFAULT_GLASSES_COLOR, type Headwear } from '../../types/avatar-v2';
import { HEADWEAR, headwearItem, itemUnlock, STARTER_ONLY } from '../../data/avatarItems';
import { ITEM_ID_PATTERN, itemId, itemLabel, canUse } from '../../data/avatarCatalog';
import { migrateAvatarConfig, applyAvatarChange } from '../../utils/avatarConfig';
import { headwearHairCut } from '../outfitRenderer';
import { AvatarV2 } from '../../components/AvatarV2';

const NEW_HATS: Headwear[] = ['beanie', 'baseball_cap', 'cowboy_hat', 'beret', 'headband', 'bucket_hat', 'headwrap'];

describe('headwear', () => {
  it('lists every hat the renderer can draw, once', () => {
    const ids = HEADWEAR.map(h => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of NEW_HATS) expect(ids).toContain(id);
  });

  it('the everyday hats are open to everyone, with a name and a valid item id', () => {
    for (const id of NEW_HATS) {
      const item = headwearItem(id);
      expect(item.id).toBe(id);
      expect(item.tier).toBe('starter');
      expect(item.fallback).toBe('none');
      expect(itemUnlock(item, STARTER_ONLY).ok).toBe(true);
      expect(ITEM_ID_PATTERN.test(itemId('headwear', id))).toBe(true);
      expect(canUse(itemId('headwear', id), STARTER_ONLY).ok).toBe(true);
      expect(itemLabel(itemId('headwear', id))).toBe(item.label);
    }
  });

  it.each(HEADWEAR.map(h => h.id))('%s draws on every face width without a broken number', (headwear) => {
    for (const faceWidth of [-1, 0, 1]) {
      const { container, unmount } = render(
        <AvatarV2 part="head" config={{ gender: 'female', hairStyle: 'bun', headwear, faceTune: { faceWidth }, _version: 4 }} />,
      );
      expect(container.innerHTML).not.toMatch(/NaN|undefined/);
      unmount();
    }
  });

  it.each(NEW_HATS)('%s draws something over the head', (headwear) => {
    const bare = render(<AvatarV2 part="head" config={{ gender: 'male', hairStyle: 'short', _version: 4 }} />).container.innerHTML;
    const hatted = render(<AvatarV2 part="head" config={{ gender: 'male', hairStyle: 'short', headwear, _version: 4 }} />).container.innerHTML;
    expect(hatted).not.toBe(bare);
  });

  it('hats that cover the hair tuck it away; a headband leaves it showing', () => {
    const p = (headwear: Headwear) => ({ headwear, fRx: 28, faceTop: 18 });
    for (const id of NEW_HATS.filter(h => h !== 'headband')) expect(headwearHairCut(p(id))).not.toBeNull();
    expect(headwearHairCut(p('headband'))).toBeNull();
  });

  it('a hat grows with a wider head', () => {
    const width = (headwear: Headwear, faceWidth: number) => {
      const { container } = render(<AvatarV2 part="head" config={{ gender: 'male', hairStyle: 'bald', headwear, faceTune: { faceWidth }, _version: 4 }} />);
      return container.innerHTML.length > 0 ? container.innerHTML : '';
    };
    for (const id of NEW_HATS) expect(width(id, 1)).not.toBe(width(id, -1));
  });
});

describe('glasses colour', () => {
  const frames = (config: Record<string, unknown>) => {
    const { container } = render(<AvatarV2 part="head" config={{ gender: 'female', hairStyle: 'bob', _version: 4, ...config }} />);
    return container.innerHTML;
  };

  it('offers named colours, all valid hex, starting with the classic black', () => {
    expect(GLASSES_COLORS[0].value).toBe(DEFAULT_GLASSES_COLOR);
    for (const c of GLASSES_COLORS) expect(c.value).toMatch(/^#[0-9a-f]{6}$/i);
    expect(new Set(GLASSES_COLORS.map(c => c.value)).size).toBe(GLASSES_COLORS.length);
  });

  it.each(['round', 'square', 'cat-eye', 'aviator'] as const)('%s frames take the chosen colour', (glasses) => {
    const red = frames({ glasses, glassesColor: '#c73e3a' });
    expect(red).toContain('stroke="#c73e3a"');
    expect(frames({ glasses })).toContain(`stroke="${DEFAULT_GLASSES_COLOR}"`);
    expect(frames({ glasses })).not.toContain('#c73e3a');
  });

  it('draws no frames, and no frame colour, without glasses', () => {
    expect(frames({ glasses: 'none', glassesColor: '#c73e3a' })).not.toContain('#c73e3a');
  });

  it('keeps a good colour and drops anything that is not #rrggbb', () => {
    expect(migrateAvatarConfig({ gender: 'male', glassesColor: '#2F6FD6' }).glassesColor).toBe('#2F6FD6');
    for (const bad of ['red', '#fff', 'url(#x)', '"><script>', 12, null]) {
      expect(migrateAvatarConfig({ gender: 'male', glassesColor: bad }).glassesColor).toBeUndefined();
    }
    expect(frames({ glasses: 'round', glassesColor: '"><script>alert(1)</script>' })).not.toContain('script');
  });

  it('survives an edit and an old config without one', () => {
    const edited = applyAvatarChange({ gender: 'female', glasses: 'round' }, { glassesColor: '#d4af37' });
    expect(edited.glassesColor).toBe('#d4af37');
    expect(migrateAvatarConfig({ gender: 'female', glasses: 'round' }).glassesColor).toBeUndefined();
  });
});

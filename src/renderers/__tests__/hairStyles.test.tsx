import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HAIRSTYLES, HAIRSTYLE_GROUPS } from '../../types/avatar-v2';
import { AvatarV2 } from '../../components/AvatarV2';

describe('hairstyles', () => {
  it('lists every style in exactly one picker group', () => {
    const grouped = HAIRSTYLE_GROUPS.flatMap(g => g.styles);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(HAIRSTYLES.map(h => h.value).sort());
  });

  it.each(HAIRSTYLES.map(h => h.value))('draws %s from the front, the back and with highlights', (hairStyle) => {
    const config = { gender: 'female', hairStyle, hairColor: '#2a1f1a', hairHighlight: '#e07a9f', _version: 4 } as const;
    for (const props of [{}, { part: 'head' as const }, { part: 'head' as const, view: 'back' as const }]) {
      const { container, unmount } = render(<AvatarV2 config={config} {...props} />);
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });

  it('draws no hair at all when bald', () => {
    const { container } = render(<AvatarV2 config={{ gender: 'male', hairStyle: 'bald', hairColor: '#123456', _version: 4 }} />);
    expect(container.innerHTML).not.toContain('#123456');
  });
});

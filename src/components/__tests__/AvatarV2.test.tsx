import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AvatarV2 } from '../AvatarV2';
import { migrateAvatarConfig } from '../../utils/avatarConfig';

describe('AvatarV2', () => {
  it('draws the afro for both genders', () => {
    for (const gender of ['male', 'female'] as const) {
      const { container } = render(<AvatarV2 config={migrateAvatarConfig({ gender, hairStyle: 'afro' })} />);
      expect(container.querySelector('svg')).not.toBeNull();
    }
  });

  it('gives each avatar on a page its own outfit colours', () => {
    const { container } = render(
      <>
        <AvatarV2 config={migrateAvatarConfig({ outfit: 'tee', outfitColor: '#1e293b' })} />
        <AvatarV2 config={migrateAvatarConfig({ outfit: 'chef', outfitColor: '#f4f1ea' })} />
      </>,
    );
    const gradients = [...container.querySelectorAll('linearGradient')].filter(g => g.id.endsWith('-outfit'));
    expect(gradients).toHaveLength(2);
    expect(gradients[0].id).not.toBe(gradients[1].id);
    expect(gradients[1].querySelector('stop')?.getAttribute('stop-color')).toBe('#f4f1ea');
  });

  it('tucks hair under a hat and draws nothing extra without one', () => {
    const hatted = render(<AvatarV2 config={migrateAvatarConfig({ hairStyle: 'bun', headwear: 'tricorn' })} />);
    expect(hatted.container.querySelector('[id$="-hair"]')).not.toBeNull();
    const bare = render(<AvatarV2 config={migrateAvatarConfig({ hairStyle: 'bun' })} />);
    expect(bare.container.querySelector('[id$="-hair"]')).toBeNull();
  });

  it('draws the same facial hair every time, so a beard never flickers between renders', () => {
    for (const facialHair of ['stubble', 'beard', 'goatee', 'mustache'] as const) {
      const config = migrateAvatarConfig({ gender: 'male', facialHair });
      expect(renderToStaticMarkup(<AvatarV2 config={config} />)).toBe(renderToStaticMarkup(<AvatarV2 config={config} />));
    }
  });
});

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AvatarV2 } from '../AvatarV2';
import { migrateAvatarConfig } from '../../utils/avatarConfig';
import { HAIRSTYLES, FACE_SHAPES, EYE_SHAPES } from '../../types/avatar-v2';
import { faceOutlinePath } from '../../renderers/faceGeometry';

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

  it('draws every hairstyle and texture on either gender, the same way every time', () => {
    for (const gender of ['male', 'female'] as const) {
      for (const { value: hairStyle } of HAIRSTYLES) {
        for (const hairTexture of ['straight', 'wavy', 'coily'] as const) {
          const config = migrateAvatarConfig({ gender, hairStyle, hairTexture });
          const a = renderToStaticMarkup(<AvatarV2 config={config} />);
          expect(a).toBe(renderToStaticMarkup(<AvatarV2 config={config} />));
          expect(a).not.toContain('NaN');
        }
      }
    }
  });

  it('gives every face shape its own outline', () => {
    const outlines = FACE_SHAPES.map(({ value }) => faceOutlinePath({
      faceShape: value, fRx: 28, fRy: 34, chinW: 20, faceTop: 18, faceBottom: 86, faceCenterY: 52,
    }));
    expect(new Set(outlines).size).toBe(FACE_SHAPES.length);
    for (const d of outlines) expect(d).not.toContain('NaN');
  });

  it('draws every eye shape differently', () => {
    const drawn = EYE_SHAPES.map(({ value }) => renderToStaticMarkup(<AvatarV2 config={migrateAvatarConfig({ eyeShape: value })} />));
    expect(new Set(drawn).size).toBe(EYE_SHAPES.length);
  });

  it('gives each avatar its own skin colour, so a hidden copy never blanks a visible one', () => {
    const config = migrateAvatarConfig({ skinTone: '#7d4a2e' });
    const { container } = render(<><AvatarV2 config={config} /><AvatarV2 config={config} /></>);
    const ids = [...container.querySelectorAll('radialGradient')].map(g => g.id).filter(id => id.endsWith('-skin'));
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('draws v1 configs from before the current renderer', () => {
    const { container } = render(<AvatarV2 config={{ gender: 'male', hairStyle: 'sleek', skinTone: '#e8b890' }} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('draws every lip shape in every mood, with teeth only when the mouth is open', () => {
    for (const lipShape of ['natural', 'full', 'thin', 'heart'] as const) {
      const config = migrateAvatarConfig({ lipShape });
      const closed = renderToStaticMarkup(<AvatarV2 config={config} />);
      const smile = renderToStaticMarkup(<AvatarV2 config={config} mood="smile" />);
      const grin = renderToStaticMarkup(<AvatarV2 config={config} mood="grin" />);
      for (const svg of [closed, smile, grin]) expect(svg).not.toContain('NaN');
      expect(smile).not.toBe(closed);
      expect(closed).not.toContain('mouth-open');
      expect(grin).toContain('mouth-open');
    }
  });
});

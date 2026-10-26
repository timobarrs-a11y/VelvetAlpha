import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FACE_TUNE_SLIDERS, tuneOf } from '../../types/avatar-v2';
import { AvatarV2 } from '../../components/AvatarV2';

const base = { gender: 'female', hairStyle: 'bun', _version: 4 } as const;
const drawn = (faceTune?: Record<string, number>) =>
  render(<AvatarV2 part="head" config={{ ...base, faceTune }} />).container.innerHTML;

describe('face fine-tuning', () => {
  it('keeps stored values within -1..1, and treats junk as 0', () => {
    expect(tuneOf({ eyeSize: 3 }, 'eyeSize')).toBe(1);
    expect(tuneOf({ eyeSize: -3 }, 'eyeSize')).toBe(-1);
    expect(tuneOf({ eyeSize: Number.NaN }, 'eyeSize')).toBe(0);
    expect(tuneOf(undefined, 'eyeSize')).toBe(0);
  });

  it('leaves the face exactly as drawn when every slider is at 0', () => {
    const plain = drawn().replace(/id="[^"]*"|url\(#[^)]*\)/g, '');
    const zeros = drawn(Object.fromEntries(FACE_TUNE_SLIDERS.map(s => [s.key, 0]))).replace(/id="[^"]*"|url\(#[^)]*\)/g, '');
    expect(zeros).toBe(plain);
  });

  it.each(FACE_TUNE_SLIDERS.map(s => s.key))('%s changes the face at both ends', (key) => {
    const strip = (h: string) => h.replace(/id="[^"]*"|url\(#[^)]*\)/g, '');
    const low = strip(drawn({ [key]: -1 })), mid = strip(drawn()), high = strip(drawn({ [key]: 1 }));
    expect(low).not.toBe(mid);
    expect(high).not.toBe(mid);
  });
});

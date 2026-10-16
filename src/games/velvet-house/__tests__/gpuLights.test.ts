import { describe, it, expect } from 'vitest';
import { packLights, parseLightColor, isFireColor, createGpuLights, MAX_LIGHTS, type ScreenLight } from '../engine/gpuLights';

const light = (over: Partial<ScreenLight> = {}): ScreenLight => ({ sx: 10, sy: 20, px: 10, py: 40, r: 140, s: 1, ...over });

describe('gpuLights', () => {
  it('parses light colors and falls back to warm white', () => {
    expect(parseLightColor('255,150,70')).toEqual([1, 150 / 255, 70 / 255]);
    expect(parseLightColor(undefined)).toEqual([1, 190 / 255, 120 / 255]);
    expect(parseLightColor('nope')).toEqual([1, 190 / 255, 120 / 255]);
  });

  it('marks fire-colored lights so they flicker', () => {
    expect(isFireColor('255,150,70')).toBe(true);
    expect(isFireColor(undefined)).toBe(false);
    expect(isFireColor('255,226,160')).toBe(false);
  });

  it('packs lights into fixed-size arrays and clamps strength', () => {
    const p = packLights([light({ s: 2 }), light({ col: '255,150,70', r: 0 })]);
    expect(p.count).toBe(2);
    expect(p.a.length).toBe(MAX_LIGHTS * 4);
    expect(p.a[3]).toBe(1);
    expect(p.a[6]).toBe(1);
    expect(p.b[6]).toBe(1);
  });

  it('caps the number of lights', () => {
    const many = Array.from({ length: MAX_LIGHTS + 10 }, () => light());
    expect(packLights(many).count).toBe(MAX_LIGHTS);
  });

  it('returns null when the browser has no graphics-card support', () => {
    expect(createGpuLights()).toBeNull();
  });
});

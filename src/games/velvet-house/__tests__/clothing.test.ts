import { describe, it, expect } from 'vitest';
import {
  CLOTHES, clothByKey, clothId, wearOn, defaultCloset,
} from '../state/clothing';
import type { LookState, OwnedCloth } from '../state/clothing';

describe('clothing — catalog', () => {
  it('has 24 clothing items', () => {
    expect(CLOTHES.length).toBe(24);
  });

  it('each item has slot, style, name, price, colors, tags', () => {
    for (const c of CLOTHES) {
      expect(c.slot).toBeDefined();
      expect(c.style).toBeDefined();
      expect(c.name).toBeDefined();
      expect(c.price).toBeGreaterThan(0);
      expect(c.colors.length).toBeGreaterThan(0);
      expect(c.tags.length).toBeGreaterThan(0);
    }
  });

  it('covers all 5 slots', () => {
    const slots = new Set(CLOTHES.map(c => c.slot));
    expect(slots.has('top')).toBe(true);
    expect(slots.has('bottom')).toBe(true);
    expect(slots.has('shoes')).toBe(true);
    expect(slots.has('hat')).toBe(true);
    expect(slots.has('glasses')).toBe(true);
  });
});

describe('clothing — clothByKey', () => {
  it('finds item by key', () => {
    const c = clothByKey('tee');
    expect(c).toBeDefined();
    expect(c!.name).toBe('Classic tee');
  });

  it('returns undefined for unknown key', () => {
    expect(clothByKey('nonexistent')).toBeUndefined();
  });
});

describe('clothing — clothId', () => {
  it('prefixes with c-', () => {
    expect(clothId('tee')).toBe('c-tee');
    expect(clothId('sneakers')).toBe('c-sneakers');
  });
});

describe('clothing — wearOn', () => {
  const baseLook: LookState = {
    top: '#FFF', topStyle: 'tee', bottom: 'pants', pants: '#000',
    shoes: '#333', hat: '', hatColor: '', glasses: '', glassColor: '',
  };

  it('wears top correctly', () => {
    const look = { ...baseLook };
    const pc: OwnedCloth = { slot: 'top', style: 'hoodie', col: '#8E9C96', name: 'Hoodie', id: 'c-hoodie' };
    wearOn(look, pc);
    expect(look.topStyle).toBe('hoodie');
    expect(look.top).toBe('#8E9C96');
  });

  it('wears bottom correctly', () => {
    const look = { ...baseLook };
    const pc: OwnedCloth = { slot: 'bottom', style: 'shorts', col: '#7FB069', name: 'Shorts', id: 'c-shorts' };
    wearOn(look, pc);
    expect(look.bottom).toBe('shorts');
    expect(look.pants).toBe('#7FB069');
  });

  it('wears shoes correctly', () => {
    const look = { ...baseLook };
    const pc: OwnedCloth = { slot: 'shoes', style: 'shoe', col: '#C2413A', name: 'Sneakers', id: 'c-sneakers' };
    wearOn(look, pc);
    expect(look.shoes).toBe('#C2413A');
  });

  it('wears hat correctly', () => {
    const look = { ...baseLook };
    const pc: OwnedCloth = { slot: 'hat', style: 'beanie', col: '#C2413A', name: 'Beanie', id: 'c-beanie' };
    wearOn(look, pc);
    expect(look.hat).toBe('beanie');
    expect(look.hatColor).toBe('#C2413A');
  });

  it('wears glasses correctly', () => {
    const look = { ...baseLook };
    const pc: OwnedCloth = { slot: 'glasses', style: 'round', col: '#2B2B30', name: 'Round', id: 'c-round' };
    wearOn(look, pc);
    expect(look.glasses).toBe('round');
    expect(look.glassColor).toBe('#2B2B30');
  });
});

describe('clothing — defaultCloset', () => {
  it('creates 4 starter items', () => {
    const look: LookState = {
      top: '#F2EEE8', topStyle: 'tee', bottom: 'pants', pants: '#3D5B8A',
      shoes: '#F2EEE8', hat: '', hatColor: '', glasses: '', glassColor: '',
    };
    const mayaLook: LookState = { ...look };
    const closet = defaultCloset(look, mayaLook, '#3D5B8A', '#F2EEE8');
    expect(closet.length).toBe(4);
    expect(closet[0].slot).toBe('top');
    expect(closet[2].slot).toBe('bottom');
    expect(closet[3].slot).toBe('shoes');
  });
});

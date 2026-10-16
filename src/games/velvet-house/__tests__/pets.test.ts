import { describe, it, expect } from 'vitest';
import {
  PET_COATS, PET_NAMES, PET_STATE_POSE, PET_DECAY,
  petMood, petFree, petWantsNow, petDecayNeeds, petEnd, petPick,
  weight, petScoreForActivity, petActivityLabel,
} from '../state/pets';
import type { Pet, PetNeeds } from '../state/pets';

function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: 'pet1',
    kind: 'cat',
    coat: PET_COATS.cat[0],
    furRGB: '217,130,43',
    name: 'Biscuit',
    level: 1,
    x: 5, y: 5, z: 0,
    alpha: 1,
    front: true,
    flip: 1,
    route: [],
    state: 'idle',
    pose: 'stand',
    timer: 0,
    seed: 0,
    needs: { food: 75, play: 55, love: 50 },
    bowlFood: 2,
    litterUses: 0,
    litterT: 0,
    hearts: 3,
    away: null,
    hold: null,
    cameIn: 0,
    spd: 1,
    want: null,
    who: null,
    next: null,
    ...overrides,
  };
}

describe('pets — constants', () => {
  it('has 4 cat coats and 3 dog coats', () => {
    expect(PET_COATS.cat.length).toBe(4);
    expect(PET_COATS.dog.length).toBe(3);
  });

  it('has 5 names per kind', () => {
    expect(PET_NAMES.cat.length).toBe(5);
    expect(PET_NAMES.dog.length).toBe(5);
  });

  it('PET_STATE_POSE maps all states', () => {
    expect(PET_STATE_POSE.potty).toBe('crouch');
    expect(PET_STATE_POSE.eat).toBe('eat');
    expect(PET_STATE_POSE.sleep).toBe('sleep');
    expect(PET_STATE_POSE.door).toBe('sit');
    expect(PET_STATE_POSE.idle).toBe('stand');
    expect(PET_STATE_POSE.groom).toBe('groom');
  });

  it('PET_DECAY has dog with bladder, cat without', () => {
    expect(PET_DECAY.dog.bladder).toBe(7);
    expect(PET_DECAY.cat.bladder).toBeUndefined();
    expect(PET_DECAY.dog.food).toBe(5);
    expect(PET_DECAY.cat.food).toBe(4);
  });
});

describe('pets — petMood', () => {
  it('returns happy when average > 70', () => {
    expect(petMood(makePet({ needs: { food: 80, play: 75, love: 70 } }))).toBe('happy');
  });

  it('returns okay when average 45-70', () => {
    expect(petMood(makePet({ needs: { food: 55, play: 50, love: 45 } }))).toBe('okay');
  });

  it('returns needy when average 25-45', () => {
    expect(petMood(makePet({ needs: { food: 35, play: 30, love: 25 } }))).toBe('needy');
  });

  it('returns miserable when average < 25', () => {
    expect(petMood(makePet({ needs: { food: 10, play: 5, love: 15 } }))).toBe('miserable');
  });
});

describe('pets — petFree', () => {
  it('free when not away, not held, not on stairs', () => {
    expect(petFree(makePet())).toBe(true);
  });

  it('not free when away', () => {
    expect(petFree(makePet({ away: { until: 100 } }))).toBe(false);
  });

  it('not free when held', () => {
    expect(petFree(makePet({ hold: {} }))).toBe(false);
  });

  it('not free when route has stair step', () => {
    expect(petFree(makePet({ route: [{ type: 'stair' }] }))).toBe(false);
  });
});

describe('pets — petWantsNow', () => {
  it('feed: true when food < 50 and no bowl food', () => {
    expect(petWantsNow(makePet({ want: 'feed', needs: { food: 30, play: 50, love: 50 }, bowlFood: 0 }))).toBe(true);
  });

  it('feed: false when bowl has food', () => {
    expect(petWantsNow(makePet({ want: 'feed', needs: { food: 30, play: 50, love: 50 }, bowlFood: 2 }))).toBe(false);
  });

  it('play: true when play < 55', () => {
    expect(petWantsNow(makePet({ want: 'play', needs: { food: 80, play: 40, love: 50 } }))).toBe(true);
  });

  it('love: false when love >= 55', () => {
    expect(petWantsNow(makePet({ want: 'love', needs: { food: 80, play: 80, love: 60 } }))).toBe(false);
  });

  it('null want returns false', () => {
    expect(petWantsNow(makePet({ want: null }))).toBe(false);
  });
});

describe('pets — petDecayNeeds', () => {
  it('decays cat needs over 60 game-minutes', () => {
    const p = makePet({ needs: { food: 75, play: 55, love: 50 } });
    petDecayNeeds(p, 60);
    expect(p.needs.food).toBeCloseTo(71, 0);
    expect(p.needs.play).toBeCloseTo(51, 0);
    expect(p.needs.love).toBeCloseTo(47, 0);
  });

  it('decays slower when asleep', () => {
    const p = makePet({ state: 'sleep', needs: { food: 75, play: 55, love: 50 } });
    petDecayNeeds(p, 60);
    expect(p.needs.food).toBeCloseTo(75 - 4 * 0.35, 1);
  });

  it('clamps at 0', () => {
    const p = makePet({ needs: { food: 1, play: 1, love: 1 } });
    petDecayNeeds(p, 1000);
    expect(p.needs.food).toBe(0);
  });
});

describe('pets — petEnd', () => {
  it('eating consumes bowl food and restores needs', () => {
    const p = makePet({ state: 'eat', bowlFood: 2, needs: { food: 30, play: 50, love: 50 } });
    petEnd(p);
    expect(p.bowlFood).toBe(1);
    expect(p.needs.food).toBe(90);
    expect(p.state).toBe('idle');
    expect(p.want).toBeNull();
  });

  it('litter increments uses and resets timer', () => {
    const p = makePet({ state: 'litter', litterUses: 2, litterT: 300 });
    petEnd(p);
    expect(p.litterUses).toBe(3);
    expect(p.litterT).toBe(0);
  });

  it('potty resets bladder', () => {
    const p: Pet = makePet({ kind: 'dog', state: 'potty', needs: { food: 80, play: 80, love: 80, bladder: 20 } });
    petEnd(p);
    expect(p.needs.bladder).toBe(100);
    expect(p.doorLogged).toBe(false);
  });

  it('resets state to idle', () => {
    const p = makePet({ state: 'sleep', pose: 'sleep' });
    petEnd(p);
    expect(p.state).toBe('idle');
    expect(p.pose).toBe('stand');
    expect(p.timer).toBe(0);
  });
});

describe('pets — petPick', () => {
  it('returns pet with lowest need', () => {
    const pets = [
      makePet({ id: 'a', needs: { food: 80, play: 60, love: 50 } }),
      makePet({ id: 'b', needs: { food: 80, play: 20, love: 50 } }),
    ];
    const p = petPick(pets, 'play');
    expect(p?.id).toBe('b');
  });

  it('returns null when no free pets', () => {
    const pets = [makePet({ hold: {} })];
    expect(petPick(pets, 'love')).toBeNull();
  });
});

describe('pets — weight', () => {
  it('returns 1 at 0, 0 at 100', () => {
    expect(weight(0)).toBe(1);
    expect(weight(100)).toBe(0);
    expect(weight(50)).toBe(0.5);
  });
});

describe('pets — petScoreForActivity', () => {
  it('returns -1 with no pets', () => {
    expect(petScoreForActivity([], 10, 'playPet', false, 10)).toBe(-1);
  });

  it('feedPet returns positive when pet hungry and food available', () => {
    const pets = [makePet({ needs: { food: 30, play: 50, love: 50 }, bowlFood: 0 })];
    const score = petScoreForActivity(pets, 10, 'feedPet', false, 10);
    expect(score).toBeGreaterThan(0);
  });

  it('feedPet returns -1 when no pet food', () => {
    const pets = [makePet({ needs: { food: 30, play: 50, love: 50 } })];
    expect(petScoreForActivity(pets, 0, 'feedPet', false, 10)).toBe(-1);
  });

  it('walkDog returns -1 outside walk hours', () => {
    const pets: Pet[] = [makePet({ kind: 'dog', needs: { food: 80, play: 30, love: 50, bladder: 20 } })];
    expect(petScoreForActivity(pets, 10, 'walkDog', false, 5)).toBe(-1);
    expect(petScoreForActivity(pets, 10, 'walkDog', false, 23)).toBe(-1);
  });

  it('maya gets multiplier bonus', () => {
    const pets = [makePet({ needs: { food: 30, play: 50, love: 50 }, bowlFood: 0 })];
    const j = petScoreForActivity(pets, 10, 'feedPet', false, 10);
    const m = petScoreForActivity(pets, 10, 'feedPet', true, 10);
    expect(m).toBeGreaterThan(j);
  });
});

describe('pets — petActivityLabel', () => {
  it('labels idle as Chilling', () => {
    expect(petActivityLabel(makePet({ state: 'idle' }), 10)).toBe('Chilling');
  });

  it('labels sleep at night as Asleep', () => {
    expect(petActivityLabel(makePet({ state: 'sleep' }), 23)).toBe('Asleep');
  });

  it('labels sleep during day as Napping', () => {
    expect(petActivityLabel(makePet({ state: 'sleep' }), 14)).toBe('Napping');
  });

  it('labels eat as Eating', () => {
    expect(petActivityLabel(makePet({ state: 'eat' }), 10)).toBe('Eating');
  });

  it('labels beg with want', () => {
    expect(petActivityLabel(makePet({ state: 'beg', want: 'feed' }), 10)).toBe('Begging for food');
    expect(petActivityLabel(makePet({ state: 'beg', want: 'play' }), 10)).toBe('Wants to play');
  });
});

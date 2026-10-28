import { describe, it, expect } from 'vitest';
import {
  PET_COATS, PET_NAMES, PET_STATE_POSE, PET_DECAY,
  petMood, petFree, petWantsNow, petDecayNeeds, petEnd, petPick,
  weight, petScoreForActivity, petActivityLabel,
} from '../state/pets';
import type { Pet, PetNeeds, PetWorld } from '../state/pets';
import { petDecide, createPet, revivePet, serializePet, pickName, pickCoat, petStatusText, petRoutineBlock, walkMinutes, LITTER, PET_ROUTINE, WALK } from '../state/pets';
import { statusText, createAgent } from '../state/agents';

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
  it('has 4 cat coats and 4 dog coats', () => {
    expect(PET_COATS.cat.length).toBe(4);
    expect(PET_COATS.dog.length).toBe(4);
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
    expect(petActivityLabel(makePet({ state: 'idle' }), 10)).toBe('Sunbathing upstairs'); // a cat's mid-morning, by the routine
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


// ---- Deciding, making and keeping pets ----

function world(over: Partial<PetWorld> = {}): PetWorld {
  const thing = (id: unknown) => (typeof id === 'string' ? { level: id === 'litter1' ? 0 : 1, at: (lx: number, ly: number): [number, number] => [4 + lx, 2 + ly] } : null);
  return {
    hour: 12, people: [{ id: 'jordan', level: 1, x: 5, y: 5, asleep: false, away: false }],
    thing, randomFree: (lv) => [lv + 1.5, 3.5], spotNear: (who) => [who.x + 0.75, who.y - 0.75],
    door: [0.6, 5.05], mainFloor: 1, yard: 3, floors: [0, 1, 2], rng: () => 0.99, ...over,
  };
}
const withThings = (over: Partial<Pet> = {}) => makePet({ bowl: 'bowl1', bed: 'bed1', litter: 'litter1', ...over });

describe('pets — deciding', () => {
  it('goes to the bowl when hungry and there is food in it', () => {
    const a = petDecide(withThings({ needs: { food: 40, play: 80, love: 80 }, bowlFood: 2 }), world());
    expect(a).toMatchObject({ kind: 'go', state: 'eat', level: 1 });
  });

  it('does not go to an empty bowl; begs for food from whoever is up instead', () => {
    const a = petDecide(withThings({ needs: { food: 30, play: 80, love: 80 }, bowlFood: 0 }), world());
    expect(a).toMatchObject({ kind: 'go', state: 'beg', want: 'feed', who: 'jordan' });
  });

  it('a cat uses the litter box when it is time, and goes beside it when the box is too dirty', () => {
    const w = world();
    expect(petDecide(withThings({ litterT: LITTER.every + 1, litterUses: 1 }), w)).toMatchObject({ kind: 'go', state: 'litter', level: 0 });
    const p = withThings({ litterT: LITTER.every + 1, litterUses: LITTER.tooDirty });
    expect(petDecide(p, w)).toMatchObject({ kind: 'accident', level: 0 });
    expect(p.litterT).toBe(0);
  });

  it('a dog that needs to go heads for the yard by day, and sits at the door when there is no yard', () => {
    const dog = () => withThings({ kind: 'dog', needs: { food: 80, play: 80, love: 80, bladder: 20 } });
    expect(petDecide(dog(), world())).toMatchObject({ kind: 'go', state: 'potty', level: 3 });
    expect(petDecide(dog(), world({ yard: null }))).toMatchObject({ kind: 'go', state: 'door', level: 1 });
  });

  it('sleeps in its bed at night', () => {
    const a = petDecide(withThings({ needs: { food: 80, play: 80, love: 80 } }), world({ hour: 3 }));
    expect(a).toMatchObject({ kind: 'go', state: 'sleep', dur: 120 });
  });

  it('with nothing pressing and nobody about, wanders to a free spot', () => {
    const a = petDecide(withThings({ needs: { food: 80, play: 80, love: 80 } }), world({ hour: 17, people: [], rng: () => 0.95 }));
    expect(a.kind).toBe('go');
    expect((a as { state: string }).state).toBe('idle');
  });

  it('a cat with time on its paws grooms', () => {
    // Not sleepy, not in the mood for company, then the grooming roll comes up.
    const rolls = [0.5, 0.5, 0.1];
    const a = petDecide(withThings({ needs: { food: 80, play: 80, love: 80 } }), world({ hour: 17, rng: () => rolls.shift() ?? 0.9 }));
    expect(a).toMatchObject({ kind: 'stay', state: 'groom' });
  });
});

describe('pets — making and keeping', () => {
  it('picks a name nobody has yet, and the coat the shop promised', () => {
    const taken = ['Biscuit', 'Mochi', 'Pepper', 'Juniper'];
    expect(pickName('cat', taken, () => 0.5)).toBe('Nori');
    expect(pickCoat('dog', 'corgi', () => 0).n).toBe('corgi');
    expect(pickCoat('dog', 'no such coat', () => 0).n).toBe('golden');
  });

  it('a new pet starts at the door with sensible needs', () => {
    const p = createPet('pet3', 'dog', pickCoat('dog', 'golden', () => 0), 'Waffles', { level: 1, x: 1.3, y: 5.3 }, 2);
    expect(p.needs.bladder).toBe(85);
    expect(p.state).toBe('idle');
    expect(p.face).toEqual([0, 1]);
  });

  it('survives a save and a load with its things, and shrugs off junk', () => {
    const p = withThings({ kind: 'cat', name: 'Nori', needs: { food: 33, play: 44, love: 55 }, bowlFood: 1, litterUses: 2, route: [{ type: 'stair' }], hold: {} });
    const back = revivePet(JSON.parse(JSON.stringify(serializePet(p))))!;
    expect(back.name).toBe('Nori');
    expect(back.needs).toEqual({ food: 33, play: 44, love: 55 });
    expect(back.bowl).toBe('bowl1'); expect(back.litter).toBe('litter1');
    expect(back.route).toEqual([]); expect(back.hold).toBeNull();
    expect(revivePet(null)).toBeNull();
    expect(revivePet({ kind: 'dog' })).toBeNull();
    const old = revivePet({ id: 'p1', kind: 'cat', name: 'Miso' })!; // the old game's save
    expect(old.kind).toBe('cat'); expect(old.needs.food).toBe(70);
  });

  it('says what they are up to, and with whom', () => {
    const p = withThings({ state: 'beg', want: 'play' });
    expect(petStatusText(p, 12, null)).toBe('Wants to play');
    expect(petStatusText(withThings({ state: 'sleep' }), 2, null)).toBe('Asleep');
    expect(petStatusText(withThings({ hold: 'maya' }), 12, { name: 'Maya', act: 'playPet', phase: 'do' })).toBe('Playing with Maya');
    expect(petStatusText(withThings({ hold: 'maya' }), 12, { name: 'Maya', act: 'walkDog', phase: 'walk' })).toBe('Off for a walk with Maya');
  });
});


describe('pets — the day\'s routine', () => {
  const rested = (over: Partial<Pet> = {}) => withThings({ needs: { food: 80, play: 80, love: 80, ...(over.kind === 'dog' ? { bladder: 90 } : {}) }, ...over });

  it('has a block for every hour of the day, for both kinds, wrapping midnight', () => {
    for (const kind of ['cat', 'dog'] as const) {
      for (let h = 0; h < 24; h += 0.25) expect(petRoutineBlock(kind, h), `${kind} ${h}`).toBeTruthy();
      const covered = PET_ROUTINE[kind].reduce((n, b) => n + ((b.to - b.from + 24) % 24 || 24), 0);
      expect(covered, `${kind} blocks cover the day once`).toBeCloseTo(24, 6);
    }
    expect(petRoutineBlock('dog', 23.5).name).toBe('night');
    expect(petRoutineBlock('dog', 6).name).toBe('night');
    expect(petRoutineBlock('dog', 15).name).toBe('afternoon');
  });

  it('a dog roams the main floor, upstairs and the yard, and never the basement', () => {
    const levels = new Set<number>();
    for (let h = 0; h < 24; h += 0.5) {
      for (const seed of [0.05, 0.3, 0.6, 0.9]) {
        const rolls = [0.99, seed, 0.2, seed]; // no nap; the yard roll; then a wander to a floor the block likes
        const a = petDecide(rested({ kind: 'dog', level: 1 }), world({ hour: h, people: [], rng: () => rolls.shift() ?? seed }));
        if (a.kind === 'go') levels.add(a.level);
      }
    }
    expect(levels.has(0)).toBe(false);
    expect(levels.has(1)).toBe(true);
    expect(levels.has(2)).toBe(true);
    expect(levels.has(3)).toBe(true);
  });

  it('a cat can prowl the basement in the late afternoon', () => {
    const levels = new Set<number>();
    for (const seed of [0.02, 0.2, 0.4, 0.6, 0.8]) {
      const rolls = [0.99, 0.99, 0.0, seed]; // no nap, no groom; a wander, picking by the seed
      const a = petDecide(rested({ level: 1 }), world({ hour: 17, people: [], rng: () => rolls.shift() ?? seed }));
      if (a.kind === 'go') levels.add(a.level);
    }
    expect(levels.has(0)).toBe(true);
  });

  it('naps at midday when the roll says so, and heads for the yard in the afternoon', () => {
    const nap = petDecide(rested({ kind: 'dog' }), world({ hour: 13, rng: () => 0.5 }));
    expect(nap).toMatchObject({ kind: 'go', state: 'sleep' });
    const rolls = [0.99, 0.99, 0.3, 0.7];
    const yard = petDecide(rested({ kind: 'dog' }), world({ hour: 15, rng: () => rolls.shift() ?? 0.9 }));
    expect(yard).toMatchObject({ kind: 'go', level: 3, state: 'sit' });
  });

  it('keeps the family company in the evening', () => {
    const rolls = [0.99, 0.5];
    const a = petDecide(rested({ kind: 'dog' }), world({ hour: 19, rng: () => rolls.shift() ?? 0.9 }));
    expect(a).toMatchObject({ kind: 'go', state: 'sit', who: 'jordan' });
  });

  it('a walk round the block takes half an hour to fifty minutes, and the walker is out of the house', () => {
    expect(walkMinutes(() => 0)).toBe(WALK.min);
    expect(walkMinutes(() => 1)).toBe(WALK.max);
    const ch = createAgent('jordan', 'Jordan', undefined, { skin: '#000', hair: '#000', top: '#000', topStyle: 'tee', bottom: '#000', longHair: false });
    ch.away = 'walk';
    expect(statusText(ch)).toBe('Out walking the dog');
    expect(petStatusText(withThings({ kind: 'dog', away: { until: 9 * 60 + 5 } }), 8, null)).toBe('Out for a walk, back around 9:05 AM');
  });
});


describe('pets — noticing each other', () => {
  const rested = (over: Partial<Pet> = {}) => withThings({ needs: { food: 80, play: 80, love: 80, ...(over.kind === 'dog' ? { bladder: 90 } : {}) }, ...over });
  const other = (over: Partial<NonNullable<PetWorld['others']>[number]> = {}) => ({ id: 'pet2', kind: 'dog' as const, level: 1, x: 6, y: 4, z: 0, state: 'idle' as const, busy: false, ...over });

  it('sleepy with another pet already asleep, half the time curls up with them instead of going to bed', () => {
    const rolls = [0.2, 0.2]; // sleepy; then the curl-up roll
    const a = petDecide(rested(), world({ hour: 13, rng: () => rolls.shift() ?? 0.9, others: [other({ state: 'sleep', z: 0.1 })] }));
    expect(a).toMatchObject({ kind: 'go', state: 'cuddle', who: 'pet2', level: 1 });
    const rolls2 = [0.2, 0.9];
    const alone = petDecide(rested(), world({ hour: 13, rng: () => rolls2.shift() ?? 0.9, others: [other({ state: 'sleep' })] }));
    expect(alone).toMatchObject({ kind: 'go', state: 'sleep' }); // the other roll came up heads: its own bed
  });

  it('with a play need and another pet awake, goes to romp with them', () => {
    const rolls = [0.99, 0.99, 0.1];
    const a = petDecide(rested({ needs: { food: 80, play: 50, love: 80 } }), world({ hour: 17, rng: () => rolls.shift() ?? 0.9, others: [other()] }));
    expect(a).toMatchObject({ kind: 'go', state: 'romp', who: 'pet2', dur: 6 });
  });

  it('a dog with nothing on tags along after the cat', () => {
    const rolls = [0.99, 0.99, 0.1]; // not sleepy, not off to a person; the tag-along roll
    const a = petDecide(rested({ kind: 'dog' }), world({ hour: 19, rng: () => rolls.shift() ?? 0.9, others: [other({ id: 'cat1', kind: 'cat' })] }));
    expect(a).toMatchObject({ kind: 'go', state: 'sit', who: 'cat1' });
  });

  it('ignores a pet that is held, away or on the stairs, and never notices itself', () => {
    const rolls = [0.2, 0.2];
    const a = petDecide(rested({ id: 'pet1' }), world({ hour: 13, rng: () => rolls.shift() ?? 0.9, others: [other({ id: 'pet1', state: 'sleep' }), other({ state: 'sleep', busy: true })] }));
    expect((a as { state: string }).state).toBe('sleep');
  });

  it('a romp is worth a play, and the labels name the friend', () => {
    const p = rested({ state: 'romp', who: 'pet2', needs: { food: 80, play: 40, love: 50 } });
    petEnd(p);
    expect(p.needs.play).toBe(65);
    expect(petStatusText(withThings({ state: 'romp', who: 'pet2' }), 12, null, { pet2: 'Waffles' })).toBe('Playing with Waffles');
    expect(petStatusText(withThings({ state: 'cuddle', who: 'pet2' }), 12, null, { pet2: 'Waffles' })).toBe('Curled up with Waffles');
    expect(petStatusText(withThings({ state: 'sit', who: 'pet2' }), 12, null, { pet2: 'Waffles' })).toBe('Hanging out with Waffles');
    expect(petStatusText(withThings({ state: 'sit', who: 'jordan' }), 12, null, { pet2: 'Waffles' })).toBe('Hanging out');
  });
});

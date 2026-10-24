// Activity animation: where a character's hands, elbows and body go for each
// pose at time t. Pure and art-free so it can be tested; houseArt draws it.
//
// Positions are in the character's own frame, in world units:
//   f = forward (the way they face), s = outward from the body (multiplied by
//   the side, -1 left / +1 right), z = height relative to the shoulder.
// A hand spec is [f, s, z]. Elbows are optional; without one the arm bends
// a little below the midpoint.

const TAU = Math.PI * 2;
const wave = (t, speed, phase = 0) => Math.sin(t * speed + phase);
/** 0..1 that rises and holds: for "every few seconds, lift the cup". */
function pulse(t, period, on, phase = 0) {
  const u = ((t + phase) % period) / period;
  if (u > on) return 0;
  return Math.sin((u / on) * Math.PI);
}

/**
 * The rig for one pose. Fields (all optional):
 *   hands: { [-1]: [f,s,z], [1]: [f,s,z] }  hand targets per side
 *   elbows: { [-1]: [f,s,z], [1]: [f,s,z] } elbow positions per side
 *   legs: 'run' | 'crouch' | 'kneel' | 'step' | 'swim'
 *   phase: number   leg cycle phase for 'run' / 'step'
 *   bob: number     extra hip lift (world units)
 *   drop: number    lower the hips (crouching)
 *   lean: number    lean forward (world units at the shoulder)
 *   headDown: bool  look down (reading, petting)
 *   talk: bool      mouth moves (phone calls)
 *   props: [{ kind, side, ...}]  things in hand, drawn after the arms
 */
export function poseRig(pose, t, seed = 0, act = null, actMin = 0) {
  const ph = seed * 3.7;
  // An activity can have its own clip on top of the pose it shares with others
  // (piano and the bike both sit like the desk, but don't look like typing).
  const clip = act && ACT_CLIPS[act] ? ACT_CLIPS[act](t, ph, actMin) : null;
  if (clip) return clip;
  switch (pose) {
    case 'cook': {
      // One hand stirs a pot in small circles, the other steadies it.
      const a = t * 5 + ph;
      return {
        hands: { 1: [0.32 + Math.cos(a) * 0.05, 0.02 + Math.sin(a) * 0.05, -0.2], [-1]: [0.3, 0.1, -0.22] },
        lean: 0.03,
        props: [{ kind: 'spoon', side: 1 }],
      };
    }
    case 'eat':
    case 'eatOut': {
      // Fork from the plate to the mouth every few seconds.
      const lift = pulse(t, 3.2, 0.45, ph);
      return {
        hands: { 1: [0.28 - lift * 0.18, 0.04 - lift * 0.02, -0.24 + lift * 0.44], [-1]: [0.26, 0.08, -0.26] },
        headDown: lift < 0.2,
        props: [{ kind: 'fork', side: 1 }],
      };
    }
    case 'sip': {
      const lift = pulse(t, 4.5, 0.4, ph);
      return {
        hands: { 1: [0.2 - lift * 0.1, 0.03, -0.18 + lift * 0.38], [-1]: [0.16, 0.08, -0.26] },
        props: [{ kind: 'cup', side: 1 }],
      };
    }
    case 'shower': {
      // Scrubbing their hair, hands moving in turn.
      return {
        hands: {
          1: [0.04 + wave(t, 7, ph) * 0.04, 0.07, 0.34 + wave(t, 9, ph) * 0.05],
          [-1]: [0.04 - wave(t, 7, ph) * 0.04, 0.07, 0.34 - wave(t, 9, ph) * 0.05],
        },
        elbows: { 1: [0.04, 0.2, 0.16], [-1]: [0.04, 0.2, 0.16] },
        props: [{ kind: 'water' }],
      };
    }
    case 'read':
      return {
        hands: { 1: [0.24, 0.07, -0.16], [-1]: [0.24, 0.07, -0.16] },
        headDown: true,
        props: [{ kind: 'book', flip: pulse(t, 6, 0.12, ph) }],
      };
    case 'phone':
      return {
        hands: { 1: [0.03, 0.07, 0.27], [-1]: [0.1, 0.1, -0.3] },
        elbows: { 1: [0.08, 0.17, 0.0] },
        talk: pulse(t, 5, 0.7, ph) > 0.05,
        props: [{ kind: 'phone', side: 1 }],
      };
    case 'tv': {
      // Hands in the lap; a laugh now and then.
      const laugh = pulse(t, 9, 0.18, ph);
      return { hands: { 1: [0.2, 0.05, -0.32], [-1]: [0.2, 0.05, -0.32] }, bob: laugh * 0.03 };
    }
    case 'run': {
      // Treadmill: a full running cycle in place, arms pumping bent.
      const p = t * 11 + ph;
      return {
        legs: 'run', phase: p,
        bob: Math.abs(Math.sin(p)) * 0.05,
        lean: 0.04,
        hands: { 1: [0.1 + Math.sin(p) * 0.12, 0.08, -0.16], [-1]: [0.1 - Math.sin(p) * 0.12, 0.08, -0.16] },
        elbows: { 1: [-0.02 + Math.sin(p) * 0.06, 0.12, -0.2], [-1]: [-0.02 - Math.sin(p) * 0.06, 0.12, -0.2] },
      };
    }
    case 'lift': {
      // Dumbbell press: from the shoulders to overhead and back.
      const c = (1 - Math.cos(t * 3.2 + ph)) / 2;
      return {
        hands: { 1: [0.04, 0.16, 0.02 + c * 0.52], [-1]: [0.04, 0.16, 0.02 + c * 0.52] },
        elbows: { 1: [0.04, 0.22, -0.08 + c * 0.28], [-1]: [0.04, 0.22, -0.08 + c * 0.28] },
        drop: c * 0.02,
        props: [{ kind: 'dumbbell', side: 1 }, { kind: 'dumbbell', side: -1 }],
      };
    }
    case 'stretch': {
      // Arms overhead, leaning slowly side to side.
      const s = wave(t, 1.1, ph);
      return { hands: { 1: [0, 0.04 + s * 0.1, 0.66], [-1]: [0, 0.04 - s * 0.1, 0.66] },
        elbows: { 1: [0, 0.1 + s * 0.06, 0.34], [-1]: [0, 0.1 - s * 0.06, 0.34] }, bob: 0.01 };
    }
    case 'switch':
      return { hands: { 1: [0.34, 0.06, 0.05], [-1]: [0.06, 0.12, -0.32] } };
    case 'reach': {
      // Picking things up and putting them away, one hand then the other.
      const a = pulse(t, 2.4, 0.5, ph), b = pulse(t, 2.4, 0.5, ph + 1.2);
      return {
        hands: { 1: [0.24 + a * 0.12, 0.08, -0.22 - a * 0.2], [-1]: [0.24 + b * 0.12, 0.08, -0.22 - b * 0.2] },
        drop: Math.max(a, b) * 0.06, lean: Math.max(a, b) * 0.05,
      };
    }
    case 'listen': {
      // Nodding along and snapping to the beat.
      const beat = Math.abs(Math.sin(t * 4.2 + ph));
      return {
        hands: { 1: [0.14, 0.14, -0.08 - beat * 0.06], [-1]: [0.12, 0.12, -0.3] },
        bob: beat * 0.02,
        props: [{ kind: 'notes' }],
      };
    }
    case 'arcade':
      // Mashing buttons and jerking the stick.
      return {
        hands: {
          1: [0.3, 0.06 + wave(t, 23, ph) * 0.015, -0.14 + Math.abs(wave(t, 17, ph)) * 0.025],
          [-1]: [0.3, 0.07 + wave(t, 6, ph) * 0.03, -0.14],
        },
        lean: 0.05,
      };
    case 'desk':
      // Typing: short taps in turn.
      return {
        hands: {
          1: [0.3, 0.05, -0.2 + Math.max(0, wave(t, 16, ph)) * 0.025],
          [-1]: [0.3, 0.05, -0.2 + Math.max(0, wave(t, 16, ph + Math.PI)) * 0.025],
        },
        lean: 0.03,
      };
    case 'water':
      return {
        hands: { 1: [0.3, 0.06, -0.12 + wave(t, 1.5, ph) * 0.03], [-1]: [0.12, 0.12, -0.3] },
        props: [{ kind: 'can', side: 1 }],
      };
    case 'mop': {
      // Both hands on the handle, sweeping side to side.
      const sw = wave(t, 3, ph);
      return {
        hands: { 1: [0.24, 0.02 + sw * 0.1, -0.22], [-1]: [0.2, 0.0 + sw * 0.1, -0.06] },
        lean: 0.05,
        props: [{ kind: 'mop', sweep: sw }],
      };
    }
    case 'pet': {
      // Crouched, stroking slowly.
      const st = wave(t, 2.6, ph);
      return {
        legs: 'crouch', drop: 0.26, lean: 0.08, headDown: true,
        hands: { 1: [0.34 + st * 0.06, 0.06, -0.5], [-1]: [0.2, 0.12, -0.42] },
      };
    }
    case 'play': {
      // Crouched, tossing a toy: wind up, then throw.
      const u = ((t + ph) % 2.2) / 2.2;
      const arm = u < 0.6 ? -u / 0.6 : (u - 0.6) / 0.4;
      return {
        legs: 'crouch', drop: 0.18, lean: 0.06,
        hands: { 1: [0.1 + arm * 0.22, 0.12, -0.05 + arm * 0.12], [-1]: [0.22, 0.1, -0.4] },
        props: u > 0.6 && u < 0.8 ? [{ kind: 'ball', side: 1 }] : [],
      };
    }
    case 'mow':
      return {
        legs: 'step', phase: t * 7 + ph,
        hands: { 1: [0.34, 0.09, -0.2], [-1]: [0.34, 0.09, -0.2] },
        lean: 0.05,
      };
    case 'swim': {
      // Freestyle: arms windmill in turn.
      const a = t * 4 + ph;
      return {
        // Chest-deep: legs stay under the water.
        legs: 'swim', drop: 0.5,
        hands: {
          1: [Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3],
          [-1]: [Math.cos(a + Math.PI) * 0.3, 0.12, Math.sin(a + Math.PI) * 0.3],
        },
        props: [{ kind: 'splash' }],
      };
    }
    case 'roll': {
      // Paint roller up and down the wall.
      const r = wave(t, 2.4, ph);
      return {
        hands: { 1: [0.32, 0.06, 0.04 + r * 0.22], [-1]: [0.1, 0.12, -0.3] },
        props: [{ kind: 'roller', side: 1 }],
      };
    }
    case 'wipe': {
      // Painting at the easel: short brush strokes, palette in the other hand.
      const u = ((t + ph) % 0.9) / 0.9;
      return {
        hands: { 1: [0.34, 0.04 + u * 0.08, -0.04 + Math.sin(u * Math.PI) * 0.08], [-1]: [0.16, 0.16, -0.22] },
        props: [{ kind: 'brush', side: 1 }, { kind: 'palette', side: -1 }],
      };
    }
    default:
      return null;
  }
}

/**
 * Clips for specific activities. actMin is game minutes into the activity,
 * which lets a clip move through steps (chop, stir, taste, plate).
 */
const ACT_CLIPS = {
  // Cooking walks through its steps over the cook.
  cook(t, ph, m) {
    const step = Math.floor(m / 6) % 4;
    if (step === 0) {
      // Chop: knife hand taps down fast, other hand holds the food.
      const chop = Math.abs(Math.sin(t * 9 + ph));
      return { hands: { 1: [0.3, 0.04, -0.2 + chop * 0.08], [-1]: [0.3, 0.12, -0.24] }, lean: 0.04, props: [{ kind: 'knife', side: 1 }] };
    }
    if (step === 2) {
      // Taste: spoon to the mouth, a little nod.
      const lift = pulse(t, 2.6, 0.5, ph);
      return { hands: { 1: [0.3 - lift * 0.22, 0.03, -0.2 + lift * 0.42], [-1]: [0.3, 0.1, -0.22] }, bob: lift * 0.01, props: [{ kind: 'spoon', side: 1 }] };
    }
    if (step === 3) {
      // Plate: both hands carry the plate across.
      const sw = wave(t, 1.6, ph);
      return { hands: { 1: [0.3, 0.02 + sw * 0.08, -0.22], [-1]: [0.3, 0.1 + sw * 0.08, -0.22] }, props: [{ kind: 'plate' }] };
    }
    return null; // stir: the plain cook pose
  },
  grill(t, ph) {
    // Flip with the spatula every couple of seconds.
    const flip = pulse(t, 2.2, 0.35, ph);
    return { hands: { 1: [0.34, 0.04, -0.2 + flip * 0.16], [-1]: [0.2, 0.12, -0.3] }, lean: 0.03, props: [{ kind: 'spatula', side: 1, flip }] };
  },
  piano(t, ph) {
    // Hands spread over the keys, playing in turn.
    return {
      hands: {
        1: [0.3, 0.14 + wave(t, 1.3, ph) * 0.04, -0.22 + Math.max(0, wave(t, 11, ph)) * 0.03],
        [-1]: [0.3, 0.14 - wave(t, 1.1, ph) * 0.04, -0.22 + Math.max(0, wave(t, 9, ph + 1)) * 0.03],
      },
      bob: Math.abs(wave(t, 2.2, ph)) * 0.01,
    };
  },
  guitar(t, ph) {
    // Strumming hand sweeps, fretting hand up the neck.
    return {
      hands: { 1: [0.16, 0.0, -0.3 + wave(t, 8, ph) * 0.05], [-1]: [0.22, 0.22, -0.12 + wave(t, 0.8, ph) * 0.02] },
      bob: Math.abs(wave(t, 4, ph)) * 0.015,
      props: [{ kind: 'guitar' }],
    };
  },
  boxing(t, ph) {
    // Jab, cross, hook on the bag, then reset.
    const u = ((t + ph) % 1.8) / 1.8;
    const jab = u < 0.2 ? Math.sin((u / 0.2) * Math.PI) : 0;
    const cross = u > 0.25 && u < 0.45 ? Math.sin(((u - 0.25) / 0.2) * Math.PI) : 0;
    const hook = u > 0.5 && u < 0.72 ? Math.sin(((u - 0.5) / 0.22) * Math.PI) : 0;
    return {
      hands: {
        [-1]: [0.12 + jab * 0.3, 0.08, -0.04 + hook * 0.02],
        1: [0.12 + cross * 0.32 + hook * 0.18, 0.08 - hook * 0.12, -0.04],
      },
      elbows: { [-1]: [0.04 + jab * 0.14, 0.16, -0.14], 1: [0.04 + cross * 0.14, 0.18 - hook * 0.04, -0.1 + hook * 0.06] },
      legs: 'step', phase: t * 5 + ph, lean: 0.04 + (jab + cross) * 0.03,
      props: [{ kind: 'gloves' }],
    };
  },
  bike(t, ph) {
    return { legs: 'pedal', phase: t * 7 + ph, hands: { 1: [0.32, 0.1, -0.22], [-1]: [0.32, 0.1, -0.22] }, lean: 0.08, bob: Math.abs(wave(t, 7, ph)) * 0.01 };
  },
  stretch(t, ph) {
    // Yoga flow: reach up, tree pose, warrior arms, every few seconds.
    const step = Math.floor((t + ph) / 4) % 3;
    if (step === 0) return { hands: { 1: [0, 0.04, 0.66], [-1]: [0, 0.04, 0.66] }, elbows: { 1: [0, 0.1, 0.34], [-1]: [0, 0.1, 0.34] }, bob: 0.01 };
    if (step === 1) return { hands: { 1: [0.12, 0.02, -0.12], [-1]: [0.12, 0.02, -0.12] }, legs: 'tree', bob: 0.01 };
    return { hands: { 1: [0.36, 0.06, -0.02], [-1]: [-0.36, 0.06, -0.02] }, elbows: { 1: [0.18, 0.06, -0.01], [-1]: [-0.18, 0.06, -0.01] }, legs: 'lunge' };
  },
  stargaze() {
    return { hands: { 1: [-0.04, 0.14, 0.12], [-1]: [-0.04, 0.14, 0.12] }, elbows: { 1: [0.02, 0.24, 0.06], [-1]: [0.02, 0.24, 0.06] }, lookUp: true };
  },
  unpack(t, ph, m) {
    // Cut the tape, lift something out, set it down.
    const step = Math.floor(m * 1.5) % 3;
    if (step === 0) return { hands: { 1: [0.3, 0.02 + wave(t, 6, ph) * 0.08, -0.32], [-1]: [0.3, 0.1, -0.34] }, drop: 0.08, lean: 0.06, props: [{ kind: 'knife', side: 1 }] };
    if (step === 1) {
      const up = (1 - Math.cos(t * 2 + ph)) / 2;
      return { hands: { 1: [0.26, 0.06, -0.36 + up * 0.3], [-1]: [0.26, 0.06, -0.36 + up * 0.3] }, drop: (1 - up) * 0.1, props: [{ kind: 'parcel' }] };
    }
    return { hands: { 1: [0.36, 0.06, -0.26], [-1]: [0.36, 0.06, -0.26] }, lean: 0.08, props: [{ kind: 'parcel' }] };
  },
  laundry(t, ph) {
    // Folding: hands meet and part.
    const f = (1 - Math.cos(t * 2.6 + ph)) / 2;
    return { hands: { 1: [0.28, 0.04 + f * 0.12, -0.2], [-1]: [0.28, 0.04 + f * 0.12, -0.2] }, props: [{ kind: 'cloth', open: f }] };
  },
  phone(t, ph, m) {
    // Calls and scrolling take turns.
    if (Math.floor(m / 8) % 2 === 1) {
      return { hands: { 1: [0.2, 0.04, -0.12], [-1]: [0.2, 0.08, -0.16] }, headDown: true, props: [{ kind: 'phone', side: 1, scroll: (t * 1.5) % 1 }] };
    }
    return null;
  },
  dance: (t, ph) => danceClip(t, ph, 0),
  jukebox: (t, ph) => danceClip(t, ph, 1),
  danceTogether: (t, ph) => danceClip(t, ph, 2),
  gDance: (t, ph) => danceClip(t, ph, 1),
  hammock: () => null,
};

/** Three dance styles: disco point, side-to-side sway, bouncy arms-up party. */
function danceClip(t, ph, style) {
  const b = t * 6 + ph;
  if (style === 0) {
    const up = Math.sin(b * 0.5) > 0;
    return {
      legs: 'step', phase: b,
      bob: Math.abs(Math.sin(b)) * 0.05,
      hands: { 1: up ? [0.1, 0.18, 0.5] : [0.1, 0.1, -0.3], [-1]: up ? [0.08, 0.1, -0.28] : [0.1, 0.18, 0.5] },
    };
  }
  if (style === 1) {
    const s = Math.sin(b * 0.5);
    return { legs: 'step', phase: b * 0.5, bob: Math.abs(Math.sin(b)) * 0.03, hands: { 1: [0.16, 0.16 + s * 0.1, -0.06], [-1]: [0.16, 0.16 - s * 0.1, -0.06] } };
  }
  const h = Math.abs(Math.sin(b));
  return { legs: 'step', phase: b, bob: h * 0.06, hands: { 1: [0.06, 0.14, 0.4 + h * 0.12], [-1]: [0.06, 0.14, 0.4 + h * 0.12] } };
}

export const ANIMATED_POSES = [
  'cook', 'eat', 'eatOut', 'sip', 'shower', 'read', 'phone', 'tv', 'run', 'lift', 'stretch', 'switch',
  'reach', 'listen', 'arcade', 'desk', 'water', 'mop', 'pet', 'play', 'mow', 'swim', 'roll', 'wipe',
];

export { TAU };

/**
 * Idle life: while standing around, a character fidgets every few seconds
 * instead of freezing. Picks a fidget per window of time; mood tilts the
 * choice (tired people yawn and stretch, happy ones bounce).
 */
const FIDGETS = {
  phone: () => ({ idle: true, hands: { 1: [0.2, 0.04, -0.14], [-1]: [0.06, 0.12, -0.34] }, headDown: true, props: [{ kind: 'phone', side: 1 }] }),
  scratch: (t) => ({ idle: true, hands: { 1: [0.02, 0.06, 0.3 + Math.sin(t * 14) * 0.02], [-1]: [0.06, 0.12, -0.34] }, elbows: { 1: [0.04, 0.2, 0.12] } }),
  hips: () => ({ idle: true, hands: { 1: [0, 0.16, -0.36], [-1]: [0, 0.16, -0.36] }, elbows: { 1: [-0.02, 0.26, -0.18], [-1]: [-0.02, 0.26, -0.18] } }),
  yawn: (t) => ({ idle: true, hands: { 1: [0.06, 0.04, 0.12], [-1]: [0.04, 0.14, 0.5] }, yawn: true, bob: Math.sin(t * 2) * 0.01 }),
  stretch: () => ({ idle: true, hands: { 1: [0, 0.06, 0.62], [-1]: [0, 0.06, 0.62] }, elbows: { 1: [0, 0.12, 0.32], [-1]: [0, 0.12, 0.32] }, bob: 0.015 }),
  bounce: (t) => ({ idle: true, hands: { 1: [0.06, 0.12, -0.3], [-1]: [0.06, 0.12, -0.3] }, bob: Math.abs(Math.sin(t * 5)) * 0.03 }),
  look: () => null, // just the default idle, with a long look around
};

const FIDGET_POOL = {
  tired: ['yawn', 'stretch', 'look', 'hips', 'look'],
  happy: ['bounce', 'phone', 'look', 'scratch', 'bounce'],
  playful: ['bounce', 'phone', 'hips', 'bounce', 'look'],
  annoyed: ['hips', 'look', 'scratch', 'hips', 'phone'],
  sad: ['look', 'look', 'phone', 'hips', 'look'],
  neutral: ['look', 'phone', 'scratch', 'look', 'hips', 'stretch'],
};

export function idleRig(t, seed = 0, expr = 'neutral') {
  const win = 6.5, n = Math.floor((t + seed * 13) / win), u = ((t + seed * 13) % win) / win;
  // Half of each window is plain standing, so fidgets read as moments.
  if (u < 0.5) return null;
  const pool = FIDGET_POOL[expr] || FIDGET_POOL.neutral;
  const pick = pool[Math.abs(Math.floor(Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453)) % pool.length];
  return FIDGETS[pick](t);
}

/** How someone looks, from their needs (0-100 each). */
export function expressionFor(needs) {
  if (!needs) return 'neutral';
  const { energy = 50, food = 50, hygiene = 50, fun = 50, comfort = 50, social = 50 } = needs;
  if (energy < 25) return 'tired';
  if (Math.min(food, hygiene, comfort) < 20) return 'annoyed';
  if (social < 20 || fun < 15) return 'sad';
  const avg = (energy + food + hygiene + fun + comfort + social) / 6;
  if (fun > 80 && avg > 60) return 'playful';
  if (avg >= 65) return 'happy';
  return 'neutral';
}

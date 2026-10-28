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
 *   nod: number     head dip (world units, + up): nodding along, glancing at the work
 *   snap: bool      arms follow the targets tightly, for fast taps and punches
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
      const a = t * 4.5 + ph;
      return {
        hands: { 1: [0.32 + Math.cos(a) * 0.12, 0.02 + Math.sin(a) * 0.12, -0.2 + Math.sin(a) * 0.03], [-1]: [0.3, 0.1, -0.22] },
        lean: 0.04 + Math.sin(a) * 0.01, headDown: true,
        props: [{ kind: 'spoon', side: 1 }],
      };
    }
    case 'eat':
    case 'eatOut': {
      // Fork from the plate to the mouth every few seconds.
      const lift = pulse(t, 3.2, 0.45, ph), cyc = ((t + ph) % 3.2) / 3.2;
      return {
        hands: { 1: [0.28 - lift * 0.18, 0.04 - lift * 0.02, -0.24 + lift * 0.44], [-1]: [0.26, 0.08, -0.26] },
        headDown: lift < 0.2, nod: -lift * 0.03,
        props: [{ kind: 'fork', side: 1, food: cyc < 0.225 }],
      };
    }
    case 'sip': {
      const lift = pulse(t, 4.5, 0.4, ph);
      return {
        hands: { 1: [0.2 - lift * 0.1, 0.03, -0.18 + lift * 0.38], [-1]: [0.16, 0.08, -0.26] },
        nod: lift * 0.03,
        props: [{ kind: 'cup', side: 1, steam: lift < 0.15 }],
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
    case 'read': {
      const flip = pulse(t, 6, 0.12, ph);
      return {
        hands: { 1: [0.24, 0.07 + flip * 0.1, -0.16 + flip * 0.12], [-1]: [0.24, 0.07, -0.16] },
        headDown: true, nod: wave(t, 0.6, ph) * 0.012,
        props: [{ kind: 'book', flip }],
      };
    }
    case 'phone': {
      // Talking with the free hand: it rises and falls with the speech.
      const speaking = pulse(t, 5, 0.7, ph) > 0.05, gest = Math.max(0, wave(t, 2.6, ph)) * (speaking ? 1 : 0.2);
      return {
        hands: { 1: [0.03, 0.07, 0.27], [-1]: [0.12 + gest * 0.1, 0.1 + gest * 0.06, -0.3 + gest * 0.28] },
        elbows: { 1: [0.08, 0.17, 0.0] },
        talk: speaking, nod: speaking ? wave(t, 3.4, ph) * 0.015 : 0,
        props: [{ kind: 'phone', side: 1 }],
      };
    }
    case 'tv': {
      // Hands in the lap; a laugh now and then.
      const laugh = pulse(t, 9, 0.18, ph);
      return {
        hands: { 1: [0.2 - laugh * 0.14, 0.05, -0.32 + laugh * 0.55], [-1]: [0.2 - laugh * 0.14, 0.05, -0.32 + laugh * 0.55] },
        bob: laugh * (0.025 + Math.abs(Math.sin(t * 14)) * 0.03), talk: laugh > 0.25,
      };
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
      return { hands: { 1: [0.34, 0.06, 0.05], [-1]: [0.06, 0.12, -0.32] }, grip: { 1: 'point' } };
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
          1: [0.3, 0.06 + wave(t, 19, ph) * 0.08, -0.14 + Math.abs(wave(t, 14, ph)) * 0.1],
          [-1]: [0.3, 0.07 + wave(t, 5, ph) * 0.1, -0.14 + Math.max(0, wave(t, 11, ph + 1)) * 0.05],
        },
        lean: 0.05 + wave(t, 7, ph) * 0.02, nod: wave(t, 9, ph) * 0.02, snap: true,
        grip: { 1: 'point', [-1]: 'fist' },
      };
    case 'desk':
      // Typing: short taps in turn.
      return {
        hands: {
          1: [0.3, 0.05 + wave(t, 1.1, ph) * 0.05, -0.2 + Math.max(0, wave(t, 16, ph)) * 0.1],
          [-1]: [0.3, 0.05 - wave(t, 1.1, ph) * 0.05, -0.2 + Math.max(0, wave(t, 16, ph + Math.PI)) * 0.1],
        },
        lean: 0.03 + wave(t, 0.5, ph) * 0.012, nod: wave(t, 0.9, ph) * 0.018, snap: true,
      };
    case 'water': {
      const tip = pulse(t, 4, 0.6, ph);
      return {
        hands: { 1: [0.3 + tip * 0.1, 0.06, -0.14 + tip * 0.22], [-1]: [0.12, 0.12, -0.3] },
        props: [{ kind: 'can', side: 1 }],
      };
    }
    case 'mop': {
      // Both hands on the handle, sweeping side to side.
      const sw = wave(t, 2.6, ph);
      return {
        hands: { 1: [0.24, 0.02 + sw * 0.22, -0.22], [-1]: [0.2, 0.0 + sw * 0.22, -0.06] },
        lean: 0.05 + (1 - Math.abs(sw)) * 0.03, bob: Math.abs(sw) * 0.015,
        props: [{ kind: 'mop', sweep: sw }],
      };
    }
    case 'pet': {
      // Crouched, stroking slowly.
      const st = wave(t, 2.6, ph);
      return {
        legs: 'crouch', drop: 0.26, lean: 0.08, headDown: true,
        hands: { 1: [0.34 + st * 0.14, 0.06 + st * 0.04, -0.5 + Math.abs(st) * 0.05], [-1]: [0.2, 0.12, -0.42] },
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
        hands: { 1: [0.34, 0.04 + u * 0.2, -0.04 + Math.sin(u * Math.PI) * 0.14], [-1]: [0.16, 0.16, -0.22] },
        props: [{ kind: 'brush', side: 1 }, { kind: 'palette', side: -1 }],
      };
    }
    // Poses that belong to one activity each: the activity's own clip.
    case 'jacks': return ACT_CLIPS.yardWorkout(t, ph);
    case 'snack': return ACT_CLIPS.snack(t, ph);
    case 'meditate': return ACT_CLIPS.meditate(t, ph);
    case 'jumprope': return ACT_CLIPS.jumprope(t, ph);
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
      const chop = Math.abs(Math.sin(t * 10 + ph));
      return { hands: { 1: [0.3, 0.04, -0.2 + chop * 0.22], [-1]: [0.3, 0.12, -0.24] }, lean: 0.04, nod: -0.02 - chop * 0.02, snap: true, props: [{ kind: 'knife', side: 1 }] };
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
    return { hands: { 1: [0.34, 0.04, -0.2 + flip * 0.3], [-1]: [0.2, 0.12, -0.3] }, lean: 0.03 + flip * 0.03, props: [{ kind: 'spatula', side: 1, flip }] };
  },
  piano(t, ph) {
    // Hands spread over the keys, playing in turn.
    return {
      hands: {
        1: [0.3, 0.14 + wave(t, 1.3, ph) * 0.1, -0.22 + Math.max(0, wave(t, 11, ph)) * 0.07],
        [-1]: [0.3, 0.14 - wave(t, 1.1, ph) * 0.1, -0.22 + Math.max(0, wave(t, 9, ph + 1)) * 0.07],
      },
      bob: Math.abs(wave(t, 2.2, ph)) * 0.02, lean: 0.02 + wave(t, 1.4, ph) * 0.02, nod: wave(t, 2.2, ph) * 0.025, snap: true,
      grip: { 1: 'open', [-1]: 'open' },
    };
  },
  guitar(t, ph) {
    // Strumming hand sweeps, fretting hand up the neck.
    return {
      hands: { 1: [0.16, 0.0, -0.3 + wave(t, 8, ph) * 0.13], [-1]: [0.22, 0.22 + wave(t, 0.8, ph) * 0.07, -0.12 + wave(t, 0.8, ph) * 0.04] },
      bob: Math.abs(wave(t, 4, ph)) * 0.035, lean: 0.02 + wave(t, 2, ph) * 0.02, nod: wave(t, 4, ph) * 0.025, snap: true,
      grip: { 1: 'relaxed', [-1]: 'fist' },
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
      legs: 'step', phase: t * 5 + ph, lean: 0.04 + (jab + cross) * 0.03, snap: true,
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
    return { hands: { 1: [0.36, 0.06, -0.02], [-1]: [-0.36, 0.06, -0.02] }, elbows: { 1: [0.18, 0.06, -0.01], [-1]: [-0.18, 0.06, -0.01] }, legs: 'lunge', drop: 0.12 };
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
    return { hands: { 1: [0.28, 0.04 + f * 0.28, -0.2 - f * 0.03], [-1]: [0.28, 0.04 + f * 0.28, -0.2 - f * 0.03] }, lean: 0.03 + f * 0.03, props: [{ kind: 'cloth', open: f }] };
  },
  phone(t, ph, m) {
    // Calls and scrolling take turns.
    if (Math.floor(m / 8) % 2 === 1) {
      return { hands: { 1: [0.2, 0.04, -0.12], [-1]: [0.2, 0.08, -0.16] }, headDown: true, grip: { [-1]: 'point' }, props: [{ kind: 'phone', side: 1, scroll: (t * 1.5) % 1 }] };
    }
    return null;
  },
  // ---- Everyday life ----
  newspaper(t, ph) {
    // Paper held open wide; a page turn now and then, a shake to straighten it.
    const turn = pulse(t, 7, 0.14, ph), shake = pulse(t, 11, 0.06, ph + 3), sway = wave(t, 1.3, ph) * 0.03;
    return {
      hands: { 1: [0.24, 0.2 - turn * 0.08, -0.12 + shake * 0.07 + sway + turn * 0.1], [-1]: [0.24, 0.2 - turn * 0.08, -0.12 + shake * 0.07 + sway + turn * 0.1] },
      props: [{ kind: 'paper', flip: turn }],
    };
  },
  rakeYard(t, ph) {
    // Long pulls toward the feet, then reach out again.
    const u = ((t + ph) % 1.6) / 1.6, pull = u < 0.65 ? u / 0.65 : 1 - (u - 0.65) / 0.35;
    return {
      hands: { 1: [0.3 - pull * 0.14, 0.04, -0.2], [-1]: [0.24 - pull * 0.12, 0.0, -0.04] },
      lean: 0.1 - pull * 0.05, legs: 'step', phase: 0,
      props: [{ kind: 'rake', pull }],
    };
  },
  yardWorkout(t, ph) {
    // Jumping jacks: arms clap overhead as the feet jump apart.
    const u = (1 - Math.cos(t * 6 + ph)) / 2;
    return {
      hands: { 1: [0.02, 0.26 - u * 0.14, -0.3 + u * 0.92], [-1]: [0.02, 0.26 - u * 0.14, -0.3 + u * 0.92] },
      elbows: { 1: [0.02, 0.26 + u * 0.04, -0.12 + u * 0.4], [-1]: [0.02, 0.26 + u * 0.04, -0.12 + u * 0.4] },
      legs: 'jack', spread: u * 0.2, bob: Math.abs(Math.sin(t * 6 + ph)) * 0.06, snap: true,
    };
  },
  phonePace(t, ph) {
    // Walking in little circles on a call, the free hand talking too.
    return {
      legs: 'step', phase: t * 4 + ph,
      hands: { 1: [0.03, 0.07, 0.27], [-1]: [0.16 + wave(t, 2.2, ph) * 0.06, 0.14, -0.14 + Math.abs(wave(t, 3, ph)) * 0.08] },
      elbows: { 1: [0.08, 0.17, 0.0] },
      talk: pulse(t, 4, 0.75, ph) > 0.05,
      props: [{ kind: 'phone', side: 1 }],
    };
  },
  snack(t, ph) {
    // Standing at the fridge, an apple to the mouth every couple of seconds.
    const bite = pulse(t, 2.4, 0.4, ph);
    return { hands: { 1: [0.2 - bite * 0.12, 0.06, -0.16 + bite * 0.36], [-1]: [0.08, 0.14, -0.32] }, props: [{ kind: 'apple', side: 1 }] };
  },
  wipeCounter(t, ph) {
    // Circles with a cloth, then a long wipe across.
    const a = t * 4 + ph, across = Math.floor((t + ph) / 3) % 2;
    const h1 = across ? [0.34, 0.05 + wave(t, 1.5, ph) * 0.18, -0.22] : [0.34 + Math.cos(a) * 0.06, 0.05 + Math.sin(a) * 0.08, -0.22];
    return { hands: { 1: h1, [-1]: [0.26, 0.14, -0.24] }, lean: 0.07, props: [{ kind: 'rag', side: 1 }] };
  },
  soloDance: (t, ph) => danceClip(t, ph, Math.floor(ph) % 3),
  journal(t, ph) {
    // Writing in short bursts, stopping to think (pen to the chin).
    const think = pulse(t, 9, 0.22, ph);
    const scrib = think > 0.05 ? 0 : wave(t, 14, ph) * 0.012;
    return {
      hands: { 1: think > 0.05 ? [0.12, 0.04, 0.12] : [0.3 + scrib, 0.04 + Math.max(0, wave(t, 1.3, ph)) * 0.05, -0.21], [-1]: [0.3, 0.14, -0.22] },
      headDown: think < 0.05, lean: 0.04,
      props: [{ kind: 'pen', side: 1 }],
    };
  },
  mirror(t, ph) {
    // Fixing their hair, a tilt of the head, a last look.
    const fix = wave(t, 3.2, ph);
    return {
      hands: { 1: [0.06, 0.1, 0.34 + fix * 0.1], [-1]: [0.04 + Math.max(0, fix) * 0.1, 0.12, 0.28] },
      elbows: { 1: [0.06, 0.24, 0.12], [-1]: [0.04, 0.24, 0.1] },
      bob: pulse(t, 5, 0.2, ph) * 0.01, nod: wave(t, 1.6, ph) * 0.02,
      props: [{ kind: 'comb', side: 1 }],
    };
  },
  foldClothes: (t, ph) => ACT_CLIPS.laundry(t, ph),
  makeBed(t, ph) {
    // Shake the duvet out across the bed, then smooth it flat.
    const u = ((t + ph) % 2.8) / 2.8, shake = u < 0.4 ? Math.sin((u / 0.4) * Math.PI) : 0;
    const smooth = u >= 0.4 ? wave(t, 2.4, ph) : 0;
    return {
      hands: { 1: [0.36, 0.2 + smooth * 0.1, -0.24 + shake * 0.3], [-1]: [0.36, 0.2 - smooth * 0.1, -0.24 + shake * 0.3] },
      lean: 0.12 - shake * 0.06, drop: 0.04,
      props: [{ kind: 'cloth', open: 0.5 + shake * 0.5 }],
    };
  },
  meditate(t, ph) {
    // Sitting cross-legged on the floor, hands on the knees, slow breaths.
    const breath = (1 - Math.cos(t * 0.9 + ph)) / 2;
    return { legs: 'crouch', drop: 0.42, hands: { 1: [0.16, 0.18, -0.46], [-1]: [0.16, 0.18, -0.46] }, bob: breath * 0.03, calm: true };
  },
  jumprope(t, ph) {
    // Small hops as the rope comes round, hands turning it at the hips.
    const a = t * 8 + ph;
    return {
      hands: { 1: [0.06 + Math.cos(a) * 0.03, 0.22, -0.3 + Math.sin(a) * 0.03], [-1]: [0.06 + Math.cos(a) * 0.03, 0.22, -0.3 + Math.sin(a) * 0.03] },
      bob: Math.max(0, Math.sin(a)) * 0.07, snap: true,
      props: [{ kind: 'rope', turn: a }],
    };
  },
  shadowbox: (t, ph) => ({ ...ACT_CLIPS.boxing(t, ph), props: [] }),
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
  'jacks', 'snack', 'meditate', 'jumprope',
];

export { TAU };

// ---- The walk and the seat: the parts of the rig every character shares ----

/** Leg bones in world units: hip to knee, knee to ankle, and how far the hips sit above a seat. */
export const LEG = { thigh: 0.31, shin: 0.31, hipRise: 0.03, sink: 0.08, stretch: 1.25 };
/** Arm reach from the shoulder, and the foot's length, in world units. */
export const ARM = { length: 0.42 };
export const FOOT = { length: 0.22, heel: 0.3 };
/** The stride: half a stride of body travel per plant, and how far a foot reaches, in world units. */
export const GAIT = { cycle: 0.68, reach: 0.17, lift: 0.075 };

/**
 * Where one foot is in the stride, as [forward, lift] from under the hip. The phase runs
 * 2*PI per full cycle (GAIT.cycle of body travel). While sin(phase) > 0 the foot swings
 * forward through the air on an arc; for the other half it is planted and slides straight
 * back at exactly the body's speed, so it holds its place on the floor instead of skating.
 */
export function gaitFoot(phase, amp = 1) {
  const u = ((phase % TAU) + TAU) % TAU, A = GAIT.reach * amp;
  if (u < Math.PI) return [-A * Math.cos(u), Math.sin(u) * GAIT.lift * amp];
  return [A * (1 - (2 * (u - Math.PI)) / Math.PI), 0];
}

/**
 * Walking arms, in the character's own frame (f forward, s outward, z from the shoulder).
 * Each arm swings opposite the leg on its side (the leg follows gaitFoot(phase) for side +1
 * and gaitFoot(phase + PI) for side -1), pivoting at the shoulder so the hand stays an arm's length
 * away, with the elbow bent a little forward. amp 0..1 fades the swing out as a walk ends,
 * leaving the arms hanging straight down.
 */
export function walkRig(phase, amp = 1) {
  const L = ARM.length;
  const arm = (side) => {
    // The leg on this side is furthest forward at phase PI (side +1) / 0 (side -1); the arm is furthest back there.
    const sw = Math.cos(phase + (side > 0 ? 0 : Math.PI)) * amp;
    const ang = sw * 0.55; // up to ~32 degrees forward and back
    const hand = [Math.sin(ang) * L, 0.13, -Math.cos(ang) * L + 0.02];
    // The elbow sits halfway up, pushed forward as the arm swings back (the forearm folds), and a touch outward.
    const elbow = [Math.sin(ang) * L * 0.5 + 0.03 + Math.max(0, -sw) * 0.05, 0.15, -Math.cos(ang) * L * 0.5];
    return { hand, elbow };
  };
  const r = arm(1), l = arm(-1);
  return { hands: { 1: r.hand, [-1]: l.hand }, elbows: { 1: r.elbow, [-1]: l.elbow } };
}

// ---- The head: it looks before the body turns, at whoever it is with, and around the room ----

/** How far the head turns from the body (radians) and how fast (radians a second). */
export const HEAD = { turn: 1.2, rate: 7, glance: 0.55 };
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Where the head wants to point: at a look target when there is one, else where the body is
 * heading (so the head leads a turn), plus any idle glance; never more than HEAD.turn from the
 * way the body faces, because necks only go so far.
 */
export function headTarget(bodyA, headingA, lookA = null, glance = 0) {
  const want = lookA != null ? lookA : headingA + glance;
  const d = Math.max(-HEAD.turn, Math.min(HEAD.turn, wrapAngle(want - bodyA)));
  return bodyA + d;
}

/** Turns the head from `ha` toward `target` the short way, no faster than HEAD.rate. */
export function turnHead(ha, target, dt) {
  const d = wrapAngle(target - ha);
  return ha + Math.max(-HEAD.rate * dt, Math.min(HEAD.rate * dt, d));
}

/** Standing around, a look to one side now and then: zero most of the time, a smooth turn and back otherwise. */
export function idleGlance(t, seed = 0) {
  const win = 7.5, n = Math.floor((t + seed * 11) / win), u = ((t + seed * 11) % win) / win;
  if (u < 0.5 || u > 0.85) return 0;
  const dir = Math.sin(n * 12.9898 + seed * 78.233) > 0 ? 1 : -1;
  return dir * HEAD.glance * Math.sin(((u - 0.5) / 0.35) * Math.PI);
}

/**
 * Tree pose: the raised foot rests against the standing leg's inner knee, its own knee turned
 * out. Returns the knee and foot as [outward, z] from the raised leg's hip, for a standing
 * leg whose hip is `hipGap` away and whose knee is at `kneeZ` above the floor.
 */
export function treeLeg(hipZ, hipGap = 0.2, kneeZ = LEG.shin) {
  const foot = [-hipGap + 0.03, kneeZ - hipZ];
  const knee = legIK([0, 0], foot); // bends toward +outward
  return { knee, foot };
}

/**
 * Two-bone leg: where the knee goes for a hip and a foot given as [forward, z], with the knee
 * bending forward. A foot out of reach straightens the leg toward it (a slight stretch, never
 * a gap), so a stride or a pedal never leaves a leg that grows and shrinks.
 */
export function legIK(hip, foot, thigh = LEG.thigh, shin = LEG.shin) {
  const dx = foot[0] - hip[0], dz = foot[1] - hip[1];
  const d = Math.hypot(dx, dz) || 1e-6;
  if (d >= thigh + shin) {
    const k = thigh / (thigh + shin);
    return [hip[0] + dx * k, hip[1] + dz * k];
  }
  // Law of cosines: the knee sits a distance `a` along the hip-foot line and `h` off it.
  const a = (thigh * thigh - shin * shin + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, thigh * thigh - a * a));
  const ux = dx / d, uz = dz / d;
  let px = -uz, pz = ux; // the perpendicular that points forward
  if (px < 0) { px = -px; pz = -pz; }
  return [hip[0] + ux * a + px * h, hip[1] + uz * a + pz * h];
}

/**
 * Sitting legs for a seat `seat` high, as [forward, z] from the hip's footprint on the seat.
 * The hip sinks a little into the cushion; the thigh runs forward to the knee; the shin
 * drops to the floor when it can (stretching a shade on tall seats, as cartoon legs do) and
 * otherwise the feet hang. On a low seat the knees rise so the feet still stand flat.
 */
export function seatLegs(seat) {
  const { thigh, shin, hipRise, sink, stretch } = LEG;
  const hipZ = hipRise - sink;
  // Knee height above the seat: level with the hip on a chair, rising on a low seat so a shin's length reaches the floor.
  const kneeZ = Math.max(hipZ - 0.06, Math.min(thigh * 0.85, shin - seat));
  const kneeF = Math.sqrt(Math.max(0.02, thigh * thigh - (kneeZ - hipZ) ** 2));
  const drop = seat + kneeZ; // the knee's height above the floor
  const reach = shin * stretch;
  if (drop > reach) {
    // Too tall a seat: the feet dangle, toes forward.
    return { hip: [0, hipZ], knee: [kneeF, kneeZ], foot: [kneeF + 0.05, kneeZ - Math.sqrt(reach * reach - 0.0025)], dangle: true };
  }
  const len = Math.max(shin, drop);
  return { hip: [0, hipZ], knee: [kneeF, kneeZ], foot: [kneeF + Math.sqrt(Math.max(0, len * len - drop * drop)), -seat], dangle: false };
}

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

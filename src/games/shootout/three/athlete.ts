import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// A basketball player built from smooth, overlapping shapes on a simple
// skeleton: a sculpted torso in a jersey, shorts, muscled two-part arms and
// legs, fingered hands, sneakers, and a head with a face and hair. Posed every
// frame from a few controls (running, crouch, carry, set point, release,
// celebrate). When the player has the ball, the ball is placed first and the
// arms reach it with two-bone IK, so the palms sit on its surface and the
// fingers wrap it. Local space: feet at y = 0, facing +z, about 1.95m tall.

export interface AthleteLook {
  jersey: [string, string];
  number: number;
  skin: string;
  hair: string;
  /** Sneaker accent colour. */
  accent?: string;
}

/** What the body is doing; every value blends 0..1 except the phases. */
export interface AthletePose {
  /** Jogging amount, and where in the stride (radians, keeps increasing). */
  run: number;
  stride: number;
  /** Knee bend (the dip before a jump, the landing). */
  crouch: number;
  /** Ball from the chest (0) to the set point above the forehead (1). */
  set: number;
  /** Shooting arm extending and the wrist flicking through (0..1); the ball has left. */
  release: number;
  /** Holding the ball at the chest (0 = hands free). */
  carry: number;
  /** Both arms up. */
  celebrate: number;
  /** Seconds, for idle breathing and the celebration wave. */
  t: number;
}

export const SKINS = ['#8D5A3B', '#5E3A22', '#B07850', '#D9A37E', '#F1C7A5', '#6B4329'];
export const HAIRS = ['#14100E', '#2B1B12', '#4A2E1C', '#0E0E10', '#6B4A2B'];

export const BALL_RADIUS = 0.12;
const UPPER = 0.3, FORE = 0.27, PALM = 0.065;

/**
 * A limb segment shaped by a radius profile (top to bottom), hanging from its
 * joint down to y = -len. Profiles give muscle shape (biceps, forearm, quad).
 */
function muscle(len: number, radii: number[], segs = 20): THREE.LatheGeometry {
  const pts = radii.map((r, i) => new THREE.Vector2(r, -len * (i / (radii.length - 1))));
  pts.unshift(new THREE.Vector2(0, 0)); pts.push(new THREE.Vector2(0, -len));
  return new THREE.LatheGeometry(pts.reverse(), segs);
}

/**
 * The jersey wrapped around the torso (lathe U = 0 is the front, 0.5 the back):
 * body colour, side panels, trim at the hem, and the number front and back.
 */
function jerseyMap(colors: [string, string], number: number): THREE.CanvasTexture {
  const W = 512, H = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = colors[0]; g.fillRect(0, 0, W, H);
  g.fillStyle = colors[1];
  [W * 0.25, W * 0.75].forEach(x => g.fillRect(x - 10, 0, 20, H));
  g.fillRect(0, H - 22, W, 8);
  const num = String(number);
  g.font = '900 78px Inter, Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = colors[1]; g.fillStyle = '#FFFFFF';
  [0, W, W / 2].forEach(x => { g.strokeText(num, x, H * 0.45); g.fillText(num, x, H * 0.45); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Scratch objects for the IK (no allocation per frame).
const V = () => new THREE.Vector3();
const _C = V(), _chest = V(), _set = V(), _dir = V(), _palm = V(), _pole = V(), _S = V(), _n = V(), _fing = V(), _W = V(), _toW = V(),
  _perp = V(), _up = V(), _E = V(), _fore = V(), _bend = V(), _x = V(), _y = V(), _wx = V(), _wy = V(), _wz = V(), _axisX = new THREE.Vector3(1, 0, 0);
const _rot = new THREE.Quaternion(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _sq = new THREE.Quaternion(), _m = new THREE.Matrix4();

export class Athlete {
  readonly group = new THREE.Group();
  private j: Record<string, THREE.Object3D> = {};
  private fingers: Record<'L' | 'R', THREE.Object3D[][]> = { L: [], R: [] };
  private thumbs = {} as Record<'L' | 'R', THREE.Object3D>;
  /** Where the ball is, in this athlete's local space (valid while holding it). */
  private ball = new THREE.Vector3(0, 1.3, 0.3);

  constructor(look: AthleteLook) {
    const skin = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.5 });
    const jersey = new THREE.MeshStandardMaterial({ map: jerseyMap(look.jersey, look.number), roughness: 0.75 });
    const trim = new THREE.MeshStandardMaterial({ color: look.jersey[1], roughness: 0.7 });
    const shorts = new THREE.MeshStandardMaterial({ color: look.jersey[0], roughness: 0.75 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0xf7f7f7, roughness: 0.4 });
    const sole = new THREE.MeshStandardMaterial({ color: look.accent ?? look.jersey[1], roughness: 0.5 });
    const hair = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.4 });
    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
    };
    const joint = (name: string, parent: THREE.Object3D, x: number, y: number, z = 0) => {
      const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); this.j[name] = o; return o;
    };

    // Pelvis and shorts.
    const pelvis = joint('pelvis', this.group, 0, 1.0);
    add(pelvis, new THREE.LatheGeometry([
      new THREE.Vector2(0.0, -0.13), new THREE.Vector2(0.19, -0.12), new THREE.Vector2(0.192, -0.04), new THREE.Vector2(0.168, 0.05), new THREE.Vector2(0.14, 0.1), new THREE.Vector2(0, 0.1),
    ], 28), shorts).scale.set(1.08, 1, 0.78);

    // Torso in a sleeveless jersey; trim at the collar; trapezius above the jersey line.
    const spine = joint('spine', pelvis, 0, 0.1);
    add(spine, new THREE.LatheGeometry([
      new THREE.Vector2(0.0, -0.035), new THREE.Vector2(0.178, -0.035), new THREE.Vector2(0.17, 0.04), new THREE.Vector2(0.164, 0.1), new THREE.Vector2(0.178, 0.22), new THREE.Vector2(0.196, 0.33),
      new THREE.Vector2(0.205, 0.42), new THREE.Vector2(0.192, 0.49), new THREE.Vector2(0.14, 0.53), new THREE.Vector2(0.07, 0.548), new THREE.Vector2(0.0, 0.55),
    ], 32), jersey).scale.set(1.12, 1, 0.72);
    add(spine, new THREE.TorusGeometry(0.073, 0.011, 8, 24), trim, 0, 0.535, 0.004).rotation.x = Math.PI / 2;
    add(spine, new THREE.SphereGeometry(0.1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), skin, 0, 0.5, -0.01).scale.set(1.75, 0.55, 0.85);

    // Neck and head.
    const neck = joint('neck', spine, 0, 0.53);
    add(neck, muscle(0.13, [0.056, 0.054, 0.06], 20), skin, 0, 0.12);
    const head = joint('head', neck, 0, 0.12);
    add(head, new THREE.SphereGeometry(0.107, 32, 24), skin, 0, 0.1).scale.set(0.92, 1.12, 1);
    add(head, new THREE.SphereGeometry(0.062, 20, 14), skin, 0, 0.035, 0.034).scale.set(1.3, 0.92, 1.12); // jaw
    add(head, new THREE.SphereGeometry(0.019, 12, 8), skin, 0, 0.085, 0.108).scale.set(1, 1.35, 1);        // nose
    [-1, 1].forEach(s => {
      add(head, new THREE.SphereGeometry(0.022, 12, 8), skin, s * 0.098, 0.09, 0).scale.set(0.5, 1, 0.8); // ears
      add(head, new THREE.SphereGeometry(0.011, 10, 8), dark, s * 0.036, 0.115, 0.093);                    // eyes
      add(head, new RoundedBoxGeometry(0.032, 0.007, 0.01, 2, 0.003), hair, s * 0.036, 0.137, 0.094);       // brows
    });
    add(head, new THREE.SphereGeometry(0.113, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.115, -0.008).scale.set(0.95, 1.08, 1.04);
    add(head, new THREE.TorusGeometry(0.1, 0.012, 8, 32), sole, 0, 0.165, 0).rotation.x = Math.PI / 2 + 0.12;

    // Arms: shoulder → upper arm (deltoid, biceps) → elbow → forearm → wrist → hand with fingers.
    (['L', 'R'] as const).forEach(side => {
      const s = side === 'L' ? -1 : 1;
      const shoulder = joint(`shoulder${side}`, spine, s * 0.23, 0.465);
      add(shoulder, new THREE.SphereGeometry(0.07, 20, 14), skin, 0, -0.015).scale.set(1, 1.15, 1);
      add(shoulder, muscle(UPPER, [0.062, 0.058, 0.055, 0.05, 0.044], 20), skin);
      const elbow = joint(`elbow${side}`, shoulder, 0, -UPPER);
      add(elbow, new THREE.SphereGeometry(0.045, 16, 12), skin);
      add(elbow, muscle(FORE, [0.045, 0.047, 0.043, 0.036, 0.031], 20), skin);
      add(elbow, muscle(0.045, [0.036, 0.036], 16), white, 0, -0.2); // wristband
      const wrist = joint(`wrist${side}`, elbow, 0, -FORE);
      this.buildHand(side, wrist, skin);
    });

    // Legs: hip → thigh (quad) → knee → shin (calf) → ankle → sneaker.
    (['L', 'R'] as const).forEach(side => {
      const s = side === 'L' ? -1 : 1;
      const hip = joint(`hip${side}`, pelvis, s * 0.1, -0.06);
      add(hip, muscle(0.46, [0.09, 0.088, 0.08, 0.068, 0.058], 20), skin);
      // Shorts leg, flaring to the hem; its top stays inside the shorts so no edge pokes through when
      // the hip turns (profile runs bottom to top so the faces point outward).
      add(hip, new THREE.LatheGeometry([new THREE.Vector2(0.0, -0.24), new THREE.Vector2(0.118, -0.24), new THREE.Vector2(0.106, -0.06), new THREE.Vector2(0.088, 0.02), new THREE.Vector2(0.0, 0.04)], 20), shorts);
      const knee = joint(`knee${side}`, hip, 0, -0.46);
      add(knee, new THREE.SphereGeometry(0.058, 16, 12), skin);
      add(knee, muscle(0.44, [0.056, 0.064, 0.058, 0.045, 0.038], 20), skin);
      add(knee, muscle(0.12, [0.046, 0.044], 16), white, 0, -0.32); // sock
      const ankle = joint(`ankle${side}`, knee, 0, -0.44);
      add(ankle, new RoundedBoxGeometry(0.11, 0.085, 0.27, 4, 0.04), shoe, 0, -0.035, 0.045);
      add(ankle, new THREE.SphereGeometry(0.056, 16, 10), shoe, 0, -0.04, 0.16).scale.set(1, 0.72, 0.9); // toe cap
      add(ankle, new RoundedBoxGeometry(0.116, 0.024, 0.3, 3, 0.01), sole, 0, -0.072, 0.055);
    });
  }

  /** Palm, four two-joint fingers and a thumb. The palm faces local +z; fingers hang along -y. */
  private buildHand(side: 'L' | 'R', wrist: THREE.Object3D, skin: THREE.Material): void {
    const s = side === 'L' ? -1 : 1;
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.078, PALM + 0.02, 0.03, 3, 0.013), skin);
    palm.position.set(0, -PALM / 2 - 0.004, 0); palm.castShadow = true; wrist.add(palm);
    [0.045, 0.05, 0.048, 0.04].forEach((l, i) => {
      const base = new THREE.Group(); base.position.set((i - 1.5) * 0.019 * -s, -PALM - 0.004, 0.002); wrist.add(base);
      const seg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, l * 0.55, 4, 8), skin); seg1.position.y = -l * 0.3; base.add(seg1);
      const mid = new THREE.Group(); mid.position.y = -l * 0.58; base.add(mid);
      const seg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0078, l * 0.42, 4, 8), skin); seg2.position.y = -l * 0.24; mid.add(seg2);
      this.fingers[side].push([base, mid]);
    });
    const thumb = new THREE.Group(); thumb.position.set(0.04 * s, -0.022, 0.012); wrist.add(thumb);
    const t1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.04, 4, 8), skin); t1.position.y = -0.026; thumb.add(t1);
    thumb.rotation.set(0.4, 0, s * 0.7);
    this.thumbs[side] = thumb;
  }

  /** World position of the ball's centre (valid while the player is holding it). */
  ballCenter(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateWorldMatrix(true, false);
    return out.copy(this.ball).applyMatrix4(this.group.matrixWorld);
  }

  pose(p: AthletePose): void {
    const J = this.j;
    const run = p.run, st = p.stride;
    const breathe = Math.sin(p.t * 2.2) * 0.015 * (1 - run);
    const lean = run * 0.18 + p.crouch * 0.28 - p.set * 0.06;
    J.spine.rotation.set(lean + breathe, run * Math.sin(st) * 0.08, 0);
    J.pelvis.rotation.set(0, -run * Math.sin(st) * 0.1, 0);
    J.pelvis.position.y = 1.0 - p.crouch * 0.2 + run * Math.abs(Math.sin(st)) * 0.04;
    J.head.rotation.set(-lean * 0.6 - p.set * 0.25, 0, 0);

    (['L', 'R'] as const).forEach((side, i) => {
      const ph = st + i * Math.PI;
      const swing = Math.sin(ph) * 0.75 * run;
      const kneeRun = (0.25 + 1.1 * Math.max(0, Math.sin(ph - 0.9))) * run;
      J[`hip${side}`].rotation.set(-swing - p.crouch * 0.95, 0, (side === 'L' ? -1 : 1) * 0.03);
      J[`knee${side}`].rotation.set(kneeRun + p.crouch * 1.7, 0, 0);
      J[`ankle${side}`].rotation.set(-p.crouch * 0.75 + (run ? Math.max(0, -Math.sin(ph)) * 0.35 : 0), 0, 0);
    });

    // Arms, free: swinging when running, hanging when not; the release and celebration are posed directly.
    const mix = (a: number, b: number, k: number) => a + (b - a) * k;
    (['L', 'R'] as const).forEach((side, i) => {
      const s = side === 'L' ? -1 : 1;
      const swing = Math.sin(st + i * Math.PI + Math.PI) * 0.65 * run;
      const rel = side === 'R' ? { ua: -2.9, el: -0.1, out: -0.15, wr: 1.4 } : { ua: -2.3, el: -0.75, out: 0.05, wr: -0.2 };
      const ua = mix(swing - 0.05, rel.ua, p.release), el = mix(-0.15 - 1.2 * run, rel.el, p.release);
      const out = mix(0.1, rel.out, p.release), wr = mix(0, rel.wr, p.release);
      const up = p.celebrate;
      J[`shoulder${side}`].rotation.set(mix(ua, -2.95 + Math.sin(p.t * 7 + i) * 0.12, up), 0, s * mix(out, 0.25, up));
      J[`elbow${side}`].rotation.set(mix(el, -0.1, up), 0, 0);
      J[`wrist${side}`].rotation.set(wr, 0, 0);
    });

    // Holding the ball: place it, then reach it with both hands.
    const grip = Math.max(p.carry, p.set) * (1 - p.release) * (1 - p.celebrate);
    this.ball.set(mix(0, 0.05, p.set), mix(1.3, 2.1, p.set) - p.crouch * 0.2, mix(0.3, 0.16, p.set));
    if (grip > 0.001) this.reach(p.set, grip);
    this.curl(grip);
  }

  /**
   * Put each palm on the ball's surface: both hands on the sides at the chest;
   * at the set point the shooting hand goes under and behind the ball and the
   * guide hand stays on its side. Elbows bend down and out.
   */
  private reach(set: number, weight: number): void {
    this.group.updateWorldMatrix(true, true);
    _rot.setFromRotationMatrix(_m.extractRotation(this.group.matrixWorld));
    _C.copy(this.ball).applyMatrix4(this.group.matrixWorld);
    (['L', 'R'] as const).forEach(side => {
      const s = side === 'L' ? -1 : 1;
      _chest.set(s, -0.1, -0.3).normalize();
      (side === 'R' ? _set.set(s * 0.18, -0.75, -0.62) : _set.set(s, -0.05, -0.18)).normalize();
      _dir.copy(_chest).lerp(_set, set).normalize().applyQuaternion(_rot);
      _palm.copy(_C).addScaledVector(_dir, BALL_RADIUS + 0.016);
      _pole.set(s * 0.6, -1, -0.5).normalize().applyQuaternion(_rot);
      this.solveArm(side, weight);
    });
  }

  /** Two-bone IK from the shoulder to the wrist that puts the palm at _palm facing _C. */
  private solveArm(side: 'L' | 'R', weight: number): void {
    const shoulder = this.j[`shoulder${side}`], elbow = this.j[`elbow${side}`], wrist = this.j[`wrist${side}`];
    shoulder.getWorldPosition(_S);
    // Palm normal points into the ball; the fingers run along its surface, away from the shoulder.
    _n.copy(_C).sub(_palm).normalize();
    _fing.subVectors(_palm, _S).normalize();
    _fing.addScaledVector(_n, -_fing.dot(_n)).normalize();
    // The wrist sits half a palm back along the fingers, just off the ball.
    _W.copy(_palm).addScaledVector(_fing, -PALM / 2);
    _toW.subVectors(_W, _S);
    const d = THREE.MathUtils.clamp(_toW.length(), Math.abs(UPPER - FORE) + 1e-3, UPPER + FORE - 1e-3);
    _toW.normalize();
    const a = Math.acos(THREE.MathUtils.clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1));
    _perp.copy(_pole).addScaledVector(_toW, -_pole.dot(_toW)).normalize();
    _up.copy(_toW).multiplyScalar(Math.cos(a)).addScaledVector(_perp, Math.sin(a)).normalize();
    _E.copy(_S).addScaledVector(_up, UPPER);
    _fore.subVectors(_W, _E).normalize();
    // Shoulder frame: local -y along the upper arm, local +z toward where the forearm bends.
    _bend.copy(_fore).addScaledVector(_up, -_fore.dot(_up));
    if (_bend.lengthSq() < 1e-6) _bend.copy(_perp).negate();
    _bend.normalize();
    _y.copy(_up).negate();
    _x.crossVectors(_y, _bend).normalize();
    _sq.setFromRotationMatrix(_m.makeBasis(_x, _y, _bend));
    shoulder.parent!.getWorldQuaternion(_pq);
    shoulder.quaternion.slerp(_pq.invert().multiply(_sq), weight);
    // Elbow: bend about its local x.
    const bend = Math.acos(THREE.MathUtils.clamp(_up.dot(_fore), -1, 1));
    elbow.quaternion.slerp(_q.setFromAxisAngle(_axisX, -bend), weight);
    // Wrist: palm (+z) into the ball, fingers (-y) along its surface.
    shoulder.updateWorldMatrix(false, true);
    _wy.copy(_fing).negate();
    _wx.crossVectors(_wy, _n).normalize();
    _wz.crossVectors(_wx, _wy).normalize();
    _sq.setFromRotationMatrix(_m.makeBasis(_wx, _wy, _wz));
    elbow.getWorldQuaternion(_pq);
    wrist.quaternion.slerp(_pq.invert().multiply(_sq), weight);
  }

  /** Fingers wrap the ball when holding it, relax when not. */
  private curl(grip: number): void {
    (['L', 'R'] as const).forEach(side => {
      this.fingers[side].forEach(([base, mid]) => {
        base.rotation.x = -(0.25 + 0.45 * grip);
        mid.rotation.x = -(0.2 + 0.55 * grip);
      });
      this.thumbs[side].rotation.x = 0.4 - 0.6 * grip;
    });
  }
}

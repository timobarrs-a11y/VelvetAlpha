import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// A basketball player built from shaped parts on a simple skeleton: a
// sculpted torso in a jersey, shorts, two-part arms and legs with elbows and
// knees, hands, sneakers, and a head with a face and hair. Posed every frame
// from a few high-level controls (running, crouch, set point, release,
// celebrate), so the same figure jogs, shoots a jumper and celebrates.
// Local space: feet at y = 0, facing +z, about 1.95m tall.

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
  /** Shooting arm extending and the wrist flicking through (0..1). */
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

/**
 * The jersey wrapped around the torso (lathe U = 0 is the front, 0.5 the back):
 * body colour, side panels, trim at the hem, and the number front and back.
 */
function jerseyMap(colors: [string, string], number: number): THREE.CanvasTexture {
  const W = 512, H = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = colors[0]; g.fillRect(0, 0, W, H);
  // Side panels in the trim colour (at the quarter turns).
  g.fillStyle = colors[1];
  [W * 0.25, W * 0.75].forEach(x => g.fillRect(x - 10, 0, 20, H));
  g.fillRect(0, H - 22, W, 8); // hem stripe
  const num = String(number);
  g.font = '900 78px Inter, Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = colors[1]; g.fillStyle = '#FFFFFF';
  // Front (split across the seam at x = 0 / W) and back (x = W/2). Canvas y runs top-down; the lathe's V runs bottom-up.
  [0, W, W / 2].forEach(x => { g.strokeText(num, x, H * 0.45); g.fillText(num, x, H * 0.45); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.flipY = true;
  return t;
}

const limbGeo = (r1: number, r2: number, len: number) => {
  // A tapered limb hanging down from its joint (y = 0 to y = -len), rounded at both ends.
  const g = new THREE.CylinderGeometry(r1, r2, len, 14, 1);
  g.translate(0, -len / 2, 0);
  return g;
};

export class Athlete {
  readonly group = new THREE.Group();
  private j: Record<string, THREE.Object3D> = {};
  private handL = new THREE.Object3D();
  private handR = new THREE.Object3D();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  constructor(look: AthleteLook) {
    const skin = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.55, metalness: 0 });
    const jersey = new THREE.MeshStandardMaterial({ map: jerseyMap(look.jersey, look.number), roughness: 0.75 });
    const trim = new THREE.MeshStandardMaterial({ color: look.jersey[1], roughness: 0.7 });
    const shorts = new THREE.MeshStandardMaterial({ color: look.jersey[0], roughness: 0.75, side: THREE.DoubleSide });
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.6 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0xf7f7f7, roughness: 0.45 });
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
    const shortsBody = new THREE.LatheGeometry([
      new THREE.Vector2(0.155, 0.12), new THREE.Vector2(0.175, 0.06), new THREE.Vector2(0.19, -0.04), new THREE.Vector2(0.19, -0.12), new THREE.Vector2(0.0, -0.13),
    ], 20);
    add(pelvis, shortsBody, shorts).scale.set(1.08, 1, 0.78);
    // Spine: torso in a sleeveless jersey (wider at the shoulders), the trim at the neck and arm holes.
    const spine = joint('spine', pelvis, 0, 0.1);
    const torsoGeo = new THREE.LatheGeometry([
      new THREE.Vector2(0.0, -0.02), new THREE.Vector2(0.158, -0.02), new THREE.Vector2(0.165, 0.12), new THREE.Vector2(0.19, 0.3),
      new THREE.Vector2(0.205, 0.42), new THREE.Vector2(0.18, 0.5), new THREE.Vector2(0.075, 0.54), new THREE.Vector2(0.0, 0.545),
    ], 24);
    add(spine, torsoGeo, jersey).scale.set(1.12, 1, 0.72);
    add(spine, new THREE.TorusGeometry(0.075, 0.012, 6, 18), trim, 0, 0.53, 0).rotation.x = Math.PI / 2;
    // Neck and head: face, ears, hair.
    const neck = joint('neck', spine, 0, 0.53);
    add(neck, new THREE.CylinderGeometry(0.052, 0.058, 0.12, 12), skin, 0, 0.05);
    const head = joint('head', neck, 0, 0.12);
    const skull = add(head, new THREE.SphereGeometry(0.107, 24, 18), skin, 0, 0.1); skull.scale.set(0.92, 1.12, 1);
    add(head, new THREE.SphereGeometry(0.06, 14, 10), skin, 0, 0.035, 0.035).scale.set(1.3, 0.9, 1.1); // jaw
    add(head, new THREE.SphereGeometry(0.018, 8, 6), skin, 0, 0.085, 0.108).scale.set(1, 1.3, 1);       // nose
    [-1, 1].forEach(s => {
      add(head, new THREE.SphereGeometry(0.022, 8, 6), skin, s * 0.098, 0.09, 0).scale.set(0.5, 1, 0.8); // ears
      add(head, new THREE.SphereGeometry(0.011, 8, 6), dark, s * 0.036, 0.115, 0.093);                    // eyes
      add(head, new THREE.BoxGeometry(0.03, 0.006, 0.01), hair, s * 0.036, 0.137, 0.094);                   // brows
    });
    const cap = add(head, new THREE.SphereGeometry(0.112, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.115, -0.008);
    cap.scale.set(0.95, 1.08, 1.04);
    add(head, new THREE.TorusGeometry(0.1, 0.012, 6, 24), sole, 0, 0.165, 0).rotation.x = Math.PI / 2 + 0.12; // headband

    // Arms: shoulder → upper arm → elbow → forearm → wrist → hand.
    (['L', 'R'] as const).forEach(side => {
      const s = side === 'L' ? -1 : 1;
      const shoulder = joint(`shoulder${side}`, spine, s * 0.235, 0.47);
      add(shoulder, new THREE.SphereGeometry(0.068, 14, 10), skin, 0, -0.01); // deltoid
      add(shoulder, limbGeo(0.058, 0.046, 0.3), skin);
      const elbow = joint(`elbow${side}`, shoulder, 0, -0.3);
      add(elbow, new THREE.SphereGeometry(0.046, 10, 8), skin);
      add(elbow, limbGeo(0.045, 0.034, 0.27), skin);
      add(elbow, new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12), white, 0, -0.06); // sleeve band
      const wrist = joint(`wrist${side}`, elbow, 0, -0.27);
      add(wrist, new RoundedBoxGeometry(0.075, 0.13, 0.035, 2, 0.015), skin, 0, -0.07);
      add(wrist, new THREE.CapsuleGeometry(0.013, 0.04, 3, 6), skin, -s * 0.042, -0.05, 0.012).rotation.z = s * 0.6; // thumb
      const tip = side === 'L' ? this.handL : this.handR;
      tip.position.set(0, -0.09, 0.02); wrist.add(tip);
    });
    // Legs: hip → thigh → knee → shin → ankle → sneaker.
    (['L', 'R'] as const).forEach(side => {
      const s = side === 'L' ? -1 : 1;
      const hip = joint(`hip${side}`, pelvis, s * 0.1, -0.06);
      add(hip, limbGeo(0.088, 0.062, 0.46), skin);
      // Shorts leg: flares out to a wide hem and starts inside the shorts body, so no gap opens as the leg swings.
      const leg = new THREE.LatheGeometry([new THREE.Vector2(0.0, 0.1), new THREE.Vector2(0.1, 0.1), new THREE.Vector2(0.108, -0.05), new THREE.Vector2(0.118, -0.24), new THREE.Vector2(0.0, -0.24)], 16);
      add(hip, leg, shorts);
      const knee = joint(`knee${side}`, hip, 0, -0.46);
      add(knee, new THREE.SphereGeometry(0.062, 12, 8), skin);
      const calf = add(knee, new THREE.SphereGeometry(0.062, 12, 10), skin, 0, -0.12, -0.012); calf.scale.set(1, 1.7, 1.05);
      add(knee, limbGeo(0.058, 0.04, 0.44), skin);
      add(knee, limbGeo(0.046, 0.046, 0.12), white, 0, -0.33); // sock
      const ankle = joint(`ankle${side}`, knee, 0, -0.44);
      add(ankle, new RoundedBoxGeometry(0.11, 0.085, 0.29, 3, 0.035), shoe, 0, -0.035, 0.05);
      add(ankle, new RoundedBoxGeometry(0.114, 0.025, 0.295, 2, 0.01), sole, 0, -0.072, 0.05);
    });
  }

  /** World position between the hands, a little in front: where the ball sits. */
  ballPoint(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    this.handL.getWorldPosition(this.tmpA);
    this.handR.getWorldPosition(this.tmpB);
    out.addVectors(this.tmpA, this.tmpB).multiplyScalar(0.5);
    // Push the ball out in front of the palms, in the direction the player faces.
    const f = this.tmpA.set(0, 0, 1).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()));
    return out.addScaledVector(f, 0.11).add(this.tmpB.set(0, 0.04, 0));
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

    // Legs: a jog stride with a real knee bend, and a crouch for the dip.
    (['L', 'R'] as const).forEach((side, i) => {
      const ph = st + i * Math.PI;
      const swing = Math.sin(ph) * 0.75 * run;
      const kneeRun = (0.25 + 1.1 * Math.max(0, Math.sin(ph - 0.9))) * run;
      J[`hip${side}`].rotation.set(-swing - p.crouch * 0.95, 0, (side === 'L' ? -1 : 1) * 0.03);
      J[`knee${side}`].rotation.set(kneeRun + p.crouch * 1.7, 0, 0);
      J[`ankle${side}`].rotation.set(-p.crouch * 0.75 + (run ? Math.max(0, -Math.sin(ph)) * 0.35 : 0), 0, 0);
    });

    // Arms: hanging or swinging when empty-handed; ball at the chest when carrying; then up to the
    // set point (shooting hand under the ball, guide hand on the side) and through the release.
    (['L', 'R'] as const).forEach((side, i) => {
      const s = side === 'L' ? -1 : 1;
      const swing = Math.sin(st + i * Math.PI + Math.PI) * 0.65 * run * (1 - p.carry);
      const free = { ua: swing - 0.05, el: -0.15 - 1.2 * run, out: 0.1 };
      // 'out' turns the arm away from the body; negative brings the hands in to meet around the ball.
      const chest = { ua: -0.8, el: -1.5, out: -0.22 };
      const set = side === 'R' ? { ua: -2.3, el: -1.45, out: -0.27 } : { ua: -2.05, el: -1.3, out: -0.2 };
      const rel = side === 'R' ? { ua: -2.9, el: -0.1, out: -0.15 } : { ua: -2.3, el: -0.75, out: 0.05 };
      const mix = (a: number, b: number, k: number) => a + (b - a) * k;
      let ua = mix(free.ua, chest.ua, p.carry), el = mix(free.el, chest.el, p.carry), out = mix(free.out, chest.out, p.carry);
      ua = mix(ua, set.ua, p.set); el = mix(el, set.el, p.set); out = mix(out, set.out, p.set);
      ua = mix(ua, rel.ua, p.release); el = mix(el, rel.el, p.release); out = mix(out, rel.out, p.release);
      const up = p.celebrate;
      J[`shoulder${side}`].rotation.set(mix(ua, -2.95 + Math.sin(p.t * 7 + i) * 0.12, up), 0, s * mix(out, 0.25, up));
      J[`elbow${side}`].rotation.set(mix(el, -0.1, up), 0, 0);
      J[`wrist${side}`].rotation.set(side === 'R' ? -0.9 * p.set * (1 - p.release) + 1.4 * p.release : -0.3 * p.set, 0, 0);
    });
  }
}

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import {
  buildCourse, fireBoost, isMake, judge, MAX_SCORE, resolveShot, RIM_HEIGHT, shotWindow, spotPosition,
  type Ball, type Grade, type Level, type Outcome, type Spot,
} from '../engine';
import { legAt, planFlight, type Leg, type V3 } from '../game';
import * as sfx from '../audio';
import { ballTexture, FLOOR, floorTexture, jerseyTexture, makeScoreboard, ribbonTexture } from './textures';
import { Net } from './net';
import type { RivalRun } from '../rivals';
import { Crowd } from './crowd';

// 3-Point Shootout in 3D: a lit arena with a lacquered floor, glass board and
// a cloth net, a full crowd, first-person shooting and a broadcast camera
// between racks, slow-motion replays of the big shots. Game logic lives in
// ../engine; game coordinates are metres with z up (x across, y out from the
// rim), mapped to Three's y-up space by toThree.

export type Phase = 'walk' | 'aim' | 'hold' | 'flight' | 'replay' | 'done';

export type ShootoutEvent =
  | { type: 'rack'; label: string; index: number; money: boolean }
  | { type: 'ball'; kind: Ball['kind'] }
  | { type: 'grade'; grade: Grade; error: number; window: number }
  | { type: 'make'; points: number; outcome: Outcome; streak: number }
  | { type: 'miss'; outcome: Outcome }
  | { type: 'fire' }
  | { type: 'replay'; on: boolean }
  | { type: 'final10' };

export interface RunResult { score: number; max: number; makes: number; shots: number; bestStreak: number; level: Level }

/** Options for one run: a custom course and clock (tiebreakers), a jersey, or a rival on autopilot. */
export interface RunOptions {
  course?: Spot[];
  clock?: number;
  jersey?: { colors: [string, string]; number: number };
  /** Play a rival's pre-simulated run from the broadcast camera instead of taking input. */
  auto?: RivalRun;
  /** Playback speed for autopilot runs. */
  speed?: number;
}

export interface Callbacks {
  onEvent?: (e: ShootoutEvent) => void;
  onDone?: (r: RunResult) => void;
}

const BALL_R = 0.12, RIM_R = 0.2286, BOARD_Y = -0.38;
const toThree = (v: V3 | readonly number[]) => new THREE.Vector3(v[0], v[2], v[1]);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

type Quality = 'high' | 'mid';

// Final pass: ACES tone mapping, a soft vignette and sRGB out. (three 0.154's
// OutputPass redeclares toneMappingExposure and fails to compile.)
function outputPass(exposure: number): ShaderPass {
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uExposure: { value: exposure } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uExposure; varying vec2 vUv;
      vec3 rrtOdt(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c) {
        const mat3 inM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
        const mat3 outM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
        c *= uExposure / 0.6; c = outM * rrtOdt(inM * c); return clamp(c, 0.0, 1.0);
      }
      vec3 toSrgb(vec3 c) { return mix(c * 12.92, pow(c, vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c)); }
      void main() {
        vec4 t = texture2D(tDiffuse, vUv);
        vec3 c = aces(t.rgb);
        vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * 0.55;
        gl_FragColor = vec4(toSrgb(c), 1.0);
      }`,
  });
  pass.material.toneMapped = false;
  return pass;
}

export class Shootout3D {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private quality: Quality;
  private raf = 0;
  private last = 0;
  private time = 0;
  private cb: Callbacks;
  private basePR = 1;
  private mirror: THREE.Object3D | null = null;
  /** Frame governor: 0 = full quality; each step trades detail for frame rate. */
  private perf = { acc: 0, n: 0, skip: 90, level: 0, good: 0, ups: 0, frame: 0 };
  private noDraw = false;
  private opts: RunOptions;
  /** Autopilot: the rival run being played back, and the next shot in it. */
  private auto: RivalRun | null;
  private autoIdx = 0;
  private clock0: number;

  // World pieces.
  private net!: Net;
  private crowd!: Crowd;
  private ball!: THREE.Mesh;
  private ballMats: Record<Ball['kind'], THREE.MeshStandardMaterial>;
  private heldBall!: THREE.Mesh;
  private arms = new THREE.Group();
  private ballRig!: THREE.Group;
  private player = new THREE.Group();
  private playerParts: Record<string, THREE.Object3D> = {};
  private rackBalls: THREE.Mesh[][] = [];
  private ribbons: THREE.Texture[] = [];
  private rimMat!: THREE.MeshStandardMaterial;
  private scoreboards: ReturnType<typeof makeScoreboard>;
  private confetti!: THREE.Points;
  private confettiVel: Float32Array;
  private confettiLife: Float32Array;
  private flames!: THREE.Points;

  // Game state.
  readonly level: Level;
  private course: Spot[];
  private max: number;
  private spotIdx = 0;
  private ballIdx = 0;
  phase: Phase = 'walk';
  private phaseT = 0;
  private clock: number;
  score = 0;
  private makes = 0; private shots = 0; streak = 0; private bestStreak = 0;
  private holdT = 0;
  private win = { green: 0.08, rise: 0.7 };
  private greenPinged = false;
  private flight: Leg[] = [];
  private flightT = 0;
  private legPlayed = -1;
  private outcome: Outcome | null = null;
  private ballNow: Ball | null = null;
  private replayT = 0;
  private hitstop = 0;
  private punch = 0;
  private shake = 0;
  private walkFrom: [number, number] = [0, 10];
  private lastTick = -1;
  private sentFinal = false;
  /** 0..1 black fade for camera cuts. */
  fade = 0;
  private camPos = new THREE.Vector3(-10, 7, 10);
  private camLook = new THREE.Vector3(0, 1, 4);
  private reduced: boolean;

  constructor(private canvas: HTMLCanvasElement, level: Level, moneyRack: number, cb: Callbacks = {}, opts: RunOptions = {}) {
    this.cb = cb;
    this.opts = opts;
    this.auto = opts.auto ?? null;
    this.level = level;
    this.course = opts.course ?? buildCourse(moneyRack);
    this.max = MAX_SCORE(this.course);
    this.clock = opts.clock ?? level.clock;
    this.clock0 = this.clock;
    this.reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.quality = coarse || Math.min(window.innerWidth, window.innerHeight) < 600 ? 'mid' : 'high';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    // Start sharp but sane; the frame governor trades resolution for 60fps.
    this.basePR = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 1.5 : 1.35);
    this.renderer.setPixelRatio(this.basePR);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 120);
    this.scene.add(this.camera);
    this.scene.background = new THREE.Color(0x05050a);
    this.scene.fog = new THREE.Fog(0x05050a, 28, 60);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const rt = new THREE.WebGLRenderTarget(1, 1, { samples: this.quality === 'high' ? 4 : 2, type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(outputPass(this.renderer.toneMappingExposure));

    this.ballMats = {
      regular: this.makeBallMat('regular'), money: this.makeBallMat('money'), starry: this.makeBallMat('starry'),
    };
    this.scoreboards = makeScoreboard();
    this.confettiVel = new Float32Array(400 * 3);
    this.confettiLife = new Float32Array(400);
    this.build();
    this.resize();
    this.precompile();
    sfx.startCrowd();
  }

  // ---- Building the arena ---------------------------------------------------

  private makeBallMat(kind: Ball['kind']): THREE.MeshStandardMaterial {
    const { map, bump } = ballTexture(kind);
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.035, roughness: 0.62, metalness: 0, envMapIntensity: 0.6 });
  }

  private build(): void {
    const s = this.scene;
    const hi = this.quality === 'high';

    // Floor, lacquered. On desktop a mirror under a translucent floor gives true reflections.
    const { map, rough } = floorTexture(hi ? 2048 : 1536);
    const fw = FLOOR.x1 - FLOOR.x0, fh = FLOOR.y1 - FLOOR.y0;
    const floorGeo = new THREE.PlaneGeometry(fw, fh).rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshPhysicalMaterial({
      map, roughnessMap: rough, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 0.55,
      transparent: hi, opacity: hi ? 0.9 : 1,
    });
    if (!hi) { floorMat.clearcoat = 0; floorMat.roughness = 0.5; }
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set((FLOOR.x0 + FLOOR.x1) / 2, 0, (FLOOR.y0 + FLOOR.y1) / 2);
    floor.receiveShadow = true;
    s.add(floor);
    if (hi) {
      const mirror = new Reflector(new THREE.PlaneGeometry(fw, fh), { textureWidth: 768, textureHeight: 768, color: 0x6b6b6b });
      mirror.rotateX(-Math.PI / 2);
      // The reflection pass skips the crowd and net: thousands of triangles
      // nobody sees in a blurry floor.
      const reflect = mirror.onBeforeRender.bind(mirror);
      mirror.onBeforeRender = (...args: Parameters<typeof mirror.onBeforeRender>) => {
        const c = this.crowd?.group, n = this.net?.mesh;
        if (c) c.visible = false; if (n) n.visible = false;
        reflect(...args);
        if (c) c.visible = true; if (n) n.visible = true;
      };
      this.mirror = mirror;
      mirror.position.set(floor.position.x, -0.002, floor.position.z);
      s.add(mirror);
    }

    // Lights: arena spots over the court, a cool fill, and the environment.
    s.add(new THREE.HemisphereLight(0x8a90b8, 0x1a1210, 0.35));
    const spots: Array<[number, number, number]> = [[-6, 2, 13], [6, 2, 13], [-6, 9, 13], [6, 9, 13], [0, -1, 12]];
    spots.forEach(([x, y, z], i) => {
      const L = new THREE.SpotLight(0xfff1dd, i === 4 ? 2.4 : 1.5, 45, 0.62, 0.65, 1.1);
      L.position.copy(toThree([x, y, z]));
      L.target.position.copy(toThree([x * 0.4, y * 0.7 + 1, 0]));
      if (i === 4) { L.castShadow = true; L.shadow.mapSize.set(1024, 1024); L.shadow.bias = -0.0004; L.shadow.camera.near = 4; L.shadow.camera.far = 30; }
      s.add(L, L.target);
      // The fixture itself, glowing.
      const fix = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 16), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff4e0, emissiveIntensity: 2.2 }));
      fix.position.copy(L.position);
      s.add(fix);
    });
    // Ceiling trusses.
    const truss = new THREE.MeshStandardMaterial({ color: 0x1c1d24, metalness: 0.6, roughness: 0.5 });
    [2, 9].forEach(y => { const b = new THREE.Mesh(new THREE.BoxGeometry(22, 0.35, 0.35), truss); b.position.copy(toThree([0, y, 13.3])); s.add(b); });

    this.buildHoop();

    // Crowd and stands.
    this.crowd = new Crowd(toThree, hi ? 2600 : 1300);
    s.add(this.crowd.group);

    // LED ribbon boards along the front of each stand.
    const ribbon = (text: string, color: string, len: number, pos: V3, rotY: number) => {
      const tex = ribbonTexture(text, color);
      tex.repeat.set(len / 12, 1);
      this.ribbons.push(tex);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.55), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.3, color: 0x000000 }));
      m.position.copy(toThree(pos)); m.rotation.y = rotY;
      s.add(m);
    };
    ribbon('VELVET  3-POINT SHOOTOUT', '#F5C451', 30, [0, -6.0, 0.35], 0);
    ribbon('MONEY BALL  •  STARRY RANGE', '#F472B6', 22, [11.1, 6, 0.35], -Math.PI / 2);
    ribbon('HIT THE GREEN', '#7CF7D4', 22, [-11.1, 6, 0.35], Math.PI / 2);

    // Scoreboards: a jumbotron over the court and a board behind the basket.
    const sbMat = new THREE.MeshStandardMaterial({ map: this.scoreboards.tex, emissive: 0xffffff, emissiveMap: this.scoreboards.tex, emissiveIntensity: 1.4, color: 0x000000 });
    const jumbo = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.5, 4.6), new THREE.MeshStandardMaterial({ color: 0x0b0b10, metalness: 0.5, roughness: 0.4 }));
    jumbo.add(frame);
    for (let k = 0; k < 4; k++) {
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), sbMat);
      scr.position.set(Math.sin((k * Math.PI) / 2) * 2.31, 0, Math.cos((k * Math.PI) / 2) * 2.31);
      scr.rotation.y = (k * Math.PI) / 2;
      jumbo.add(scr);
    }
    jumbo.position.copy(toThree([0, 7, 10.5]));
    s.add(jumbo);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), sbMat);
    back.position.copy(toThree([0, -11.4, 7.6]));
    s.add(back);
    // Banners high on the end wall.
    const banner = (txt: string, x: number, col: string) => {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
      const g = cv.getContext('2d')!; g.fillStyle = col; g.fillRect(0, 0, 256, 512);
      g.fillStyle = '#F5C451'; g.fillRect(0, 470, 256, 42);
      g.save(); g.translate(128, 256); g.rotate(-Math.PI / 2); g.fillStyle = '#FFFFFF'; g.font = '900 64px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 0); g.restore();
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.2), new THREE.MeshStandardMaterial({ map: t, emissive: 0x222222, roughness: 0.9 }));
      m.position.copy(toThree([x, -13.5, 10])); s.add(m);
    };
    banner('CHAMPS', -7, '#5C163A'); banner('2026', -4.5, '#1F2937'); banner('LEGENDS', 4.5, '#1F2937'); banner('VELVET', 7, '#5C163A');

    // Ball racks at each spot.
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, metalness: 0.85, roughness: 0.3 });
    this.course.forEach((spot) => {
      const [x, y] = spotPosition(spot);
      const p = toThree([x * 1.1, y * 1.1, 0]);
      const rack = new THREE.Group();
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.05, 0.36), rackMat);
      shelf.position.y = 0.72; rack.add(shelf);
      [-0.65, 0.65].forEach(dx => [-0.15, 0.15].forEach(dz => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 6), rackMat); leg.position.set(dx, 0.36, dz); rack.add(leg); }));
      rack.position.copy(p);
      rack.lookAt(new THREE.Vector3(0, 0, 0)); rack.rotateY(Math.PI / 2);
      s.add(rack);
      const rackGeo = new THREE.SphereGeometry(BALL_R, 20, 14);
      const balls = spot.balls.map((b, i) => {
        const m = new THREE.Mesh(rackGeo, this.ballMats[b.kind]);
        m.position.set(-0.56 + i * 0.28, 0.72 + BALL_R, 0);
        m.castShadow = hi;
        rack.add(m);
        return m;
      });
      this.rackBalls.push(balls);
    });

    // The flying ball, and the one in your hands.
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), this.ballMats.regular);
    this.ball.castShadow = true;
    this.ball.visible = false;
    s.add(this.ball);
    this.buildArms();
    this.buildPlayer();

    // Confetti and fire.
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 3).fill(-100), 3));
    cg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(400 * 3), 3));
    this.confetti = new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, depthWrite: false }));
    this.confetti.frustumCulled = false;
    s.add(this.confetti);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3).fill(-100), 3));
    this.flames = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.12, color: 0xff7a1a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flames.frustumCulled = false;
    s.add(this.flames);
  }

  private buildHoop(): void {
    const s = this.scene;
    // Stanchion: padded base, pole and arm.
    const pad = new THREE.MeshStandardMaterial({ color: 0x5c163a, roughness: 0.75 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x23252d, metalness: 0.7, roughness: 0.35 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 2.2), pad); base.position.copy(toThree([0, -3.7, 0.55])); base.castShadow = true; s.add(base);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.28), steel); pole.position.copy(toThree([0, -3.4, 2.2])); s.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 3.0), steel); arm.position.copy(toThree([0, -2.0, 3.55])); arm.rotation.x = -0.12; s.add(arm);
    // Glass backboard with frame and shooter's square.
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.83, 1.07, 0.025), new THREE.MeshPhysicalMaterial({
      color: 0xe8f0ff, transparent: true, opacity: 0.16, roughness: 0.03, metalness: 0, clearcoat: 1, envMapIntensity: 1.2,
    }));
    glass.position.copy(toThree([0, BOARD_Y, 3.435]));
    s.add(glass);
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444444, roughness: 0.4 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xff6a13, emissive: 0x4a1a00, roughness: 0.4 });
    const bar = (w: number, h: number, x: number, z: number, m: THREE.Material) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), m); b.position.copy(toThree([x, BOARD_Y + 0.005, z])); s.add(b); };
    bar(1.83, 0.05, 0, 3.97, white); bar(1.83, 0.05, 0, 2.9, white); bar(0.05, 1.07, -0.9, 3.435, white); bar(0.05, 1.07, 0.9, 3.435, white);
    bar(0.59, 0.04, 0, 3.5, orange); bar(0.59, 0.04, 0, 3.07, orange); bar(0.04, 0.45, -0.29, 3.28, orange); bar(0.04, 0.45, 0.29, 3.28, orange);
    const padBot = new THREE.Mesh(new THREE.BoxGeometry(1.83, 0.09, 0.08), pad); padBot.position.copy(toThree([0, BOARD_Y, 2.86])); s.add(padBot);
    // Rim and bracket.
    this.rimMat = new THREE.MeshStandardMaterial({ color: 0xff5a0a, metalness: 0.55, roughness: 0.35, emissive: 0x000000 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.011, 12, 48), this.rimMat);
    rim.rotation.x = Math.PI / 2; rim.position.copy(toThree([0, 0, RIM_HEIGHT])); rim.castShadow = true; s.add(rim);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.16), this.rimMat); bracket.position.copy(toThree([0, -RIM_R - 0.07, RIM_HEIGHT - 0.01])); s.add(bracket);
    // The net.
    this.net = new Net({ x: 0, y: 0, z: RIM_HEIGHT - 0.01, r: RIM_R - 0.004 }, toThree);
    s.add(this.net.mesh);
  }

  private buildArms(): void {
    // Two hands on the ball, seen from behind: the shooting hand under and
    // behind it, the guide hand on its side, forearms running out of frame.
    const skin = new THREE.MeshStandardMaterial({ color: 0x8d5a3b, roughness: 0.5, envMapIntensity: 0.5 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x5c163a, roughness: 0.75 });
    const tip = new THREE.MeshStandardMaterial({ color: 0xa9765a, roughness: 0.45 });
    const between = (a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) => {
      const d = new THREE.Vector3().subVectors(b, a), len = d.length();
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 4, 12), mat);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      return m;
    };
    const R = BALL_R;
    /** A hand whose palm sits on the ball at `on` (unit dir from centre), fingers pointing `up`. */
    const hand = (on: THREE.Vector3, up: THREE.Vector3, elbow: THREE.Vector3, spread: number) => {
      const g = new THREE.Group();
      const n = on.clone().normalize(), u = up.clone().sub(n.clone().multiplyScalar(up.dot(n))).normalize(), side = new THREE.Vector3().crossVectors(u, n);
      const palmC = n.clone().multiplyScalar(R + 0.022);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), skin);
      palm.scale.set(1, 1.15, 0.42);
      palm.position.copy(palmC);
      palm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, u, n));
      g.add(palm);
      // Fingers wrap over the ball's surface.
      for (let f = 0; f < 4; f++) {
        const ang = (f - 1.5) * spread;
        const dir = u.clone().multiplyScalar(Math.cos(ang)).addScaledVector(side, Math.sin(ang));
        let prev = palmC.clone().addScaledVector(dir, 0.04);
        const segs = f === 0 || f === 3 ? 2 : 3;
        for (let k = 1; k <= segs; k++) {
          const a = 0.32 + k * 0.3;
          const p = n.clone().multiplyScalar(Math.cos(a)).addScaledVector(dir, Math.sin(a)).normalize().multiplyScalar(R + 0.012);
          const p2 = palmC.clone().lerp(p, 1).add(n.clone().multiplyScalar(0.0));
          g.add(between(prev, p2, 0.0115 - k * 0.0008, k === segs ? tip : skin));
          prev = p2;
        }
      }
      // Thumb toward the camera side.
      const th0 = palmC.clone().addScaledVector(side, -0.035).addScaledVector(u, -0.02);
      const th1 = n.clone().multiplyScalar(R + 0.012).addScaledVector(side, -0.07).addScaledVector(u, 0.02);
      g.add(between(th0, th1, 0.013, skin));
      // Wrist, forearm, sleeve band.
      const wrist = palmC.clone().addScaledVector(u, -0.04).addScaledVector(n, 0.012);
      g.add(between(palmC.clone().addScaledVector(u, -0.01), wrist, 0.03, skin));
      g.add(between(wrist, elbow, 0.034, skin));
      const fore = between(wrist.clone().lerp(elbow, 0.3), elbow, 0.04, skin); g.add(fore);
      const bandAt = wrist.clone().lerp(elbow, 0.55);
      const band = between(bandAt, wrist.clone().lerp(elbow, 0.7), 0.041, sleeve); g.add(band);
      return g;
    };
    this.ballRig = new THREE.Group();
    this.heldBall = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), this.ballMats.regular);
    this.ballRig.add(this.heldBall);
    // Shooting hand: under/behind the ball, slightly right. Guide hand: left side.
    this.ballRig.add(hand(new THREE.Vector3(0.25, -0.45, 0.85), new THREE.Vector3(0, 1, -0.2), new THREE.Vector3(0.2, -0.46, 0.3), 0.32));
    this.ballRig.add(hand(new THREE.Vector3(-1, 0.05, 0.12), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.3, -0.4, 0.26), 0.26));
    this.arms.add(this.ballRig);
    this.camera.add(this.arms);
  }

  private buildPlayer(): void {
    const skin = new THREE.MeshStandardMaterial({ color: 0x8d5a3b, roughness: 0.55 });
    const jersey = new THREE.MeshStandardMaterial({ map: jerseyTexture(this.opts.jersey?.number ?? 30, this.opts.jersey?.colors), roughness: 0.7 });
    const shorts = new THREE.MeshStandardMaterial({ color: this.opts.jersey?.colors[0] ?? 0x5c163a, roughness: 0.7 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const P = this.playerParts;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 12), jersey); torso.position.y = 1.32; P.torso = torso;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin); head.position.y = 1.82; P.head = head;
    const hip = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.12, 4, 12), shorts); hip.position.y = 0.98; P.hip = hip;
    this.player.add(torso, head, hip);
    const limb = (name: string, x: number, y: number, len: number, r: number, mat: THREE.Material, footMat?: THREE.Material) => {
      const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat); m.position.y = -len / 2 - r; pivot.add(m);
      if (footMat) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.24), footMat); f.position.set(0, -len - r * 2, 0.06); pivot.add(f); }
      this.player.add(pivot); P[name] = pivot;
    };
    limb('legL', -0.1, 0.92, 0.72, 0.075, skin, shoe); limb('legR', 0.1, 0.92, 0.72, 0.075, skin, shoe);
    limb('armL', -0.27, 1.55, 0.55, 0.055, skin); limb('armR', 0.27, 1.55, 0.55, 0.055, skin);
    this.player.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    this.scene.add(this.player);
  }

  // ---- Lifecycle ------------------------------------------------------------

  start(): void {
    this.last = performance.now();
    const loop = (now: number) => {
      const ms = now - this.last;
      const real = Math.min(0.05, ms / 1000);
      this.last = now;
      this.govern(ms);
      this.frame(real);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Test hook: pause the loop and advance `seconds` at 60fps, drawing only the last frame. */
  advance(seconds: number): void {
    cancelAnimationFrame(this.raf);
    const n = Math.max(1, Math.round(seconds * 60));
    for (let i = 0; i < n; i++) { this.noDraw = i < n - 1; this.frame(1 / 60); }
    this.noDraw = false;
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }

  /** Compile every shader up front (hidden effects too) so nothing hitches mid-run. */
  private precompile(): void {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    this.renderer.compile(this.scene, this.camera);
    hidden.forEach(o => { o.visible = false; });
  }

  /**
   * Hold 60fps: average the frame time over ~40 frames and step quality down
   * when it runs long (resolution, then the floor mirror, then bloom, then
   * shadow refresh rate), and back up a little when there's headroom.
   */
  private govern(ms: number): void {
    const p = this.perf;
    p.frame++;
    if (document.hidden || ms > 250) return;
    if (p.skip > 0) { p.skip--; return; }
    p.acc += ms; p.n++;
    if (p.n < 40) return;
    const avg = p.acc / p.n; p.acc = 0; p.n = 0;
    if (avg > 18.5 && p.level < 5) { p.level++; p.good = 0; this.applyPerf(); }
    else if (avg < 12.5 && p.level > 0 && p.ups < 3) { if (++p.good >= 5) { p.level--; p.ups++; p.good = 0; this.applyPerf(); } }
    else p.good = 0;
  }

  private applyPerf(): void {
    const L = this.perf.level;
    const scale = [1, 0.85, 0.85, 0.75, 0.66, 0.58][L];
    const pr = Math.max(0.7, this.basePR * scale);
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
    if (this.mirror) this.mirror.visible = L < 2;
    this.bloom.enabled = L < 3;
    this.renderer.shadowMap.autoUpdate = L < 5;
    this.resize();
    this.perf.skip = 20; // let the new settings settle before judging them
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Arms sit closer to centre on tall phone screens.
    this.arms.scale.setScalar(w < h ? 0.8 : 1);
  }

  begin(): void {
    this.prepWindow();
    this.walkFrom = [-2, 11];
    this.enter('walk');
    this.emitRack();
  }

  press(): void {
    if (this.auto) return;
    if (this.phase === 'replay') { this.endReplay(); return; }
    if (this.phase !== 'aim') return;
    this.phase = 'hold'; this.holdT = 0; this.greenPinged = false;
  }

  release(): void { if (this.phase === 'hold' && !this.auto) this.shoot(); }

  /** Autopilot only: jump to the end of the rival's run (same result as watching it). */
  skip(): void {
    const run = this.auto;
    if (!run || this.phase === 'done') return;
    this.score = run.score;
    this.makes = run.shots.filter(s => s.points > 0).length;
    this.shots = run.shots.length;
    this.clock = this.clock0 - run.end;
    this.finish();
  }

  get spot(): Spot { return this.course[this.spotIdx]; }

  hud() {
    return { elapsed: this.clock0 - Math.max(0, this.clock), score: this.score, time: Math.max(0, this.clock), spot: this.spot?.label ?? '', streak: this.streak, phase: this.phase, fade: this.fade, max: this.max, level: this.level.name };
  }

  rackState(): Array<{ kind: Ball['kind']; state: 'done' | 'now' | 'left' }> {
    const s = this.spot;
    if (!s) return [];
    return s.balls.map((b, i) => ({ kind: b.kind, state: i < this.ballIdx ? 'done' : i === this.ballIdx ? 'now' : 'left' }));
  }

  /** The current shot window, for the meter in the HUD. */
  meter(): { hold: number; rise: number; green: number; active: boolean } {
    return { hold: this.holdT, rise: this.win.rise, green: this.win.green * fireBoost(this.streak), active: this.phase === 'hold' || this.phase === 'aim' };
  }

  // ---- Simulation -----------------------------------------------------------

  private enter(p: Phase): void { this.phase = p; this.phaseT = 0; }

  private emitRack(): void {
    const s = this.spot;
    if (!s) return;
    this.cb.onEvent?.({ type: 'rack', label: s.label, index: this.spotIdx, money: s.balls.every(b => b.kind === 'money') });
  }

  private frame(real: number): void {
    if (this.auto) real *= this.opts.speed ?? 1;
    // Hitstop freezes the action for a beat on a swish; replays run slow.
    if (this.hitstop > 0) { this.hitstop -= real; this.render(real); return; }
    const scale = this.phase === 'replay' ? 0.32 : 1;
    const dt = real * scale;
    this.time += real;
    this.phaseT += dt;

    if (this.phase !== 'done' && this.phase !== 'replay') {
      this.clock -= real;
      // Autopilot: the clock follows the simulated run, so watching and skipping agree.
      if (this.auto) {
        const next = this.auto.shots[this.autoIdx];
        this.clock = Math.max(this.clock, this.clock0 - (next ? next.t : this.auto.end));
      }
      const sec = Math.ceil(this.clock);
      if (this.clock <= 5 && sec !== this.lastTick && sec > 0) { this.lastTick = sec; sfx.playTick(); }
      if (this.clock <= 10 && !this.sentFinal) { this.sentFinal = true; this.cb.onEvent?.({ type: 'final10' }); }
      if (this.clock <= 0 && this.phase !== 'flight' && !this.auto) { this.finish(); }
    }
    if (this.phase === 'walk' && this.phaseT > 1.6) { this.enter('aim'); this.fade = 1; this.cb.onEvent?.({ type: 'ball', kind: this.spot.balls[this.ballIdx].kind }); }
    if (this.auto && this.phase === 'aim') {
      const next = this.auto.shots[this.autoIdx];
      if (!next || next.spotIdx !== this.spotIdx || next.ballIdx !== this.ballIdx) { this.finish(); }
      else if (this.phaseT >= this.auto.rival.gather) { this.phase = 'hold'; this.holdT = 0; this.greenPinged = true; }
    }
    if (this.auto && this.phase === 'hold') {
      this.holdT += dt;
      const next = this.auto.shots[this.autoIdx];
      if (next && this.holdT >= this.win.rise + next.error) this.shoot();
    } else if (this.phase === 'hold') {
      this.holdT += dt;
      const { green, rise } = this.win;
      if (!this.greenPinged && this.holdT >= rise - (green * fireBoost(this.streak)) / 2) { this.greenPinged = true; sfx.playGreen(); }
      if (this.holdT > rise * 1.45) this.shoot();
    }
    if (this.phase === 'flight' || this.phase === 'replay') this.stepFlight(dt);
    this.fade = Math.max(0, this.fade - real * 3.2);
    this.punch = Math.max(0, this.punch - real * 2.5);
    this.shake = Math.max(0, this.shake - real * 3);
    this.render(real);
  }

  private stepFlight(dt: number): void {
    const t = this.phase === 'replay' ? (this.replayT += dt) : (this.flightT += dt);
    let acc = 0;
    for (let i = 0; i < this.flight.length; i++) {
      if (t >= acc && i > this.legPlayed) {
        this.legPlayed = i;
        const snd = this.flight[i].sound;
        if (snd === 'rim') sfx.playRim();
        if (snd === 'board') sfx.playBoard();
        if (snd === 'bounce') sfx.playBounce();
        if (snd === 'swish') {
          sfx.playSwish();
          if (this.phase === 'flight') this.celebrate();
          else this.burst();
        }
      }
      acc += this.flight[i].dur;
    }
    if (t > acc + 0.15) {
      if (this.phase === 'replay') this.endReplay();
      else this.afterShot();
    }
  }

  private ballPos(t: number): V3 {
    let acc = 0;
    for (const leg of this.flight) {
      if (t <= acc + leg.dur) return legAt(leg, Math.max(0, (t - acc) / leg.dur));
      acc += leg.dur;
    }
    const last = this.flight[this.flight.length - 1];
    return last ? last.b : [0, 0, 0];
  }

  private shoot(): void {
    const ball = this.spot.balls[this.ballIdx];
    const windowW = this.win.green * fireBoost(this.streak);
    const planned = this.auto?.shots[this.autoIdx];
    let grade: Grade, error: number;
    if (planned) {
      grade = planned.grade; error = planned.error; this.outcome = planned.outcome;
      this.autoIdx++;
      this.clock = this.clock0 - planned.t;
    } else {
      ({ grade, error } = judge(this.holdT, this.win.rise, windowW));
      this.outcome = resolveShot(grade);
    }
    this.ballNow = ball;
    this.ball.material = this.ballMats[ball.kind];
    // The ball leaves from the hands, wherever the jump put them.
    const hand = new THREE.Vector3();
    if (this.auto) hand.copy(this.ball.position);
    else this.heldBall.getWorldPosition(hand);
    const from: V3 = [hand.x, hand.z, hand.y];
    this.flight = planFlight(from, this.outcome, Math.random() < 0.5 ? -1 : 1);
    this.flightT = 0; this.legPlayed = 0;
    this.shots++;
    sfx.playRelease();
    this.cb.onEvent?.({ type: 'grade', grade, error, window: windowW });
    this.enter('flight');
    if (!isMake(this.outcome)) {
      this.streak = 0;
      this.rimMat.emissive.setHex(0x000000);
      this.cb.onEvent?.({ type: 'miss', outcome: this.outcome });
      if (this.outcome === 'airball') setTimeout(() => sfx.playGroan(), 900);
    }
    // That ball leaves the rack.
    const rb = this.rackBalls[this.spotIdx]?.[this.ballIdx];
    if (rb) rb.visible = false;
  }

  private celebrate(): void {
    if (!this.outcome || !isMake(this.outcome) || !this.ballNow) return;
    const pts = this.ballNow.points;
    this.score += pts; this.makes++; this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    if (this.streak === 3) { this.cb.onEvent?.({ type: 'fire' }); this.rimMat.emissive.setHex(0x5a1a00); }
    this.cb.onEvent?.({ type: 'make', points: pts, outcome: this.outcome, streak: this.streak });
    const big = pts > 1 || this.streak >= 3 || this.outcome === 'swish';
    sfx.playCheer(pts + (this.streak >= 3 ? 1 : 0));
    this.crowd.cheer(pts + (this.streak >= 3 ? 1 : 0));
    if (this.outcome === 'swish' && !this.reduced && !this.auto) this.hitstop = 0.07;
    this.punch = big ? 1 : 0.5;
    if (!this.reduced) this.shake = big ? 0.6 : 0.25;
    try { navigator.vibrate?.(pts > 1 ? [20, 40, 30] : 18); } catch { /* not supported */ }
    this.burst();
  }

  private burst(): void {
    const pts = this.ballNow?.points ?? 1;
    const palette = pts === 3 ? [0xe0e7ff, 0xa5b4fc, 0xffffff] : pts === 2 ? [0xf472b6, 0xf5c451, 0xffffff] : [0xf5c451, 0xffffff, 0xfb923c];
    const pos = this.confetti.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.confetti.geometry.getAttribute('color') as THREE.BufferAttribute;
    const c = new THREE.Color();
    const n = pts > 1 || this.streak >= 3 ? 400 : 180;
    for (let i = 0; i < n; i++) {
      const p = toThree([0, 0, RIM_HEIGHT]);
      pos.setXYZ(i, p.x, p.y, p.z);
      const a = Math.random() * Math.PI * 2, v = 1 + Math.random() * 3;
      this.confettiVel[i * 3] = Math.cos(a) * v; this.confettiVel[i * 3 + 1] = 2 + Math.random() * 3.5; this.confettiVel[i * 3 + 2] = Math.sin(a) * v;
      this.confettiLife[i] = 1.2 + Math.random() * 0.8;
      c.setHex(palette[i % palette.length]); col.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  /** After a shot lands: a replay for the big ones, else on to the next ball. */
  private afterShot(): void {
    const big = this.outcome && isMake(this.outcome) && this.ballNow && (this.ballNow.points >= 2 || this.isLastBall());
    if (big && !this.reduced && !this.auto) {
      this.enter('replay'); this.replayT = 0; this.legPlayed = 0; this.fade = 1;
      this.cb.onEvent?.({ type: 'replay', on: true });
      return;
    }
    this.nextBall();
  }

  private endReplay(): void {
    this.cb.onEvent?.({ type: 'replay', on: false });
    this.fade = 1;
    this.nextBall();
  }

  private isLastBall(): boolean {
    return this.spotIdx === this.course.length - 1 && this.ballIdx === this.spot.balls.length - 1;
  }

  private nextBall(): void {
    this.ballIdx++;
    if (this.ballIdx >= this.spot.balls.length) {
      this.walkFrom = spotPosition(this.spot);
      this.spotIdx++; this.ballIdx = 0;
      if (this.spotIdx >= this.course.length) { this.finish(); return; }
      this.prepWindow();
      this.enter('walk'); this.fade = 1;
      this.emitRack();
      return;
    }
    this.prepWindow();
    this.enter('aim');
    this.cb.onEvent?.({ type: 'ball', kind: this.spot.balls[this.ballIdx].kind });
  }

  private prepWindow(): void {
    const s = this.spot;
    if (!s) return;
    this.win = shotWindow(this.level, s, s.balls[this.ballIdx], this.ballIdx);
  }

  private finish(): void {
    if (this.phase === 'done') return;
    if (this.auto) this.clock = this.clock0 - this.auto.end;
    this.enter('done'); this.fade = 1;
    sfx.playHorn();
    this.crowd.cheer(2);
    this.cb.onDone?.({ score: this.score, max: this.max, makes: this.makes, shots: this.shots, bestStreak: this.bestStreak, level: this.level });
  }

  // ---- Rendering ------------------------------------------------------------

  private render(real: number): void {
    const t = this.time;
    this.crowd.update(t, real);
    this.ribbons.forEach((tex, i) => { tex.offset.x = (tex.offset.x + real * (0.05 + i * 0.01)) % 1; });
    if (Math.floor(t * 10) !== Math.floor((t - real) * 10)) this.scoreboards.draw(this.score, Math.max(0, this.clock), this.spot?.label ?? 'Final');

    // The ball in flight (or replay), its spin, and the net reacting to it.
    const flying = this.phase === 'flight' || this.phase === 'replay';
    const bp = flying ? this.ballPos(this.phase === 'replay' ? this.replayT : this.flightT) : null;
    this.ball.visible = !!bp;
    if (bp) { this.ball.position.copy(toThree(bp)); this.ball.rotation.x -= real * 14 * (this.phase === 'replay' ? 0.32 : 1); }
    if (this.auto && !bp && (this.phase === 'aim' || this.phase === 'hold')) {
      // The rival's ball: at the chest while gathering, overhead in the jump.
      const pp = this.player.position;
      const j = this.phase === 'hold' ? Math.min(1, this.holdT / this.win.rise) : 0;
      this.ball.visible = true;
      this.ball.material = this.ballMats[this.spot.balls[this.ballIdx]?.kind ?? 'regular'];
      // Out in front of the body, toward the rim.
      const d = Math.hypot(pp.x, pp.z) || 1, out = 0.32 - j * 0.12;
      this.ball.position.set(pp.x - (pp.x / d) * out, pp.y + 1.3 + j * 1.15, pp.z - (pp.z / d) * out);
    }
    this.net.step(real * (this.phase === 'replay' ? 0.32 : 1), bp, BALL_R, 0);
    this.stepConfetti(real);
    this.stepFlames(bp);

    // Arms and held ball: first person only.
    const fp = !this.auto && (this.phase === 'aim' || this.phase === 'hold');
    this.arms.visible = fp || (!this.auto && this.phase === 'flight' && this.flightT < 0.25);
    this.heldBall.visible = fp;
    this.ballRig.rotation.set(0, 0, 0);
    if (fp) {
      this.heldBall.material = this.ballMats[this.spot.balls[this.ballIdx]?.kind ?? 'regular'];
      const j = this.phase === 'hold' ? ease(Math.min(1, this.holdT / this.win.rise)) : 0;
      // Set point: the ball comes up from the chest toward the forehead as
      // you rise, drifting to the shooting side so the rim stays in view.
      const bob = this.phase === 'aim' ? Math.sin(t * 2.4) * 0.006 : 0;
      this.arms.position.set(0.035 * j, -0.26 + j * 0.17 + bob, -0.6 - j * 0.06);
      this.arms.rotation.set(-0.1 + j * 0.35, 0, -0.05 * j);
      this.heldBall.rotation.y = 0.4;
    } else if (this.phase === 'flight') {
      // Follow-through: hands snap up and out as the ball leaves.
      const k = Math.min(1, this.flightT / 0.12);
      this.arms.position.set(0.05, -0.09 + k * 0.12, -0.68);
      this.arms.rotation.x = 0.25 + k * 0.5;
    }

    this.updatePlayer(t);
    this.updateCamera(real);
    if (!this.renderer.shadowMap.autoUpdate && this.perf.frame % 3 === 0) this.renderer.shadowMap.needsUpdate = true;
    if (!this.noDraw) this.composer.render();
  }

  private stepConfetti(dt: number): void {
    const pos = this.confetti.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.confettiLife.length; i++) {
      if (this.confettiLife[i] <= 0) continue;
      this.confettiLife[i] -= dt;
      this.confettiVel[i * 3 + 1] -= 6 * dt;
      const x = pos.getX(i) + this.confettiVel[i * 3] * dt, y = pos.getY(i) + this.confettiVel[i * 3 + 1] * dt, z = pos.getZ(i) + this.confettiVel[i * 3 + 2] * dt;
      pos.setXYZ(i, x, this.confettiLife[i] > 0 ? Math.max(0.01, y) : -100, z);
    }
    pos.needsUpdate = true;
  }

  private stepFlames(bp: V3 | null): void {
    const pos = this.flames.geometry.getAttribute('position') as THREE.BufferAttribute;
    const on = this.streak >= 3 && !!bp;
    for (let i = 0; i < pos.count; i++) {
      if (!on) { pos.setXYZ(i, 0, -100, 0); continue; }
      const p = toThree(bp!);
      const k = i / pos.count;
      pos.setXYZ(i, p.x + (Math.random() - 0.5) * 0.12, p.y + (Math.random() - 0.5) * 0.12 - k * 0.1, p.z + (Math.random() - 0.5) * 0.12 + k * 0.25);
    }
    pos.needsUpdate = true;
  }

  /** The shooter, seen from the broadcast camera: jogs to the next rack, then turns to the hoop. */
  private updatePlayer(t: number): void {
    const show = this.phase === 'walk' || this.phase === 'done' || (!!this.auto && this.phase !== 'replay');
    this.player.visible = show;
    if (!show) return;
    const to = spotPosition(this.spot ?? this.course[this.course.length - 1]);
    const u = this.phase === 'walk' ? ease(Math.min(1, this.phaseT / 1.3)) : 1;
    const x = lerp(this.walkFrom[0], to[0], u), y = lerp(this.walkFrom[1], to[1], u);
    this.player.position.copy(toThree([x, y, 0]));
    const moving = this.phase === 'walk' && u < 1;
    const dir = moving ? Math.atan2(to[0] - this.walkFrom[0], to[1] - this.walkFrom[1]) : Math.atan2(-x, -y);
    this.player.rotation.y = dir;
    const P = this.playerParts, sw = moving ? Math.sin(t * 13) * 0.7 : 0;
    P.legL.rotation.x = sw; P.legR.rotation.x = -sw; P.armL.rotation.x = -sw * 0.8; P.armR.rotation.x = sw * 0.8;
    if (this.phase === 'done') { P.armL.rotation.x = P.armR.rotation.x = -2.9 + Math.sin(t * 6) * 0.15; }
    this.player.position.y = moving ? Math.abs(Math.sin(t * 13)) * 0.05 : 0;
    if (this.auto) {
      // A rival's jumper: dip and gather, rise with the ball overhead, follow through, land.
      const rise = this.win.rise;
      const j = this.phase === 'hold' ? Math.sin(Math.min(1, this.holdT / rise) * Math.PI * 0.5)
        : this.phase === 'flight' ? Math.max(0, Math.cos(Math.min(1, this.flightT / 0.45) * Math.PI * 0.5)) : 0;
      const dip = this.phase === 'aim' ? Math.sin(Math.min(1, this.phaseT / Math.max(0.1, this.auto.rival.gather)) * Math.PI) * 0.08 : 0;
      this.player.position.y = j * 0.5 - dip;
      if (this.phase === 'aim' || this.phase === 'hold' || this.phase === 'flight') {
        const up = this.phase === 'aim' ? -1.2 : -2.6 - (this.phase === 'flight' ? 0.3 : 0);
        P.armL.rotation.x = up; P.armR.rotation.x = up - 0.1;
        P.legL.rotation.x = P.legR.rotation.x = dip * 2;
      }
    }
  }

  private updateCamera(real: number): void {
    let pos: THREE.Vector3, look: THREE.Vector3, fov: number;
    const k = 1 - Math.pow(0.0015, real); // smooth follow
    if (this.phase === 'walk' || this.phase === 'done' || (this.auto && this.phase !== 'replay')) {
      // Broadcast: high on the sideline, tracking the shooter with the hoop in frame.
      const pp = this.player.position;
      pos = new THREE.Vector3(-11.5, 6.2, pp.z * 0.5 + 6.5);
      look = new THREE.Vector3(pp.x * 0.6, 1.4, pp.z * 0.55);
      fov = 42;
      if (this.auto && this.phase !== 'walk') {
        // Watching a rival: frame shooter and rim together, pushing in a touch while the ball's up.
        const push = this.phase === 'flight' ? Math.min(1, this.flightT * 1.5) : 0;
        const k = this.camera.aspect < 1 ? 0.68 : 0.45; // tall screens favour the shooter
        look.set(pp.x * k, 1.9 + push * 0.6, pp.z * k);
        fov = 40 - push * 4;
      }
      this.camPos.lerp(pos, this.fade > 0.5 ? 1 : k);
      this.camLook.lerp(look, this.fade > 0.5 ? 1 : k);
    } else if (this.phase === 'replay') {
      // Replay: low, beside the rim, slow motion.
      pos = toThree([1.9, 1.4, 2.3]); look = toThree([0, 0, RIM_HEIGHT - 0.2]); fov = 34;
      this.camPos.copy(pos); this.camLook.copy(look);
    } else {
      // First person: your eyes rise with the jump; after release the view follows the ball a little.
      const [px, py] = spotPosition(this.spot);
      const j = this.phase === 'hold' ? Math.sin(Math.min(1, this.holdT / this.win.rise) * Math.PI * 0.5) : this.phase === 'flight' ? Math.max(0, 1 - this.flightT * 1.3) : 0;
      const sway = this.phase === 'aim' && !this.reduced ? Math.sin(this.phaseT * 1.6) * 0.01 : 0;
      pos = toThree([px * 1.04 + sway, py * 1.04, 1.78 + j * 0.5]);
      let lk: V3 = [0, 0, RIM_HEIGHT - 0.55];
      if (this.phase === 'flight') { const b = this.ballPos(this.flightT); lk = [lerp(0, b[0], 0.25), lerp(0, b[1], 0.25), Math.max(lk[2], lerp(lk[2], b[2], 0.5))]; }
      look = toThree(lk);
      fov = 52;
      this.camPos.copy(pos);
      this.camLook.lerp(look, this.phase === 'flight' ? k : 1);
    }
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.04 * this.shake, (Math.random() - 0.5) * 0.04 * this.shake, 0));
    this.camera.lookAt(this.camLook);
    // Wider on tall phone screens so the hoop and court both fit.
    const tall = this.camera.aspect < 1 ? 1 + (1 - this.camera.aspect) * 0.55 : 1;
    this.camera.fov = fov * tall - this.punch * 5;
    this.camera.updateProjectionMatrix();
  }
}

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  pickRelease, RELOAD, JOG,
  buildCourse, fireBoost, isMake, judge, MAX_SCORE, resolveShot, RIM_HEIGHT, shotWindow, spotPosition,
  perfectMultiplier, shotPoints,
  type Ball, type Grade, type ScoringMode, type Level, type Outcome, type Spot,
} from '../engine';
import { planShotSteps, planShot, previewArc, sampleAt, simulateLaunch, type ShotPlan, type V3 } from '../ballSim';
import * as sfx from '../audio';
import { ballTexture, FLOOR, floorTexture, makeScoreboard, ribbonTexture } from './textures';
import { Effects } from './effects';
import { NO_FX, shotFx, startFx, stepFx, type FxRun, type ShotFx } from '../fx';
import { Net } from './net';
import { seeded, type RivalRun } from '../rivals';
import { Crowd } from './crowd';
import { buildArena, type Arena } from './arena';
import { Athlete, HAIRS, SKINS } from './athlete';
import { getLook } from '../settings';
import { HoldClock } from '../holdClock';

// 3-Point Shootout in 3D: a lit arena with a lacquered floor, glass board and
// a cloth net, a full crowd, first-person shooting and a broadcast camera
// between racks, slow-motion replays of the big shots. Game logic lives in
// ../engine; game coordinates are metres with z up (x across, y out from the
// rim), mapped to Three's y-up space by toThree.

export type Phase = 'walk' | 'aim' | 'hold' | 'flight' | 'wait' | 'replay' | 'done';

export type ShootoutEvent =
  | { type: 'rack'; label: string; index: number; money: boolean }
  | { type: 'ball'; kind: Ball['kind'] }
  | { type: 'grade'; grade: Grade; error: number; window: number }
  | { type: 'make'; points: number; outcome: Outcome; streak: number; perfect: boolean; chain: number; mult: number; kind: Ball['kind']; bank?: boolean }
  | { type: 'time' }
  | { type: 'buzzer' }
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
  /**
   * How you shoot. 'jumper' (default): hold to rise, let go on the green; the
   * rules decide and physics stages it. 'touch': drag toward the hoop and let
   * go; the physics decides. Random spots, side-on camera.
   */
  control?: 'jumper' | 'touch';
  /** How makes score (default classic 1/2/3). */
  scoring?: ScoringMode;
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

/** A soft round dot for the touch guide (points are square otherwise). */
function dotTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.65, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(cv);
}

/** Flights worth having ready at each spot (outcome:side; early = -1 is short, late = +1 is long). */
const PLAN_KEYS = ['swish:1', 'make:1', 'make:-1', 'rim-in:1', 'rim-in:-1', 'rim-out:-1', 'rim-out:1', 'brick:-1', 'brick:1', 'airball:-1'];

const spinAxis = new THREE.Vector3(), spinQ = new THREE.Quaternion();
/** Turn a ball by its spin (game coords, rad/s) over dt. The y/z swap to three's space mirrors the axis. */
function spin(mesh: THREE.Object3D, w: V3, dt: number): void {
  const rate = Math.hypot(w[0], w[1], w[2]);
  if (rate < 1e-4) return;
  spinAxis.set(-w[0] / rate, -w[2] / rate, -w[1] / rate);
  mesh.quaternion.premultiply(spinQ.setFromAxisAngle(spinAxis, rate * dt));
}

/** One shot in the air: its planned flight, and what the rules already decided about it. */
interface LiveBall {
  mesh: THREE.Mesh;
  plan: ShotPlan;
  /** Seconds since release. */
  t: number;
  pos: V3;
  /** Gap between the hand and the planned start, blended away over the first moment. */
  offset: V3;
  kind: Ball['kind'];
  outcome: Outcome;
  points: number;
  perfect: boolean;
  chain: number;
  streakAfter: number;
  bank?: boolean;
  /** What it shows when it gets to the rim (perfect-release chain). */
  fx: ShotFx;
  nextEvent: number;
  resolved: boolean;
}

/** The stanchion pad's side: brand colour, a stripe and the logo. */
function stanchionPadTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256); grad.addColorStop(0, '#7a1f4f'); grad.addColorStop(1, '#4a1030');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#F5C451'; g.fillRect(0, 196, 512, 10);
  g.fillStyle = '#fff'; g.font = 'italic 900 92px Inter, Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('VELVET', 256, 110);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The scoreboard's LED halo: deep wine with a thin gold line through it.
function haloTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, '#2a0717'); grad.addColorStop(0.5, '#5C163A'); grad.addColorStop(1, '#2a0717');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#B8923A'; g.fillRect(0, 15, 256, 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The scoreboard's underside: a dark panel with a soft wine glow and a gold ring.
function bellyTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, '#4a1230'); grad.addColorStop(1, '#0c0408');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#8a6a2c'; g.lineWidth = 2; g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

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

// Retro look: chunky pixels (about 200 rows tall), a limited palette and
// ordered dithering, like a 16-bit console, over the same 3D arena.
function retroPass(): ShaderPass {
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uPx: { value: 4 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uPx; varying vec2 vUv;
      float bayer(vec2 p) {
        vec2 q = mod(p, 4.0);
        int i = int(q.x) + int(q.y) * 4;
        float m[16];
        m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
        m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
        for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0 - 0.5;
        return 0.0;
      }
      void main() {
        vec2 cell = floor(vUv * uRes / uPx);
        vec2 uv = (cell + 0.5) * uPx / uRes;
        vec3 c = texture2D(tDiffuse, uv).rgb;
        float levels = 9.0;
        c = floor(c * levels + 0.5 + bayer(cell) * 0.55) / levels;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
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
  private retro: ShaderPass | null = null;
  private opts: RunOptions;
  /** Autopilot: the rival run being played back, and the next shot in it. */
  private auto: RivalRun | null;
  private autoIdx = 0;
  private clock0: number;

  // World pieces.
  private net!: Net;
  private crowd!: Crowd;
  private arena!: Arena;
  private ball!: THREE.Mesh;
  private ballMats: Record<Ball['kind'], THREE.MeshStandardMaterial>;
  private heldBall!: THREE.Mesh;
  private arms = new THREE.Group();
  private ballRig!: THREE.Group;
  private player = new THREE.Group();
  private athlete!: Athlete;
  private rackBalls: THREE.Mesh[][] = [];
  private ribbons: THREE.Texture[] = [];
  private rimMat!: THREE.MeshStandardMaterial;
  private scoreboards: ReturnType<typeof makeScoreboard>;
  private fx!: Effects;
  private fxRun!: FxRun;
  private ballsTotal = 0;
  /** How hot the rim glows: steady while it's on fire, a flash when it explodes. */
  private rimHeat = 0;
  private rimOnFire = false;
  private finaleAt = -99;

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
  /** Times your hold from input timestamps, so judging doesn't depend on frame rate. */
  private holdClock = new HoldClock(() => (this.synthetic ? this.simMs : performance.now()));
  /** Test harness only: advance() drives a synthetic clock instead of wall time. */
  private synthetic = false;
  private simMs = 0;
  private win = { green: 0.08, rise: 0.7 };
  /** This run's release point (fraction of the jump), and where the green sits for the current shot. */
  private shift = 0;
  private target = 0.7;
  /** The last release, flashed on the meter for a moment so you can learn the timing. */
  private lastRelease: { held: number; target: number; green: number; at: number; error: number; starry: boolean } | null = null;
  private greenPinged = false;
  /** Time since the last release (follow-through and reaching for the next ball). */
  private flightT = 0;
  /** Perfect releases in a row (Score Attack multiplier). Decided at release. */
  private chain = 0;
  /** Balls in the air or rolling away. Catch and shoot: several can be live. */
  private live: LiveBall[] = [];
  private ballPool: THREE.Mesh[] = [];
  /** Flights planned ahead for this spot while you aim, so release never waits on the physics. */
  private plans = new Map<string, { plan: ShotPlan; from: V3 }>();
  private planJob: { key: string; from: V3; gen: Generator<void, ShotPlan> } | null = null;
  private planSpot = -1;
  private seed = (Math.random() * 1e9) >>> 0;
  private shotSeq = 0;
  /** What the crowd has seen: the streak as of the last ball to land. */
  private shownStreak = 0;
  /** No more shots (clock out or course done); finish once the last balls land. */
  private ending = false;
  private replayBall: LiveBall | null = null;
  /** Touch shooting: aiming state, the guide arc, and how long it shows (shorter on harder levels). */
  private touch: boolean;
  private aiming = false;
  private aimV: V3 | null = null;
  private guide!: THREE.Points;
  private guideSecs: number;
  private touchRand: () => number = Math.random;
  private walkTime = JOG;
  private replayT = 0;
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
    this.touch = opts.control === 'touch';
    this.guideSecs = [0.55, 0.45, 0.38, 0.3, 0.24][level.id] ?? 0.4;
    this.touchRand = seeded(this.seed ^ 0x5bd1e995);
    this.course = this.touch ? [this.touchSpot(0)] : opts.course ?? buildCourse(moneyRack);
    this.max = MAX_SCORE(this.course);
    this.clock = opts.clock ?? (this.touch ? 60 : level.clock);
    this.clock0 = this.clock;
    this.shift = pickRelease().shift;
    this.reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.quality = coarse || Math.min(window.innerWidth, window.innerHeight) < 600 ? 'mid' : 'high';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    // Start sharp but sane; the frame governor trades resolution for 60fps.
    this.basePR = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 1.5 : 1.35);
    this.renderer.setPixelRatio(this.basePR);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
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
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.26, 0.5, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(outputPass(this.renderer.toneMappingExposure));
    if (getLook() === 'retro') { this.retro = retroPass(); this.composer.addPass(this.retro); }

    this.ballMats = {
      regular: this.makeBallMat('regular'), money: this.makeBallMat('money'), starry: this.makeBallMat('starry'),
    };
    this.scoreboards = makeScoreboard();
    this.build();
    this.resize();
    this.precompile();
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
      if (i === 4) { L.castShadow = true; L.shadow.mapSize.set(1024, 1024); L.shadow.bias = -0.0004; L.shadow.normalBias = 0.025; L.shadow.camera.near = 4; L.shadow.camera.far = 30; }
      s.add(L, L.target);
    });
    // The building: upper deck, suites, walls, roof, lighting rigs (the fixtures
    // for these spots), banners, light beams.
    this.arena = buildArena(s, toThree, { hi, spots });
    this.ribbons.push(...this.arena.ribbons);

    this.buildHoop();

    // Crowd and stands.
    this.crowd = new Crowd(toThree, hi ? 4200 : 2200);
    s.add(this.crowd.group);

    // LED ribbon boards along the front of each stand.
    const ribbon = (text: string, color: string, len: number, pos: V3, rotY: number) => {
      const tex = ribbonTexture(text, color);
      tex.repeat.set(len / 12, 1);
      this.ribbons.push(tex);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.55), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.7, color: 0x000000 }));
      m.position.copy(toThree(pos)); m.rotation.y = rotY;
      s.add(m);
    };
    ribbon('VELVET  3-POINT SHOOTOUT', '#F5C451', 30, [0, -6.0, 0.35], 0);
    ribbon('MONEY BALL  •  STARRY RANGE', '#F472B6', 22, [11.1, 6, 0.35], -Math.PI / 2);
    ribbon('HIT THE GREEN', '#7CF7D4', 22, [-11.1, 6, 0.35], Math.PI / 2);

    // Scoreboards: a centre-hung board over the court and a board behind the basket.
    const sbMat = new THREE.MeshStandardMaterial({ map: this.scoreboards.tex, emissive: 0xffffff, emissiveMap: this.scoreboards.tex, emissiveIntensity: 1.2, color: 0x000000 });
    const jumbo = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x0b0b10, metalness: 0.5, roughness: 0.4 });
    jumbo.add(new THREE.Mesh(new THREE.BoxGeometry(6.6, 3.5, 6.6), steel));
    for (let k = 0; k < 4; k++) {
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.1), sbMat);
      scr.position.set(Math.sin((k * Math.PI) / 2) * 3.31, 0, Math.cos((k * Math.PI) / 2) * 3.31);
      scr.rotation.y = (k * Math.PI) / 2;
      jumbo.add(scr);
    }
    // A slim LED halo under the screens: wine with a gold line, quietly lit.
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.42, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: haloTexture(), emissiveIntensity: 0.55, side: THREE.DoubleSide }));
    halo.position.y = -2.25;
    jumbo.add(halo);
    // The underbelly, seen from the floor: a soft wine glow, not a black slab.
    const belly = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 6.6).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: bellyTexture(), emissiveIntensity: 0.5 }));
    belly.position.y = -1.76;
    jumbo.add(belly);
    // Hung on four cables.
    [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]].forEach(([x, z]) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 7, 6), steel); c.position.set(x, 5.25, z); jumbo.add(c);
    });
    jumbo.position.copy(toThree([0, 7, 11.2]));
    s.add(jumbo);
    // The big board on the upper deck behind the basket.
    // It sits behind the rim from most racks, so it glows less than the jumbotron.
    const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshStandardMaterial({ map: this.scoreboards.tex, emissive: 0xffffff, emissiveMap: this.scoreboards.tex, emissiveIntensity: 0.6, color: 0x000000 }));
    back.position.copy(toThree([0, -18.6, 12.4]));
    s.add(back);

    // Ball racks at each spot.
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, metalness: 0.85, roughness: 0.3 });
    if (!this.touch) this.course.forEach((spot) => {
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
    // Balls in flight: catch and shoot means a few can be up at once.
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(this.ball.geometry, this.ballMats.regular);
      m.castShadow = true; m.visible = false;
      s.add(m); this.ballPool.push(m);
    }
    // Touch: the dotted guide showing the start of your throw.
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
    this.guide = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, map: dotTexture(), alphaTest: 0.3, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, fog: false }));
    this.guide.frustumCulled = false; this.guide.renderOrder = 10; this.guide.visible = false;
    s.add(this.guide);
    this.buildArms();
    this.buildPlayer();

    // Make effects: fireworks, flames and the finale, driven by the perfect-release chain.
    this.fx = new Effects(toThree, [0, 0, RIM_HEIGHT], RIM_R);
    s.add(this.fx.group);
    this.fxRun = startFx(this.course);
    this.ballsTotal = this.course.reduce((n, sp) => n + sp.balls.length, 0);
  }

  private buildHoop(): void {
    const s = this.scene;
    // Stanchion: padded base, pole and arm.
    const padTex = stanchionPadTexture();
    const pad = new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.6 });
    const padPlain = new THREE.MeshStandardMaterial({ color: 0x5c163a, roughness: 0.6 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x23252d, metalness: 0.7, roughness: 0.35 });
    // Soft, rounded padding with the logo on the sides; the pole and arm padded too.
    const base = new THREE.Mesh(new RoundedBoxGeometry(1.4, 1.1, 2.2, 4, 0.16), [pad, pad, padPlain, padPlain, padPlain, padPlain]);
    base.position.copy(toThree([0, -3.7, 0.55])); base.castShadow = true; s.add(base);
    const pole = new THREE.Mesh(new RoundedBoxGeometry(0.42, 3.4, 0.42, 3, 0.1), padPlain); pole.position.copy(toThree([0, -3.4, 2.2])); s.add(pole);
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.26, 3.0, 3, 0.08), steel); arm.position.copy(toThree([0, -2.0, 3.55])); arm.rotation.x = -0.12; s.add(arm);
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
    const j = this.opts.jersey;
    const n = j?.number ?? 30;
    this.athlete = new Athlete({
      jersey: j?.colors ?? ['#5C163A', '#F5C451'],
      number: n,
      skin: SKINS[j ? n % SKINS.length : 0],
      hair: HAIRS[n % HAIRS.length],
    });
    this.player.add(this.athlete.group);
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
    this.synthetic = true;
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
    if (this.retro) {
      const pr = this.renderer.getPixelRatio();
      this.retro.uniforms.uRes.value.set(w * pr, h * pr);
      this.retro.uniforms.uPx.value = Math.max(2, Math.round((h * pr) / 200));
    }
    // Arms sit closer to centre on tall phone screens.
    this.arms.scale.setScalar(w < h ? 0.8 : 1);
  }

  begin(): void {
    this.prepWindow();
    this.walkFrom = this.touch ? [0, 9.5] : [-2, 11];
    this.enter('walk');
    if (!this.touch) this.emitRack();
  }

  // ---- Touch shooting ---------------------------------------------------------

  /** A random spot for touch shooting: anywhere from the paint to well beyond the arc. */
  private touchSpot(n: number): Spot {
    const r = this.touchRand;
    const angle = (r() * 2 - 1) * 78;
    const dist = 3.6 + r() * 5.4;
    const three = dist >= (Math.abs(angle) > 68 ? 6.7 : 7.24);
    const money = n > 0 && r() < 0.16;
    return { id: `t${n}`, label: `${dist.toFixed(1)}m · ${three ? 3 : 2}PT${money ? ' · MONEY' : ''}`, angle, dist, balls: [{ kind: money ? 'money' : 'regular', points: (three ? 3 : 2) * (money ? 2 : 1) }] };
  }

  /** Point to aim (screen coords -1..1). Press shows the guide, moving adjusts it, letting go throws. */
  aimStart(nx: number, ny: number): void {
    if (!this.touch || this.phase !== 'aim' || this.ending) return;
    this.aiming = true;
    this.aimMove(nx, ny);
  }

  aimMove(nx: number, ny: number): void {
    if (!this.aiming) return;
    this.aimV = this.touchVelocity(nx, ny);
    const pos = this.guide.geometry.getAttribute('position') as THREE.BufferAttribute;
    const pts = this.aimV ? previewArc(this.handPoint(), this.aimV, [0, 0, 0], this.guideSecs, 0.035) : [];
    for (let i = 0; i < pos.count; i++) {
      const p = pts[i];
      if (p) { const t = toThree(p); pos.setXYZ(i, t.x, t.y, t.z); } else pos.setXYZ(i, 0, -100, 0);
    }
    pos.needsUpdate = true;
    this.guide.visible = pts.length > 0;
  }

  aimEnd(nx: number, ny: number): void {
    if (!this.aiming) return;
    this.aimMove(nx, ny);
    this.aiming = false;
    this.guide.visible = false;
    if (this.aimV && this.phase === 'aim' && !this.ending) this.throwBall(this.aimV);
  }

  aimCancel(): void { this.aiming = false; this.guide.visible = false; }

  /** Where the ball leaves the hands in touch mode (overhead, a little in front). */
  private handPoint(): V3 { return [this.ball.position.x, this.ball.position.z, this.ball.position.y]; }

  /**
   * The throw for a pointer position: the pointer is projected onto the
   * upright plane through the ball and the rim, and the ball is thrown
   * toward that point, faster the further away it is.
   */
  private touchVelocity(nx: number, ny: number): V3 | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const b = this.handPoint();
    const d = Math.hypot(b[0], b[1]) || 1;
    const n = new THREE.Vector3(-b[1] / d, 0, b[0] / d); // plane normal (three space: x, up, z = game y)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, toThree(b));
    const hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return null;
    const p: V3 = [hit.x, hit.z, hit.y];
    const POWER = 3.1, MAX = 13.5;
    let v: V3 = [(p[0] - b[0]) * POWER, (p[1] - b[1]) * POWER, (p[2] - b[2]) * POWER];
    const sp = Math.hypot(v[0], v[1], v[2]);
    if (sp < 2.5 || v[2] < 0.5) return null;
    if (sp > MAX) v = [v[0] * MAX / sp, v[1] * MAX / sp, v[2] * MAX / sp];
    return v;
  }

  /** Throw exactly as aimed: the physics decides make or miss. */
  private throwBall(v: V3): void {
    const ball = this.spot.balls[0];
    const from = this.handPoint();
    const l = Math.hypot(v[0], v[1]) || 1;
    const w: V3 = [-(v[1] / l) * 15, (v[0] / l) * 15, 0]; // backspin
    const shot = simulateLaunch(from, v, w);
    const swish = shot.outcome === 'swish';
    const points = shot.made ? ball.points + (swish ? 1 : 0) + (shot.bank ? 1 : 0) : 0;
    this.chain = shot.made && swish ? this.chain + 1 : 0;
    this.streak = shot.made ? this.streak + 1 : 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    if (shot.made) this.makes++;
    this.shots++;
    const mesh = this.ballPool.find(m => !m.visible) ?? this.ballPool[0];
    mesh.material = this.ballMats[ball.kind];
    mesh.visible = true; mesh.scale.setScalar(1);
    this.live.push({
      mesh, plan: shot, t: 0, pos: [...from], offset: [0, 0, 0], kind: ball.kind, outcome: shot.outcome, points,
      perfect: swish, chain: this.chain, streakAfter: this.streak, bank: shot.bank, fx: NO_FX, nextEvent: 0, resolved: false,
    });
    if (this.live.length > this.ballPool.length) this.live.shift();
    this.replayBall = this.live[this.live.length - 1];
    this.enter('flight'); this.flightT = 0;
  }

  /** On to a fresh random spot: a quick jog while the last ball is still up. */
  private nextTouchSpot(): void {
    this.walkFrom = spotPosition(this.spot);
    this.course.push(this.touchSpot(this.course.length));
    this.spotIdx++; this.ballIdx = 0;
    const [x, y] = spotPosition(this.spot);
    this.walkTime = Math.max(0.55, Math.min(1.2, Math.hypot(x - this.walkFrom[0], y - this.walkFrom[1]) / 6));
    this.prepWindow();
    this.enter('walk');
  }

  /** Start the jump. `at` is the input event's timeStamp, for frame-accurate timing. */
  press(at?: number): void {
    if (this.auto || this.touch) return;
    if (this.phase === 'replay') { this.endReplay(); return; }
    if (this.ending) return;
    if (this.phase !== 'aim') return;
    this.phase = 'hold'; this.holdT = 0; this.greenPinged = false;
    this.holdClock.start(at);
  }

  /** Let go. The hold is measured between the two event timestamps, not in frames. */
  release(at?: number): void {
    if (this.phase !== 'hold' || this.auto) return;
    this.holdT = this.holdClock.stop(at);
    this.shoot();
  }

  /**
   * The touch was taken away mid-jump (an iOS system gesture): land without
   * shooting rather than firing a shot the player didn't choose.
   */
  cancel(): void {
    if (this.phase !== 'hold' || this.auto) return;
    this.holdClock.stop();
    this.holdT = 0;
    this.enter('aim');
  }

  /** Autopilot only: jump to the end of the rival's run (same result as watching it). */
  skip(): void {
    const run = this.auto;
    if (!run || this.phase === 'done') return;
    this.score = run.score;
    this.makes = run.shots.filter(s => s.points > 0).length;
    this.shots = run.shots.length;
    this.clock = this.clock0 - run.end;
    this.live.forEach(b => { b.mesh.visible = false; });
    this.live = [];
    this.finish();
  }

  get spot(): Spot { return this.course[this.spotIdx]; }

  hud() {
    return { elapsed: this.clock0 - Math.max(0, this.clock), score: this.score, time: Math.max(0, this.clock), spot: this.spot?.label ?? '', streak: this.shownStreak, phase: this.phase, fade: this.fade, max: this.max, level: this.level.name };
  }

  rackState(): Array<{ kind: Ball['kind']; state: 'done' | 'now' | 'left' }> {
    const s = this.spot;
    if (!s) return [];
    return s.balls.map((b, i) => ({ kind: b.kind, state: i < this.ballIdx ? 'done' : i === this.ballIdx ? 'now' : 'left' }));
  }

  /**
   * What the release meter should show. The first shot at each rack shows it
   * live so you can find the mark; after that it only flashes for a moment
   * after each release (where you let go against the green), then fades.
   * Starry balls never show it: they're timed from memory of the shots before.
   */
  meterView(): { mode: 'live' | 'flash' | 'off'; hold: number; target: number; green: number; error: number; age: number } {
    if (this.auto || this.touch) return { mode: 'off', hold: 0, target: 1, green: 0, error: 0, age: 0 };
    const green = this.win.green * fireBoost(this.streak);
    if (this.meterLive() && (this.phase === 'aim' || this.phase === 'hold')) return { mode: 'live', hold: this.holdT, target: this.target, green, error: 0, age: 0 };
    const r = this.lastRelease, age = r ? this.time - r.at : 99;
    if (r && !r.starry && age < 1.3) return { mode: 'flash', hold: r.held, target: r.target, green: r.green, error: r.error, age };
    return { mode: 'off', hold: 0, target: this.target, green, error: 0, age };
  }

  /** The meter runs live for the first ball at each rack, never for a Starry ball. */
  private meterLive(): boolean {
    return this.ballIdx === 0 && this.spot?.balls[0]?.kind !== 'starry';
  }

  // ---- Simulation -----------------------------------------------------------

  private enter(p: Phase): void { this.phase = p; this.phaseT = 0; }

  private emitRack(): void {
    const s = this.spot;
    if (!s) return;
    this.cb.onEvent?.({ type: 'rack', label: s.label, index: this.spotIdx, money: s.balls.every(b => b.kind === 'money') });
  }

  private frame(real: number): void {
    this.simMs += real * 1000;
    if (this.auto) real *= this.opts.speed ?? 1;
    // Replays run slow.
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
      if (this.clock <= 0 && !this.auto && !this.ending) this.timeUp();
    }
    if (this.phase === 'walk' && this.phaseT > (this.touch ? this.walkTime : JOG)) { this.enter('aim'); this.fade = this.touch ? 0 : 1; this.cb.onEvent?.({ type: 'ball', kind: this.spot.balls[this.ballIdx].kind }); }
    if (this.auto && this.phase === 'aim') {
      const next = this.auto.shots[this.autoIdx];
      if (!next || next.spotIdx !== this.spotIdx || next.ballIdx !== this.ballIdx) { this.ending = true; this.enter('wait'); }
      else if (this.phaseT >= this.auto.rival.gather) { this.phase = 'hold'; this.holdT = 0; this.greenPinged = true; }
    }
    if (this.auto && this.phase === 'hold') {
      this.holdT += dt;
      const next = this.auto.shots[this.autoIdx];
      if (next && this.holdT >= this.win.rise + next.error) this.shoot();
    } else if (this.phase === 'hold') {
      this.holdT = this.holdClock.held();
      const { green } = this.win;
      // Only a live meter (the first shot at each rack) pings the green: after that it's timing from memory.
      if (!this.greenPinged && this.meterLive() && this.holdT >= this.target - (green * fireBoost(this.streak)) / 2) { this.greenPinged = true; sfx.playGreen(); }
      if (this.holdT > Math.max(this.target, this.win.rise) * 1.45) { this.holdT = this.holdClock.stop(); this.shoot(); }
    }
    // Catch and shoot: the next ball comes as soon as you've followed through and reached for it.
    if (this.phase === 'flight') { this.flightT += dt; if (this.phaseT >= (this.touch ? 0.45 : RELOAD)) this.nextBall(); }
    if (this.phase === 'replay') this.stepReplay(dt);
    else this.stepBalls(dt);
    this.pumpPlans();
    // After a finale, let the explosion play out before the replay.
    if (this.phase === 'wait' && this.phaseT > 0.5 && this.live.every(b => b.resolved) && this.time - this.finaleAt > 2.4) this.wrapUp();
    this.fade = Math.max(0, this.fade - real * 3.2);
    this.punch = Math.max(0, this.punch - real * 2.5);
    this.shake = Math.max(0, this.shake - real * 3);
    this.render(real);
  }

  /** The clock ran out. A ball already released still counts; one in your hands doesn't. */
  private timeUp(): void {
    if (this.phase === 'hold' || this.aiming) { this.holdClock.stop(); this.aimCancel(); this.cb.onEvent?.({ type: 'time' }); }
    this.ending = true;
    this.enter('wait');
  }

  private shoot(): void {
    const ball = this.spot.balls[this.ballIdx];
    const windowW = this.win.green * fireBoost(this.streak);
    const planned = this.auto?.shots[this.autoIdx];
    let grade: Grade, error: number, outcome: Outcome;
    if (planned) {
      grade = planned.grade; error = planned.error; outcome = planned.outcome;
      this.autoIdx++;
      this.clock = this.clock0 - planned.t;
    } else {
      ({ grade, error } = judge(this.holdT, this.target, windowW));
      this.lastRelease = { held: this.holdT, target: this.target, green: windowW, at: this.time, error, starry: ball.kind === 'starry' };
      outcome = resolveShot(grade);
    }
    // The rules decide the shot now; the score and the crowd wait until the ball gets there.
    const made = isMake(outcome);
    const perfect = made && grade === 'perfect';
    this.chain = perfect ? this.chain + 1 : 0;
    this.streak = made ? this.streak + 1 : 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const points = made ? shotPoints(this.opts.scoring ?? 'classic', ball, true, perfect, this.chain) : 0;
    if (made) this.makes++;
    this.shots++;
    this.fxRun = stepFx(this.fxRun, ball.kind, made, perfect);
    const fx = shotFx(this.fxRun, made, perfect, this.shots >= this.ballsTotal);

    // The ball leaves from the hands, wherever the jump put them. Early comes up short, late goes long.
    const hand = new THREE.Vector3();
    if (this.auto) hand.copy(this.ball.position);
    else this.heldBall.getWorldPosition(hand);
    const from: V3 = [hand.x, hand.z, hand.y];
    const side = outcome === 'airball' ? -1 : outcome === 'swish' ? 1 : error < 0 ? -1 : 1;
    const plan = this.takePlan(outcome, side, from);
    const mesh = this.ballPool.find(m => !m.visible) ?? this.ballPool[0];
    mesh.material = this.ballMats[ball.kind];
    mesh.visible = true; mesh.scale.setScalar(1);
    const start = plan.samples[0].p;
    this.live.push({
      mesh, plan, t: 0, pos: [...from], offset: [from[0] - start[0], from[1] - start[1], from[2] - start[2]],
      kind: ball.kind, outcome, points, perfect, chain: this.chain, streakAfter: this.streak, fx, nextEvent: 0, resolved: false,
    });
    if (this.live.length > this.ballPool.length) this.live.shift();
    this.replayBall = this.live[this.live.length - 1];
    this.cb.onEvent?.({ type: 'grade', grade, error, window: windowW });
    this.enter('flight'); this.flightT = 0;
    // That ball leaves the rack.
    const rb = this.rackBalls[this.spotIdx]?.[this.ballIdx];
    if (rb) rb.visible = false;
  }

  /** Where the ball will leave the hands at this spot, for planning ahead. */
  private releasePoint(): V3 {
    const [px, py] = spotPosition(this.spot);
    const d = Math.hypot(px, py) || 1, ux = px / d, uy = py / d;
    return this.auto ? [px - ux * 0.25, py - uy * 0.25, 2.95] : [px * 1.04 - ux * 0.6, py * 1.04 - uy * 0.6, 2.2];
  }

  /** A planned flight for this outcome: from the cache if one was made while aiming, else now. */
  private takePlan(outcome: Outcome, side: number, from: V3): ShotPlan {
    const key = `${outcome}:${side}`;
    const ready = this.plans.get(key);
    if (ready && Math.hypot(ready.from[0] - from[0], ready.from[1] - from[1], ready.from[2] - from[2]) < 0.6) {
      this.plans.delete(key); // plan a fresh one for next time, so no two shots look the same
      return ready.plan;
    }
    return planShot(from, outcome, side, seeded(this.seed + this.shotSeq++));
  }

  /**
   * Plan flights for this spot a little at a time (about 1.5ms a frame), so a
   * release never stalls. Never while you're holding: that's when a dropped
   * frame would hurt.
   */
  private pumpPlans(): void {
    if (this.touch || this.ending || this.phase === 'done' || this.phase === 'replay' || this.phase === 'hold' || !this.spot) return;
    if (this.planSpot !== this.spotIdx) { this.plans.clear(); this.planJob = null; this.planSpot = this.spotIdx; }
    const t0 = performance.now();
    while (performance.now() - t0 < 1.5) {
      if (!this.planJob) {
        const key = PLAN_KEYS.find(k => !this.plans.has(k));
        if (!key) return;
        const [o, sd] = key.split(':');
        const from = this.releasePoint();
        this.planJob = { key, from, gen: planShotSteps(from, o as Outcome, Number(sd), seeded(this.seed + this.shotSeq++)) };
      }
      const r = this.planJob.gen.next();
      if (r.done) { this.plans.set(this.planJob.key, { plan: r.value, from: this.planJob.from }); this.planJob = null; }
    }
  }

  /** Move every live ball along its flight: sounds on contact, the score when it drops. */
  private stepBalls(dt: number): void {
    for (let i = 0; i < this.live.length; i++) {
      const b = this.live[i];
      b.t += dt;
      const smp = sampleAt(b.plan.samples, b.t);
      const f = Math.max(0, 1 - b.t / 0.15);
      b.pos = [smp.p[0] + b.offset[0] * f, smp.p[1] + b.offset[1] * f, smp.p[2] + b.offset[2] * f];
      b.mesh.position.copy(toThree(b.pos));
      spin(b.mesh, smp.w, dt);
      // Fade the ball out at the very end of its recorded flight (it's rolled away by then).
      b.mesh.scale.setScalar(Math.max(0.001, Math.min(1, (b.plan.duration - b.t) / 0.3)));
      while (b.nextEvent < b.plan.events.length && b.plan.events[b.nextEvent].t <= b.t) {
        const e = b.plan.events[b.nextEvent++];
        if (e.kind === 'rim') sfx.playRim(Math.min(1, 0.35 + e.speed / 5));
        else if (e.kind === 'board' || e.kind === 'stanchion') sfx.playBoard();
        else if (e.kind === 'floor' && e.speed > 0.8) sfx.playBounce();
        else if (e.kind === 'through') sfx.playSwish(b.points > 0 ? Math.max(1, Math.round(b.points / (this.opts.scoring === 'attack' ? 100 : 1))) : 1);
      }
      // Shots are announced in the order they were taken.
      if (!b.resolved && b.t >= b.plan.resolvedAt && this.live.slice(0, i).every(p => p.resolved)) this.resolve(b);
    }
    // Retire balls that have finished their flight.
    this.live = this.live.filter(b => {
      if (b.t < b.plan.duration || !b.resolved) return true;
      b.mesh.visible = false;
      return false;
    });
  }

  /** A ball's result reaches the crowd: points, streak, callouts. */
  private resolve(b: LiveBall): void {
    b.resolved = true;
    this.shownStreak = b.streakAfter;
    this.rimOnFire = b.fx.rimFire;
    this.fx.setRimFire(b.fx.rimFire);
    if (!isMake(b.outcome)) {
      this.cb.onEvent?.({ type: 'miss', outcome: b.outcome });
      return;
    }
    this.score += b.points;
    if (this.clock <= 0 && !this.auto) this.cb.onEvent?.({ type: 'buzzer' });
    if (b.streakAfter === 3) this.cb.onEvent?.({ type: 'fire' });
    this.cb.onEvent?.({ type: 'make', points: b.points, outcome: b.outcome, streak: b.streakAfter, perfect: b.perfect, chain: b.chain, mult: b.perfect ? perfectMultiplier(b.chain) : 1, kind: b.kind, bank: b.bank });
    const value = b.kind === 'starry' ? 3 : b.kind === 'money' ? 2 : 1;
    // Only a perfect release gets effects, and they grow with the chain. Any
    // other make just gets the crowd.
    const f = b.fx;
    if (b.perfect) {
      this.crowd.cheer(value + 1 + f.level * 3);
      this.punch = 0.6 + f.level * 0.6;
      if (!this.reduced) this.shake = 0.25 + f.level * 0.5;
      this.fx.fireworks(f.level);
    } else this.crowd.cheer(value * 0.5);
    try { navigator.vibrate?.(b.perfect ? [20, 40, 30] : 18); } catch { /* not supported */ }
    if (f.finale !== 'none') this.finale(f.finale);
  }

  /** The last ball of a perfect run blows up the burning rim; every ball made gets a gold burst. */
  private finale(kind: 'perfect' | 'made'): void {
    this.fx.explode(kind);
    if (this.phase !== 'replay') this.finaleAt = this.time;
    this.rimOnFire = false;
    this.rimHeat = kind === 'perfect' ? 3 : 1.5;
    this.crowd.cheer(4);
    this.punch = 1.4;
    if (!this.reduced) this.shake = 1.2;
    try { navigator.vibrate?.([40, 30, 60, 30, 90]); } catch { /* not supported */ }
  }

  /** Everything has landed: show the last make again in slow motion, then the horn. */
  private wrapUp(): void {
    const last = this.replayBall;
    if (last && isMake(last.outcome) && !this.reduced && !this.auto) {
      this.enter('replay'); this.replayT = Math.max(0, last.plan.resolvedAt - 1.1); this.fade = 1;
      this.cb.onEvent?.({ type: 'replay', on: true });
      return;
    }
    this.finish();
  }

  private stepReplay(dt: number): void {
    const b = this.replayBall;
    if (!b) { this.finish(); return; }
    const before = this.replayT;
    this.replayT += dt;
    const through = b.plan.events.find(e => e.kind === 'through');
    if (through && before < through.t && this.replayT >= through.t) {
      sfx.playSwish();
      if (b.perfect) this.fx.fireworks(b.fx.level);
      if (b.fx.finale !== 'none') this.finale(b.fx.finale);
    }
    if (this.replayT > b.plan.resolvedAt + 0.7) this.endReplay();
  }

  private endReplay(): void {
    this.cb.onEvent?.({ type: 'replay', on: false });
    this.fade = 1;
    this.finish();
  }

  private nextBall(): void {
    if (this.touch) { this.nextTouchSpot(); return; }
    this.ballIdx++;
    if (this.ballIdx >= this.spot.balls.length) {
      this.walkFrom = spotPosition(this.spot);
      this.spotIdx++; this.ballIdx = 0;
      if (this.spotIdx >= this.course.length) { this.ending = true; this.enter('wait'); return; }
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
    this.target = this.win.rise * (1 + this.shift);
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
    this.arena.update(t, real);
    this.ribbons.forEach((tex, i) => { tex.offset.x = (tex.offset.x + real * (0.05 + i * 0.01)) % 1; });
    if (Math.floor(t * 10) !== Math.floor((t - real) * 10)) this.scoreboards.draw(this.score, Math.max(0, this.clock), this.spot?.label ?? 'Final');

    // The replay ball (slow motion), the live balls, and the net reacting to whichever is at the rim.
    let bp: V3 | null = null;
    if (this.phase === 'replay' && this.replayBall) {
      const smp = sampleAt(this.replayBall.plan.samples, this.replayT);
      bp = smp.p;
      this.ball.material = this.ballMats[this.replayBall.kind];
      this.ball.position.copy(toThree(bp));
      spin(this.ball, smp.w, real * 0.32);
      this.live.forEach(b => { b.mesh.visible = false; });
    }
    this.ball.visible = !!bp;
    let atRim = bp, best = 1.2;
    for (const b of this.live) {
      const d = Math.hypot(b.pos[0], b.pos[1], b.pos[2] - RIM_HEIGHT);
      if (d < best) { best = d; atRim = b.pos; }
    }
    this.net.step(real * (this.phase === 'replay' ? 0.32 : 1), atRim, BALL_R, 0);
    // A ball on fire burns all the way to the rim (and again in the replay).
    const fdt = real * (this.phase === 'replay' ? 0.32 : 1);
    if (bp && this.replayBall?.fx.fireball) this.fx.burn(toThree(bp), fdt);
    for (const b of this.live) if (b.fx.fireball && !b.resolved && b.mesh.visible) this.fx.burn(toThree(b.pos), fdt);
    this.fx.update(fdt, this.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)));
    // The rim glows while it burns and flashes white-hot when it explodes.
    this.rimHeat += ((this.rimOnFire ? 0.55 : 0) - this.rimHeat) * Math.min(1, real * (this.rimHeat > 0.6 ? 1.5 : 4));
    this.rimMat.emissive.setRGB(1, 0.38, 0.08).multiplyScalar(this.rimHeat);

    // Arms and held ball: first person only.
    const fp = !this.auto && !this.touch && (this.phase === 'aim' || this.phase === 'hold');
    const reloading = !this.auto && !this.touch && this.phase === 'flight';
    // Last ball at this rack: no next ball to grab here (you jog to the next one).
    const lastHere = !this.spot || this.ballIdx >= this.spot.balls.length - 1;
    const r = Math.min(1, this.phaseT / RELOAD);
    this.arms.visible = fp || reloading;
    this.heldBall.visible = fp || (reloading && !lastHere && r > 0.6);
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
    } else if (reloading) {
      // Follow-through: hands snap up and out as the ball leaves...
      const k = Math.min(1, this.phaseT / 0.12);
      const ftY = -0.09 + k * 0.12, ftRot = 0.25 + k * 0.5;
      if (r < 0.35) {
        this.arms.position.set(0.05, ftY, -0.68);
        this.arms.rotation.set(ftRot, 0, 0);
      } else {
        // ...then drop to the rack and come back up with the next ball, in one smooth move.
        const u = ease((r - 0.35) / 0.65);
        const dip = Math.sin(u * Math.PI) * (lastHere ? 0.9 : 0.34);
        const toY = lastHere ? -0.9 : -0.26;
        this.arms.position.set(lerp(0.05, 0, u) + dip * 0.35, lerp(ftY, toY, u) - dip, lerp(-0.68, -0.6, u));
        this.arms.rotation.set(lerp(ftRot, -0.1, u), 0, 0);
        if (!lastHere) this.heldBall.material = this.ballMats[this.spot.balls[this.ballIdx + 1].kind];
      }
    }

    this.updatePlayer(t);
    // The ball in the shooter's hands (rivals and Street), between the athlete's palms.
    const touchHolding = this.touch && (this.phase === 'aim' || this.phase === 'walk');
    if (!bp && ((this.auto && (this.phase === 'aim' || this.phase === 'hold')) || touchHolding)) {
      this.ball.visible = true;
      this.ball.material = this.ballMats[this.spot.balls[this.ballIdx]?.kind ?? 'regular'];
      this.athlete.ballCenter(this.ball.position);
    }
    this.updateCamera(real);
    if (!this.renderer.shadowMap.autoUpdate && this.perf.frame % 3 === 0) this.renderer.shadowMap.needsUpdate = true;
    if (!this.noDraw) this.composer.render();
  }

  /** The shooter, seen from the broadcast camera: jogs to the next rack, then turns to the hoop. */
  private updatePlayer(t: number): void {
    const show = this.phase === 'walk' || this.phase === 'done' || ((!!this.auto || this.touch) && this.phase !== 'replay');
    this.player.visible = show;
    if (!show) return;
    const to = spotPosition(this.spot ?? this.course[this.course.length - 1]);
    const u = this.phase === 'walk' ? ease(Math.min(1, this.phaseT / (this.touch ? this.walkTime * 0.85 : 1.3))) : 1;
    const x = lerp(this.walkFrom[0], to[0], u), y = lerp(this.walkFrom[1], to[1], u);
    this.player.position.copy(toThree([x, y, 0]));
    const moving = this.phase === 'walk' && u < 1;
    const dir = moving ? Math.atan2(to[0] - this.walkFrom[0], to[1] - this.walkFrom[1]) : Math.atan2(-x, -y);
    this.player.rotation.y = dir;
    this.player.position.y = 0;
    const pose = { run: moving ? 1 : 0, stride: t * 11, crouch: 0, set: 0, release: 0, carry: this.touch ? 1 : 0, celebrate: this.phase === 'done' ? 1 : 0, t };
    if (moving) this.player.position.y = Math.abs(Math.sin(t * 11)) * 0.04;
    if (this.touch && !moving && this.phase !== 'done') {
      // Street: ball up at the set point while aiming; a hop and follow-through on the throw.
      const ft = this.phase === 'flight' ? Math.min(1, this.flightT / 0.12) : 0;
      this.player.position.y = this.phase === 'flight' ? Math.sin(Math.min(1, this.flightT / 0.4) * Math.PI) * 0.22 : 0;
      pose.set = 1; pose.release = this.phase === 'flight' ? ft * Math.max(0, 1 - (this.flightT - 0.3) / 0.2) : 0;
      if (this.aiming) pose.crouch = 0.15;
    }
    if (this.auto && !moving && this.phase !== 'done') {
      // A rival's jumper: dip and gather at the chest, rise to the set point, release and flick, land.
      const rise = this.win.rise;
      const gather = this.phase === 'aim' ? Math.min(1, this.phaseT / Math.max(0.1, this.auto.rival.gather)) : 1;
      const j = this.phase === 'hold' ? Math.sin(Math.min(1, this.holdT / rise) * Math.PI * 0.5)
        : this.phase === 'flight' ? Math.max(0, Math.cos(Math.min(1, this.flightT / 0.45) * Math.PI * 0.5)) : 0;
      this.player.position.y = j * 0.5;
      pose.carry = 1;
      pose.crouch = this.phase === 'aim' ? Math.sin(gather * Math.PI) * 0.45 : this.phase === 'flight' ? Math.max(0, 1 - this.flightT / 0.5) * (this.flightT > 0.35 ? 0.3 : 0) : 0;
      pose.set = this.phase === 'hold' ? Math.min(1, this.holdT / (rise * 0.7)) : this.phase === 'flight' ? 1 : 0;
      pose.release = this.phase === 'flight' ? Math.min(1, this.flightT / 0.12) * Math.max(0, 1 - Math.max(0, this.flightT - 0.4) / 0.25) : 0;
      if (this.phase === 'flight' && this.flightT > 0.4) { pose.set = Math.max(0, 1 - (this.flightT - 0.4) / 0.25); pose.carry = pose.set; }
    }
    this.athlete.pose(pose);
  }

  private updateCamera(real: number): void {
    let pos: THREE.Vector3, look: THREE.Vector3, fov: number;
    const k = 1 - Math.pow(0.0015, real); // smooth follow
    if (this.touch && this.phase !== 'replay') {
      // Side-on to the shot: shooter on one side of the frame, hoop on the other, so you can read the whole arc.
      const pp = this.player.position;
      const bx = pp.x, by = pp.z, d = Math.hypot(bx, by) || 1;
      let nx = -by / d, ny = bx / d;
      if (ny < 0 || (Math.abs(ny) < 0.3 && nx > 0)) { nx = -nx; ny = -ny; }
      if (this.camera.aspect < 1) {
        // Tall screens: three-quarters from behind the shooter, so the arc rises up the screen.
        const ux = -bx / d, uy = -by / d; // shooter → rim
        pos = toThree([bx - ux * 6.2 + nx * 2.2, by - uy * 6.2 + ny * 2.2, 3.9]);
        look = toThree([bx + ux * d * 0.5, by + uy * d * 0.5, 2.5]);
        fov = 40;
      } else {
        const back = d * 0.62 + 4.2;
        const mid: V3 = [bx * 0.5, by * 0.5, 2.3];
        pos = toThree([mid[0] + nx * back, mid[1] + ny * back, 2.6]);
        look = toThree(mid);
        fov = 42;
      }
      this.camPos.lerp(pos, k * 0.6);
      this.camLook.lerp(look, k * 0.6);
    } else if (this.phase === 'walk' || this.phase === 'done' || (this.auto && this.phase !== 'replay')) {
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
      const [px, py] = spotPosition(this.spot ?? this.course[this.course.length - 1]);
      const j = this.phase === 'hold' ? Math.sin(Math.min(1, this.holdT / this.win.rise) * Math.PI * 0.5) : this.phase === 'flight' ? Math.max(0, 1 - this.flightT * 1.3) : 0;
      const sway = this.phase === 'aim' && !this.reduced ? Math.sin(this.phaseT * 1.6) * 0.01 : 0;
      pos = toThree([px * 1.04 + sway, py * 1.04, 1.78 + j * 0.5]);
      let lk: V3 = [0, 0, RIM_HEIGHT - 0.55];
      const nb = this.live[this.live.length - 1];
      if ((this.phase === 'flight' || this.phase === 'wait') && nb && nb.t < 1.6) { const b = nb.pos; lk = [lerp(0, b[0], 0.2), lerp(0, b[1], 0.2), Math.max(lk[2], lerp(lk[2], b[2], 0.35))]; }
      look = toThree(lk);
      fov = 52;
      this.camPos.copy(pos);
      this.camLook.lerp(look, this.fade > 0.5 ? 1 : k);
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

import * as THREE from 'three';

// Make effects, arena pyro style: a spark fountain under the rim, rockets that
// launch from behind the baseline and break into real firework shells (peony,
// chrysanthemum, ring, willow, crossette), flame cannons, a ball and a rim on
// fire, and the finale explosion. Each perfect in a row steps the show up a
// tier (see fx.ts).
//
// Every particle is one instance of a quad in a single draw call: sparks are
// stretched along their motion into trails and cool from white-hot through
// their colour to embers; glitter twinkles; flames are soft textured puffs that
// cool from yellow to red; flashes are brief glows. Game coords (x across, y
// out, z up) via `toThree`.

type V = [number, number, number];

// Particle kinds (the shader and the update read these).
const SPARK = 0, GLITTER = 1, FLAME = 2, FLASH = 3, CROSSETTE = 5, WILLOW = 6;

const GOLD = 0xffc864, WHITE = 0xfff4e6;
/** Shell colours, unlocked tier by tier: gold and white, then wine and rose, then mint and violet, then sky and orange. */
const PALETTE = [GOLD, WHITE, 0xff2d6f, 0xff7ab6, 0x5cffc8, 0xb38cff, 0x5cb8ff, 0xff8a2a];
const colorsFor = (tier: number) => PALETTE.slice(0, Math.min(PALETTE.length, 2 + Math.floor(tier / 2) * 2));

type Burst = 'peony' | 'chrysanthemum' | 'ring' | 'willow' | 'crossette';

interface Rocket { p: THREE.Vector3; v: THREE.Vector3; fuse: number; burst: Burst; colors: number[]; size: number }
interface Emitter { until: number; rate: number; acc: number; spawn: () => void }

/** A soft, slightly ragged puff for flames and flashes. */
function puffTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  // Ragged edges: a few soft lobes.
  let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 7; k++) {
    const a = r() * Math.PI * 2, d = 8 + r() * 10, x = 32 + Math.cos(a) * d, y = 32 + Math.sin(a) * d;
    const lg = g.createRadialGradient(x, y, 0, x, y, 9 + r() * 7);
    lg.addColorStop(0, 'rgba(255,255,255,.45)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(cv);
}

export class Effects {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private iPos: Float32Array;
  private iVel: Float32Array;
  private iCol: Float32Array;
  /** age, span, size, kind */
  private iLife: Float32Array;
  private iSeed: Float32Array;
  private next = 0;
  /** Particles in the pool: fewer on phones (their buffers upload every frame they're active). */
  private pool: number;
  private uniforms = { uPx: { value: 400 }, uTime: { value: 0 }, uView: { value: new THREE.Vector2(1, 1) }, uPuff: { value: null as THREE.Texture | null } };
  private time = 0;
  private queue: Array<{ at: number; run: () => void }> = [];
  private rockets: Rocket[] = [];
  private emitters: Emitter[] = [];
  private ring: THREE.Mesh;
  private ringT = 99;
  private ringScale = 1;
  private rimFire = false;
  private rim: THREE.Vector3;
  private up = new THREE.Vector3(0, 1, 0);
  private c = new THREE.Color();
  private v = new THREE.Vector3();

  constructor(private toThree: (v: V) => THREE.Vector3, rimAt: V, private rimRadius: number, hi: boolean, private onBoom?: (size: number) => void) {
    this.rim = toThree(rimAt);
    const POOL = (this.pool = hi ? 3200 : 2200);
    this.iPos = new Float32Array(POOL * 3);
    this.iVel = new Float32Array(POOL * 3);
    this.iCol = new Float32Array(POOL * 3);
    this.iLife = new Float32Array(POOL * 4);
    this.iSeed = new Float32Array(POOL);
    for (let i = 0; i < POOL; i++) this.iSeed[i] = Math.random();
    const g = new THREE.InstancedBufferGeometry();
    // corner.x across the trail (-1..1), corner.y along it (0 = tail, 1 = head).
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    g.setAttribute('corner', new THREE.Float32BufferAttribute([-1, 0, 1, 0, 1, 1, -1, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const dyn = (a: Float32Array, n: number) => new THREE.InstancedBufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', dyn(this.iPos, 3));
    g.setAttribute('iVel', dyn(this.iVel, 3));
    g.setAttribute('iCol', dyn(this.iCol, 3));
    g.setAttribute('iLife', dyn(this.iLife, 4));
    g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(this.iSeed, 1));
    g.instanceCount = POOL;
    this.uniforms.uPuff.value = puffTexture();
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      // Double-sided: the quads are built in screen space and wind either way.
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: this.uniforms,
      vertexShader: `
        attribute vec2 corner; attribute vec3 iPos; attribute vec3 iVel; attribute vec3 iCol; attribute vec4 iLife; attribute float iSeed;
        uniform float uPx; uniform vec2 uView;
        varying vec2 vUv; varying vec3 vCol; varying float vT; varying float vKind; varying float vSeed; varying float vDot;
        void main() {
          float age = iLife.x, span = iLife.y, size = iLife.z, kind = iLife.w;
          vUv = corner; vCol = iCol; vKind = kind; vSeed = iSeed; vT = span > 0.0 ? age / span : 1.0;
          if (span <= 0.0 || age >= span) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          // Trail length in seconds of travel: sparks streak, willows streak long, flames and flashes are round.
          float trail = kind < 0.5 ? 0.075 : kind < 1.5 ? 0.05 : kind > 5.5 ? 0.2 : kind > 4.5 ? 0.06 : 0.0;
          vDot = trail > 0.0 ? 0.0 : 1.0;
          float grow = kind > 1.5 && kind < 2.5 ? 0.55 + 0.9 * vT : kind > 2.5 && kind < 3.5 ? 0.6 + 0.6 * vT : 1.0;
          vec4 h = projectionMatrix * viewMatrix * vec4(iPos, 1.0);
          vec4 t = projectionMatrix * viewMatrix * vec4(iPos - iVel * trail, 1.0);
          float w = clamp(size * grow * uPx / max(0.1, h.w), 1.2, kind > 1.5 ? 220.0 : 26.0);
          vec2 d = (h.xy / h.w - t.xy / t.w) * uView * 0.5;
          float len = length(d);
          // A spark flying past the camera would streak across the screen: cap the trail.
          float cap = min(1.0, 70.0 / max(len, 1.0));
          t = mix(h, t, cap); d *= cap; len *= cap;
          vec2 dir = len > 0.01 ? d / len : vec2(0.0, 1.0);
          vec2 nrm = vec2(-dir.y, dir.x);
          vec4 p = mix(t, h, corner.y);
          // Round the ends (half a width past the tail and the head); dots are just a square.
          vec2 off = nrm * corner.x * w * 0.5 + dir * (corner.y * 2.0 - 1.0) * w * 0.5;
          p.xy += off / (uView * 0.5) * p.w;
          gl_Position = p;
        }`,
      fragmentShader: `
        uniform float uTime; uniform sampler2D uPuff;
        varying vec2 vUv; varying vec3 vCol; varying float vT; varying float vKind; varying float vSeed; varying float vDot;
        void main() {
          if (vT >= 1.0) discard;
          vec3 col; float a;
          if (vKind > 1.5 && vKind < 2.5) {
            // Flame: a turning puff, cooling white-yellow -> orange -> deep red, then gone.
            float ang = vSeed * 6.283 + vT * 2.0;
            vec2 q = vec2(vUv.x, vUv.y * 2.0 - 1.0) * 0.5;
            q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q + 0.5;
            float m = texture2D(uPuff, q).a;
            col = mix(vec3(1.0, 0.92, 0.6), vec3(1.0, 0.45, 0.08), smoothstep(0.05, 0.4, vT));
            col = mix(col, vec3(0.55, 0.06, 0.02), smoothstep(0.45, 0.95, vT)) * vCol;
            a = m * (1.0 - smoothstep(0.55, 1.0, vT)) * 0.85;
          } else if (vKind > 2.5 && vKind < 3.5) {
            // Flash: a big soft glow, gone in a blink.
            float r = length(vec2(vUv.x, vUv.y * 2.0 - 1.0));
            col = vCol; a = pow(max(0.0, 1.0 - r), 2.2) * pow(1.0 - vT, 2.0) * 1.6;
          } else {
            // Sparks, glitter, willow, crossette: bright head, fading trail, soft edges.
            float across = 1.0 - abs(vUv.x);
            float shape = vDot > 0.5 ? max(0.0, 1.0 - length(vec2(vUv.x, vUv.y * 2.0 - 1.0))) : pow(across, 1.4) * mix(0.08, 1.0, pow(vUv.y, 1.6));
            // White-hot at birth, then the star's colour, then a dim ember.
            col = mix(vec3(1.0, 0.98, 0.94), vCol, smoothstep(0.02, 0.22, vT));
            col = mix(col, vec3(1.0, 0.42, 0.08) * 0.55, smoothstep(0.62, 1.0, vT));
            a = shape * (1.0 - smoothstep(0.55, 1.0, vT));
            // Glitter (and willow tips) twinkle late in life.
            if ((vKind > 0.5 && vKind < 1.5) || vKind > 5.5) {
              float tw = fract(sin(vSeed * 91.7 + floor(uTime * 22.0) * 13.31) * 43758.55);
              a *= vT > 0.35 ? (tw > 0.55 ? 1.8 : 0.15) : 1.0;
            }
          }
          gl_FragColor = vec4(col * a, 1.0);
        }`,
    }));
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
    // The shockwave: a flat ring round the rim, expanding and fading.
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ring.position.copy(this.rim);
    this.group.add(this.ring);
  }

  // ---- Spawning --------------------------------------------------------------

  private spawn(p: THREE.Vector3, v: THREE.Vector3, color: number, size: number, span: number, kind: number): void {
    const i = this.next; this.next = (this.next + 1) % this.pool;
    this.iPos[i * 3] = p.x; this.iPos[i * 3 + 1] = p.y; this.iPos[i * 3 + 2] = p.z;
    this.iVel[i * 3] = v.x; this.iVel[i * 3 + 1] = v.y; this.iVel[i * 3 + 2] = v.z;
    this.c.setHex(color); this.iCol[i * 3] = this.c.r; this.iCol[i * 3 + 1] = this.c.g; this.iCol[i * 3 + 2] = this.c.b;
    this.iLife[i * 4] = 0; this.iLife[i * 4 + 1] = span; this.iLife[i * 4 + 2] = size; this.iLife[i * 4 + 3] = kind;
  }

  private flash(at: THREE.Vector3, color: number, size: number, span = 0.16): void {
    this.spawn(at, this.v.set(0, 0, 0), color, size, span, FLASH);
  }

  /** A firework shell breaking at `at`. */
  private shell(at: THREE.Vector3, burst: Burst, colors: number[], size: number): void {
    const v = new THREE.Vector3();
    const n = Math.round((burst === 'willow' ? 110 : burst === 'ring' ? 70 : burst === 'crossette' ? 26 : 120) * size);
    const speed = (burst === 'willow' ? 6 : burst === 'crossette' ? 9 : 11) * Math.sqrt(size);
    const main = colors[Math.floor(Math.random() * colors.length)], second = colors[Math.floor(Math.random() * colors.length)];
    // A ring lies in a random plane facing roughly up and toward the court.
    const axis = new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize();
    const e1 = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(1, 0, 0)).normalize(), e2 = new THREE.Vector3().crossVectors(axis, e1);
    for (let k = 0; k < n; k++) {
      if (burst === 'ring') { const a = (k / n) * Math.PI * 2; v.copy(e1).multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a)).multiplyScalar(speed); }
      else v.randomDirection().multiplyScalar(speed * (burst === 'peony' ? 0.92 + Math.random() * 0.08 : 0.6 + Math.random() * 0.4));
      const col = burst === 'willow' ? GOLD : k % 3 === 0 ? second : main;
      const kind = burst === 'willow' ? WILLOW : burst === 'crossette' ? CROSSETTE : burst === 'chrysanthemum' && k % 2 ? GLITTER : SPARK;
      const span = burst === 'willow' ? 2.4 + Math.random() * 0.6 : 1.1 + Math.random() * 0.5;
      this.spawn(at, v, col, burst === 'willow' ? 0.07 : 0.09, span, kind);
    }
    this.flash(at, main, 3.2 * size, 0.18);
    this.onBoom?.(size);
  }

  private launch(from: V, burst: Burst, colors: number[], size: number, height: number): void {
    const p = this.toThree(from);
    const top = this.toThree([from[0] + (Math.random() - 0.5) * 2, from[1] - 1 - Math.random() * 2, height]);
    const fuse = 0.55 + Math.random() * 0.25;
    // Launch speed that reaches `top` as the fuse burns down (a little lift, so it slows near the top).
    const v = top.clone().sub(p).divideScalar(fuse); v.y += 2.4 * fuse;
    this.rockets.push({ p, v, fuse, burst, colors, size });
  }

  private emit(duration: number, rate: number, spawn: () => void): void {
    this.emitters.push({ until: this.time + duration, rate, acc: 0, spawn });
  }

  /** A gold spark fountain pouring out of the net. */
  private fountain(n: number, dur: number): void {
    const v = new THREE.Vector3(), p = new THREE.Vector3();
    this.emit(dur, n / dur, () => {
      const a = Math.random() * Math.PI * 2, r = this.rimRadius * (0.6 + Math.random() * 0.4);
      p.copy(this.rim).add(v.set(Math.cos(a) * r, -0.15 - Math.random() * 0.25, Math.sin(a) * r));
      this.spawn(p, v.set(Math.cos(a) * (0.6 + Math.random()), -0.5 - Math.random() * 1.5, Math.sin(a) * (0.6 + Math.random())), Math.random() < 0.7 ? GOLD : WHITE, 0.035, 0.6 + Math.random() * 0.5, SPARK);
    });
  }

  /** Flame cannons on both sides of the baseline. */
  private cannons(dur: number, power: number): void {
    const v = new THREE.Vector3();
    [-4.2, 4.2].forEach(x => {
      const base = this.toThree([x, -6.4, 0.3]);
      this.flash(base.clone().add(v.set(0, 0.4, 0)), 0xffa040, 2.5, 0.25);
      this.emit(dur, 70, () => {
        this.spawn(base, v.set((Math.random() - 0.5) * 0.9, (6 + Math.random() * 3) * power, (Math.random() - 0.5) * 0.9), 0xffffff, 0.5 + Math.random() * 0.4, 0.55 + Math.random() * 0.3, FLAME);
      });
    });
  }

  // ---- Shows -----------------------------------------------------------------

  /**
   * The show for a perfect make. Every tier adds to the last: 1 a spark fountain
   * through the net; 2+ rockets breaking over the basket (one more per tier,
   * richer shells and colours as it climbs); 5+ flame cannons; 8+ glitter and
   * willows; 10+ the full barrage.
   */
  perfect(tier: number): void {
    if (tier <= 0) return;
    const colors = colorsFor(tier);
    this.flash(this.rim, 0xfff0c8, 1.2 + tier * 0.08, 0.2);
    this.fountain(40 + tier * 14, 0.45 + tier * 0.03);
    const rockets = tier < 2 ? 0 : Math.min(8, tier - 1);
    const kinds: Burst[] = tier < 4 ? ['peony'] : tier < 6 ? ['peony', 'chrysanthemum', 'ring'] : tier < 8 ? ['peony', 'chrysanthemum', 'ring', 'crossette'] : ['chrysanthemum', 'ring', 'crossette', 'willow', 'peony'];
    for (let k = 0; k < rockets; k++) {
      const x = (k - (rockets - 1) / 2) * (rockets > 1 ? 13 / (rockets - 1) : 0) + (Math.random() - 0.5);
      const burst = kinds[k % kinds.length];
      this.later(0.05 + k * 0.12 + Math.random() * 0.06, () => this.launch([x, -6.3, 0.4], burst, colors, 0.8 + tier * 0.035, 8 + Math.random() * 3));
    }
    if (tier >= 5) this.cannons(0.35 + (tier >= 10 ? 0.25 : 0), tier >= 10 ? 1.2 : 1);
    if (tier >= 10) this.later(0.8, () => this.launch([0, -6.3, 0.4], 'willow', colors, 1.3, 11));
  }

  /** Flames and sparks off a ball on fire: call every frame while it flies. */
  burn(at: THREE.Vector3, dt: number): void {
    const v = this.v, n = Math.min(5, Math.ceil(dt * 150));
    for (let k = 0; k < n; k++) {
      const p = at.clone().add(v.randomDirection().multiplyScalar(0.08));
      this.spawn(p, v.set((Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3), 0xffffff, 0.2 + Math.random() * 0.1, 0.3 + Math.random() * 0.15, FLAME);
    }
    if (Math.random() < dt * 30) this.spawn(at, v.randomDirection().multiplyScalar(1.2).add(this.up), GOLD, 0.03, 0.4, SPARK);
  }

  /** The rim on fire (a perfect run's last rack), until switched off. */
  setRimFire(on: boolean): void { this.rimFire = on; }

  /** The finale: 'perfect' blows the burning rim apart; 'made' is a gold barrage without fire. */
  explode(kind: 'perfect' | 'made'): void {
    this.rimFire = false;
    const v = new THREE.Vector3();
    this.flash(this.rim, kind === 'perfect' ? 0xffb060 : 0xffe2a0, 6, 0.35);
    if (kind === 'perfect') {
      this.shell(this.rim, 'peony', [WHITE, GOLD, 0xff8a2a], 0.9);
      for (let k = 0; k < 90; k++) this.spawn(this.rim, v.randomDirection().multiplyScalar(2.2).add(this.up.clone().multiplyScalar(1.5 + Math.random() * 2)), 0xffffff, 0.45 + Math.random() * 0.3, 0.7 + Math.random() * 0.5, FLAME);
      this.cannons(1.2, 1.3);
      for (let k = 0; k < 10; k++) {
        const x = -7 + (14 * k) / 9;
        this.later(0.15 + k * 0.14, () => this.launch([x, -6.3, 0.4], (['peony', 'chrysanthemum', 'ring', 'crossette', 'willow'] as Burst[])[k % 5], PALETTE, 1.2, 9 + Math.random() * 3));
      }
      this.later(1.7, () => this.launch([0, -6.3, 0.4], 'willow', [GOLD], 1.6, 12));
    } else {
      this.shell(this.rim, 'peony', [GOLD, WHITE], 0.7);
      for (let k = 0; k < 6; k++) this.later(0.15 + k * 0.18, () => this.launch([-6 + k * 2.4, -6.3, 0.4], k % 2 ? 'willow' : 'chrysanthemum', [GOLD, WHITE], 1.1, 9 + Math.random() * 2));
    }
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(kind === 'perfect' ? 0xff9a3c : 0xf5c451);
    this.ringT = 0; this.ringScale = kind === 'perfect' ? 4.5 : 3.5;
  }

  private later(delay: number, run: () => void): void { this.queue.push({ at: this.time + delay, run }); }

  // ---- Simulation ------------------------------------------------------------

  /**
   * `pxScale`: screen pixels per world unit at distance 1 (sizes in perspective);
   * `w`, `h`: the drawing buffer in pixels.
   */
  update(dt: number, pxScale: number, w: number, h: number): void {
    this.time += dt;
    this.uniforms.uPx.value = pxScale;
    this.uniforms.uTime.value = this.time;
    this.uniforms.uView.value.set(w, h);
    if (this.queue.length) {
      const due = this.queue.filter(q => q.at <= this.time);
      this.queue = this.queue.filter(q => q.at > this.time);
      due.forEach(q => q.run());
    }
    // Rockets climb on a sparkling trail, then break.
    const v = this.v;
    this.rockets = this.rockets.filter(r => {
      r.fuse -= dt;
      r.v.y -= 2.4 * dt * 2; r.p.addScaledVector(r.v, dt);
      for (let k = 0; k < 2; k++) this.spawn(r.p, v.set((Math.random() - 0.5) * 0.4, -0.8 - Math.random(), (Math.random() - 0.5) * 0.4), GOLD, 0.03, 0.35 + Math.random() * 0.2, GLITTER);
      if (r.fuse > 0) return true;
      this.shell(r.p, r.burst, r.colors, r.size);
      return false;
    });
    this.emitters = this.emitters.filter(e => {
      e.acc += e.rate * dt;
      while (e.acc >= 1) { e.acc -= 1; e.spawn(); }
      return this.time < e.until;
    });
    if (this.rimFire) {
      const n = Math.min(6, Math.ceil(dt * 200));
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const p = this.rim.clone().add(v.set(Math.cos(a) * this.rimRadius, 0.02, Math.sin(a) * this.rimRadius));
        this.spawn(p, v.set((Math.random() - 0.5) * 0.2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.2), 0xffffff, 0.16 + Math.random() * 0.08, 0.35 + Math.random() * 0.2, FLAME);
      }
    }
    let any = false;
    const L = this.iLife, P = this.iPos, Vv = this.iVel;
    for (let i = 0; i < this.pool; i++) {
      const span = L[i * 4 + 1];
      if (span <= 0 || L[i * 4] >= span) continue;
      any = true;
      const age = (L[i * 4] += dt), kind = L[i * 4 + 3];
      // Stars slow hard in the air and then fall; willows droop; flames rise.
      const drag = kind === FLAME ? 2.2 : kind === WILLOW ? 1.5 : kind === FLASH ? 0 : 2.6;
      const grav = kind === FLAME ? -1.6 : kind === WILLOW ? 2.2 : kind === FLASH ? 0 : 4.2;
      const k = Math.exp(-drag * dt);
      Vv[i * 3] *= k; Vv[i * 3 + 2] *= k; Vv[i * 3 + 1] = Vv[i * 3 + 1] * k - grav * dt;
      P[i * 3] += Vv[i * 3] * dt; P[i * 3 + 1] += Vv[i * 3 + 1] * dt; P[i * 3 + 2] += Vv[i * 3 + 2] * dt;
      // A crossette star splits in four halfway through.
      if (kind === CROSSETTE && age > span * 0.45) {
        L[i * 4 + 3] = SPARK;
        const at = new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
        const col = this.c.setRGB(this.iCol[i * 3], this.iCol[i * 3 + 1], this.iCol[i * 3 + 2]).getHex();
        for (let q = 0; q < 4; q++) this.spawn(at, new THREE.Vector3().randomDirection().multiplyScalar(4), col, 0.07, 0.6, SPARK);
        L[i * 4 + 1] = age + 0.05;
      }
    }
    if (any) {
      const g = this.mesh.geometry;
      ['iPos', 'iVel', 'iCol', 'iLife'].forEach(n => { (g.getAttribute(n) as THREE.InstancedBufferAttribute).needsUpdate = true; });
    }
    if (this.ringT < 0.9) {
      this.ringT += dt;
      const r = this.ringT / 0.9;
      this.ring.scale.setScalar(0.3 + r * this.ringScale);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - r);
    } else (this.ring.material as THREE.MeshBasicMaterial).opacity = 0;
  }
}

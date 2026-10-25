import * as THREE from 'three';

// Make effects: fireworks at the rim that grow with a run of perfect releases,
// flames (a ball on fire, the rim on fire) and the finale explosion. Every
// particle lives in one pool of glowing points (one draw call), plus a
// shockwave ring for the explosions. Game coords (x across, y out, z up) via `toThree`.

type V = [number, number, number];

const POOL = 1800;
// Particle kinds: sparks fall and fade; flames rise, shrink and cool from yellow to red.
const SPARK = 0, FLAME = 1;

/** Fireworks colours, unlocked as the chain grows: gold first, then wine, pink, mint, violet, sky. */
const PALETTE = [0xf5c451, 0xffffff, 0xc2185b, 0xf472b6, 0x7cf7d4, 0xa78bfa, 0x60a5fa, 0xfb923c];

export class Effects {
  readonly group = new THREE.Group();
  private points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private life: Float32Array;
  private kind: Float32Array;
  private vel = new Float32Array(POOL * 3);
  private age = new Float32Array(POOL);
  private span = new Float32Array(POOL);
  private next = 0;
  private uPx = { value: 400 };
  private queue: Array<{ at: number; run: () => void }> = [];
  private time = 0;
  private ring: THREE.Mesh;
  private ringT = 99;
  private ringScale = 1;
  private rimFire = false;
  private rim: THREE.Vector3;
  private c = new THREE.Color();

  constructor(private toThree: (v: V) => THREE.Vector3, rimAt: V, private rimRadius: number) {
    this.rim = toThree(rimAt);
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(POOL * 3).fill(-100);
    this.col = new Float32Array(POOL * 3);
    this.size = new Float32Array(POOL);
    this.life = new Float32Array(POOL);
    this.kind = new Float32Array(POOL);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPx: this.uPx },
      vertexShader: `
        attribute vec3 color; attribute float aSize; attribute float aLife; attribute float aKind;
        uniform float uPx; varying vec3 vCol; varying float vLife; varying float vKind;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          // Flames shrink as they rise; sparks hold their size.
          float s = aKind > 0.5 ? aSize * (0.4 + 0.6 * aLife) : aSize;
          gl_PointSize = aLife > 0.0 ? min(26.0, s * uPx / max(0.1, -mv.z)) : 0.0;
          vCol = color; vLife = aLife; vKind = aKind;
        }`,
      fragmentShader: `
        varying vec3 vCol; varying float vLife; varying float vKind;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0 || vLife <= 0.0) discard;
          float glow = pow(1.0 - d, 1.6);
          // Flames cool from their colour to deep red, then fade.
          vec3 c = vKind > 0.5 ? mix(vec3(0.9, 0.12, 0.02), vCol, vLife) : vCol;
          float a = vKind > 0.5 ? vLife : smoothstep(0.0, 0.35, vLife);
          gl_FragColor = vec4(c * glow * a * 1.6, 1.0);
        }`,
    }));
    this.points.frustumCulled = false;
    this.group.add(this.points);
    // The shockwave: a flat ring round the rim, expanding and fading.
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ring.position.copy(this.rim);
    this.ring.visible = false;
    this.group.add(this.ring);
  }

  private spawn(p: THREE.Vector3, v: THREE.Vector3, color: number, size: number, span: number, kind: number): void {
    const i = this.next; this.next = (this.next + 1) % POOL;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.c.setHex(color); this.col[i * 3] = this.c.r; this.col[i * 3 + 1] = this.c.g; this.col[i * 3 + 2] = this.c.b;
    this.size[i] = size; this.age[i] = 0; this.span[i] = span; this.life[i] = 1; this.kind[i] = kind;
  }

  private sphere(at: THREE.Vector3, n: number, speed: number, colors: number[], size: number, span: number, up = 0): void {
    const v = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      v.randomDirection().multiplyScalar(speed * (0.55 + Math.random() * 0.45));
      v.y += up;
      this.spawn(at, v, colors[k % colors.length], size * (0.7 + Math.random() * 0.6), span * (0.7 + Math.random() * 0.5), SPARK);
    }
  }

  /**
   * Fireworks for a perfect make. `level` (0..1) is how far the chain has
   * come: more sparks, more colours, faster, and shells bursting overhead.
   */
  fireworks(level: number): void {
    if (level <= 0) return;
    const colors = PALETTE.slice(0, 2 + Math.round(level * (PALETTE.length - 2)));
    this.sphere(this.rim, Math.round(70 + level * 330), 1.6 + level * 2, colors, 0.05 + level * 0.03, 0.9 + level * 0.6, 1.2);
    // Shells over the basket, more of them the longer the chain.
    const shells = level >= 0.7 ? 3 : level >= 0.4 ? 2 : level >= 0.15 ? 1 : 0;
    for (let k = 0; k < shells; k++) {
      const at = this.toThree([(k - (shells - 1) / 2) * 2.6, -2.5 - Math.random(), 6.5 + Math.random() * 1.5]);
      const shell = [colors[(k * 3 + 2) % colors.length], colors[(k * 3 + 3) % colors.length], 0xffffff];
      this.later(0.18 + k * 0.16, () => this.sphere(at, Math.round(90 + level * 110), 2.2 + level * 1.2, shell, 0.08 + level * 0.04, 1.3, 0));
    }
  }

  /** Flames behind a ball on fire: call every frame while it flies. */
  burn(at: THREE.Vector3, dt: number): void {
    const v = new THREE.Vector3();
    const n = Math.min(6, Math.ceil(dt * 160));
    for (let k = 0; k < n; k++) {
      const p = at.clone().add(v.randomDirection().multiplyScalar(0.09));
      this.spawn(p, v.set((Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4), Math.random() < 0.5 ? 0xffd27a : 0xff8a2a, 0.11, 0.28 + Math.random() * 0.2, FLAME);
    }
  }

  /** The rim on fire (a perfect run's last rack), until switched off. */
  setRimFire(on: boolean): void { this.rimFire = on; }

  /** The finale: 'perfect' blows the burning rim apart; 'made' is a gold burst without fire. */
  explode(kind: 'perfect' | 'made'): void {
    this.rimFire = false;
    if (kind === 'perfect') {
      this.sphere(this.rim, 520, 5, [0xffffff, 0xffd27a, 0xff8a2a, 0xf5c451, 0xc2185b], 0.08, 1.8, 1);
      const v = new THREE.Vector3();
      for (let k = 0; k < 160; k++) this.spawn(this.rim, v.randomDirection().multiplyScalar(1.6).setY(1 + Math.random() * 2.5), 0xffd27a, 0.16, 0.6 + Math.random() * 0.5, FLAME);
      this.later(0.25, () => this.fireworks(1));
      this.later(0.6, () => this.fireworks(1));
    } else {
      this.sphere(this.rim, 380, 3.8, [0xf5c451, 0xffffff, 0xfff1c2], 0.07, 1.6, 1);
      this.later(0.3, () => this.sphere(this.rim, 160, 2.6, [0xf5c451, 0xffffff], 0.06, 1.4, 2));
    }
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(kind === 'perfect' ? 0xff9a3c : 0xf5c451);
    this.ringT = 0; this.ringScale = kind === 'perfect' ? 4.5 : 3.5;
  }

  private later(delay: number, run: () => void): void { this.queue.push({ at: this.time + delay, run }); }

  /** `pxScale`: screen pixels per world unit at distance 1 (sizes points in perspective). */
  update(dt: number, pxScale: number): void {
    this.time += dt;
    this.uPx.value = pxScale;
    if (this.queue.length) {
      const due = this.queue.filter(q => q.at <= this.time);
      this.queue = this.queue.filter(q => q.at > this.time);
      due.forEach(q => q.run());
    }
    if (this.rimFire) {
      const v = new THREE.Vector3(), n = Math.min(8, Math.ceil(dt * 260));
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const p = this.rim.clone().add(v.set(Math.cos(a) * this.rimRadius, 0.02, Math.sin(a) * this.rimRadius));
        this.spawn(p, v.set((Math.random() - 0.5) * 0.25, 0.7 + Math.random() * 0.9, (Math.random() - 0.5) * 0.25), Math.random() < 0.6 ? 0xffc46b : 0xff7a1a, 0.13, 0.35 + Math.random() * 0.25, FLAME);
      }
    }
    let any = false;
    for (let i = 0; i < POOL; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.age[i] += dt;
      this.life[i] = Math.max(0, 1 - this.age[i] / this.span[i]);
      const flame = this.kind[i] === FLAME, drag = Math.exp(-(flame ? 2.5 : 1.3) * dt);
      this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag + (flame ? 1.2 : -4.5) * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    if (any) {
      const g = this.points.geometry;
      (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (g.getAttribute('aLife') as THREE.BufferAttribute).needsUpdate = true;
      (g.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
      (g.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
      (g.getAttribute('aKind') as THREE.BufferAttribute).needsUpdate = true;
    }
    this.points.visible = any;
    if (this.ringT < 0.9) {
      this.ringT += dt;
      const k = this.ringT / 0.9;
      this.ring.visible = true;
      this.ring.scale.setScalar(0.3 + k * this.ringScale);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    } else this.ring.visible = false;
  }
}

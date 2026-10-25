import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The stands and the fans in them. Fans are instanced silhouette cut-outs,
// bob gently all game and jump up when something big happens. Phone flashes
// pop in the crowd. Game coords (x across, y out, z up) via `toThree`.

type V = [number, number, number];

/** The seating bowl's shape, shared with the arena (walls, suites, roof). */
export const BOWL = {
  sections: [
    { along: 'x' as const, fixed: -6.2, from: -16, to: 16, dir: -1 },  // behind the baseline
    { along: 'y' as const, fixed: 11.2, from: -5, to: 17, dir: 1 },    // right sideline
    { along: 'y' as const, fixed: -11.2, from: -5, to: 17, dir: -1 },  // left sideline
  ],
  lowerRows: 12,
  upperRows: 14,
  rowDepth: 0.85,
  /** Depth of the suite level between the tiers. */
  gap: 1.2,
  /** Lower bowl top, and where the upper deck starts. */
  lowerTop: 0.6 + 12 * 0.45,
  upperZ: 0.6 + 12 * 0.45 + 2.6,
  roofZ: 20,
};

/** Eight head-and-shoulder silhouettes side by side (128×256 each). Red marks
 *  the shirt (and caps, hoods), green the skin, dimmer green the hair; alpha is
 *  the outline. The shader colours each fan from these masks. */
function silhouettes(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
  const g = cv.getContext('2d')!;
  const SHIRT = 'rgb(255,0,0)', SKIN = 'rgb(0,255,0)', HAIR = 'rgb(0,80,0)';
  const ell = (x: number, y: number, rx: number, ry: number, fill: string) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
  const body = (cx: number, w: number, top = 160) => { g.fillStyle = SHIRT; g.beginPath(); g.ellipse(cx, 256, w / 2, 256 - top, 0, Math.PI, 0); g.fill(); };
  const neck = (cx: number, y = 150) => { g.fillStyle = SKIN; g.fillRect(cx - 10, y - 20, 20, 36); };
  const head = (cx: number, cy = 110, r = 27) => ell(cx, cy, r * 0.86, r, SKIN);
  const variants: Array<(cx: number) => void> = [
    cx => { body(cx, 100); neck(cx); head(cx); ell(cx, 92, 22, 12, HAIR); },                                    // short hair
    cx => { ell(cx, 128, 28, 44, HAIR); body(cx, 86); neck(cx); head(cx, 110, 25); ell(cx, 92, 22, 13, HAIR); }, // long hair
    cx => { body(cx, 112, 156); neck(cx); head(cx, 108, 28); ell(cx, 90, 25, 13, SHIRT); g.fillStyle = SHIRT; g.fillRect(cx, 92, 34, 7); }, // cap
    cx => { body(cx, 92); neck(cx); head(cx, 110, 25); ell(cx, 90, 21, 12, HAIR); ell(cx - 4, 74, 11, 10, HAIR); }, // bun
    cx => { body(cx, 78, 182); neck(cx, 176); head(cx, 138, 24); ell(cx, 121, 19, 11, HAIR); },                   // kid
    cx => { body(cx, 104, 158); ell(cx, 112, 31, 36, SHIRT); neck(cx); ell(cx, 116, 18, 22, SKIN); },             // hood up
    cx => { body(cx, 100); g.fillStyle = SHIRT; g.fillRect(cx + 30, 70, 17, 110); ell(cx + 38, 64, 10, 12, SKIN); neck(cx); head(cx); ell(cx, 92, 22, 12, HAIR); }, // arm up
    cx => { body(cx, 104); neck(cx); ell(cx, 102, 36, 34, HAIR); head(cx, 114, 25); ell(cx, 92, 30, 18, HAIR); },  // big hair
  ];
  variants.forEach((draw, i) => draw(i * 128 + 64));
  const t = new THREE.CanvasTexture(cv);
  return t;
}

interface Fan { pos: V; phase: number; jump: number }

export class Crowd {
  readonly group = new THREE.Group();
  private cutouts: THREE.InstancedMesh;
  private fans: Fan[] = [];
  private tmp = new THREE.Object3D();
  private excite = 0;
  private flashes: THREE.Points;
  private flashLife: Float32Array;
  private uTime = { value: 0 };
  private uExcite = { value: 0 };

  constructor(private toThree: (v: V) => THREE.Vector3, count: number) {
    const rand = (() => { let s = 99; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
    // Tiered stands: behind the baseline and along both sidelines.
    // Dark and low-reflection: the stands sit back so the court reads first.
    const standMat = new THREE.MeshStandardMaterial({ color: 0x0e0d12, roughness: 0.9, envMapIntensity: 0.25 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x24101c, roughness: 0.8, envMapIntensity: 0.25 });
    // Two tiers: the lower bowl right off the floor, and an upper deck set
    // back above the suite level (see BOWL, which the arena builds around).
    const tiers = [
      { first: 0, rows: BOWL.lowerRows, z0: 0.6, rise: 0.45, extra: 0, spacing: 0.55 },
      { first: BOWL.lowerRows * BOWL.rowDepth + BOWL.gap, rows: BOWL.upperRows, z0: BOWL.upperZ, rise: 0.5, extra: 8, spacing: 0.6 },
    ];
    const rowDepth = BOWL.rowDepth;
    // Steps are merged into two meshes (one per colour): a couple of draw calls, not dozens.
    const standGeos: THREE.BufferGeometry[] = [], seatGeos: THREE.BufferGeometry[] = [];
    const spots: V[] = [];
    tiers.forEach(tier => BOWL.sections.forEach(sec => {
      const from = sec.from - tier.extra, to = sec.to + tier.extra;
      for (let r = 0; r < tier.rows; r++) {
        const off = sec.fixed + sec.dir * (tier.first + r * rowDepth), z = tier.z0 + r * tier.rise;
        const len = to - from;
        const step = new THREE.BoxGeometry(sec.along === 'x' ? len : rowDepth, tier.rise, sec.along === 'x' ? rowDepth : len);
        const c: V = sec.along === 'x' ? [(from + to) / 2, off, z - tier.rise / 2] : [off, (from + to) / 2, z - tier.rise / 2];
        const at = this.toThree(c);
        step.translate(at.x, at.y, at.z);
        (r % 2 ? standGeos : seatGeos).push(step);
        for (let q = from + 0.3; q < to; q += tier.spacing) spots.push(sec.along === 'x' ? [q, off, z] : [off, q, z]);
      }
    }));
    ([[standGeos, standMat], [seatGeos, seatMat]] as const).forEach(([geos, mat]) => {
      const m = new THREE.Mesh(mergeGeometries(geos), mat);
      m.receiveShadow = true;
      this.group.add(m);
    });
    // Pick seats until we have enough fans; some seats stay empty.
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    spots.slice(0, Math.min(count, spots.length)).forEach(p => this.fans.push({ pos: p, phase: rand() * 10, jump: 0.4 + rand() * 0.8 }));
    const matrices: THREE.Matrix4[] = [];

    // Fans are cut-outs: one quad each, turned about the vertical to face the
    // camera, drawn from an atlas of head-and-shoulder silhouettes. Two triangles
    // a fan instead of a body and a head (about 140), and one draw call.
    const quad = new THREE.PlaneGeometry(0.56, 1.12).translate(0, 0.56, 0);
    const n = this.fans.length;
    const shirt = new Float32Array(n * 3), skin = new Float32Array(n * 3), rim = new Float32Array(n), look = new Float32Array(n), phase = new Float32Array(n), jump = new Float32Array(n);
    // Home crowd: mostly wine, charcoal and navy, the odd white or gold shirt.
    const shirts = ['#5C163A', '#5C163A', '#5C163A', '#3A1026', '#3A1026', '#1F2937', '#1F2937', '#111827', '#111827', '#1E2A44', '#1E2A44', '#2B2F3A', '#4A4550', '#C9C4BC', '#B8923A'];
    const skins = ['#F1C7A5', '#D9A37E', '#B07850', '#8D5A3B', '#5E3A22', '#E8B48F'];
    const col = new THREE.Color();
    this.fans.forEach((f, i) => {
      // Upper rows sit further from the court lights, and fans behind the rim
      // from some rack (the baseline end, the sidelines' near end) sit back
      // further still, so the shooter's backdrop stays calm.
      const behind = f.pos[1] < BOWL.sections[0].fixed ? 1 : 1 - THREE.MathUtils.smoothstep(f.pos[1], 2, 10);
      const light = (0.06 + rand() * 0.04) * (1 - 0.4 * Math.min(1, (f.pos[2] - 0.6) / 14)) * (1 - 0.45 * behind);
      rim[i] = 1 - 0.75 * behind;
      col.set(shirts[Math.floor(rand() * shirts.length)]).multiplyScalar(light).toArray(shirt, i * 3);
      col.set(skins[Math.floor(rand() * skins.length)]).multiplyScalar(light * 0.6).toArray(skin, i * 3);
      // Silhouette (1..8), negative = mirrored.
      look[i] = (1 + Math.floor(rand() * 8)) * (rand() < 0.5 ? -1 : 1);
      phase[i] = f.phase; jump[i] = f.jump;
      const [x, y, z] = f.pos;
      this.tmp.position.copy(this.toThree([x, y, z + 0.15]));
      this.tmp.scale.setScalar(0.92 + rand() * 0.16);
      this.tmp.updateMatrix();
      this.tmp.scale.setScalar(1);
      matrices.push(this.tmp.matrix.clone());
    });
    quad.setAttribute('aShirt', new THREE.InstancedBufferAttribute(shirt, 3));
    quad.setAttribute('aSkin', new THREE.InstancedBufferAttribute(skin, 3));
    quad.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 1));
    quad.setAttribute('aRim', new THREE.InstancedBufferAttribute(rim, 1));
    quad.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    quad.setAttribute('aJump', new THREE.InstancedBufferAttribute(jump, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), map: { value: silhouettes() }, uTime: this.uTime, uExcite: this.uExcite, uRim: { value: new THREE.Color(0xffe6c4).multiplyScalar(0.1) } },
      fog: true, side: THREE.DoubleSide, alphaToCoverage: true,
      vertexShader: `
        attribute vec3 aShirt; attribute vec3 aSkin; attribute float aLook; attribute float aRim; attribute float aPhase; attribute float aJump;
        uniform float uTime; uniform float uExcite;
        varying vec2 vUv; varying vec3 vShirt; varying vec3 vSkin; varying float vRim;
        #include <fog_pars_vertex>
        void main() {
          vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float s = length(instanceMatrix[0].xyz);
          // Bobbing all game, jumping up in big moments.
          c.y += sin(uTime * 2.2 + aPhase) * 0.015 + uExcite * aJump * max(0.0, sin(uTime * 9.0 + aPhase)) * 0.28;
          vec3 toCam = cameraPosition - c; toCam.y = 0.0;
          vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + 1e-5);
          vec3 wp = c + right * position.x * s * sign(aLook) + vec3(0.0, position.y * s, 0.0);
          vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vUv = vec2((abs(aLook) - 1.0 + uv.x) / 8.0, uv.y);
          vShirt = aShirt; vSkin = aSkin; vRim = aRim;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform vec3 uRim;
        varying vec2 vUv; varying vec3 vShirt; varying vec3 vSkin; varying float vRim;
        #include <fog_pars_fragment>
        void main() {
          vec4 t = texture2D(map, vUv);
          if (t.a < 0.04) discard;
          // The arena lights catch the top edge: lit where the texel above is empty.
          float rim = t.a * (1.0 - texture2D(map, vUv + vec2(0.0, 0.012)).a);
          vec3 col = vShirt * t.r + vSkin * t.g + uRim * rim * vRim;
          gl_FragColor = vec4(col, smoothstep(0.25, 0.65, t.a));
          #include <fog_fragment>
        }`,
    });
    this.cutouts = new THREE.InstancedMesh(quad, mat, n);
    matrices.forEach((m, i) => this.cutouts.setMatrixAt(i, m));
    // Bounds never change and the stands are always in shot.
    this.cutouts.frustumCulled = false;
    this.group.add(this.cutouts);

    // Phone camera flashes.
    const nf = 60, pos = new Float32Array(nf * 3);
    this.flashLife = new Float32Array(nf);
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.flashes = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flashes.frustumCulled = false;
    this.group.add(this.flashes);
    this.update(0, 0);
  }

  /** Big moment: the crowd jumps up. */
  cheer(size: number): void { this.excite = Math.min(1.6, this.excite + size * 0.5); }

  update(t: number, dt: number): void {
    this.excite = Math.max(0, this.excite - dt * 0.6);
    const e = this.excite;
    this.uTime.value = t; this.uExcite.value = e;
    // Flashes: more of them in big moments.
    const pos = this.flashes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.flashLife.length; i++) {
      this.flashLife[i] -= dt;
      if (this.flashLife[i] <= 0) {
        if (Math.random() < dt * (0.6 + e * 6)) {
          const f = this.fans[Math.floor(Math.random() * this.fans.length)];
          if (f) { pos.setXYZ(i, f.pos[0], f.pos[2] + 1, f.pos[1]); this.flashLife[i] = 0.08; }
        } else pos.setXYZ(i, 0, -100, 0);
      }
    }
    pos.needsUpdate = true;
  }
}

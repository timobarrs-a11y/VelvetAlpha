import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The stands and the fans in them. Fans are instanced (torsos and heads),
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

interface Fan { pos: V; phase: number; jump: number }

export class Crowd {
  readonly group = new THREE.Group();
  private bodies: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh;
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

    // Low-poly fans: they're small on screen and there are thousands of them.
    const torso = new THREE.CapsuleGeometry(0.19, 0.16, 2, 6);
    const head = new THREE.IcosahedronGeometry(0.11, 1);
    // Bobbing and jumping run in the vertex shader, so the instance matrices
    // are written once and nothing is re-uploaded per frame.
    const phase = new Float32Array(this.fans.length), jump = new Float32Array(this.fans.length);
    this.fans.forEach((f, i) => { phase[i] = f.phase; jump[i] = f.jump; });
    [torso, head].forEach(g => {
      g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
      g.setAttribute('aJump', new THREE.InstancedBufferAttribute(jump, 1));
    });
    const animate = (m: THREE.MeshStandardMaterial) => {
      m.onBeforeCompile = sh => {
        sh.uniforms.uTime = this.uTime; sh.uniforms.uExcite = this.uExcite;
        sh.vertexShader = 'attribute float aPhase;\nattribute float aJump;\nuniform float uTime;\nuniform float uExcite;\n' + sh.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed.y += sin(uTime * 2.2 + aPhase) * 0.015 + uExcite * aJump * max(0.0, sin(uTime * 9.0 + aPhase)) * 0.28;',
        );
      };
      return m;
    };
    const shirtMat = animate(new THREE.MeshStandardMaterial({ roughness: 0.85, envMapIntensity: 0.25 }));
    const skinMat = animate(new THREE.MeshStandardMaterial({ roughness: 0.8, envMapIntensity: 0.25 }));
    this.bodies = new THREE.InstancedMesh(torso, shirtMat, this.fans.length);
    this.heads = new THREE.InstancedMesh(head, skinMat, this.fans.length);
    // Home crowd: mostly wine, charcoal and navy, the odd white or gold shirt.
    const shirts = ['#5C163A', '#5C163A', '#5C163A', '#3A1026', '#3A1026', '#1F2937', '#1F2937', '#111827', '#111827', '#1E2A44', '#1E2A44', '#2B2F3A', '#4A4550', '#C9C4BC', '#B8923A'];
    const skins = ['#F1C7A5', '#D9A37E', '#B07850', '#8D5A3B', '#5E3A22', '#E8B48F'];
    const col = new THREE.Color();
    this.fans.forEach((f, i) => {
      this.bodies.setColorAt(i, col.set(shirts[Math.floor(rand() * shirts.length)]).multiplyScalar(0.2 + rand() * 0.14));
      this.heads.setColorAt(i, col.set(skins[Math.floor(rand() * skins.length)]).multiplyScalar(0.22));
      const [x, y, z] = f.pos;
      this.tmp.position.copy(this.toThree([x, y, z + 0.3])); this.tmp.updateMatrix();
      this.bodies.setMatrixAt(i, this.tmp.matrix);
      this.tmp.position.copy(this.toThree([x, y, z + 0.66])); this.tmp.updateMatrix();
      this.heads.setMatrixAt(i, this.tmp.matrix);
    });
    // Bounds never change and the stands are always in shot.
    this.bodies.frustumCulled = this.heads.frustumCulled = false;
    this.group.add(this.bodies, this.heads);

    // Phone camera flashes.
    const n = 60, pos = new Float32Array(n * 3);
    this.flashLife = new Float32Array(n);
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

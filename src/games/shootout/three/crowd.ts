import * as THREE from 'three';

// The stands and the fans in them. Fans are instanced (torsos and heads),
// bob gently all game and jump up when something big happens. Phone flashes
// pop in the crowd. Game coords (x across, y out, z up) via `toThree`.

type V = [number, number, number];

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

  constructor(private toThree: (v: V) => THREE.Vector3, count: number) {
    const rand = (() => { let s = 99; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
    // Tiered stands: behind the baseline and along both sidelines.
    const standMat = new THREE.MeshStandardMaterial({ color: 0x15131f, roughness: 0.9 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x3a1230, roughness: 0.7 });
    const sections: Array<{ along: 'x' | 'y'; fixed: number; from: number; to: number; dir: number }> = [
      { along: 'x', fixed: -6.2, from: -16, to: 16, dir: -1 },  // behind the baseline
      { along: 'y', fixed: 11.2, from: -5, to: 17, dir: 1 },    // right sideline
      { along: 'y', fixed: -11.2, from: -5, to: 17, dir: -1 },  // left sideline
    ];
    const rows = 12, rowDepth = 0.85, rowRise = 0.45;
    const spots: V[] = [];
    sections.forEach(sec => {
      for (let r = 0; r < rows; r++) {
        const off = sec.fixed + sec.dir * (r * rowDepth), z = 0.6 + r * rowRise;
        const len = sec.to - sec.from;
        const step = new THREE.Mesh(new THREE.BoxGeometry(sec.along === 'x' ? len : rowDepth, rowRise, sec.along === 'x' ? rowDepth : len), r % 2 ? standMat : seatMat);
        const c: V = sec.along === 'x' ? [(sec.from + sec.to) / 2, off, z - rowRise / 2] : [off, (sec.from + sec.to) / 2, z - rowRise / 2];
        step.position.copy(this.toThree(c));
        step.receiveShadow = true;
        this.group.add(step);
        for (let s = sec.from + 0.3; s < sec.to; s += 0.55) spots.push(sec.along === 'x' ? [s, off, z] : [off, s, z]);
      }
    });
    // Pick seats until we have enough fans; some seats stay empty.
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    spots.slice(0, Math.min(count, spots.length)).forEach(p => this.fans.push({ pos: p, phase: rand() * 10, jump: 0.4 + rand() * 0.8 }));

    const torso = new THREE.CapsuleGeometry(0.17, 0.32, 3, 6);
    const head = new THREE.SphereGeometry(0.105, 8, 6);
    const shirtMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    this.bodies = new THREE.InstancedMesh(torso, shirtMat, this.fans.length);
    this.heads = new THREE.InstancedMesh(head, skinMat, this.fans.length);
    const shirts = ['#5C163A', '#F5C451', '#FFFFFF', '#1F2937', '#2563EB', '#DC2626', '#10B981', '#7C3AED', '#F472B6', '#111827', '#5C163A', '#F5C451'];
    const skins = ['#F1C7A5', '#D9A37E', '#B07850', '#8D5A3B', '#5E3A22', '#E8B48F'];
    const col = new THREE.Color();
    this.fans.forEach((_, i) => {
      this.bodies.setColorAt(i, col.set(shirts[Math.floor(rand() * shirts.length)]).multiplyScalar(0.42 + rand() * 0.2));
      this.heads.setColorAt(i, col.set(skins[Math.floor(rand() * skins.length)]).multiplyScalar(0.55));
    });
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
    this.fans.forEach((f, i) => {
      const bob = Math.sin(t * 2.2 + f.phase) * 0.015 + e * f.jump * Math.max(0, Math.sin(t * 9 + f.phase)) * 0.28;
      const [x, y, z] = f.pos;
      this.tmp.position.copy(this.toThree([x, y, z + 0.33 + bob]));
      this.tmp.rotation.set(0, 0, 0); this.tmp.scale.setScalar(1); this.tmp.updateMatrix();
      this.bodies.setMatrixAt(i, this.tmp.matrix);
      this.tmp.position.copy(this.toThree([x, y, z + 0.78 + bob])); this.tmp.updateMatrix();
      this.heads.setMatrixAt(i, this.tmp.matrix);
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    // Flashes: more of them in big moments.
    const pos = this.flashes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.flashLife.length; i++) {
      this.flashLife[i] -= dt;
      if (this.flashLife[i] <= 0) {
        if (Math.random() < dt * (0.6 + e * 6)) {
          const f = this.fans[Math.floor(Math.random() * this.fans.length)];
          if (f) { const p = this.toThree([f.pos[0], f.pos[1], f.pos[2] + 1]); pos.setXYZ(i, p.x, p.y, p.z); this.flashLife[i] = 0.08; }
        } else pos.setXYZ(i, 0, -100, 0);
      }
    }
    pos.needsUpdate = true;
  }
}

import * as THREE from 'three';

// The net as a small cloth simulation (Verlet particles and distance
// constraints) hanging from the rim, drawn as instanced cords. The ball
// pushes the cords aside, so swishes whip the net and rattles shake it.
// Works in game coordinates (x across, y out, z up); `toThree` maps to Three.

type V = [number, number, number];

const AROUND = 14, DOWN = 6;

export class Net {
  readonly mesh: THREE.InstancedMesh;
  private p: V[] = [];
  private prev: V[] = [];
  private pinned: boolean[] = [];
  private links: Array<[number, number, number]> = [];
  private tmp = new THREE.Object3D();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(rim: { x: number; y: number; z: number; r: number }, private toThree: (v: V) => THREE.Vector3) {
    for (let l = 0; l < DOWN; l++) {
      const rr = rim.r * (1 - 0.42 * (l / (DOWN - 1)));
      for (let i = 0; i < AROUND; i++) {
        // Diamond weave: alternate rows are offset half a cell.
        const a = ((i + (l % 2) * 0.5) / AROUND) * Math.PI * 2;
        const v: V = [rim.x + Math.cos(a) * rr, rim.y + Math.sin(a) * rr, rim.z - l * 0.085];
        this.p.push(v); this.prev.push([...v] as V); this.pinned.push(l === 0);
      }
    }
    const idx = (i: number, l: number) => l * AROUND + ((i + AROUND) % AROUND);
    for (let l = 0; l < DOWN - 1; l++) {
      for (let i = 0; i < AROUND; i++) {
        const a = idx(i, l), b = idx(i + (l % 2), l + 1), c = idx(i - 1 + (l % 2), l + 1);
        this.links.push([a, b, this.dist(a, b)], [a, c, this.dist(a, c)]);
      }
    }
    const geo = new THREE.CylinderGeometry(0.0045, 0.0045, 1, 5, 1, true);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: 0.85, emissive: 0x222222 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.links.length);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.write();
  }

  private dist(a: number, b: number): number {
    const p = this.p[a], q = this.p[b];
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }

  /** Step the cloth. `ball` (game coords) and radius push the cords out of the way. */
  step(dt: number, ball: V | null, ballR: number, kick = 0): void {
    const h = Math.min(dt, 1 / 30), g = -9.8 * h * h;
    for (let i = 0; i < this.p.length; i++) {
      if (this.pinned[i]) continue;
      const p = this.p[i], q = this.prev[i];
      const vx = (p[0] - q[0]) * 0.985, vy = (p[1] - q[1]) * 0.985, vz = (p[2] - q[2]) * 0.985;
      q[0] = p[0]; q[1] = p[1]; q[2] = p[2];
      p[0] += vx; p[1] += vy; p[2] += vz + g - kick * h * 0.6;
    }
    for (let it = 0; it < 6; it++) {
      for (const [a, b, rest] of this.links) {
        const p = this.p[a], q = this.p[b];
        const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
        const d = Math.hypot(dx, dy, dz) || 1e-6, diff = (d - rest) / d;
        const wa = this.pinned[a] ? 0 : this.pinned[b] ? 1 : 0.5, wb = this.pinned[b] ? 0 : this.pinned[a] ? 1 : 0.5;
        p[0] += dx * diff * wa; p[1] += dy * diff * wa; p[2] += dz * diff * wa;
        q[0] -= dx * diff * wb; q[1] -= dy * diff * wb; q[2] -= dz * diff * wb;
      }
      if (ball) {
        // Keep cords outside the ball.
        for (let i = 0; i < this.p.length; i++) {
          if (this.pinned[i]) continue;
          const p = this.p[i], dx = p[0] - ball[0], dy = p[1] - ball[1], dz = p[2] - ball[2];
          const d = Math.hypot(dx, dy, dz), min = ballR + 0.012;
          if (d < min && d > 1e-6) { const k = (min - d) / d; p[0] += dx * k; p[1] += dy * k; p[2] += dz * k; }
        }
      }
    }
    this.write();
  }

  /** Place each cord between its two knots. */
  private write(): void {
    const A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3();
    this.links.forEach(([a, b], k) => {
      A.copy(this.toThree(this.p[a])); B.copy(this.toThree(this.p[b]));
      D.subVectors(B, A);
      const len = D.length();
      this.tmp.position.copy(A).addScaledVector(D, 0.5);
      this.tmp.quaternion.setFromUnitVectors(this.up, D.normalize());
      this.tmp.scale.set(1, len, 1);
      this.tmp.updateMatrix();
      this.mesh.setMatrixAt(k, this.tmp.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export type ParticleKind = 'steam' | 'smoke' | 'ember' | 'dust' | 'splash' | 'leaf';

export interface Particle {
  kind: ParticleKind;
  level: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  seed: number;
}

interface Spec { rate: number; life: number; rise: number; spread: number; gravity: number; drag: number }

const SPECS: Record<ParticleKind, Spec> = {
  steam: { rate: 7, life: 1.5, rise: 0.5, spread: 0.05, gravity: 0, drag: 0.6 },
  smoke: { rate: 5, life: 3.4, rise: 0.38, spread: 0.08, gravity: 0, drag: 0.35 },
  ember: { rate: 6, life: 1.2, rise: 1.1, spread: 0.25, gravity: 0.9, drag: 0.2 },
  dust: { rate: 14, life: 0.7, rise: 0.18, spread: 0.12, gravity: 0.4, drag: 0.9 },
  splash: { rate: 20, life: 0.5, rise: 0.9, spread: 0.16, gravity: 2.8, drag: 0.2 },
  leaf: { rate: 0.6, life: 6, rise: 0.25, spread: 0.3, gravity: 0.12, drag: 0.15 },
};

export interface Particles {
  /** Call every frame while the source is active; emission is rate-limited per key. */
  emit(key: string, kind: ParticleKind, level: number, x: number, y: number, z: number, strength?: number): void;
  /** A one-off puff of n particles (furniture landing, a box dropped). */
  burst(kind: ParticleKind, level: number, x: number, y: number, z: number, n: number): void;
  step(dt: number, wind: [number, number], density: number): void;
  forEach(level: number, fn: (p: Particle, t: number) => void): void;
  readonly count: number;
}

export function createParticles(max = 360, rand: () => number = Math.random): Particles {
  const list: Particle[] = [];
  const acc = new Map<string, number>();
  let dt = 0, density = 1;

  return {
    emit(key, kind, level, x, y, z, strength = 1) {
      const s = SPECS[kind];
      let a = (acc.get(key) || 0) + s.rate * strength * density * dt;
      while (a >= 1 && list.length < max) {
        a -= 1;
        const ang = rand() * Math.PI * 2, r = rand() * s.spread;
        list.push({
          kind, level, x: x + Math.cos(ang) * r * 0.4, y: y + Math.sin(ang) * r * 0.4, z,
          vx: Math.cos(ang) * r, vy: Math.sin(ang) * r, vz: s.rise * (0.7 + rand() * 0.6),
          age: 0, life: s.life * (0.75 + rand() * 0.5), seed: rand(),
        });
      }
      acc.set(key, Math.min(a, 1));
    },
    burst(kind, level, x, y, z, n) {
      const s = SPECS[kind];
      for (let i = 0; i < n && list.length < max; i++) {
        const ang = rand() * Math.PI * 2, r = (0.4 + rand()) * s.spread * 2.5;
        list.push({
          kind, level, x: x + Math.cos(ang) * r * 0.3, y: y + Math.sin(ang) * r * 0.3, z,
          vx: Math.cos(ang) * r * 2, vy: Math.sin(ang) * r * 2, vz: s.rise * (0.5 + rand() * 0.8),
          age: 0, life: s.life * (0.8 + rand() * 0.6), seed: rand(),
        });
      }
    },
    step(frameDt, wind, dens) {
      dt = Math.min(frameDt, 0.1);
      density = dens;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i], s = SPECS[p.kind];
        p.age += dt;
        if (p.age >= p.life || p.z < 0) { list[i] = list[list.length - 1]; list.pop(); continue; }
        const k = Math.max(0, 1 - s.drag * dt);
        p.vx = p.vx * k + wind[0] * dt;
        p.vy = p.vy * k + wind[1] * dt;
        p.vz = p.vz * k - s.gravity * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      }
    },
    forEach(level, fn) { list.forEach(p => { if (p.level === level) fn(p, p.age / p.life); }); },
    get count() { return list.length; },
  };
}

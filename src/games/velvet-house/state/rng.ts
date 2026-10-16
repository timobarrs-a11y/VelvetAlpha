/**
 * Seeded mulberry32 RNG — deterministic for tests and screenshot comparisons.
 * Drop-in replacement for Math.random() that can be injected anywhere.
 */
export class RNG {
  private state: number;

  constructor(seed: number = 1) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  reseed(seed: number): void {
    this.state = seed >>> 0;
  }
}

let _global: RNG | null = null;

export function globalRNG(): RNG {
  if (!_global) _global = new RNG((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  return _global;
}

export function setGlobalRNG(rng: RNG): void {
  _global = rng;
}

export function rand(): number {
  return globalRNG().next();
}

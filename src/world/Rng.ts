/** Small deterministic PRNG (mulberry32) so a run can be replayed from its seed. */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }

  float(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number { return min + (max - min) * this.float(); }
  int(n: number): number { return Math.floor(this.float() * n); }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }
  chance(p: number): boolean { return this.float() < p; }
}

import type { MoveEvent } from '../player/Movement';

/**
 * FLOW: reward uninterrupted stylish movement. Tricks within the window raise the level (x1..x5);
 * the window shrinks as level rises; standing still bleeds it fast.
 */
export class FlowSystem {
  level = 0;            // 0..4  -> multiplier 1..5
  window = 0;           // seconds left before a level drops
  tricks = 0;
  best = 1;
  private readonly baseWindow = 3.2;
  decayMult = 1;

  get multiplier(): number { return 1 + this.level; }
  get progress01(): number { return this.level === 0 && this.window <= 0 ? 0 : Math.min(1, this.window / this.windowFor(this.level)); }
  get intensity01(): number { return this.level / 4; }

  private windowFor(level: number): number { return (this.baseWindow - level * 0.35) * this.decayMult; }

  reset(): void { this.level = 0; this.window = 0; this.tricks = 0; }

  /** Returns true when the multiplier went up. */
  onEvent(ev: MoveEvent): boolean {
    const trick = ev === 'walljump' || ev === 'grapple-release' || ev === 'djump' || ev === 'vault' || ev === 'wallrun' || ev === 'dash' || ev === 'slide';
    if (!trick) return false;
    this.tricks++;
    const before = this.level;
    // dashes alone shouldn't farm flow; everything else is a full step
    const gain = ev === 'dash' ? 0.5 : 1;
    this.window = this.windowFor(this.level);
    this.partial += gain;
    if (this.partial >= 1) { this.partial = 0; this.level = Math.min(4, this.level + 1); }
    this.best = Math.max(this.best, this.multiplier);
    return this.level > before;
  }
  private partial = 0;

  update(dt: number, speedXZ: number, grounded: boolean): void {
    if (this.level === 0 && this.window <= 0) return;
    const slow = grounded && speedXZ < 2 ? 3 : 1;
    this.window -= dt * slow;
    if (this.window <= 0) {
      if (this.level > 0) { this.level--; this.window = this.windowFor(this.level) * 0.6; }
      else this.window = 0;
    }
  }
}

import type { RunStats } from '../player/Movement';
import type { Rng } from '../world/Rng';

export interface Upgrade {
  id: string;
  name: string;
  /** one line: what you can now do */
  desc: string;
  /** one line: why it matters */
  why: string;
  icon: string;
  max: number;
  apply: (s: RunStats) => void;
}

export const UPGRADES: Upgrade[] = [
  { id: 'djump', name: 'TRIPLE JUMP', desc: '+1 extra jump in mid-air', why: 'Fix a bad jump. Reach higher islands.', icon: '⤴', max: 2, apply: (s) => { s.airJumps += 1; } },
  { id: 'dash2', name: 'TWIN DASH', desc: 'Two dashes before you must land', why: 'Cross the biggest gaps.', icon: '»»', max: 2, apply: (s) => { s.dashCharges += 1; } },
  { id: 'dashreset', name: 'RIFT STEP', desc: 'Wall-runs and grapples refill your dash', why: 'Keep chaining without touching ground.', icon: '↻', max: 1, apply: (s) => { s.dashResetOnTrick = true; } },
  { id: 'grapple+', name: 'LONG GRAPPLE', desc: 'Grapple rings catch from 8 m further', why: 'Grab earlier, swing longer.', icon: '⚓', max: 2, apply: (s) => { s.grappleRange += 8; } },
  { id: 'gboost', name: 'SLINGSHOT', desc: 'Letting go of a grapple flings you 15% harder', why: 'Turn every swing into a launch.', icon: '⟿', max: 2, apply: (s) => { s.grappleBoost += 0.15; } },
  { id: 'wall+', name: 'WALL BOOST', desc: 'Wall-run almost a second longer', why: 'Clear long canyons without a floor.', icon: '▐', max: 2, apply: (s) => { s.wallRunTime += 0.8; } },
  { id: 'riftslow', name: 'RIFT WARD', desc: 'The Rift chases 20% slower', why: 'Breathing room on every run.', icon: '⌛', max: 2, apply: (s) => { s.riftSlow *= 0.8; } },
  { id: 'feather', name: 'FEATHER', desc: 'Jump 12% higher, more time to leave an edge', why: 'Forgiving edges, taller hops.', icon: '✧', max: 2, apply: (s) => { s.jumpMult *= 1.12; s.coyoteBonus += 0.1; } },
  { id: 'flowkeep', name: 'FLOW KEEPER', desc: 'FLOW drains 30% slower', why: 'Hold the multiplier; coins pay out more.', icon: '∞', max: 2, apply: (s) => { s.flowDecayMult *= 1.3; } },
  { id: 'magnet', name: 'COIN MAGNET', desc: 'Coins fly to you from twice the distance', why: 'More energy without detours.', icon: '◎', max: 2, apply: (s) => { s.magnetRadius += 1.8; } },
  { id: 'shield', name: 'RIFT SHIELD', desc: 'Survive being caught by the Rift once', why: 'A second chance per run.', icon: '⬡', max: 1, apply: (s) => { s.riftShield += 1; } },
];

export class UpgradeDeck {
  readonly taken = new Map<string, number>();

  offer(rng: Rng, n = 3): Upgrade[] {
    const pool = UPGRADES.filter((u) => (this.taken.get(u.id) ?? 0) < u.max);
    const out: Upgrade[] = [];
    while (out.length < n && pool.length) {
      const i = rng.int(pool.length);
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  take(u: Upgrade, stats: RunStats): void {
    this.taken.set(u.id, (this.taken.get(u.id) ?? 0) + 1);
    u.apply(stats);
  }

  reset(): void { this.taken.clear(); }
}

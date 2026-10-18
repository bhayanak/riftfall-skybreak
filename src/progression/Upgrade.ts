import type { RunStats } from '../player/Movement';
import type { Rng } from '../world/Rng';

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  icon: string;
  max: number;
  apply: (s: RunStats) => void;
}

export const UPGRADES: Upgrade[] = [
  { id: 'djump', name: 'AIR JUMP', desc: '+1 jump in mid-air', icon: '⤴', max: 2, apply: (s) => { s.airJumps += 1; } },
  { id: 'dash2', name: 'EXTRA DASH', desc: '+1 dash charge', icon: '»', max: 2, apply: (s) => { s.dashCharges += 1; } },
  { id: 'dashreset', name: 'RIFT STEP', desc: 'Wall-runs & grapples refill your dash', icon: '↻', max: 1, apply: (s) => { s.dashResetOnTrick = true; } },
  { id: 'grapple+', name: 'LONG GRAPPLE', desc: '+7 m grapple reach', icon: '⚓', max: 2, apply: (s) => { s.grappleRange += 7; } },
  { id: 'gboost', name: 'GRAPPLE BOOST', desc: 'Release flings you harder', icon: '⟿', max: 2, apply: (s) => { s.grappleBoost += 0.12; } },
  { id: 'wall+', name: 'WALL BOOST', desc: 'Wall-run 0.6 s longer', icon: '▐', max: 2, apply: (s) => { s.wallRunTime += 0.6; } },
  { id: 'swift', name: 'SWIFT', desc: '+8% run speed', icon: '➤', max: 3, apply: (s) => { s.speedMult *= 1.08; } },
  { id: 'feather', name: 'FEATHER', desc: 'Higher jump, longer coyote time', icon: '✧', max: 2, apply: (s) => { s.jumpMult *= 1.06; s.coyoteBonus += 0.08; } },
  { id: 'flowkeep', name: 'FLOW KEEPER', desc: 'FLOW decays 30% slower', icon: '∞', max: 2, apply: (s) => { s.flowDecayMult *= 1.3; } },
  { id: 'magnet', name: 'ENERGY MAGNET', desc: 'Pull in energy from further away', icon: '◎', max: 2, apply: (s) => { s.magnetRadius += 1.4; } },
  { id: 'shield', name: 'RIFT SHIELD', desc: 'Survive the Rift once per run', icon: '⬡', max: 1, apply: (s) => { s.riftShield += 1; } },
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

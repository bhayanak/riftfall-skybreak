import type { Save } from './Save';

/**
 * Three active missions at a time, drawn from a pool in a fixed order; completing one pays coins and pulls the
 * next. `run` missions reset their progress every run; `life` missions accumulate across runs (from the profile's
 * lifetime counters). Metrics are fed by the game via count()/set().
 */
export interface Mission {
  id: string;
  text: string;
  metric: string;
  target: number;
  scope: 'run' | 'life';
  reward: number;
}

export const MISSIONS: Mission[] = [
  { id: 'm.coins60', text: 'Collect 60 coins in one run', metric: 'coins', target: 60, scope: 'run', reward: 40 },
  { id: 'm.stages3', text: 'Clear 3 stages in one run', metric: 'stages', target: 3, scope: 'run', reward: 50 },
  { id: 'm.slide5', text: 'Slide under 5 gates in one run', metric: 'gates', target: 5, scope: 'run', reward: 40 },
  { id: 'm.wall8', text: 'Wall-run 8 times in one run', metric: 'wallruns', target: 8, scope: 'run', reward: 40 },
  { id: 'm.flow5', text: 'Reach FLOW x5', metric: 'flow', target: 5, scope: 'run', reward: 40 },
  { id: 'm.star1', text: 'Find a hidden star', metric: 'stars', target: 1, scope: 'run', reward: 40 },
  { id: 'm.grapple6', text: 'Grapple 6 times in one run', metric: 'grapples', target: 6, scope: 'run', reward: 40 },
  { id: 'm.nofall', text: 'Clear a stage without falling', metric: 'cleanstage', target: 1, scope: 'run', reward: 50 },
  { id: 'm.dist1500', text: 'Run 1,500 m in one run', metric: 'distance', target: 1500, scope: 'run', reward: 60 },
  { id: 'm.djump15', text: 'Double-jump 15 times in one run', metric: 'djumps', target: 15, scope: 'run', reward: 30 },
  { id: 'm.sky40', text: 'Clear Sky Ruins in under 40 s', metric: 'sky40', target: 1, scope: 'run', reward: 60 },
  { id: 'm.stages6', text: 'Clear 6 stages in one run', metric: 'stages', target: 6, scope: 'run', reward: 90 },
  { id: 'm.coins300', text: 'Collect 300 coins in total', metric: 'coins', target: 300, scope: 'life', reward: 60 },
  { id: 'm.stars3', text: 'Find 3 hidden stars', metric: 'stars', target: 3, scope: 'life', reward: 90 },
  { id: 'm.daily', text: 'Play a daily route', metric: 'dailies', target: 1, scope: 'life', reward: 50 },
  { id: 'm.titan', text: 'Reach the Rift Titan (stage 4)', metric: 'stages', target: 4, scope: 'run', reward: 80 },
  { id: 'm.dash30', text: 'Dash 30 times in total', metric: 'dashes', target: 30, scope: 'life', reward: 40 },
  { id: 'm.stages20', text: 'Clear 20 stages in total', metric: 'stages', target: 20, scope: 'life', reward: 100 },
  { id: 'm.escape', text: 'Escape the Rift', metric: 'escapes', target: 1, scope: 'run', reward: 200 },
  { id: 'm.stars8', text: 'Find 8 hidden stars', metric: 'stars', target: 8, scope: 'life', reward: 150 },
  { id: 'm.coins150run', text: 'Collect 150 coins in one run', metric: 'coins', target: 150, scope: 'run', reward: 80 },
  { id: 'm.stages12', text: 'Clear all 12 stages in one run', metric: 'stages', target: 12, scope: 'run', reward: 250 },
];

export interface MissionView { m: Mission; progress: number; done: boolean }

export class Missions {
  private run: Record<string, number> = {};
  /** Called with the mission and its reward when one completes (already paid). */
  onComplete: ((m: Mission) => void) | null = null;

  constructor(private save: Save) {
    this.fill();
  }

  /** Top up to three active missions from the pool, skipping finished ones. */
  private fill(): void {
    const st = this.save.data.missions;
    while (st.active.length < 3 && st.cursor < MISSIONS.length) {
      const m = MISSIONS[st.cursor++];
      if (!st.done.includes(m.id)) st.active.push({ id: m.id, progress: 0 });
    }
  }

  newRun(): void { this.run = {}; }

  /** Add to a metric (run counter + lifetime counter), then check the active missions. */
  count(metric: string, n = 1): void {
    this.run[metric] = (this.run[metric] ?? 0) + n;
    this.save.addLife(metric, n);
    this.check();
  }

  /** Set a run metric to a value if higher (distance, flow level, stages). */
  set(metric: string, value: number): void {
    if (value <= (this.run[metric] ?? 0)) return;
    const delta = value - (this.run[metric] ?? 0);
    this.run[metric] = value;
    if (metric === 'stages') this.save.addLife(metric, delta);   // lifetime stages = total cleared
    this.check();
  }

  progressOf(m: Mission): number {
    return m.scope === 'run' ? (this.run[m.metric] ?? 0) : (this.save.data.life[m.metric] ?? 0);
  }

  view(): MissionView[] {
    this.fill();   // the profile may have been replaced by a platform merge since construction
    return this.save.data.missions.active.map((a) => {
      const m = MISSIONS.find((x) => x.id === a.id)!;
      const p = Math.min(m.target, this.progressOf(m));
      return { m, progress: p, done: false };
    });
  }

  get completedCount(): number { return this.save.data.missions.completed; }

  private check(): void {
    this.fill();
    const st = this.save.data.missions;
    let changed = false;
    for (const a of [...st.active]) {
      const m = MISSIONS.find((x) => x.id === a.id);
      if (!m) { st.active = st.active.filter((x) => x !== a); changed = true; continue; }
      if (this.progressOf(m) >= m.target) {
        st.active = st.active.filter((x) => x !== a);
        st.done.push(m.id);
        st.completed++;
        this.save.bankCoins(m.reward);
        changed = true;
        this.onComplete?.(m);
      }
    }
    if (changed) { this.fill(); this.save.flush(); }
  }
}

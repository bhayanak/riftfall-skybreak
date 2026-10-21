import { SHOP } from './Shop';

/** Best time / most coins on one campaign stage, and how often it was cleared. */
export interface StageRecord { bestTime: number; bestCoins: number; clears: number }

/**
 * Persistent profile. Coins are banked at the end of every stage (portal, death or quit), never lost.
 * Records: per stage (fastest clear, most coins), per run (distance, stages, coins, fastest escape), lifetime totals.
 */
export interface SaveData {
  bestDistance: number;
  /** most coins earned in a single run */
  bestEnergy: number;
  /** most stages cleared in a single run */
  bestStage: number;
  runs: number;
  wins: number;
  /** fastest full campaign escape in seconds (0 = never) */
  bestRunTime: number;
  totalCoins: number;
  totalDistance: number;
  totalTime: number;
  stages: Record<string, StageRecord>;
  muted: boolean;
  coins: number;
  owned: string[];
  suit: string;
  trail: string;
}

const KEY = 'riftfall.save.v1';
const DEFAULTS: SaveData = {
  bestDistance: 0, bestEnergy: 0, bestStage: 0, runs: 0, wins: 0, bestRunTime: 0, totalCoins: 0, totalDistance: 0, totalTime: 0, stages: {},
  muted: false, coins: 0, owned: ['suit.skyrunner', 'trail.biome'], suit: 'suit.skyrunner', trail: 'trail.biome',
};

interface Storage { getItem(k: string): string | null; setItem(k: string, v: string): void }

export interface RunResult { distance: number; stages: number; coins: number; time: number; won: boolean }

export class Save {
  data: SaveData = { ...DEFAULTS, owned: [...DEFAULTS.owned], stages: {} };
  private store: Storage | null = null;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
    } catch { /* private mode / blocked */ }
    this.grantStageItems();
  }

  /** Switch to platform storage (CrazyGames data module) and merge whatever it holds. */
  attach(store: Storage): void {
    this.store = store;
    try {
      const raw = store.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<SaveData>;
        const a = this.data;
        const stages: Record<string, StageRecord> = { ...a.stages };
        for (const [k, r] of Object.entries(d.stages ?? {})) {
          const cur = stages[k];
          stages[k] = cur ? { bestTime: Math.min(cur.bestTime, r.bestTime), bestCoins: Math.max(cur.bestCoins, r.bestCoins), clears: Math.max(cur.clears, r.clears) } : r;
        }
        this.data = {
          bestDistance: Math.max(a.bestDistance, d.bestDistance ?? 0), bestEnergy: Math.max(a.bestEnergy, d.bestEnergy ?? 0),
          bestStage: Math.max(a.bestStage, d.bestStage ?? 0), runs: Math.max(a.runs, d.runs ?? 0), wins: Math.max(a.wins, d.wins ?? 0),
          bestRunTime: a.bestRunTime && d.bestRunTime ? Math.min(a.bestRunTime, d.bestRunTime) : a.bestRunTime || d.bestRunTime || 0,
          totalCoins: Math.max(a.totalCoins, d.totalCoins ?? 0), totalDistance: Math.max(a.totalDistance, d.totalDistance ?? 0), totalTime: Math.max(a.totalTime, d.totalTime ?? 0),
          stages, muted: d.muted ?? a.muted,
          coins: Math.max(a.coins, d.coins ?? 0), owned: [...new Set([...a.owned, ...(d.owned ?? [])])],
          suit: d.suit ?? a.suit, trail: d.trail ?? a.trail,
        };
        this.grantStageItems();
      }
    } catch { /* ignore */ }
  }

  /** Coins earned in a stage go straight to the wallet (portal, death or quit). */
  bankCoins(n: number): void {
    n = Math.max(0, Math.round(n));
    if (!n) return;
    this.data.coins += n;
    this.data.totalCoins += n;
    this.flush();
  }

  /** A campaign stage was cleared; returns which stage records fell. */
  recordStage(stage: number, time: number, coins: number): { bestTime: boolean; bestCoins: boolean; first: boolean } {
    const k = String(stage);
    const cur = this.data.stages[k];
    const out = { bestTime: !cur || time < cur.bestTime, bestCoins: !cur || coins > cur.bestCoins, first: !cur };
    this.data.stages[k] = { bestTime: cur ? Math.min(cur.bestTime, time) : time, bestCoins: cur ? Math.max(cur.bestCoins, coins) : coins, clears: (cur?.clears ?? 0) + 1 };
    this.flush();
    return out;
  }

  /** A run ended (death, quit or escape). Max-merges the run records, adds to the totals; returns what was beaten. */
  recordRun(r: RunResult): { distance: boolean; stages: boolean; coins: boolean; time: boolean; unlocked: string[] } {
    const d = this.data;
    const beat = {
      distance: r.distance > d.bestDistance, stages: r.stages > d.bestStage, coins: r.coins > d.bestEnergy,
      time: r.won && (d.bestRunTime === 0 || r.time < d.bestRunTime), unlocked: [] as string[],
    };
    d.bestDistance = Math.max(d.bestDistance, Math.round(r.distance));
    d.bestEnergy = Math.max(d.bestEnergy, Math.round(r.coins));
    d.bestStage = Math.max(d.bestStage, r.stages);
    if (beat.time) d.bestRunTime = r.time;
    d.runs++;
    if (r.won) d.wins++;
    d.totalDistance += Math.round(r.distance);
    d.totalTime += r.time;
    beat.unlocked = this.grantStageItems();
    this.flush();
    return beat;
  }

  /** Endless play after an escape: the run is already counted; only extend bests and totals. */
  extendRun(distance: number, stages: number, addDistance: number, addTime: number): void {
    const d = this.data;
    d.bestDistance = Math.max(d.bestDistance, Math.round(distance));
    d.bestStage = Math.max(d.bestStage, stages);
    d.totalDistance += Math.round(addDistance);
    d.totalTime += addTime;
    this.flush();
  }

  owns(id: string): boolean { return this.data.owned.includes(id); }

  /** Spend coins on an item; false if unaffordable or already owned. */
  buy(id: string, price: number): boolean {
    if (this.owns(id) || this.data.coins < price) return false;
    this.data.coins -= price;
    this.data.owned.push(id);
    this.flush();
    return true;
  }

  equip(kind: 'suit' | 'trail', id: string): void {
    if (!this.owns(id)) return;
    this.data[kind] = id;
    this.flush();
  }

  /** Suits tied to a stage milestone become owned once that stage is reached. Returns newly granted ids. */
  private grantStageItems(): string[] {
    const out: string[] = [];
    for (const it of SHOP) {
      if (it.unlockStage !== undefined && this.data.bestStage >= it.unlockStage && !this.owns(it.id)) { this.data.owned.push(it.id); out.push(it.id); }
    }
    return out;
  }

  setMuted(m: boolean): void { this.data.muted = m; this.flush(); }

  private flush(): void {
    try { (this.store ?? localStorage).setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }
}

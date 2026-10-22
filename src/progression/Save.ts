import { MARKET, type GearSlot } from './Market';

/** Best time / most coins on one campaign stage, how often it was cleared, and whether its star was found. */
export interface StageRecord { bestTime: number; bestCoins: number; clears: number; star?: boolean }

export interface MissionState { id: string; progress: number }

/**
 * Persistent profile (v2). Coins are banked at the end of every stage (portal, death or quit), never lost.
 * Records: per stage (fastest clear, most coins, star), per run (distance, stages, coins, fastest escape), lifetime.
 */
export interface SaveData {
  v: 2;
  bestDistance: number;
  bestEnergy: number;        // most coins in one run
  bestStage: number;         // most stages cleared in one run
  runs: number;
  wins: number;
  bestRunTime: number;       // fastest escape (0 = never)
  totalCoins: number;
  totalDistance: number;
  totalTime: number;
  totalStars: number;
  dailies: number;           // daily routes started
  dailyBest: { date: string; time: number; stages: number } | null;
  stages: Record<string, StageRecord>;
  /** lifetime counters for missions: slides, wallruns, grapples, djumps, dashes ... */
  life: Record<string, number>;
  missions: { active: MissionState[]; done: string[]; cursor: number; completed: number };
  muted: boolean;
  coins: number;
  owned: string[];
  powers: Record<string, number>;
  suit: string;
  hair: string;
  gear: Record<GearSlot, string>;
  trail: string;
}

const KEY = 'riftfall.save.v2';
const OLD_KEY = 'riftfall.save.v1';
/** v1 paid 10 coins x FLOW per pickup; v2 pays 1. Old wallets are rescaled so bought items keep their relative worth. */
const V1_SCALE = 1 / 25;

const DEFAULTS = (): SaveData => ({
  v: 2, bestDistance: 0, bestEnergy: 0, bestStage: 0, runs: 0, wins: 0, bestRunTime: 0, totalCoins: 0, totalDistance: 0, totalTime: 0, totalStars: 0,
  dailies: 0, dailyBest: null, stages: {}, life: {}, missions: { active: [], done: [], cursor: 0, completed: 0 },
  muted: false, coins: 0, owned: ['suit.skyrunner', 'hair.parted', 'hair.none', 'gear.none.back', 'gear.none.head', 'gear.none.face', 'trail.biome'], powers: {},
  suit: 'suit.skyrunner', hair: 'hair.parted', gear: { back: 'gear.none.back', head: 'gear.none.head', face: 'gear.none.face' }, trail: 'trail.biome',
});

interface Storage { getItem(k: string): string | null; setItem(k: string, v: string): void }

export interface RunResult { distance: number; stages: number; coins: number; time: number; won: boolean }

export class Save {
  data: SaveData = DEFAULTS();
  private store: Storage | null = null;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(DEFAULTS(), JSON.parse(raw));
      else {
        const old = localStorage.getItem(OLD_KEY);
        if (old) { this.data = fromV1(JSON.parse(old)); this.flush(); }
      }
    } catch { /* private mode / blocked */ }
    this.grantStageItems();
  }

  /** Switch to platform storage (CrazyGames data module) and merge whatever it holds. */
  attach(store: Storage): void {
    this.store = store;
    try {
      const raw = store.getItem(KEY);
      if (raw) { this.data = merge(this.data, JSON.parse(raw)); this.grantStageItems(); this.flush(); }
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
    this.data.stages[k] = { ...cur, bestTime: cur ? Math.min(cur.bestTime, time) : time, bestCoins: cur ? Math.max(cur.bestCoins, coins) : coins, clears: (cur?.clears ?? 0) + 1 };
    this.flush();
    return out;
  }

  /** A hidden star was picked up on `stage`; true if it is the first time for that stage. */
  recordStar(stage: number): boolean {
    const k = String(stage);
    const cur = this.data.stages[k] ?? { bestTime: 0, bestCoins: 0, clears: 0 };
    const first = !cur.star;
    this.data.stages[k] = { ...cur, star: true };
    this.data.totalStars++;
    this.flush();
    return first;
  }

  /** A run ended (death, quit or escape). Max-merges the run records, adds to the totals; returns what was beaten. */
  recordRun(r: RunResult, daily: string | null): { distance: boolean; stages: boolean; coins: boolean; time: boolean; dailyBest: boolean; unlocked: string[] } {
    const d = this.data;
    const beat = {
      distance: r.distance > d.bestDistance, stages: r.stages > d.bestStage, coins: r.coins > d.bestEnergy,
      time: r.won && (d.bestRunTime === 0 || r.time < d.bestRunTime), dailyBest: false, unlocked: [] as string[],
    };
    d.bestDistance = Math.max(d.bestDistance, Math.round(r.distance));
    d.bestEnergy = Math.max(d.bestEnergy, Math.round(r.coins));
    d.bestStage = Math.max(d.bestStage, r.stages);
    if (beat.time) d.bestRunTime = r.time;
    d.runs++;
    if (r.won) d.wins++;
    d.totalDistance += Math.round(r.distance);
    d.totalTime += r.time;
    if (daily) {
      const cur = d.dailyBest?.date === daily ? d.dailyBest : null;
      const better = !cur || r.stages > cur.stages || (r.stages === cur.stages && r.won && r.time < cur.time);
      if (better) { d.dailyBest = { date: daily, time: r.time, stages: r.stages }; beat.dailyBest = true; }
    }
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

  addLife(metric: string, n = 1): void { this.data.life[metric] = (this.data.life[metric] ?? 0) + n; }

  owns(id: string): boolean { return this.data.owned.includes(id); }
  level(id: string): number { return this.data.powers[id] ?? 0; }

  /** Spend coins on a cosmetic, or on the next level of a power; false if unaffordable. */
  buy(id: string, price: number, power = false): boolean {
    if (this.data.coins < price) return false;
    if (power) this.data.powers[id] = this.level(id) + 1;
    else { if (this.owns(id)) return false; this.data.owned.push(id); }
    this.data.coins -= price;
    this.flush();
    return true;
  }

  equip(kind: 'suit' | 'hair' | 'trail', id: string): void {
    if (!this.owns(id)) return;
    this.data[kind] = id;
    this.flush();
  }
  equipGear(slot: GearSlot, id: string): void {
    if (!this.owns(id)) return;
    this.data.gear[slot] = id;
    this.flush();
  }

  /** Suits tied to a stage milestone become owned once that stage is reached. Returns newly granted ids. */
  private grantStageItems(): string[] {
    const out: string[] = [];
    for (const it of MARKET) {
      if (it.unlockStage !== undefined && this.data.bestStage >= it.unlockStage && !this.owns(it.id)) { this.data.owned.push(it.id); out.push(it.id); }
    }
    return out;
  }

  setMuted(m: boolean): void { this.data.muted = m; this.flush(); }

  flush(): void {
    try { (this.store ?? localStorage).setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }
}

/** Union two profiles: bests win, totals max, collections union, equipment from `b` when valid. */
function merge(a: SaveData, b: Partial<SaveData>): SaveData {
  const stages: Record<string, StageRecord> = { ...a.stages };
  for (const [k, r] of Object.entries(b.stages ?? {})) {
    const cur = stages[k];
    stages[k] = cur ? { bestTime: Math.min(cur.bestTime || Infinity, r.bestTime || Infinity) || 0, bestCoins: Math.max(cur.bestCoins, r.bestCoins), clears: Math.max(cur.clears, r.clears), star: cur.star || r.star } : r;
  }
  const life: Record<string, number> = { ...a.life };
  for (const [k, v] of Object.entries(b.life ?? {})) life[k] = Math.max(life[k] ?? 0, v);
  const powers: Record<string, number> = { ...a.powers };
  for (const [k, v] of Object.entries(b.powers ?? {})) powers[k] = Math.max(powers[k] ?? 0, v);
  const mx = (k: keyof SaveData) => Math.max((a[k] as number) ?? 0, (b[k] as number) ?? 0);
  const out: SaveData = {
    ...a,
    bestDistance: mx('bestDistance'), bestEnergy: mx('bestEnergy'), bestStage: mx('bestStage'), runs: mx('runs'), wins: mx('wins'),
    bestRunTime: a.bestRunTime && b.bestRunTime ? Math.min(a.bestRunTime, b.bestRunTime) : a.bestRunTime || b.bestRunTime || 0,
    totalCoins: mx('totalCoins'), totalDistance: mx('totalDistance'), totalTime: mx('totalTime'), totalStars: mx('totalStars'), dailies: mx('dailies'),
    dailyBest: b.dailyBest ?? a.dailyBest, stages, life,
    missions: b.missions ?? a.missions,
    muted: b.muted ?? a.muted, coins: mx('coins'), owned: [...new Set([...a.owned, ...(b.owned ?? [])])], powers,
    suit: b.suit ?? a.suit, hair: b.hair ?? a.hair, gear: { ...a.gear, ...(b.gear ?? {}) }, trail: b.trail ?? a.trail,
  };
  for (const k of ['suit', 'hair', 'trail'] as const) if (!out.owned.includes(out[k])) out[k] = a[k];
  return out;
}

/** v1 -> v2: rescale the inflated economy, turn owned powers into level 1, keep cosmetics and records. */
function fromV1(o: Record<string, unknown>): SaveData {
  const d = DEFAULTS();
  const n = (k: string) => (typeof o[k] === 'number' ? (o[k] as number) : 0);
  const owned = Array.isArray(o.owned) ? (o.owned as string[]) : [];
  d.bestDistance = n('bestDistance'); d.bestStage = n('bestStage'); d.runs = n('runs'); d.wins = n('wins'); d.bestRunTime = n('bestRunTime');
  d.totalDistance = n('totalDistance'); d.totalTime = n('totalTime');
  d.coins = Math.round(n('coins') * V1_SCALE); d.bestEnergy = Math.round(n('bestEnergy') * V1_SCALE); d.totalCoins = Math.round(n('totalCoins') * V1_SCALE);
  for (const [k, r] of Object.entries((o.stages as Record<string, StageRecord>) ?? {})) d.stages[k] = { bestTime: r.bestTime, bestCoins: Math.round(r.bestCoins * V1_SCALE), clears: r.clears };
  for (const id of owned) {
    if (id.startsWith('power.')) d.powers[id] = 1;
    else if (!d.owned.includes(id)) d.owned.push(id);
  }
  if (typeof o.suit === 'string' && d.owned.includes(o.suit)) d.suit = o.suit;
  if (typeof o.trail === 'string' && d.owned.includes(o.trail)) d.trail = o.trail;
  d.muted = !!o.muted;
  return d;
}

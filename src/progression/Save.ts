import { SHOP } from './Shop';

/** Tiny localStorage save: best run, totals, wallet and wardrobe. Fails silently where storage is blocked. */
export interface SaveData {
  bestDistance: number;
  bestEnergy: number;
  bestStage: number;
  runs: number;
  muted: boolean;
  coins: number;
  owned: string[];
  suit: string;
  trail: string;
}

const KEY = 'riftfall.save.v1';
const DEFAULTS: SaveData = { bestDistance: 0, bestEnergy: 0, bestStage: 0, runs: 0, muted: false, coins: 0, owned: ['suit.skyrunner', 'trail.biome'], suit: 'suit.skyrunner', trail: 'trail.biome' };

interface Storage { getItem(k: string): string | null; setItem(k: string, v: string): void }

export class Save {
  data: SaveData = { ...DEFAULTS, owned: [...DEFAULTS.owned] };
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
        this.data = {
          bestDistance: Math.max(this.data.bestDistance, d.bestDistance ?? 0), bestEnergy: Math.max(this.data.bestEnergy, d.bestEnergy ?? 0),
          bestStage: Math.max(this.data.bestStage, d.bestStage ?? 0), runs: Math.max(this.data.runs, d.runs ?? 0), muted: d.muted ?? this.data.muted,
          coins: Math.max(this.data.coins, d.coins ?? 0), owned: [...new Set([...this.data.owned, ...(d.owned ?? [])])],
          suit: d.suit ?? this.data.suit, trail: d.trail ?? this.data.trail,
        };
        this.grantStageItems();
      }
    } catch { /* ignore */ }
  }

  /** Records a finished run and banks its energy as coins; returns which records were beaten. */
  recordRun(distance: number, energy: number, stage: number): { distance: boolean; energy: boolean; stage: boolean; unlocked: string[] } {
    const d = this.data;
    const beat = { distance: distance > d.bestDistance, energy: energy > d.bestEnergy, stage: stage > d.bestStage, unlocked: [] as string[] };
    d.bestDistance = Math.max(d.bestDistance, Math.round(distance));
    d.bestEnergy = Math.max(d.bestEnergy, Math.round(energy));
    d.bestStage = Math.max(d.bestStage, stage);
    d.runs++;
    d.coins += Math.max(0, Math.round(energy));
    beat.unlocked = this.grantStageItems();
    this.flush();
    return beat;
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

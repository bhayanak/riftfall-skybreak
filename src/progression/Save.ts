/** Tiny localStorage save: best run + totals. Fails silently where storage is blocked. */
export interface SaveData {
  bestDistance: number;
  bestEnergy: number;
  bestStage: number;
  runs: number;
  muted: boolean;
}

const KEY = 'riftfall.save.v1';

interface Storage { getItem(k: string): string | null; setItem(k: string, v: string): void }

export class Save {
  data: SaveData = { bestDistance: 0, bestEnergy: 0, bestStage: 0, runs: 0, muted: false };
  private store: Storage | null = null;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
    } catch { /* private mode / blocked */ }
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
        };
      }
    } catch { /* ignore */ }
  }

  /** Records a finished run; returns which records were beaten. */
  recordRun(distance: number, energy: number, stage: number): { distance: boolean; energy: boolean; stage: boolean } {
    const d = this.data;
    const beat = { distance: distance > d.bestDistance, energy: energy > d.bestEnergy, stage: stage > d.bestStage };
    d.bestDistance = Math.max(d.bestDistance, Math.round(distance));
    d.bestEnergy = Math.max(d.bestEnergy, Math.round(energy));
    d.bestStage = Math.max(d.bestStage, stage);
    d.runs++;
    this.flush();
    return beat;
  }

  setMuted(m: boolean): void { this.data.muted = m; this.flush(); }

  private flush(): void {
    try { (this.store ?? localStorage).setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }
}

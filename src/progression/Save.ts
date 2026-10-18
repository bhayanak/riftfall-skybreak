/** Tiny localStorage save: best run + totals. Fails silently where storage is blocked. */
export interface SaveData {
  bestDistance: number;
  bestEnergy: number;
  bestStage: number;
  runs: number;
  muted: boolean;
}

const KEY = 'riftfall.save.v1';

export class Save {
  data: SaveData = { bestDistance: 0, bestEnergy: 0, bestStage: 0, runs: 0, muted: false };

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
    } catch { /* private mode / blocked */ }
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
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }
}

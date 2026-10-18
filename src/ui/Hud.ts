export class Hud {
  private flow = document.getElementById('flow')!;
  private flowMult = document.getElementById('flow-mult')!;
  private flowBar = document.querySelector<HTMLElement>('#flow-bar i')!;
  private energy = document.getElementById('energy-val')!;
  private biome = document.getElementById('biome')!;
  private rift = document.getElementById('rift')!;
  private riftVal = document.getElementById('rift-val')!;
  private hint = document.getElementById('hint')!;
  private debug = document.getElementById('debug') as HTMLPreElement;
  private hintTimer = 0;
  private lastFlow = -1;
  private lastEnergy = -1;
  private lastRift = -999;

  setFlow(mult: number, progress01: number): void {
    if (mult !== this.lastFlow) { this.flowMult.textContent = `x${mult}`; this.lastFlow = mult; this.flow.classList.toggle('hot', mult >= 4); }
    this.flowBar.style.width = `${Math.round(progress01 * 100)}%`;
  }

  setBiome(name: string): void { this.biome.textContent = name; }

  setRift(distance: number): void {
    const d = Math.max(0, Math.round(distance));
    if (d !== this.lastRift) { this.riftVal.textContent = `${d} m`; this.lastRift = d; this.rift.classList.toggle('close', d < 15); }
  }

  setEnergy(v: number): void {
    if (v !== this.lastEnergy) { this.energy.textContent = String(v); this.lastEnergy = v; }
  }

  showHint(text: string, seconds = 3): void {
    this.hint.textContent = text;
    this.hint.style.opacity = '1';
    this.hintTimer = seconds;
  }

  update(dt: number): void {
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hint.style.opacity = '0.55';
    }
  }

  toggleDebug(): boolean { this.debug.hidden = !this.debug.hidden; return !this.debug.hidden; }
  get debugVisible(): boolean { return !this.debug.hidden; }
  setDebug(text: string): void { this.debug.textContent = text; }
}

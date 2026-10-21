export class Hud {
  private flow = document.getElementById('flow')!;
  private flowMult = document.getElementById('flow-mult')!;
  private flowBar = document.querySelector<HTMLElement>('#flow-bar i')!;
  private energy = document.getElementById('energy-val')!;
  private biome = document.getElementById('biome')!;
  private rift = document.getElementById('rift')!;
  private riftVal = document.getElementById('rift-val')!;
  private hint = document.getElementById('hint')!;
  private prompt = document.getElementById('prompt')!;
  private debug = document.getElementById('debug') as HTMLPreElement;
  private hintTimer = 0;
  private lastFlow = -1;
  private lastEnergy = -1;
  private lastRift = -999;
  private promptShown = false;
  private timer = document.getElementById('timer')!;
  private lastTimer = '';
  /** Wired by the game: the top-right pause button (the only way to pause on touch). */
  onPause: (() => void) | null = null;

  constructor() {
    const b = document.getElementById('btn-pause');
    b?.addEventListener('click', (e) => { e.preventDefault(); this.onPause?.(); });
    b?.addEventListener('touchstart', (e) => { e.preventDefault(); this.onPause?.(); }, { passive: false });
  }

  setTimer(seconds: number): void {
    const t = fmtTime(seconds);
    if (t !== this.lastTimer) { this.timer.textContent = t; this.lastTimer = t; }
  }

  /** Hide the whole HUD (title screen). */
  setVisible(v: boolean): void {
    const hud = document.getElementById('hud');
    if (hud) hud.style.opacity = v ? '' : '0';
  }

  setPrompt(text: string | null): void {
    const show = !!text;
    if (show !== this.promptShown) { this.prompt.hidden = !show; this.promptShown = show; }
    if (text && this.prompt.textContent !== text) this.prompt.textContent = text;
  }

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

/** m:ss.d */
export function fmtTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
}

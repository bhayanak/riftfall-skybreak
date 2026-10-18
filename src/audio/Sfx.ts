export type SfxName =
  | 'jump' | 'djump' | 'land' | 'land_hard' | 'dash' | 'wallrun' | 'grapple' | 'slide'
  | 'pickup' | 'flow_up' | 'portal' | 'death' | 'ui_select' | 'ui_confirm' | 'checkpoint';

/** Tiny Web Audio pool. Decodes once, plays overlapping one-shots with pitch variance. Unlocks on first gesture. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SfxName, AudioBuffer>();
  private master!: GainNode;
  private lastPlay = new Map<SfxName, number>();
  muted = false;
  /** Fired once the AudioContext exists (first user gesture). */
  onReady: ((ctx: AudioContext, master: GainNode) => void) | null = null;

  constructor(private base: string) {
    const unlock = () => {
      if (!this.ctx) { this.init(); this.onReady?.(this.ctx!, this.master); }
      this.ctx!.resume();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  private init(): void {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    const names: SfxName[] = ['jump', 'djump', 'land', 'land_hard', 'dash', 'wallrun', 'grapple', 'slide', 'pickup', 'flow_up', 'portal', 'death', 'ui_select', 'ui_confirm', 'checkpoint'];
    for (const n of names) {
      fetch(`${this.base}sfx/${n}.ogg`).then((r) => r.arrayBuffer()).then((b) => this.ctx!.decodeAudioData(b)).then((buf) => this.buffers.set(n, buf)).catch(() => {});
    }
  }

  play(name: SfxName, volume = 1, pitch = 1, minGap = 0.05): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlay.get(name) ?? -1) < minGap) return;
    const buf = this.buffers.get(name);
    if (!buf) return;
    this.lastPlay.set(name, now);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.master);
    src.start();
  }
}

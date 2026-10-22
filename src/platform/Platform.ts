/**
 * Thin platform layer over the CrazyGames SDK (v3). The SDK is loaded everywhere and asked which environment it is
 * in: `crazygames` (the site and its apps) and `local` (localhost: demo ads, console-logged events) are used;
 * `disabled` (any other host, e.g. GitHub Pages) makes every call here a no-op and saves fall back to localStorage.
 * SDK docs: https://docs.crazygames.com/sdk/intro/
 */
type AdCallbacks = { adStarted?(): void; adFinished?(): void; adError?(e: unknown): void };
interface CgSettings { muteAudio?: boolean; disableChat?: boolean }
interface CgSdk {
  init(): Promise<void>;
  environment: 'crazygames' | 'local' | 'disabled' | string;
  game: {
    gameplayStart(): void; gameplayStop(): void; happytime(): void; loadingStart(): void; loadingStop(): void;
    settings?: CgSettings;
    addSettingsChangeListener?(cb: (s: CgSettings) => void): void;
    reportGameCompletedPercentage?(pct: number): void;
    setGameContext?(ctx: Record<string, string | number | boolean>): void;
    clearGameContext?(): void;
  };
  ad: { requestAd(type: 'midgame' | 'rewarded', cb: AdCallbacks): void; hasAdblock?(): Promise<boolean> };
  data: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  user: { systemInfo?: { device?: { type?: string } } };
}
declare global { interface Window { CrazyGames?: { SDK: CgSdk } } }

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

export class Platform {
  private sdk: CgSdk | null = null;
  /** The site asked for silence (its own mute button). Wins over the in-game setting. */
  muteAudio = false;
  onMuteChange: ((muted: boolean) => void) | null = null;
  /** true when running inside CrazyGames (or its local test mode) with the SDK initialised */
  get isCrazyGames(): boolean { return !!this.sdk; }
  get environment(): string { return this.sdk?.environment ?? 'none'; }
  /** 'desktop' | 'mobile' | 'tablet' from the SDK's device detection, or null when unknown. */
  get deviceType(): string | null { return this.sdk?.user?.systemInfo?.device?.type ?? null; }

  /** Load + init the SDK; never throws, never takes longer than a few seconds. */
  async init(): Promise<void> {
    if (new URLSearchParams(location.search).has('nocg')) return;
    try {
      await withTimeout(new Promise<void>((res, rej) => {
        const s = document.createElement('script');
        s.src = SDK_URL;
        s.onload = () => res(); s.onerror = () => rej(new Error('sdk load failed'));
        document.head.appendChild(s);
      }), 6000);
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return;
      await withTimeout(sdk.init(), 6000);
      if (sdk.environment === 'disabled') return;
      this.sdk = sdk;
      this.muteAudio = !!sdk.game.settings?.muteAudio;
      sdk.game.addSettingsChangeListener?.((s) => { this.muteAudio = !!s.muteAudio; this.onMuteChange?.(this.muteAudio); });
      console.info(`[platform] CrazyGames SDK ready (${sdk.environment})`);
    } catch (e) {
      console.warn('[platform] CrazyGames SDK unavailable:', e);
      this.sdk = null;
    }
  }

  loadingStart(): void { this.call(() => this.sdk!.game.loadingStart()); }
  loadingStop(): void { this.call(() => this.sdk!.game.loadingStop()); }
  gameplayStart(): void { this.call(() => this.sdk!.game.gameplayStart()); }
  gameplayStop(): void { this.call(() => this.sdk!.game.gameplayStop()); }
  /** Call on genuinely good moments only (the site celebrates): a new furthest stage, an escape. */
  happytime(): void { this.call(() => this.sdk!.game.happytime()); }
  /** 0..100 campaign progress; 100 = escaped. */
  reportProgress(pct: number): void { this.call(() => this.sdk!.game.reportGameCompletedPercentage?.(Math.round(Math.max(0, Math.min(100, pct))))); }
  /** Attached to player feedback sent from the site. */
  setContext(ctx: Record<string, string | number | boolean>): void { this.call(() => this.sdk!.game.setGameContext?.(ctx)); }
  clearContext(): void { this.call(() => this.sdk!.game.clearGameContext?.()); }

  /**
   * Midgame ad at a natural break (stage cleared, run again). The SDK decides whether one is due; the game must be
   * paused and its UI blocked until this resolves. `onStart` mutes audio only once an ad actually plays, `onEnd`
   * restores it; both are skipped when there is no ad.
   */
  async midgame(onStart: () => void, onEnd: () => void): Promise<void> {
    if (!this.sdk) return;
    await new Promise<void>((res) => {
      let started = false, done = false;
      const finish = () => { if (done) return; done = true; if (started) onEnd(); res(); };
      // an ad that never reports back must not hang the game: give the auction a few seconds to start one
      const guard = setTimeout(() => { if (!started) finish(); }, 8000);
      try {
        this.sdk!.ad.requestAd('midgame', {
          adStarted: () => { started = true; clearTimeout(guard); onStart(); },
          adFinished: () => { clearTimeout(guard); finish(); },
          adError: () => { clearTimeout(guard); finish(); },
        });
      } catch { clearTimeout(guard); finish(); }
    });
  }

  getItem(key: string): string | null {
    try { return this.sdk ? this.sdk.data.getItem(key) : localStorage.getItem(key); } catch { return null; }
  }
  setItem(key: string, value: string): void {
    try { this.sdk ? this.sdk.data.setItem(key, value) : localStorage.setItem(key, value); } catch { /* blocked */ }
  }

  private call(fn: () => void): void {
    if (!this.sdk) return;
    try { fn(); } catch (e) { console.warn('[platform]', e); }
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new Error(`timeout after ${ms} ms`)), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}

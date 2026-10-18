/**
 * Thin platform layer. On CrazyGames the SDK (v3) is loaded and used for gameplay/ad/happytime signals and
 * cloud-ish saves; anywhere else every call is a no-op (or localStorage), so the game never depends on it.
 * SDK docs: https://docs.crazygames.com/sdk/html5-v3/
 */
interface CgSdk {
  init(): Promise<void>;
  game: { gameplayStart(): void; gameplayStop(): void; happytime(): void; loadingStart(): void; loadingStop(): void };
  ad: { requestAd(type: 'midgame' | 'rewarded', cb: { adStarted?(): void; adFinished?(): void; adError?(e: unknown): void }): void };
  data: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  environment: string;
}
declare global { interface Window { CrazyGames?: { SDK: CgSdk } } }

export class Platform {
  private sdk: CgSdk | null = null;
  private portals = 0;
  /** true when running inside CrazyGames (SDK initialised) */
  get isCrazyGames(): boolean { return !!this.sdk; }

  /** Load + init the SDK only where it makes sense (CrazyGames host, or ?cg for local testing). */
  async init(): Promise<void> {
    const wanted = /crazygames\./i.test(location.hostname) || new URLSearchParams(location.search).has('cg');
    if (!wanted) return;
    try {
      await new Promise<void>((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
        s.onload = () => res(); s.onerror = () => rej(new Error('sdk load failed'));
        document.head.appendChild(s);
      });
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return;
      await sdk.init();
      this.sdk = sdk;
    } catch (e) {
      console.warn('[platform] CrazyGames SDK unavailable:', e);
      this.sdk = null;
    }
  }

  loadingStart(): void { this.sdk?.game.loadingStart(); }
  loadingStop(): void { this.sdk?.game.loadingStop(); }
  gameplayStart(): void { this.sdk?.game.gameplayStart(); }
  gameplayStop(): void { this.sdk?.game.gameplayStop(); }
  /** Call on genuinely good moments (new record, boss escaped). */
  happytime(): void { this.sdk?.game.happytime(); }

  /**
   * Natural ad break: between stages, at most every third portal. Resolves when gameplay may resume;
   * the caller must mute audio and pause input for the duration (we pass callbacks for that).
   */
  async portalBreak(onPause: () => void, onResume: () => void): Promise<void> {
    this.portals++;
    if (!this.sdk || this.portals % 3 !== 0) return;
    await new Promise<void>((res) => {
      onPause();
      this.sdk!.ad.requestAd('midgame', {
        adFinished: () => { onResume(); res(); },
        adError: () => { onResume(); res(); },
      });
    });
  }

  getItem(key: string): string | null {
    try { return this.sdk ? this.sdk.data.getItem(key) : localStorage.getItem(key); } catch { return null; }
  }
  setItem(key: string, value: string): void {
    try { this.sdk ? this.sdk.data.setItem(key, value) : localStorage.setItem(key, value); } catch { /* blocked */ }
  }
}

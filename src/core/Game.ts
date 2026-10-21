import * as pc from 'playcanvas';
import { detectDevice, type DeviceInfo } from './Device';
import { Input } from './Input';
import { Assets } from './Assets';
import { CollisionWorld } from '../world/Colliders';
import { WorldGenerator } from '../world/WorldGenerator';
import { Rift } from '../world/Rift';
import { Titan } from '../world/Titan';
import { Rng } from '../world/Rng';
import { Player } from '../player/Player';
import { defaultStats } from '../player/Movement';
import { CameraRig } from '../graphics/CameraRig';
import { Environment, BIOMES, type BiomeId } from '../graphics/Environment';
import { VFX } from '../graphics/VFX';
import { FlowSystem } from '../progression/FlowSystem';
import { UpgradeDeck } from '../progression/Upgrade';
import { Sfx } from '../audio/Sfx';
import { Music } from '../audio/Music';
import { Save } from '../progression/Save';
import { SHOP, byId, type ShopItem } from '../progression/Shop';
import { Platform } from '../platform/Platform';
import { Hud } from '../ui/Hud';
import { TouchControls } from '../ui/TouchControls';
import { Overlays, type ShopController, type StageClearInfo } from '../ui/Overlays';

type Phase = 'loading' | 'menu' | 'playing' | 'portal' | 'upgrade' | 'dead';
const BIOME_ORDER: BiomeId[] = ['sky', 'fire', 'void'];
/** Stage at which the Rift Titan starts stalking the route. */
const TITAN_STAGE = 3;
/** A run is an escape across this many stages (3 loops of the 3 biomes); after that the player may keep running. */
const CAMPAIGN_STAGES = 9;
const ESCAPE_BONUS = 500;

/** Same route for everyone on a given UTC day. */
function dailySeed(): number {
  const d = new Date();
  let h = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % 1000000 + 1;
}

/** Seed from the URL (?seed=123 or ?daily), else random. */
function pickSeed(): { seed: number; daily: boolean } {
  const q = new URLSearchParams(location.search);
  if (q.has('daily')) return { seed: dailySeed(), daily: true };
  const s = Number(q.get('seed'));
  if (Number.isFinite(s) && s > 0) return { seed: s | 0, daily: false };
  return { seed: (Date.now() % 100000) | 0, daily: false };
}

/** Movement never reads from this: used to keep the player idle behind the title screen. */
const NO_INPUT = { move: { x: 0, y: 0 }, wasPressed: () => false, wasReleased: () => false, isHeld: () => false } as unknown as Input;

export class Game {
  readonly app: pc.AppBase;
  readonly device: DeviceInfo;
  readonly biomes = BIOMES;
  readonly input: Input;
  readonly assets: Assets;
  readonly world = new CollisionWorld();
  readonly hud = new Hud();
  readonly overlays = new Overlays();
  readonly flow = new FlowSystem();
  readonly deck = new UpgradeDeck();
  readonly sfx: Sfx;
  readonly music = new Music();
  readonly save = new Save();
  readonly platform = new Platform();
  player!: Player;
  camera!: CameraRig;
  env!: Environment;
  gen!: WorldGenerator;
  rift!: Rift;
  titan!: Titan;
  vfx!: VFX;

  phase: Phase = 'loading';
  seed: number;
  daily: boolean;
  stage = 0;              // 0 sky, 1 fire, 2 void, 3 sky(harder)...
  energy = 0;             // coins earned in the current stage, not yet banked
  distance = 0;           // total this run, across stages
  private distanceBase = 0;
  private runCoins = 0;        // banked this run (all stages)
  private runTotalTime = 0;    // seconds across stages
  private endless = false;     // past the campaign: no more stage records, no second victory
  private recordedAt = { distance: 0, time: 0 };   // what recordRun() already counted (endless extension)
  private checkpoint = 0;
  private runTime = 0;
  private started = false;     // player has moved; the Rift clock runs from here
  private riftGrace = 0;
  private runId = 0;
  private fps = 60; private fpsAcc = 0; private fpsFrames = 0;
  private drawCalls = 0;
  private seenHowTo = false;
  private helpOpen = false;
  private collapsing = false;
  private booted = false;

  private constructor(app: pc.AppBase, canvas: HTMLCanvasElement, device: DeviceInfo) {
    this.app = app;
    this.device = device;
    const s = pickSeed();
    this.seed = s.seed; this.daily = s.daily;
    this.input = new Input(canvas);
    const base = `${import.meta.env.BASE_URL}assets/`;
    this.assets = new Assets(app, base);
    this.sfx = new Sfx(base);
    this.sfx.muted = this.music.muted = this.save.data.muted;
    this.sfx.onReady = (ctx, master) => this.music.attach(ctx, master);
  }

  static async create(canvas: HTMLCanvasElement): Promise<Game> {
    const device = detectDevice();
    const wantGpu = device.hasWebGPU && new URLSearchParams(location.search).has('gpu');
    const gfx = await pc.createGraphicsDevice(canvas, {
      deviceTypes: wantGpu ? [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2] : [pc.DEVICETYPE_WEBGL2],
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    gfx.maxPixelRatio = device.maxPixelRatio;

    const opts = new pc.AppOptions();
    opts.graphicsDevice = gfx;
    opts.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem, pc.AnimComponentSystem];
    opts.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.RenderHandler, pc.MaterialHandler, pc.AnimClipHandler, pc.AnimStateGraphHandler];

    const app = new pc.AppBase(canvas);
    app.init(opts);
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener('resize', () => app.resizeCanvas());

    const game = new Game(app, canvas, device);
    app.on('update', (dt: number) => game.update(dt));
    app.on('frameend', () => { game.drawCalls = (gfx as pc.GraphicsDevice & { _drawCallsPerFrame?: number })._drawCallsPerFrame ?? 0; });
    app.start();
    await game.boot();
    return game;
  }

  private async boot(): Promise<void> {
    this.overlays.loading(0);
    this.platform.loadingStart();
    await Promise.all([this.platform.init(), this.assets.loadAll((d, t) => this.overlays.loading((d / t) * 0.8))]);
    this.save.attach(this.platform);
    this.sfx.muted = this.music.muted = this.save.data.muted;

    this.env = new Environment(this.app, this.assets, this.device);
    this.gen = new WorldGenerator(this.app, this.assets, this.world);
    this.rift = new Rift(this.app);
    this.titan = new Titan(this.app, this.assets);
    this.titan.onTelegraph = () => { this.hud.showHint('TITAN SLAM INCOMING — THE MARKED ISLAND WILL SINK', 2.5); this.sfx.play('land_hard', 0.5, 0.5); };
    this.titan.onSlam = (isl) => { this.gen.builder.slam(isl); this.camera.kick(1.2); this.sfx.play('land_hard', 1, 0.6); this.vfx.emit(new pc.Vec3(isl.x, isl.top + 0.5, isl.z), 40, 9, 0.5, 1.2, 1.5, 4); };
    this.vfx = new VFX(this.app, this.device.profile === 'mobile-low' ? 60 : 160);
    this.player = new Player(this.app, this.assets, this.world);
    this.applySuit();
    this.gen.builder.quality = this.device.profile === 'mobile-low' ? 0.5 : this.device.profile === 'mobile-high' ? 0.75 : 1;
    this.camera = new CameraRig(this.app, this.device.isMobile, this.world);
    this.env.attachPost(this.camera.entity.camera!);
    if (this.device.isTouch) new TouchControls(this.input);
    this.player.movement.anchorProvider = (pos, fwd, range) => this.gen.findAnchor(pos, fwd, range)?.pos ?? null;
    this.hud.onPause = () => void this.pause();
    this.input.onPointerLockLost = () => void this.pause();

    this.platform.loadingStop();
    await this.startRun(true, false);
    this.booted = true;
    void this.menu();   // the title loop lives as long as the page; create() must resolve now
  }

  // ------------------------------------------------------------------------------------ title / shop
  private bestLine(): string {
    const s = this.save.data;
    return `CLEARED ${s.bestStage} / ${CAMPAIGN_STAGES} · BEST ${s.bestDistance.toLocaleString()} m · ${s.wins} ESCAPE${s.wins === 1 ? '' : 'S'}`;
  }
  private stageName(i: number): string { return BIOMES[BIOME_ORDER[i % BIOME_ORDER.length]].name; }

  /** Title screen loop: play / daily toggle / wardrobe / controls. Returns when a run launches. */
  private async menu(): Promise<void> {
    this.phase = 'menu';
    this.hud.setVisible(false);
    for (;;) {
      const choice = await this.overlays.startScreen({ coins: this.save.data.coins, best: this.bestLine(), daily: this.daily, touch: this.device.isTouch });
      this.sfx.play('ui_select', 0.5);
      if (choice === 'play') break;
      if (choice === 'daily') {
        this.daily = !this.daily;
        this.seed = this.daily ? dailySeed() : (Date.now() % 100000) | 0;
        await this.startRun(true, false);
      } else if (choice === 'shop') {
        await this.overlays.shop(this.shopController(), this.device.isTouch);
      } else if (choice === 'stats') {
        await this.overlays.stats(this.save.data, CAMPAIGN_STAGES, (i) => this.stageName(i));
      } else {
        await this.overlays.howToPlay(this.device.isTouch);
        this.seenHowTo = true;
      }
    }
    this.sfx.play('ui_confirm', 0.8);
    this.hud.setVisible(true);
    this.launch();
  }

  private shopController(): ShopController {
    return {
      items: SHOP,
      coins: () => this.save.data.coins,
      status: (it) => {
        if (!this.save.owns(it.id)) return 'buy';
        const worn = it.kind === 'suit' ? this.save.data.suit : it.kind === 'trail' ? this.save.data.trail : null;
        return worn === null || worn === it.id ? 'equipped' : 'owned';
      },
      act: (it) => {
        if (!this.save.owns(it.id)) {
          if (!this.save.buy(it.id, it.price)) { this.sfx.play('ui_select', 0.5, 0.6); return `NEED ${(it.price - this.save.data.coins).toLocaleString()} MORE COINS — EARN THEM BY RUNNING`; }
          this.sfx.play('flow_up', 0.8, 1.1);
          if (it.kind === 'power') return `${it.name} IS NOW ACTIVE ON EVERY RUN`;
        } else this.sfx.play('ui_confirm', 0.6);
        if (it.kind === 'suit') { this.save.equip('suit', it.id); this.applySuit(); return `WEARING ${it.name}`; }
        if (it.kind === 'trail') { this.save.equip('trail', it.id); this.applyTrail(this.biome()); return `TRAIL: ${it.name}`; }
        return `${it.name} IS ACTIVE`;
      },
    };
  }

  private applySuit(): void {
    const it = byId(this.save.data.suit) ?? byId('suit.skyrunner')!;
    if (it.suit) this.player.setSuit(it.suit.suit, it.suit.accent);
  }
  private applyTrail(b: { rift: pc.Color }): void {
    const it = byId(this.save.data.trail);
    this.vfx.setColor(it?.trail ?? b.rift);
  }
  private ownedPowers(): ShopItem[] { return SHOP.filter((i) => i.kind === 'power' && this.save.owns(i.id)); }

  // ------------------------------------------------------------------------------------ run flow
  private biome() { return BIOMES[BIOME_ORDER[this.stage % BIOME_ORDER.length]]; }

  /** Build the stage. `launch` = start playing right away (portal transitions); false = sit behind the title screen. */
  private async startRun(fresh: boolean, launch = true): Promise<void> {
    this.phase = 'loading';
    const id = ++this.runId;
    if (fresh) {
      this.stage = 0; this.energy = 0; this.distance = 0; this.distanceBase = 0;
      this.runCoins = 0; this.runTotalTime = 0; this.endless = false; this.recordedAt = { distance: 0, time: 0 };
      this.player.movement.stats = defaultStats();
      for (const p of this.ownedPowers()) p.apply?.(this.player.movement.stats);
      this.deck.reset();
      this.flow.reset();
      // the URL / daily seed is used as-is for the first route; every later route is a fresh one
      if (!this.daily && this.booted) this.seed = (this.seed * 1103515245 + 12345) >>> 0;
    }
    const b = this.biome();
    this.overlays.loading(0.9);
    await this.env.setBiome(b.id);
    if (id !== this.runId) return;
    const difficulty = 0.6 + this.stage * 0.5;
    this.gen.generate(this.seed + this.stage * 7919, b, difficulty, 10 + Math.min(4, this.stage), this.stage);
    if (import.meta.env.DEV) {
      const bad = this.gen.violations();
      if (bad.length) console.warn('[route] edges harder than intended:', bad);
    }
    this.player.movement.killY = this.gen.lowestTop() - 30;
    this.rift.setColor(b.rift);
    this.applyTrail(b);
    this.titan.setColor(b.rift);
    if (this.stage >= TITAN_STAGE) this.titan.start(this.gen.spawn); else this.titan.stop();
    this.hud.setBiome(`${b.name} · ${this.endless ? `ENDLESS ${this.stage + 1}` : `STAGE ${this.stage + 1} / ${CAMPAIGN_STAGES}`}${this.daily ? ' · DAILY' : ''}`);
    this.hud.setTimer(0);
    this.flow.decayMult = this.player.movement.stats.flowDecayMult;
    this.checkpoint = 0;
    this.runTime = 0;
    this.started = false;
    this.riftGrace = 0;
    this.collapsing = false;
    this.player.movement.respawn(this.gen.spawn);
    this.player.movement.events.length = 0;
    this.camera.snapTo(this.gen.spawn, 0);
    this.rift.reset(this.gen.spawn.z + 55, 0);
    this.hud.setPrompt(null);
    if (!launch) { this.phase = 'menu'; return; }
    this.launch();
  }

  /** Hand control to the player for the stage that startRun() built. */
  private launch(): void {
    const b = this.biome();
    this.camera.menuMode = false;
    this.camera.snapTo(this.player.movement.position, 0);   // the title orbit leaves the yaw anywhere; face the route
    this.overlays.hide();
    this.phase = 'playing';
    this.platform.gameplayStart();
    if (!this.seenHowTo) { this.seenHowTo = true; void this.showHelp(); }
    else this.hud.showHint(this.stage === TITAN_STAGE ? `${b.name} · THE RIFT TITAN HAS FOUND YOU` : `${b.name} · THE RIFT IS BEHIND YOU — RUN`, 4);
  }

  /** Pauses the run and shows the controls card until dismissed. */
  private async showHelp(): Promise<void> {
    if (this.helpOpen) return;
    this.helpOpen = true;
    const id = this.runId;
    await this.overlays.howToPlay(this.device.isTouch);
    this.helpOpen = false;
    if (id !== this.runId) return;
    this.input.endFrame();
    this.hud.showHint(`${this.biome().name} · THE RIFT IS BEHIND YOU — RUN`, 4);
  }

  private respawnAtCheckpoint(): void {
    const cp = this.gen.checkpoints[this.checkpoint] ?? this.gen.checkpoints[0];
    this.player.movement.respawn(cp.spawn);
    this.camera.snapTo(cp.spawn, this.camera.yaw);
    // push the Rift back behind the checkpoint and bring back anything it already swallowed there
    this.rift.reset(Math.max(this.rift.z, cp.spawn.z + 32), this.rift.speed);
    this.gen.restoreAhead(this.rift.z);
    this.riftGrace = 1.5;
    this.energy = Math.max(0, this.energy - 25);
    this.flow.reset();
    this.camera.kick(0.8);
    this.sfx.play('death', 0.6, 1.4);
    this.hud.showHint('FELL · −25 COINS', 1.5);
  }

  /** Pause menu: resume / controls / quit to title (coins earned so far are banked). */
  private async pause(): Promise<void> {
    if (this.phase !== 'playing' || this.overlays.visible) return;
    const id = this.runId;
    this.platform.gameplayStop();
    for (;;) {
      const c = await this.overlays.pauseMenu({ stage: this.stage, total: CAMPAIGN_STAGES, endless: this.endless, coins: this.runCoins + this.energy, touch: this.device.isTouch });
      if (id !== this.runId) return;
      if (c === 'howto') { await this.overlays.howToPlay(this.device.isTouch); if (id !== this.runId) return; continue; }
      if (c === 'quit') { await this.endRun('COINS BANKED · BACK TO THE TITLE', true); return; }
      break;
    }
    this.input.endFrame();
    this.platform.gameplayStart();
  }

  /** Bank what this stage earned. Returns the amount. */
  private bankStage(): number {
    const n = Math.max(0, Math.round(this.energy));
    this.save.bankCoins(n);
    this.runCoins += n;
    this.energy = 0;
    return n;
  }

  /** The run is over (death or quit): bank, record, show the summary, then run again or go to the title. */
  private async endRun(reason: string, quit: boolean): Promise<void> {
    const id = this.runId;
    this.phase = 'dead';
    this.platform.gameplayStop();
    this.bankStage();
    let record = '';
    if (!this.endless) {
      const beat = this.save.recordRun({ distance: this.distance, stages: this.stage, coins: this.runCoins, time: this.runTotalTime, won: false });
      if (beat.distance || beat.stages) this.platform.happytime();
      const newSuit = beat.unlocked.map((u) => byId(u)?.name).filter(Boolean)[0] ?? '';
      record = newSuit ? `NEW SUIT UNLOCKED — ${newSuit}` : beat.distance ? 'NEW DISTANCE RECORD' : beat.stages ? 'NEW STAGE RECORD' : beat.coins ? 'MOST COINS IN A RUN' : '';
    } else {
      this.save.extendRun(this.distance, this.stage, this.distance - this.recordedAt.distance, this.runTotalTime - this.recordedAt.time);
    }
    const bestLine = `${this.bestLine()} · ◎ ${this.save.data.coins.toLocaleString()} COINS · SEED ${this.seed}${this.daily ? ' (DAILY)' : ''}`;
    const choice = await this.overlays.runOver({ title: quit ? 'RUN ENDED' : 'THE RIFT TOOK YOU', reason, distance: this.distance, stages: this.stage, total: CAMPAIGN_STAGES, coins: this.runCoins, time: this.runTotalTime, bestFlow: this.flow.best, bestLine, record });
    if (id !== this.runId) return;
    this.sfx.play('ui_confirm', 0.8);
    if (choice === 0) await this.startRun(true);
    else { await this.startRun(true, false); await this.menu(); }
  }

  private async onPortal(): Promise<void> {
    this.phase = 'portal';
    const id = this.runId;
    this.platform.gameplayStop();
    this.sfx.play('portal', 0.9);
    this.camera.pulse(18);
    this.energy += 100 * this.flow.multiplier;
    this.vfx.emit(this.gen.portalPos, 60, 8, 0.4, 1.2, 1.5, 3);
    await new Promise((r) => setTimeout(r, 650));
    if (id !== this.runId) return;
    // the stage is cleared: coins are banked now, records updated now — nothing depends on surviving the next one
    const stageTime = this.runTime;
    const prev = this.save.data.stages[String(this.stage)];
    const stageCoins = this.bankStage();
    const rec = this.endless ? null : this.save.recordStage(this.stage, stageTime, stageCoins);
    if (rec?.bestTime && !rec.first) this.platform.happytime();
    if (!this.endless && this.stage + 1 >= CAMPAIGN_STAGES) { await this.onVictory(id); return; }
    await this.nextStage(id, { stage: this.stage, total: CAMPAIGN_STAGES, endless: this.endless, time: stageTime, coins: stageCoins, rec, prevBestTime: prev?.bestTime ?? 0, prevBestCoins: prev?.bestCoins ?? 0, next: this.stageName(this.stage + 1), wallet: this.save.data.coins });
  }

  /** Stage-clear card with the upgrade pick, then build the next stage. */
  private async nextStage(id: number, info: StageClearInfo): Promise<void> {
    this.phase = 'upgrade';
    const rng = new Rng(this.seed ^ (this.stage * 2654435761));
    const options = this.deck.offer(rng, 3);
    this.sfx.play('ui_select', 0.6);
    const i = await this.overlays.stageClear(info, options);
    if (id !== this.runId) return;
    if (options[i]) this.deck.take(options[i], this.player.movement.stats);
    this.sfx.play('ui_confirm', 0.8);
    if (this.stage + 1 === TITAN_STAGE) this.platform.happytime();
    await this.platform.portalBreak(() => { this.sfx.muted = this.music.muted = true; }, () => { this.sfx.muted = this.music.muted = this.save.data.muted; });
    if (id !== this.runId) return;
    this.stage++;
    this.distanceBase = this.distance;
    await this.startRun(false);
  }

  /** All campaign stages cleared. The run is recorded here; KEEP RUNNING continues it as endless. */
  private async onVictory(id: number): Promise<void> {
    this.phase = 'dead';
    this.save.bankCoins(ESCAPE_BONUS);
    this.runCoins += ESCAPE_BONUS;
    const beat = this.save.recordRun({ distance: this.distance, stages: CAMPAIGN_STAGES, coins: this.runCoins, time: this.runTotalTime, won: true });
    this.recordedAt = { distance: this.distance, time: this.runTotalTime };
    this.platform.happytime();
    this.sfx.play('flow_up', 1, 1.2);
    this.camera.pulse(20);
    const bestLine = `${this.bestLine()} · ◎ ${this.save.data.coins.toLocaleString()} COINS`;
    const choice = await this.overlays.victory({ time: this.runTotalTime, coins: this.runCoins - ESCAPE_BONUS, bonus: ESCAPE_BONUS, distance: this.distance, fastest: beat.time, bestLine });
    if (id !== this.runId) return;
    this.sfx.play('ui_confirm', 0.8);
    if (choice === 'again') await this.startRun(true);
    else if (choice === 'title') { await this.startRun(true, false); await this.menu(); }
    else {
      this.endless = true;
      await this.nextStage(id, { stage: this.stage, total: CAMPAIGN_STAGES, endless: true, time: this.runTime, coins: 0, rec: null, prevBestTime: 0, prevBestCoins: 0, next: this.stageName(this.stage + 1), wallet: this.save.data.coins });
    }
  }

  private async onDeath(reason: string): Promise<void> {
    this.phase = 'dead';
    this.platform.gameplayStop();
    this.sfx.play('death', 1);
    this.camera.kick(1.5);
    this.vfx.emit(this.player.movement.position, 50, 10, 0.4, 1, 1, 2);
    const id = this.runId;
    await new Promise((r) => setTimeout(r, 900));
    if (id !== this.runId) return;
    await this.endRun(reason, false);
  }

  // ------------------------------------------------------------------------------------ frame
  private update(dt: number): void {
    const input = this.input;
    input.beginFrame();

    if (input.wasPressed('mute')) {
      const m = !this.sfx.muted;
      this.sfx.muted = this.music.muted = m;
      this.save.setMuted(m);
      this.hud.showHint(m ? 'SOUND OFF' : 'SOUND ON', 1.2);
    }
    const playing = this.phase === 'playing' && !this.overlays.visible;
    this.music.update(dt, playing, this.flow ? this.flow.intensity01 : 0, this.rift && this.player ? pc.math.clamp(1 - this.rift.distanceTo(this.player.movement.position.z) / 30, 0, 1) : 0, this.stage);

    if (this.overlays.visible) {
      if (input.wasPressed('pick1')) this.overlays.pick(0);
      else if (input.wasPressed('pick2')) this.overlays.pick(1);
      else if (input.wasPressed('pick3')) this.overlays.pick(2);
      else if (input.wasPressed('pick4')) this.overlays.pick(3);
      else if (input.wasPressed('jump') || input.wasPressed('confirm')) this.overlays.pickPrimary();
      else if (input.wasPressed('pause') || input.wasPressed('help')) this.overlays.pickEscape();
      // keep the world alive behind the card (coins spin, portal breathes) but freeze the player/rift
      if (this.gen && this.player) this.gen.update(dt, this.player.movement.position);
      if (this.phase === 'menu' && this.player) {
        // title screen: slow orbit around the idle runner so suits and trails can be admired
        const m = this.player.movement;
        this.player.update(dt, NO_INPUT, this.camera.yawRad);
        m.events.length = 0;
        this.camera.menuMode = true;
        this.camera.yaw += dt * 9;
        this.camera.update(dt, input, m.position, 0, m.facing);
        this.vfx.update(dt);
      }
      input.endFrame();
      return;
    }
    if (this.phase !== 'playing') {
      if (this.gen && this.player) this.gen.update(dt, this.player.movement.position);
      this.titan?.update(dt, this.player?.movement.position ?? pc.Vec3.ZERO, this.gen, false);
      this.vfx?.update(dt);
      input.endFrame();
      return;
    }

    if (input.wasPressed('restart')) { void this.startRun(true); input.endFrame(); return; }
    if (input.wasPressed('debug')) this.hud.toggleDebug();
    if (input.wasPressed('pause')) { void this.pause(); input.endFrame(); return; }
    if (input.wasPressed('help')) { void this.showHelp(); input.endFrame(); return; }

    const m = this.player.movement;
    if (!this.started && (Math.abs(input.move.x) + Math.abs(input.move.y) > 0.1 || input.wasPressed('jump'))) this.started = true;
    if (this.started) { this.runTime += dt; this.runTotalTime += dt; }
    this.riftGrace = Math.max(0, this.riftGrace - dt);
    // ride drifting islands: the collider moved under us this frame, so move with it
    m.position.x += this.gen.builder.carry(m.groundBox);
    this.player.update(dt, input, this.camera.yawRad);
    // stepping onto a fractured island starts its clock
    if (m.grounded) {
      const isl = this.gen.islandOf(m.groundBox);
      if (isl && this.gen.builder.stepOn(isl)) { this.sfx.play('land_hard', 0.6, 1.4); this.camera.kick(0.4); }
    }
    this.titan.update(dt, m.position, this.gen, true);
    this.camera.update(dt, input, m.position, m.speedXZ, m.facing);
    this.camera.setFlow(this.flow.intensity01);
    // the camera got pushed into the player's back: hide the body instead of showing the inside of it
    this.player.setVisible(this.camera.boomDist > 1.3);
    // grapple targeting feedback: highlight the ring you'd grab and show the key
    const fwd = Math.abs(input.move.x) + Math.abs(input.move.y) > 0.1 ? this.camera.forwardXZ() : m.facing;
    const target = m.state === 'grapple' ? null : this.gen.findAnchor(m.position, fwd, m.stats.grappleRange);
    this.gen.update(dt, m.position, target);
    this.hud.setPrompt(target ? (this.device.isTouch ? 'GRAPPLE · TAP' : 'E · GRAPPLE') : m.state === 'grapple' ? (this.device.isTouch ? 'GRAPPLE · LET GO' : 'E · LET GO') : null);
    this.distance = Math.max(this.distance, this.distanceBase + Math.max(0, this.gen.spawn.z - m.position.z));

    // rift pressure: starts 3 s after the first move, ramps with stage and time; paused briefly after a fall.
    // Portal Collapse: once you are three islands from the portal the Rift surges — a final sprint.
    if (!this.collapsing && m.position.z < this.gen.collapseZ) {
      this.collapsing = true;
      this.hud.showHint('THE PORTAL IS COLLAPSING — SPRINT', 3);
      this.sfx.play('land_hard', 0.8, 0.4);
      this.camera.kick(1);
      this.camera.pulse(14);
    }
    const base = 3.6 + this.stage * 0.7;
    let riftSpeed = (!this.started || this.runTime < 3 || this.riftGrace > 0 ? 0 : Math.min(base + 2.5, base + this.runTime * 0.05)) * m.stats.riftSlow;
    // during the collapse the Rift runs just faster than you can: stopping is fatal, moving forward is not
    if (this.collapsing && riftSpeed > 0) riftSpeed = Math.max(riftSpeed, 10.5 * m.stats.riftSlow);
    this.rift.speed = riftSpeed;
    this.rift.update(dt, m.position.z, m.position.y);
    this.gen.riftSweep(this.rift.z);
    const riftDist = this.rift.distanceTo(m.position.z);
    this.hud.setRift(riftDist);
    if (riftDist < 0) {
      if (m.stats.riftShield > 0) {
        m.stats.riftShield--;
        this.rift.reset(m.position.z + 30, this.rift.speed);
        this.hud.showHint('RIFT SHIELD SPENT', 2);
        this.sfx.play('flow_up', 1, 0.6);
        this.camera.kick(1);
      } else {
        void this.onDeath('CONSUMED BY THE RIFT');
        input.endFrame();
        return;
      }
    }

    for (const cp of this.gen.checkpoints) {
      if (cp.index > this.checkpoint && m.grounded && Math.abs(cp.spawn.z - m.position.z) < 4 && Math.abs(cp.spawn.x - m.position.x) < 8) {
        this.checkpoint = cp.index;
        this.sfx.play('checkpoint', 0.35, 1.2, 0.5);
      }
    }

    const got = this.gen.collectGems(m.position, m.stats.magnetRadius);
    if (got) {
      this.energy += got * 10 * this.flow.multiplier;
      this.sfx.play('pickup', 0.5, 0.9 + this.flow.level * 0.08, 0.04);
      this.vfx.emit(new pc.Vec3(m.position.x, m.position.y + 1, m.position.z), 6, 4, 0.2, 0.4, 0, 2);
    }

    for (const ev of m.events) {
      const up = this.flow.onEvent(ev);
      if (up) { this.sfx.play('flow_up', 0.6, 0.8 + this.flow.level * 0.1); this.camera.pulse(6); }
      switch (ev) {
        case 'dash': this.camera.pulse(); this.sfx.play('dash', 0.7); this.vfx.emit(m.position, 14, 6, 0.3, 0.5, 0, 1); break;
        case 'jump': this.sfx.play('jump', 0.45, 1.1); break;
        case 'djump': this.sfx.play('djump', 0.6, 1.2); this.vfx.emit(new pc.Vec3(m.position.x, m.position.y + 0.2, m.position.z), 10, 5, 0.25, 0.5); break;
        case 'land': this.camera.kick(0.2); this.sfx.play('land', 0.5); break;
        case 'land-hard': this.camera.kick(0.8); this.sfx.play('land_hard', 0.8); this.vfx.emit(m.position, 12, 5, 0.25, 0.5); break;
        case 'wallrun': this.sfx.play('wallrun', 0.6, 0.9); break;
        case 'walljump': this.sfx.play('jump', 0.6, 1.3); this.camera.pulse(5); break;
        case 'slide': this.sfx.play('slide', 0.6, 0.8); break;
        case 'vault': this.sfx.play('wallrun', 0.5, 1.3); break;
        case 'grapple': this.sfx.play('grapple', 0.7); this.camera.pulse(6); break;
        case 'grapple-release': this.camera.pulse(8); break;
        case 'fell': this.respawnAtCheckpoint(); break;
      }
    }
    m.events.length = 0;

    this.flow.update(dt, m.speedXZ, m.grounded);
    this.env.setIntensity(this.flow.intensity01);
    this.vfx.trail(dt, m.position, (m.state === 'dash' ? 0.6 : 0) + this.flow.intensity01 * pc.math.clamp((m.speedXZ - 6) / 10, 0, 1));
    this.vfx.ambient(dt, m.position, this.biome().id);
    this.vfx.update(dt);

    if (this.gen.atPortal(m.position)) { void this.onPortal(); input.endFrame(); return; }

    // chunk tips (first two biomes only; after that you know the moves)
    if (this.stage < 2) {
      const h = this.gen.popHint(m.position.z);
      if (h) this.hud.showHint(this.device.isTouch ? h.touch : h.text, 5);
    }

    this.hud.setFlow(this.flow.multiplier, this.flow.progress01);
    this.hud.setEnergy(this.runCoins + Math.round(this.energy));
    this.hud.setTimer(this.runTime);
    this.hud.update(dt);

    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsFrames / this.fpsAcc); this.fpsAcc = 0; this.fpsFrames = 0; }
    if (this.hud.debugVisible) {
      const p = m.position;
      this.hud.setDebug(
        `fps ${this.fps}  draw ${this.drawCalls}  ${this.device.profile} ${this.app.graphicsDevice.deviceType}  seed ${this.seed} stage ${this.stage}\n` +
        `state ${m.state}${m.grounded ? ' grounded' : ''}${m.wallContact ? ' wall' : ''}  dash ${m.dashChargesLeft}  airjumps ${m.airJumpsLeft}\n` +
        `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  vel ${m.speedXZ.toFixed(1)} / ${m.velocity.y.toFixed(1)}  rift ${riftDist.toFixed(0)}m @${riftSpeed.toFixed(1)}\n` +
        `cp ${this.checkpoint}/${this.gen.checkpoints.length - 1}  flow L${this.flow.level} w${this.flow.window.toFixed(1)}  t ${this.runTime.toFixed(1)}`,
      );
    }

    input.endFrame();
  }
}

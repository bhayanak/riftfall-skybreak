import * as pc from 'playcanvas';
import { detectDevice, type DeviceInfo } from './Device';
import { Input } from './Input';
import { CollisionWorld } from '../world/Colliders';
import { Greybox } from '../world/Greybox';
import { Player } from '../player/Player';
import { CameraRig } from '../graphics/CameraRig';
import { Hud } from '../ui/Hud';
import { TouchControls } from '../ui/TouchControls';

export class Game {
  readonly app: pc.AppBase;
  readonly device: DeviceInfo;
  readonly input: Input;
  readonly world = new CollisionWorld();
  readonly hud = new Hud();
  player!: Player;
  camera!: CameraRig;
  greybox!: Greybox;
  private checkpoint = 0;
  private fps = 60;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private runTime = 0;
  private finished = false;
  private drawCalls = 0;

  private constructor(app: pc.AppBase, canvas: HTMLCanvasElement, device: DeviceInfo) {
    this.app = app;
    this.device = device;
    this.input = new Input(canvas);
  }

  static async create(canvas: HTMLCanvasElement): Promise<Game> {
    const device = detectDevice();
    // WebGL2 is the compatibility baseline (D1/plan). WebGPU is opt-in via ?gpu until the shader path is validated.
    const wantGpu = device.hasWebGPU && new URLSearchParams(location.search).has('gpu');
    const gfx = await pc.createGraphicsDevice(canvas, {
      deviceTypes: wantGpu ? [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2] : [pc.DEVICETYPE_WEBGL2],
      antialias: device.profile !== 'mobile-low',
      alpha: false,
      powerPreference: 'high-performance',
    });
    gfx.maxPixelRatio = device.maxPixelRatio;

    const opts = new pc.AppOptions();
    opts.graphicsDevice = gfx;
    opts.componentSystems = [pc.RenderComponentSystem, pc.CameraComponentSystem, pc.LightComponentSystem];
    opts.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.RenderHandler, pc.MaterialHandler];

    const app = new pc.AppBase(canvas);
    app.init(opts);
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener('resize', () => app.resizeCanvas());

    const game = new Game(app, canvas, device);
    await game.setupScene();
    app.on('update', (dt: number) => game.update(dt));
    app.on('frameend', () => { game.drawCalls = (gfx as pc.GraphicsDevice & { _drawCallsPerFrame?: number })._drawCallsPerFrame ?? 0; });
    app.start();
    return game;
  }

  private async setupScene(): Promise<void> {
    const app = this.app;
    const sky = new pc.Color(0.52, 0.72, 0.95);
    app.scene.ambientLight = new pc.Color(0.38, 0.45, 0.6);
    app.scene.fog.type = pc.FOG_LINEAR;
    app.scene.fog.color = sky;
    app.scene.fog.start = 70;
    app.scene.fog.end = 240;

    const sun = new pc.Entity('sun');
    sun.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1, 0.95, 0.85),
      intensity: 1.6,
      castShadows: this.device.profile !== 'mobile-low',
      shadowDistance: 70,
      shadowResolution: this.device.profile === 'desktop' ? 2048 : 1024,
      shadowBias: 0.2,
      normalOffsetBias: 0.06,
      numCascades: this.device.profile === 'desktop' ? 2 : 1,
    });
    sun.setEulerAngles(52, 35, 0);
    app.root.addChild(sun);

    const assetsBase = `${import.meta.env.BASE_URL}assets/`;
    this.greybox = new Greybox(app, this.world, assetsBase);
    await this.greybox.build();

    this.player = new Player(app, this.world);
    this.camera = new CameraRig(app, this.device.isMobile, this.world);
    if (this.device.isTouch) new TouchControls(this.input);

    this.restart();
    this.hud.showHint(this.device.isTouch ? 'DRAG RIGHT SIDE TO LOOK · REACH THE FLAG' : 'CLICK TO CAPTURE MOUSE · WASD · SPACE · SHIFT', 6);
  }

  private restart(): void {
    this.checkpoint = 0;
    this.runTime = 0;
    this.finished = false;
    this.player.movement.respawn(this.greybox.spawn);
    this.camera.snapTo(this.greybox.spawn, 0);
  }

  private respawn(): void {
    const cp = this.greybox.checkpointAt(this.checkpoint) ?? { spawn: this.greybox.spawn };
    this.player.movement.respawn(cp.spawn);
    this.camera.kick(0.6);
  }

  private update(dt: number): void {
    const input = this.input;
    input.beginFrame();

    if (input.wasPressed('restart')) this.restart();
    if (input.wasPressed('debug')) this.hud.toggleDebug();

    const m = this.player.movement;
    this.player.update(dt, input, this.camera.yawRad);
    this.camera.update(dt, input, m.position, m.speedXZ);

    // checkpoints + goal
    const trig = this.world.firstOverlap(m.position, 0.4, 1.8, 'checkpoint');
    if (trig && trig.data > this.checkpoint) {
      this.checkpoint = trig.data;
      this.hud.showHint(`CHECKPOINT ${trig.data}`, 1.5);
    }
    if (!this.finished && m.grounded && m.position.distance(this.greybox.goal) < 3) {
      this.finished = true;
      this.hud.showHint(`RIFT REACHED · ${this.runTime.toFixed(2)}s · R TO RESTART`, 10);
      this.camera.pulse(14);
    }
    if (!this.finished) this.runTime += dt;

    // movement events -> feel hooks
    for (const ev of m.events) {
      if (ev === 'dash') this.camera.pulse();
      else if (ev === 'land-hard') this.camera.kick(0.8);
      else if (ev === 'land') this.camera.kick(0.25);
      else if (ev === 'fell') this.respawn();
    }
    m.events.length = 0;

    // HUD placeholders until FLOW/energy systems land (Phase 2)
    const speedK = pc.math.clamp(m.speedXZ / 24, 0, 1);
    this.hud.setFlow(1 + Math.floor(speedK * 4), speedK);
    this.hud.setEnergy(Math.floor(this.runTime * 3));
    this.hud.update(dt);

    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsFrames / this.fpsAcc); this.fpsAcc = 0; this.fpsFrames = 0; }
    if (this.hud.debugVisible) {
      const p = m.position;
      this.hud.setDebug(
        `fps ${this.fps}  draw ${this.drawCalls}  ${this.device.profile} ${this.app.graphicsDevice.deviceType}\n` +
        `state ${m.state}${m.grounded ? ' grounded' : ''}${m.wallContact ? ' wall' : ''}  dash ${m.dashChargesLeft}\n` +
        `pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}  vel ${m.speedXZ.toFixed(1)} / ${m.velocity.y.toFixed(1)}\n` +
        `cp ${this.checkpoint}  t ${this.runTime.toFixed(1)}  cam ${this.camera.yaw.toFixed(0)}°/${this.camera.pitch.toFixed(0)}°`,
      );
    }

    input.endFrame();
  }
}

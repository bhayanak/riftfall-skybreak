import * as pc from 'playcanvas';
import { emissive, type Island } from './Island';
import type { WorldGenerator } from './WorldGenerator';
import type { Assets } from '../core/Assets';

/**
 * The Rift Titan: a storm-dragon that stalks the route from stage 4 on and slams islands ahead of the player.
 * It is pressure, not a fight: a slam is telegraphed for ~1.4 s (ring on the island + hint + dive), then that
 * island starts sinking slowly, so a quick player can still use it while a slow one has to find another way.
 */
export class Titan {
  readonly entity = new pc.Entity('titan');
  active = false;
  onTelegraph: ((isl: Island) => void) | null = null;
  onSlam: ((isl: Island) => void) | null = null;

  private model: pc.Entity;
  private anim: pc.AnimComponent;
  private ring: pc.Entity;
  private light: pc.Entity;
  private ringMat: pc.StandardMaterial;
  private t = 0;
  private cooldown = 6;
  private target: Island | null = null;
  private telegraph = 0;
  private pos = new pc.Vec3();
  private look = new pc.Vec3();
  private clip = '';
  /** seconds between slams (plus up to 2 s jitter); shorter on later stages */
  private cadence = 8;

  constructor(app: pc.AppBase, assets: Assets) {
    this.model = assets.spawn('titan');
    this.model.setLocalScale(3.2, 3.2, 3.2);
    this.model.setLocalEulerAngles(0, 180, 0);   // kit models face +Z; lookAt points -Z at the target
    for (const r of this.model.findComponents('render') as pc.RenderComponent[]) r.castShadows = false;
    this.entity.addChild(this.model);
    this.anim = this.model.addComponent('anim', { activate: true }) as pc.AnimComponent;
    for (const a of assets.get('titan').animations) {
      const track = a.resource as pc.AnimTrack;
      this.anim.assignAnimation(track.name, track, undefined, 1, track.name !== 'Headbutt');
    }
    this.play('Flying_Idle');

    this.light = new pc.Entity('glow');
    this.light.addComponent('light', { type: 'point', color: new pc.Color(1, 0.5, 0.3), intensity: 4, range: 40, castShadows: false });
    this.light.setLocalPosition(0, 2, 2);
    this.entity.addChild(this.light);

    this.ringMat = emissive(new pc.Color(1, 0.3, 0.2), 3, 0.9, true);
    this.ring = new pc.Entity('slam-ring');
    this.ring.addComponent('render', { type: 'torus', material: this.ringMat });
    this.ring.setLocalEulerAngles(90, 0, 0);
    this.ring.enabled = false;
    app.root.addChild(this.ring);

    this.entity.enabled = false;
    app.root.addChild(this.entity);
  }

  private play(name: string): void {
    if (this.clip === name) return;
    this.clip = name;
    this.anim.baseLayer?.transition(name, 0.2);
  }

  setColor(c: pc.Color): void {
    this.ringMat.emissive = c; this.ringMat.update();
    this.light.light!.color = c;
  }

  start(spawn: pc.Vec3, cadence = 8): void {
    this.active = true;
    this.entity.enabled = true;
    this.cadence = cadence;
    this.cooldown = 6;
    this.target = null;
    this.ring.enabled = false;
    this.pos.set(spawn.x + 20, spawn.y + 14, spawn.z - 10);
    this.entity.setPosition(this.pos);
    this.play('Flying_Idle');
  }

  stop(): void {
    this.active = false;
    this.entity.enabled = false;
    this.ring.enabled = false;
    this.target = null;
  }

  update(dt: number, player: pc.Vec3, gen: WorldGenerator, playing: boolean): void {
    if (!this.active) return;
    this.t += dt;
    // hover ahead and to one side, drifting across the route; dive toward the marked island during a telegraph
    const sx = Math.sin(this.t * 0.22) * 16;
    const want = this.target
      ? new pc.Vec3(this.target.x, this.target.top + 6, this.target.z + 3)
      : new pc.Vec3(player.x + sx, player.y + 10 + Math.sin(this.t * 1.1) * 0.8, player.z - 22);
    this.pos.lerp(this.pos, want, 1 - Math.exp(-dt * (this.target ? 3 : 1.4)));
    this.entity.setPosition(this.pos);
    if (this.target) this.look.set(this.target.x, this.target.top, this.target.z); else this.look.copy(player);
    this.entity.lookAt(this.look);

    if (!playing) return;
    if (this.target) {
      this.telegraph -= dt;
      const k = 1 - Math.max(0, this.telegraph) / 1.4;
      const s = (this.target.w + 2) * (0.9 + Math.sin(this.t * 14) * 0.05) / 2;
      this.ring.setLocalScale(s, s, s * (1 - k * 0.5));
      this.ringMat.opacity = 0.4 + k * 0.6; this.ringMat.update();
      if (this.telegraph <= 0) {
        this.onSlam?.(this.target);
        this.target = null;
        this.ring.enabled = false;
        this.cooldown = this.cadence + Math.random() * 2;
        this.play('Flying_Idle');
      }
    } else {
      this.cooldown -= dt;
      if (this.cooldown <= 0) {
        const isl = gen.islandAhead(player, 2);
        if (isl && !isl.crumble && !isl.motion && isl.w >= 4 && isl.d >= 4) {
          this.target = isl;
          this.telegraph = 1.4;
          this.ring.setPosition(isl.x, isl.top + 0.3, isl.z);
          this.ring.enabled = true;
          this.play('Headbutt');
          this.onTelegraph?.(isl);
        } else this.cooldown = 1.2;
      } else this.play(this.cooldown < 2.5 ? 'Fast_Flying' : 'Flying_Idle');
    }
  }
}

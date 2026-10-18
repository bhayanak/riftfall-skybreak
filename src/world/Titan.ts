import * as pc from 'playcanvas';
import { emissive, flat, type Island } from './Island';
import type { WorldGenerator } from './WorldGenerator';

/**
 * The Rift Titan: a storm-eye that stalks the route from stage 3 on and slams islands ahead of the player.
 * It is pressure, not a fight: a slam is telegraphed for ~1.4 s (ring on the island + hint), then that island
 * starts sinking slowly, so a quick player can still use it while a slow one has to find another way.
 */
export class Titan {
  readonly entity = new pc.Entity('titan');
  active = false;
  onTelegraph: ((isl: Island) => void) | null = null;
  onSlam: ((isl: Island) => void) | null = null;

  private core: pc.Entity;
  private eye: pc.Entity;
  private shards: pc.Entity[] = [];
  private ring: pc.Entity;
  private light: pc.Entity;
  private eyeMat: pc.StandardMaterial;
  private ringMat: pc.StandardMaterial;
  private t = 0;
  private cooldown = 6;
  private target: Island | null = null;
  private telegraph = 0;
  private pos = new pc.Vec3();

  constructor(app: pc.AppBase) {
    this.core = new pc.Entity('core');
    this.core.addComponent('render', { type: 'sphere', material: flat(new pc.Color(0.05, 0.04, 0.08), 0.6) });
    this.core.setLocalScale(5, 5, 5);
    this.entity.addChild(this.core);

    this.eyeMat = emissive(new pc.Color(1, 0.4, 0.2), 6);
    this.eye = new pc.Entity('eye');
    this.eye.addComponent('render', { type: 'sphere', material: this.eyeMat });
    this.eye.setLocalScale(1.8, 1.8, 1.8);
    this.eye.setLocalPosition(0, 0, 2.0);
    this.entity.addChild(this.eye);

    const shardMat = flat(new pc.Color(0.12, 0.1, 0.16), 0.5);
    for (let i = 0; i < 9; i++) {
      const s = new pc.Entity('shard');
      s.addComponent('render', { type: 'box', material: shardMat });
      s.setLocalScale(0.6 + Math.random() * 0.6, 1.6 + Math.random() * 1.8, 0.6 + Math.random() * 0.6);
      this.entity.addChild(s);
      this.shards.push(s);
    }

    this.light = new pc.Entity('glow');
    this.light.addComponent('light', { type: 'point', color: new pc.Color(1, 0.5, 0.3), intensity: 4, range: 40, castShadows: false });
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

  setColor(c: pc.Color): void {
    this.eyeMat.emissive = c; this.eyeMat.update();
    this.ringMat.emissive = c; this.ringMat.update();
    this.light.light!.color = c;
  }

  start(spawn: pc.Vec3): void {
    this.active = true;
    this.entity.enabled = true;
    this.cooldown = 6;
    this.target = null;
    this.ring.enabled = false;
    this.pos.set(spawn.x + 20, spawn.y + 14, spawn.z - 10);
    this.entity.setPosition(this.pos);
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
    // hover ahead and to one side, drifting across the route; look at the player
    const sx = Math.sin(this.t * 0.22) * 16;
    const want = new pc.Vec3(player.x + sx, player.y + 10 + Math.sin(this.t * 1.1) * 0.8, player.z - 22);
    this.pos.lerp(this.pos, want, 1 - Math.exp(-dt * 1.4));
    this.entity.setPosition(this.pos);
    this.entity.lookAt(player);
    const pulse = 1 + Math.sin(this.t * 3) * 0.08 + (this.target ? 0.25 : 0);
    this.eye.setLocalScale(1.8 * pulse, 1.8 * pulse, 1.8 * pulse);
    this.shards.forEach((s, i) => {
      const a = this.t * (0.6 + i * 0.07) + i * 0.7, r = 4.2 + Math.sin(this.t * 0.9 + i) * 0.6;
      s.setLocalPosition(Math.cos(a) * r, Math.sin(a * 1.3 + i) * 2.2, Math.sin(a) * r);
      s.setLocalEulerAngles(this.t * 40 + i * 30, this.t * 25, i * 20);
    });

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
        this.cooldown = 7 + Math.random() * 4;
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
          this.onTelegraph?.(isl);
        } else this.cooldown = 1.2;
      }
    }
  }
}

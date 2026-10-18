import * as pc from 'playcanvas';
import { emissive } from '../world/Island';

/** Pooled emissive sprites: speed trail, dash burst, pickup pop, landing dust. Cheap, no particle system. */
export class VFX {
  private pool: { e: pc.Entity; life: number; max: number; vel: pc.Vec3; grow: number; mat: pc.StandardMaterial }[] = [];
  private root = new pc.Entity('vfx');
  private color = new pc.Color(0.4, 0.8, 1);
  private trailAcc = 0;

  constructor(app: pc.AppBase, budget: number) {
    app.root.addChild(this.root);
    for (let i = 0; i < budget; i++) {
      const mat = emissive(this.color, 2, 0.8, true);
      const e = new pc.Entity('p');
      e.addComponent('render', { type: 'sphere', material: mat });
      e.render!.castShadows = false;
      e.enabled = false;
      this.root.addChild(e);
      this.pool.push({ e, life: 0, max: 1, vel: new pc.Vec3(), grow: 0, mat });
    }
  }

  setColor(c: pc.Color): void {
    this.color = c;
    for (const p of this.pool) { p.mat.emissive = c; p.mat.update(); }
  }

  emit(pos: pc.Vec3, count: number, speed: number, size: number, life: number, grow = 0, up = 0): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.find((q) => !q.e.enabled);
      if (!p) return;
      p.e.enabled = true;
      p.e.setPosition(pos.x + (Math.random() - 0.5) * 0.4, pos.y + (Math.random() - 0.5) * 0.4, pos.z + (Math.random() - 0.5) * 0.4);
      const s = size * (0.6 + Math.random() * 0.8);
      p.e.setLocalScale(s, s, s);
      p.vel.set((Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed + up, (Math.random() - 0.5) * speed);
      p.life = p.max = life * (0.7 + Math.random() * 0.6);
      p.grow = grow;
    }
  }

  /** Continuous trail behind a fast mover; intensity scales count/size. */
  trail(dt: number, pos: pc.Vec3, intensity: number): void {
    if (intensity <= 0.01) return;
    this.trailAcc += dt * (18 + intensity * 40);
    while (this.trailAcc >= 1) {
      this.trailAcc -= 1;
      this.emit(new pc.Vec3(pos.x, pos.y + 0.9, pos.z), 1, 0.6, 0.12 + intensity * 0.25, 0.35 + intensity * 0.3, -0.5);
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.e.enabled) continue;
      p.life -= dt;
      if (p.life <= 0) { p.e.enabled = false; continue; }
      const pos = p.e.getPosition();
      p.e.setPosition(pos.x + p.vel.x * dt, pos.y + p.vel.y * dt, pos.z + p.vel.z * dt);
      const k = p.life / p.max;
      const s = p.e.getLocalScale().x * (1 + p.grow * dt);
      p.e.setLocalScale(s * (0.97 + 0.03 * k), s * (0.97 + 0.03 * k), s * (0.97 + 0.03 * k));
      p.mat.opacity = 0.8 * k;
      p.mat.update();
    }
  }
}

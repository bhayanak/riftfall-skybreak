import * as pc from 'playcanvas';
import { emissive } from './Island';

/**
 * The collapsing world: a glowing wall that advances along -Z. Islands behind it sink; a player behind it dies.
 */
export class Rift {
  readonly root = new pc.Entity('rift');
  z = 40;
  speed = 0;
  private wall: pc.Entity;
  private shards: pc.Entity[] = [];
  private t = 0;
  private color = new pc.Color(0.5, 0.7, 1);
  private wallMat!: pc.StandardMaterial;

  constructor(app: pc.AppBase) {
    app.root.addChild(this.root);
    this.wall = new pc.Entity('wall');
    this.wallMat = emissive(this.color, 1.2, 0.35, true);
    this.wall.addComponent('render', { type: 'plane', material: this.wallMat });
    this.wall.setLocalScale(400, 1, 300);
    this.wall.setEulerAngles(90, 0, 0);
    this.root.addChild(this.wall);
    for (let i = 0; i < 40; i++) {
      const s = new pc.Entity('shard');
      s.addComponent('render', { type: 'box', material: emissive(this.color, 2.5) });
      const sc = 0.3 + Math.random() * 1.6;
      s.setLocalScale(sc, sc * (1 + Math.random() * 3), sc);
      s.setLocalPosition((Math.random() - 0.5) * 120, (Math.random() - 0.3) * 60, (Math.random() - 0.5) * 12);
      s.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
      this.root.addChild(s);
      this.shards.push(s);
    }
    const glow = new pc.Entity('glow');
    glow.addComponent('light', { type: 'point', color: this.color, intensity: 4, range: 40 });
    glow.setLocalPosition(0, 6, -6);
    this.root.addChild(glow);
  }

  setColor(c: pc.Color): void {
    this.color = c;
    this.wallMat.emissive = c; this.wallMat.update();
    for (const s of this.shards) { const m = s.render!.material as pc.StandardMaterial; m.emissive = c; m.update(); }
    (this.root.findByName('glow') as pc.Entity).light!.color = c;
  }

  /** Reset behind the spawn point. */
  reset(z: number, speed: number): void {
    this.z = z;
    this.speed = speed;
    this.root.setPosition(0, 0, z);
  }

  update(dt: number, playerZ: number, playerY: number, maxLead = 70): void {
    this.t += dt;
    // advance, but never fall further behind than maxLead so slow players still feel pressure
    this.z -= this.speed * dt;
    if (this.z > playerZ + maxLead) this.z = playerZ + maxLead;
    this.root.setPosition(0, playerY, this.z);
    this.wallMat.opacity = 0.3 + Math.sin(this.t * 3) * 0.06;
    this.wallMat.update();
    for (let i = 0; i < this.shards.length; i++) {
      const s = this.shards[i];
      const p = s.getLocalPosition();
      s.setLocalPosition(p.x, p.y + Math.sin(this.t * 1.3 + i) * dt * 2, p.z);
      s.rotateLocal(dt * 30, dt * 20, 0);
    }
  }

  /** Distance from the player to the wall (negative = caught). */
  distanceTo(playerZ: number): number { return this.z - playerZ; }
}

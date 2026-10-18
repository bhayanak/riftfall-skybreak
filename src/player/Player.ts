import * as pc from 'playcanvas';
import type { Input } from '../core/Input';
import type { Assets } from '../core/Assets';
import { Movement, TUNING } from './Movement';
import { PlayerAnimation } from './PlayerAnimation';
import type { CollisionWorld } from '../world/Colliders';
import { emissive } from '../world/Island';

/** Quaternius character faces +Z in glTF; the game's forward is -Z. */
const MODEL_YAW = 180;

export class Player {
  readonly entity: pc.Entity;
  readonly movement: Movement;
  readonly anim: PlayerAnimation;
  private visual: pc.Entity;
  private model: pc.Entity;
  private rope: pc.Entity;
  private lean = 0;

  constructor(app: pc.AppBase, assets: Assets, world: CollisionWorld) {
    this.movement = new Movement(world);
    this.entity = new pc.Entity('player');
    this.visual = new pc.Entity('player-visual');
    this.entity.addChild(this.visual);

    this.model = assets.spawn('player');
    this.model.setLocalEulerAngles(0, MODEL_YAW, 0);
    for (const r of this.model.findComponents('render') as pc.RenderComponent[]) { r.castShadows = true; r.receiveShadows = true; }
    this.visual.addChild(this.model);
    this.anim = new PlayerAnimation(this.model, assets.animTracks());

    this.rope = new pc.Entity('rope');
    this.rope.addComponent('render', { type: 'cylinder', material: emissive(new pc.Color(0.6, 0.9, 1), 2) });
    this.rope.enabled = false;
    app.root.addChild(this.rope);

    app.root.addChild(this.entity);
  }

  private visible = true;
  /** Hide the body (camera too close) without stopping animation or movement. */
  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    for (const r of this.model.findComponents('render') as pc.RenderComponent[]) r.enabled = v;
  }

  update(dt: number, input: Input, camYaw: number): void {
    const m = this.movement;
    m.update(dt, input, camYaw);
    this.entity.setPosition(m.position);

    // facing + lean into wall-runs / turns
    const yaw = Math.atan2(-m.facing.x, -m.facing.z) * pc.math.RAD_TO_DEG;
    const targetLean = m.state === 'wallrun' ? -m.wallSide * 22 : 0;
    this.lean += (targetLean - this.lean) * (1 - Math.exp(-dt * 10));
    this.visual.setEulerAngles(0, yaw, this.lean);
    // mirror the single wall-run clip for the other side
    this.model.setLocalScale(m.state === 'wallrun' && m.wallSide < 0 ? -1 : 1, 1, 1);

    this.anim.update(dt, m);

    // grapple rope
    if (m.grappleAnchor) {
      const a = m.grappleAnchor;
      const hand = new pc.Vec3(m.position.x, m.position.y + TUNING.height * 0.7, m.position.z);
      const mid = new pc.Vec3().add2(a, hand).mulScalar(0.5);
      const len = a.distance(hand);
      this.rope.enabled = true;
      this.rope.setPosition(mid);
      this.rope.setLocalScale(0.05, len, 0.05);
      this.rope.lookAt(a);
      this.rope.rotateLocal(90, 0, 0);
    } else {
      this.rope.enabled = false;
    }
  }
}

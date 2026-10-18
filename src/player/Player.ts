import * as pc from 'playcanvas';
import type { Input } from '../core/Input';
import { Movement, TUNING } from './Movement';
import type { CollisionWorld } from '../world/Colliders';

/** Visual + controller glue. The capsule is a placeholder until the Quaternius rig lands (Phase 3). */
export class Player {
  readonly entity: pc.Entity;
  readonly movement: Movement;
  private visual: pc.Entity;
  private trail: pc.Entity;
  private dashFlash = 0;

  constructor(app: pc.AppBase, world: CollisionWorld) {
    this.movement = new Movement(world);
    this.entity = new pc.Entity('player');

    const body = new pc.StandardMaterial();
    body.diffuse = new pc.Color(0.95, 0.55, 0.2);
    body.update();
    const nose = new pc.StandardMaterial();
    nose.diffuse = new pc.Color(0.1, 0.1, 0.12);
    nose.update();

    this.visual = new pc.Entity('player-visual');
    const capsule = new pc.Entity('capsule');
    capsule.addComponent('render', { type: 'capsule', material: body });
    capsule.setLocalScale(TUNING.radius * 2, TUNING.height, TUNING.radius * 2);
    capsule.setLocalPosition(0, TUNING.height * 0.5, 0);
    this.visual.addChild(capsule);

    const face = new pc.Entity('face');
    face.addComponent('render', { type: 'box', material: nose });
    face.setLocalScale(0.25, 0.12, 0.2);
    face.setLocalPosition(0, TUNING.height * 0.78, -TUNING.radius);
    this.visual.addChild(face);

    this.trail = new pc.Entity('dash-trail');
    const trailMat = new pc.StandardMaterial();
    trailMat.emissive = new pc.Color(0.35, 0.82, 1);
    trailMat.diffuse = new pc.Color(0, 0, 0);
    trailMat.opacity = 0.6;
    trailMat.blendType = pc.BLEND_ADDITIVE;
    trailMat.update();
    this.trail.addComponent('render', { type: 'capsule', material: trailMat });
    this.trail.setLocalScale(TUNING.radius * 2.6, TUNING.height * 1.1, TUNING.radius * 2.6);
    this.trail.setLocalPosition(0, TUNING.height * 0.5, 0);
    this.trail.enabled = false;
    this.visual.addChild(this.trail);

    this.entity.addChild(this.visual);
    app.root.addChild(this.entity);
  }

  update(dt: number, input: Input, camYaw: number): void {
    const m = this.movement;
    m.update(dt, input, camYaw);
    this.entity.setPosition(m.position);

    const yaw = Math.atan2(-m.facing.x, -m.facing.z) * pc.math.RAD_TO_DEG;
    this.visual.setEulerAngles(0, yaw, 0);

    if (m.events.includes('dash')) this.dashFlash = 1;
    this.dashFlash = Math.max(0, this.dashFlash - dt * 5);
    this.trail.enabled = this.dashFlash > 0;
    if (this.trail.enabled) {
      const s = 1 + this.dashFlash * 0.4;
      this.trail.setLocalScale(TUNING.radius * 2.6 * s, TUNING.height * 1.1, TUNING.radius * 2.6 * s);
    }
  }
}

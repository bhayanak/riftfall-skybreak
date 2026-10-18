import * as pc from 'playcanvas';
import type { Input } from '../core/Input';
import type { CollisionWorld } from '../world/Colliders';

const CAM = {
  distance: 5.2,
  height: 1.6,
  pitchMin: -40,
  pitchMax: 65,
  defaultPitch: 14,
  mouseSens: 0.12,
  followLag: 18,
  baseFov: 70,
  speedFov: 14,
  flowFov: 6,
  dashFovPulse: 10,
  shakeDecay: 6,
};

/**
 * Third-person orbit camera: yaw/pitch from look input, spring-damped follow, speed/dash FOV, light shake.
 */
export class CameraRig {
  readonly entity: pc.Entity;
  yaw = 0;
  pitch = CAM.defaultPitch;
  /** Current boom length after collision; the game fades the player out when this gets very short. */
  boomDist = CAM.distance;
  private target = new pc.Vec3();
  private smoothTarget = new pc.Vec3();
  private fovPulse = 0;
  private shake = 0;
  private flow = 0;
  private shakeSeed = Math.random() * 100;
  private tmp = new pc.Vec3();
  private reduceShake: boolean;

  constructor(app: pc.AppBase, reduceEffects: boolean, private world: CollisionWorld) {
    this.reduceShake = reduceEffects;
    this.entity = new pc.Entity('camera');
    this.entity.addComponent('camera', {
      fov: CAM.baseFov,
      nearClip: 0.1,
      farClip: 900,
    });
    app.root.addChild(this.entity);
  }

  setFlow(f01: number): void { this.flow = f01; }

  snapTo(pos: pc.Vec3, yaw: number): void {
    this.yaw = yaw; this.pitch = CAM.defaultPitch;
    this.smoothTarget.set(pos.x, pos.y + CAM.height, pos.z);
  }

  pulse(amount = CAM.dashFovPulse): void { this.fovPulse = Math.max(this.fovPulse, amount); }
  kick(amount: number): void { this.shake = Math.max(this.shake, this.reduceShake ? amount * 0.4 : amount); }

  get yawRad(): number { return this.yaw * pc.math.DEG_TO_RAD; }

  /** Unit XZ direction the camera looks along. */
  forwardXZ(): pc.Vec3 {
    const y = this.yawRad;
    return new pc.Vec3(-Math.sin(y), 0, -Math.cos(y));
  }

  update(dt: number, input: Input, focus: pc.Vec3, speedXZ: number): void {
    this.yaw -= input.look.x * CAM.mouseSens;
    this.pitch = pc.math.clamp(this.pitch + input.look.y * CAM.mouseSens, CAM.pitchMin, CAM.pitchMax);

    this.target.set(focus.x, focus.y + CAM.height, focus.z);
    const t = 1 - Math.exp(-dt * CAM.followLag);
    this.smoothTarget.lerp(this.smoothTarget, this.target, t);
    // never lag vertically on big drops — it reads as camera "detaching"
    if (Math.abs(this.target.y - this.smoothTarget.y) > 2) this.smoothTarget.y = this.target.y;

    const yawR = this.yawRad, pitchR = this.pitch * pc.math.DEG_TO_RAD;
    const cp = Math.cos(pitchR);
    // camera sits behind the player along +Z in yaw space (player faces -Z at yaw 0)
    this.tmp.set(Math.sin(yawR) * cp, Math.sin(pitchR), Math.cos(yawR) * cp);

    // shorten the boom if geometry (or a visual occluder: island body, tree canopy) sits between focus and camera
    let dist = CAM.distance;
    const hit = this.world.raycastCamera(this.smoothTarget, this.tmp, CAM.distance + 0.3);
    if (hit) dist = Math.max(0.5, hit.dist - 0.3);
    this.boomDist += (dist - this.boomDist) * (dist < this.boomDist ? 1 : 1 - Math.exp(-dt * 6));
    const pos = this.tmp.mulScalar(this.boomDist).add(this.smoothTarget);

    // keep camera above ground a little when looking up from below a platform
    pos.y = Math.max(pos.y, focus.y + 0.4);

    this.fovPulse = Math.max(0, this.fovPulse - dt * 40);
    this.shake = Math.max(0, this.shake - dt * CAM.shakeDecay * this.shake - dt * 0.2);
    if (this.shake > 0.001) {
      const tt = performance.now() * 0.02 + this.shakeSeed;
      pos.x += Math.sin(tt * 1.3) * this.shake * 0.08;
      pos.y += Math.cos(tt * 1.7) * this.shake * 0.08;
    }

    this.entity.setPosition(pos);
    this.entity.lookAt(this.smoothTarget);

    const speedK = pc.math.clamp((speedXZ - 6) / 18, 0, 1);
    const cam = this.entity.camera!;
    const targetFov = CAM.baseFov + speedK * CAM.speedFov + this.flow * CAM.flowFov + this.fovPulse;
    cam.fov = pc.math.lerp(cam.fov, targetFov, 1 - Math.exp(-dt * 10));
  }
}

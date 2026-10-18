import * as pc from 'playcanvas';
import type { Input } from '../core/Input';
import { CollisionWorld, type Contact } from '../world/Colliders';

export type MoveState = 'ground' | 'air' | 'dash';

/** All feel-tuning in one place. Units: metres, seconds. */
export const TUNING = {
  radius: 0.4,
  height: 1.8,
  runSpeed: 9.0,
  groundAccel: 45,
  groundDecel: 60,
  airAccel: 22,
  airDrag: 0.5,
  gravity: 30,
  maxFall: 45,
  jumpVelocity: 10.5,
  jumpCutMultiplier: 0.45,
  coyoteTime: 0.12,
  jumpBuffer: 0.14,
  dashSpeed: 24,
  dashDuration: 0.17,
  dashCooldown: 0.35,
  dashEndSpeedKeep: 0.55,
  dashCharges: 1,
  killY: -30,
};

const _wish = new pc.Vec3();
const _tmp = new pc.Vec3();

export class Movement {
  readonly position = new pc.Vec3();
  readonly velocity = new pc.Vec3();
  /** Unit XZ facing (where the body points). */
  readonly facing = new pc.Vec3(0, 0, -1);
  state: MoveState = 'air';
  grounded = false;
  groundNormal = new pc.Vec3(0, 1, 0);
  wallContact: Contact | null = null;

  dashChargesLeft = TUNING.dashCharges;
  private coyote = 0;
  private jumpBuf = 0;
  private dashTimer = 0;
  private dashCd = 0;
  private dashDir = new pc.Vec3();
  private contacts: Contact[] = [];
  private jumpHeld = false;

  /** Events for VFX/camera/audio hooks. Cleared each frame by consumer. */
  readonly events: string[] = [];

  constructor(private world: CollisionWorld) {}

  respawn(at: pc.Vec3): void {
    this.position.copy(at);
    this.velocity.set(0, 0, 0);
    this.state = 'air';
    this.dashChargesLeft = TUNING.dashCharges;
    this.dashTimer = 0; this.dashCd = 0; this.coyote = 0; this.jumpBuf = 0;
    this.events.push('respawn');
  }

  get speedXZ(): number { return Math.hypot(this.velocity.x, this.velocity.z); }

  /**
   * @param input  current input
   * @param camYaw camera yaw in radians (0 = looking down -Z)
   */
  update(dt: number, input: Input, camYaw: number): void {
    const T = TUNING;
    dt = Math.min(dt, 1 / 30);

    // --- wish direction (camera relative) --------------------------------------------
    const s = Math.sin(camYaw), c = Math.cos(camYaw);
    // forward = (-sin yaw, 0, -cos yaw); right = (cos yaw, 0, -sin yaw)
    _wish.set(-s * input.move.y + c * input.move.x, 0, -c * input.move.y - s * input.move.x);
    const wishLen = Math.min(1, _wish.length());
    if (wishLen > 0.001) _wish.mulScalar(1 / _wish.length());

    // --- timers -----------------------------------------------------------------------
    this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    if (input.wasPressed('jump')) this.jumpBuf = T.jumpBuffer;
    if (input.wasPressed('jump')) this.jumpHeld = true;
    if (input.wasReleased('jump')) this.jumpHeld = false;

    // --- dash start -------------------------------------------------------------------
    if (input.wasPressed('dash') && this.state !== 'dash' && this.dashCd <= 0 && this.dashChargesLeft > 0) {
      this.dashDir.copy(wishLen > 0.001 ? _wish : this.facing);
      this.dashDir.y = 0; this.dashDir.normalize();
      this.state = 'dash';
      this.dashTimer = T.dashDuration;
      this.dashChargesLeft--;
      this.events.push('dash');
    }

    // --- state integration ------------------------------------------------------------
    if (this.state === 'dash') {
      this.velocity.copy(this.dashDir).mulScalar(T.dashSpeed);
      this.velocity.y = 0;
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.velocity.mulScalar(T.dashEndSpeedKeep);
        this.state = this.grounded ? 'ground' : 'air';
        this.dashCd = T.dashCooldown;
      }
    } else {
      // horizontal
      const accel = this.grounded ? T.groundAccel : T.airAccel;
      const target = wishLen * T.runSpeed;
      _tmp.set(this.velocity.x, 0, this.velocity.z);
      const cur = _tmp.length();
      if (wishLen > 0.001) {
        // accelerate toward wish velocity
        const vx = _wish.x * target, vz = _wish.z * target;
        const dx = vx - this.velocity.x, dz = vz - this.velocity.z;
        const dl = Math.hypot(dx, dz);
        const step = accel * dt;
        if (dl <= step || dl < 1e-6) { this.velocity.x = vx; this.velocity.z = vz; }
        else { this.velocity.x += (dx / dl) * step; this.velocity.z += (dz / dl) * step; }
      } else if (this.grounded && cur > 0) {
        const nv = Math.max(0, cur - T.groundDecel * dt);
        const k = nv / cur;
        this.velocity.x *= k; this.velocity.z *= k;
      } else if (!this.grounded) {
        const k = Math.max(0, 1 - T.airDrag * dt);
        this.velocity.x *= k; this.velocity.z *= k;
      }
      // gravity
      this.velocity.y = Math.max(-T.maxFall, this.velocity.y - T.gravity * dt);
      // jump
      const canJump = this.grounded || this.coyote > 0;
      if (this.jumpBuf > 0 && canJump) {
        this.velocity.y = T.jumpVelocity;
        this.jumpBuf = 0; this.coyote = 0;
        this.grounded = false; this.state = 'air';
        this.events.push('jump');
      }
      // variable jump height
      if (!this.jumpHeld && this.velocity.y > T.jumpVelocity * T.jumpCutMultiplier && !this.grounded) {
        this.velocity.y = T.jumpVelocity * T.jumpCutMultiplier;
      }
    }

    // --- move + collide (substep fast movement so we never tunnel a 0.4 m capsule) ---------
    const speed = this.velocity.length();
    const steps = Math.max(1, Math.ceil((speed * dt) / (T.radius * 0.8)));
    const sdt = dt / steps;
    const wasGrounded = this.grounded;
    let groundedNow = false;
    this.wallContact = null;
    for (let i = 0; i < steps; i++) {
      this.position.x += this.velocity.x * sdt;
      this.position.y += this.velocity.y * sdt;
      this.position.z += this.velocity.z * sdt;
      this.world.resolveCapsule(this.position, T.radius, T.height, this.contacts);
      for (const ct of this.contacts) {
        const n = ct.normal;
        const vn = this.velocity.dot(n);
        if (vn < 0) { this.velocity.x -= n.x * vn; this.velocity.y -= n.y * vn; this.velocity.z -= n.z * vn; }
        if (n.y > 0.65) { groundedNow = true; this.groundNormal.copy(n); }
        else if (Math.abs(n.y) < 0.35) this.wallContact = ct;
      }
    }

    // ground probe keeps us "grounded" over tiny seams and lets coyote work off edges
    if (!groundedNow && wasGrounded && this.velocity.y <= 0.01) {
      _tmp.set(this.position.x, this.position.y + 0.05, this.position.z);
      const hit = this.world.raycastDown(_tmp, 0.15);
      if (hit) { groundedNow = true; this.position.y -= hit.dist - 0.05; this.velocity.y = 0; }
    }

    if (groundedNow && !wasGrounded) {
      this.events.push(this.velocity.y < -12 ? 'land-hard' : 'land');
      this.dashChargesLeft = TUNING.dashCharges;
    }
    if (!groundedNow && wasGrounded && this.state !== 'dash') this.coyote = T.coyoteTime;
    this.grounded = groundedNow;
    if (this.state !== 'dash') this.state = groundedNow ? 'ground' : 'air';
    if (groundedNow && this.state === 'ground' && this.velocity.y < 0) this.velocity.y = 0;

    // --- facing -----------------------------------------------------------------------
    const hs = this.speedXZ;
    if (hs > 0.5) {
      _tmp.set(this.velocity.x, 0, this.velocity.z).normalize();
      const t = 1 - Math.exp(-dt * 14);
      this.facing.lerp(this.facing, _tmp, t).normalize();
    }

    if (this.position.y < T.killY) this.events.push('fell');
  }
}

import * as pc from 'playcanvas';
import type { Input } from '../core/Input';
import { CollisionWorld, type Contact } from '../world/Colliders';

export type MoveState = 'ground' | 'air' | 'dash' | 'wallrun' | 'slide' | 'grapple' | 'vault';

/** All feel-tuning in one place. Units: metres, seconds. */
export const TUNING = {
  radius: 0.4,
  height: 1.8,
  slideHeight: 0.9,
  runSpeed: 9.5,
  groundAccel: 48,
  groundDecel: 60,
  airAccel: 24,
  airDrag: 0.4,
  gravity: 30,
  maxFall: 45,
  jumpVelocity: 10.8,
  jumpCutMultiplier: 0.45,
  coyoteTime: 0.12,
  jumpBuffer: 0.14,
  dashSpeed: 25,
  dashDuration: 0.17,
  dashCooldown: 0.3,
  dashEndSpeedKeep: 0.6,
  // wall-run
  wallRunMinSpeed: 5,
  wallRunTime: 1.5,
  wallRunGravity: 0.22,
  wallRunKick: 2.5,
  wallJumpOut: 7.5,
  wallJumpUp: 9.5,
  // slide
  slideTime: 0.75,
  slideBoost: 1.25,
  slideMinSpeed: 6,
  // vault
  vaultMaxHeight: 1.35,
  // grapple
  grappleRange: 20,
  grappleSwingTime: 1.5,
  grapplePull: 14,
  grappleReleaseBoost: 1.12,
  killY: -32,
};

/** Per-run stats modified by upgrades. */
export interface RunStats {
  airJumps: number;
  dashCharges: number;
  grappleRange: number;
  speedMult: number;
  wallRunTime: number;
  coyoteBonus: number;
  jumpMult: number;
  grappleBoost: number;
  dashResetOnTrick: boolean;
  magnetRadius: number;
  flowDecayMult: number;
  riftShield: number;
}
export const defaultStats = (): RunStats => ({
  airJumps: 0, dashCharges: 1, grappleRange: TUNING.grappleRange, speedMult: 1, wallRunTime: TUNING.wallRunTime,
  coyoteBonus: 0, jumpMult: 1, grappleBoost: 1, dashResetOnTrick: false, magnetRadius: 1.6, flowDecayMult: 1, riftShield: 0,
});

export type MoveEvent =
  | 'jump' | 'djump' | 'dash' | 'land' | 'land-hard' | 'fell' | 'respawn'
  | 'wallrun' | 'wallrun-end' | 'walljump' | 'slide' | 'slide-end' | 'vault'
  | 'grapple' | 'grapple-release';

const _wish = new pc.Vec3();
const _tmp = new pc.Vec3();
const _tmp2 = new pc.Vec3();

export class Movement {
  readonly position = new pc.Vec3();
  readonly velocity = new pc.Vec3();
  readonly facing = new pc.Vec3(0, 0, -1);
  state: MoveState = 'air';
  grounded = false;
  groundNormal = new pc.Vec3(0, 1, 0);
  wallContact: Contact | null = null;
  /** -1 wall on left, +1 wall on right (valid while wall-running). */
  wallSide = 0;
  wallNormal = new pc.Vec3();
  stats: RunStats = defaultStats();
  readonly events: MoveEvent[] = [];
  grappleAnchor: pc.Vec3 | null = null;
  /** Set per run from the route's lowest surface so descending routes never spawn below it. */
  killY = TUNING.killY;
  /** Supplied by game: nearest valid anchor for a grapple request. */
  anchorProvider: ((pos: pc.Vec3, fwd: pc.Vec3, range: number) => pc.Vec3 | null) | null = null;

  dashChargesLeft = 1;
  airJumpsLeft = 0;
  private coyote = 0;
  private jumpBuf = 0;
  private dashTimer = 0;
  private dashCd = 0;
  private dashDir = new pc.Vec3();
  private wallTimer = 0;
  private wallCooldown = 0;
  private slideTimer = 0;
  private vaultTimer = 0;
  private grappleTimer = 0;
  private grappleLen = 0;
  private contacts: Contact[] = [];
  private jumpHeld = false;
  private airTime = 0;

  constructor(private world: CollisionWorld) {}

  get height(): number { return this.state === 'slide' ? TUNING.slideHeight : TUNING.height; }
  get speedXZ(): number { return Math.hypot(this.velocity.x, this.velocity.z); }
  get airTimeSec(): number { return this.airTime; }

  respawn(at: pc.Vec3): void {
    this.position.copy(at);
    this.velocity.set(0, 0, 0);
    this.state = 'air';
    this.dashChargesLeft = this.stats.dashCharges;
    this.airJumpsLeft = this.stats.airJumps;
    this.dashTimer = this.dashCd = this.coyote = this.jumpBuf = this.wallTimer = this.slideTimer = this.grappleTimer = this.vaultTimer = 0;
    this.grappleAnchor = null;
    this.events.push('respawn');
  }

  update(dt: number, input: Input, camYaw: number): void {
    const T = TUNING, S = this.stats;
    dt = Math.min(dt, 1 / 30);
    const runSpeed = T.runSpeed * S.speedMult;

    // --- wish direction (camera relative) ---------------------------------------------------
    const s = Math.sin(camYaw), c = Math.cos(camYaw);
    _wish.set(-s * input.move.y + c * input.move.x, 0, -c * input.move.y - s * input.move.x);
    const wishLen = Math.min(1, _wish.length());
    if (wishLen > 0.001) _wish.mulScalar(1 / _wish.length());

    // --- timers -----------------------------------------------------------------------------
    this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.wallCooldown = Math.max(0, this.wallCooldown - dt);
    if (input.wasPressed('jump')) { this.jumpBuf = T.jumpBuffer; this.jumpHeld = true; }
    if (input.wasReleased('jump')) this.jumpHeld = false;
    this.airTime = this.grounded ? 0 : this.airTime + dt;

    // --- grapple request ----------------------------------------------------------------------
    if (input.wasPressed('grapple')) {
      if (this.state === 'grapple') this.releaseGrapple();
      else if (this.anchorProvider) {
        const fwd = wishLen > 0.001 ? _wish : this.facing;
        const a = this.anchorProvider(this.position, fwd, S.grappleRange);
        if (a) this.startGrapple(a);
      }
    }

    // --- dash start ---------------------------------------------------------------------------
    if (input.wasPressed('dash') && this.state !== 'dash' && this.state !== 'grapple' && this.dashCd <= 0 && this.dashChargesLeft > 0) {
      this.dashDir.copy(wishLen > 0.001 ? _wish : this.facing);
      this.dashDir.y = 0; this.dashDir.normalize();
      this.endWallRun(false);
      this.state = 'dash';
      this.dashTimer = T.dashDuration;
      this.dashChargesLeft--;
      this.events.push('dash');
    }

    // --- slide start --------------------------------------------------------------------------
    if (input.wasPressed('slide') && this.grounded && this.state === 'ground' && this.speedXZ > T.slideMinSpeed) {
      this.state = 'slide';
      this.slideTimer = T.slideTime;
      this.velocity.x *= T.slideBoost; this.velocity.z *= T.slideBoost;
      this.events.push('slide');
    }

    // --- state integration --------------------------------------------------------------------
    switch (this.state) {
      case 'dash': {
        this.velocity.copy(this.dashDir).mulScalar(T.dashSpeed);
        this.velocity.y = 0;
        this.dashTimer -= dt;
        if (this.dashTimer <= 0) {
          this.velocity.mulScalar(T.dashEndSpeedKeep);
          this.state = this.grounded ? 'ground' : 'air';
          this.dashCd = T.dashCooldown;
        }
        break;
      }
      case 'grapple': {
        this.grappleTimer += dt;
        const a = this.grappleAnchor!;
        _tmp.sub2(this.position, a);
        const dist = _tmp.length();
        this.velocity.y -= T.gravity * dt;
        _tmp2.set(-_tmp.x, 0, -_tmp.z).normalize();
        this.velocity.x += _tmp2.x * T.grapplePull * dt;
        this.velocity.z += _tmp2.z * T.grapplePull * dt;
        if (dist > this.grappleLen) {
          _tmp.mulScalar(1 / dist);
          const vr = this.velocity.dot(_tmp);
          if (vr > 0) { this.velocity.x -= _tmp.x * vr; this.velocity.y -= _tmp.y * vr; this.velocity.z -= _tmp.z * vr; }
          this.position.copy(a).add(_tmp.mulScalar(this.grappleLen));
        }
        const past = (this.position.z - a.z) * this.facing.z > 0 && this.velocity.y > 1;
        if (past || this.grappleTimer > T.grappleSwingTime) this.releaseGrapple();
        break;
      }
      case 'wallrun': {
        this.wallTimer -= dt;
        const n = this.wallNormal;
        const tx = -n.z * this.wallSide, tz = n.x * this.wallSide;
        const sp = Math.max(runSpeed, this.speedXZ);
        this.velocity.x = tx * sp - n.x * 1.5;
        this.velocity.z = tz * sp - n.z * 1.5;
        this.velocity.y -= T.gravity * T.wallRunGravity * dt;
        if (this.jumpBuf > 0) {
          this.jumpBuf = 0;
          this.velocity.x = tx * sp * 0.9 + n.x * T.wallJumpOut;
          this.velocity.z = tz * sp * 0.9 + n.z * T.wallJumpOut;
          this.velocity.y = T.wallJumpUp * S.jumpMult;
          this.endWallRun(true);
          this.events.push('walljump');
          if (S.dashResetOnTrick) this.dashChargesLeft = S.dashCharges;
          break;
        }
        _tmp.set(this.position.x, this.position.y + 1, this.position.z);
        _tmp2.copy(n).mulScalar(-1);
        const hit = this.world.raycast(_tmp, _tmp2, 1.0);
        if (!hit || hit.box.tag !== 'wall' || this.wallTimer <= 0) this.endWallRun(false);
        break;
      }
      case 'slide': {
        this.slideTimer -= dt;
        const cur = this.speedXZ;
        if (cur > 0) { const k = Math.max(0, cur - 4 * dt) / cur; this.velocity.x *= k; this.velocity.z *= k; }
        this.velocity.y = Math.max(-T.maxFall, this.velocity.y - T.gravity * dt);
        if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
          this.doJump(T.jumpVelocity * S.jumpMult, 'jump');
          this.state = 'air';
          this.events.push('slide-end');
        } else if (this.slideTimer <= 0 || cur < 2.5 || !this.grounded) {
          this.state = this.grounded ? 'ground' : 'air';
          this.events.push('slide-end');
        }
        break;
      }
      case 'vault': {
        this.vaultTimer -= dt;
        this.velocity.y = 0;
        if (this.vaultTimer <= 0) this.state = 'air';
        break;
      }
      default: {
        const accel = this.grounded ? T.groundAccel : T.airAccel;
        const target = wishLen * runSpeed;
        _tmp.set(this.velocity.x, 0, this.velocity.z);
        const cur = _tmp.length();
        if (wishLen > 0.001) {
          // in the air, steering never bleeds speed below what we already have
          const keep = !this.grounded && cur > target;
          const sp = keep ? cur : target;
          const dx = _wish.x * sp - this.velocity.x, dz = _wish.z * sp - this.velocity.z;
          const dl = Math.hypot(dx, dz);
          const step = accel * dt;
          if (dl <= step || dl < 1e-6) { this.velocity.x += dx; this.velocity.z += dz; }
          else { this.velocity.x += (dx / dl) * step; this.velocity.z += (dz / dl) * step; }
        } else if (this.grounded && cur > 0) {
          const k = Math.max(0, cur - T.groundDecel * dt) / cur;
          this.velocity.x *= k; this.velocity.z *= k;
        } else if (!this.grounded) {
          const k = Math.max(0, 1 - T.airDrag * dt);
          this.velocity.x *= k; this.velocity.z *= k;
        }
        this.velocity.y = Math.max(-T.maxFall, this.velocity.y - T.gravity * dt);

        const canJump = this.grounded || this.coyote > 0;
        if (this.jumpBuf > 0) {
          if (canJump) this.doJump(T.jumpVelocity * S.jumpMult, 'jump');
          else if (this.airJumpsLeft > 0) {
            this.airJumpsLeft--;
            if (wishLen > 0.001) { const sp = Math.max(cur, runSpeed * 0.8); this.velocity.x = _wish.x * sp; this.velocity.z = _wish.z * sp; }
            this.doJump(T.jumpVelocity * 0.95 * S.jumpMult, 'djump');
          }
        }
        if (!this.jumpHeld && this.velocity.y > T.jumpVelocity * T.jumpCutMultiplier && !this.grounded) {
          this.velocity.y = T.jumpVelocity * T.jumpCutMultiplier;
        }
      }
    }

    // --- move + collide (substep so we never tunnel) --------------------------------------------
    const h = this.height;
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
      this.world.resolveCapsule(this.position, T.radius, h, this.contacts);
      for (const ct of this.contacts) {
        const n = ct.normal;
        const vn = this.velocity.dot(n);
        if (vn < 0 && this.state !== 'wallrun') { this.velocity.x -= n.x * vn; this.velocity.y -= n.y * vn; this.velocity.z -= n.z * vn; }
        if (n.y > 0.65) { groundedNow = true; this.groundNormal.copy(n); }
        else if (Math.abs(n.y) < 0.35) this.wallContact = ct;
      }
    }

    if (!groundedNow && wasGrounded && this.velocity.y <= 0.01 && this.state !== 'wallrun' && this.state !== 'grapple') {
      _tmp.set(this.position.x, this.position.y + 0.05, this.position.z);
      const hit = this.world.raycastDown(_tmp, 0.15);
      if (hit) { groundedNow = true; this.position.y -= hit.dist - 0.05; this.velocity.y = 0; }
    }

    // --- vault: low obstacle ahead while moving on the ground -> hop onto it ----------------------
    if (groundedNow && this.wallContact && this.speedXZ > 3 && this.state !== 'slide') {
      const n = this.wallContact.normal;
      if (-(this.velocity.x * n.x + this.velocity.z * n.z) > 2) {
        _tmp.set(this.position.x - n.x * 0.9, this.position.y + T.vaultMaxHeight + 0.3, this.position.z - n.z * 0.9);
        const hit = this.world.raycastDown(_tmp, T.vaultMaxHeight + 0.3);
        if (hit && hit.box.tag !== 'wall') {
          const topY = _tmp.y - hit.dist;
          if (topY - this.position.y > 0.3 && topY - this.position.y <= T.vaultMaxHeight) {
            this.position.y = topY + 0.02;
            this.position.x -= n.x * 0.6; this.position.z -= n.z * 0.6;
            this.velocity.y = 0;
            this.state = 'vault'; this.vaultTimer = 0.25;
            this.events.push('vault');
          }
        }
      }
    }

    // --- wall-run start: airborne, fast, touching a wall side-on ------------------------------------
    if (!groundedNow && this.wallContact && this.state === 'air' && this.wallCooldown <= 0 && this.wallContact.collider.tag === 'wall' && this.speedXZ > T.wallRunMinSpeed && this.airTime > 0.08) {
      const n = this.wallContact.normal;
      _tmp.set(this.velocity.x, 0, this.velocity.z).normalize();
      const into = -(_tmp.x * n.x + _tmp.z * n.z);
      if (into < 0.85) {
        this.wallNormal.set(n.x, 0, n.z).normalize();
        const cx = -this.wallNormal.z, cz = this.wallNormal.x;
        this.wallSide = (cx * _tmp.x + cz * _tmp.z) >= 0 ? 1 : -1;
        this.state = 'wallrun';
        this.wallTimer = S.wallRunTime;
        this.velocity.y = Math.max(this.velocity.y, 0) + T.wallRunKick;
        this.airJumpsLeft = S.airJumps;
        if (S.dashResetOnTrick) this.dashChargesLeft = S.dashCharges;
        this.events.push('wallrun');
      }
    }

    if (groundedNow && !wasGrounded && this.state !== 'vault') {
      this.events.push(this.velocity.y < -14 ? 'land-hard' : 'land');
      this.dashChargesLeft = S.dashCharges;
      this.airJumpsLeft = S.airJumps;
      if (this.state === 'grapple') this.releaseGrapple();
    }
    if (!groundedNow && wasGrounded && this.state === 'ground') this.coyote = T.coyoteTime + S.coyoteBonus;
    this.grounded = groundedNow;
    if (this.state === 'ground' || this.state === 'air') this.state = groundedNow ? 'ground' : 'air';
    if (this.state === 'wallrun' && groundedNow) this.endWallRun(false);
    if (groundedNow && (this.state === 'ground' || this.state === 'slide') && this.velocity.y < 0) this.velocity.y = 0;

    // --- facing ---------------------------------------------------------------------------------
    if (this.speedXZ > 0.5) {
      _tmp.set(this.velocity.x, 0, this.velocity.z).normalize();
      const t = 1 - Math.exp(-dt * (this.state === 'wallrun' ? 30 : 14));
      this.facing.lerp(this.facing, _tmp, t).normalize();
    }

    if (this.position.y < this.killY) this.events.push('fell');
  }

  private doJump(v: number, ev: MoveEvent): void {
    this.velocity.y = v;
    this.jumpBuf = 0; this.coyote = 0;
    this.grounded = false;
    if (this.state === 'ground') this.state = 'air';
    this.events.push(ev);
  }

  private startGrapple(anchor: pc.Vec3): void {
    this.endWallRun(false);
    this.grappleAnchor = anchor.clone();
    this.grappleLen = Math.max(3, this.position.distance(anchor) * 0.92);
    this.grappleTimer = 0;
    this.state = 'grapple';
    _tmp.sub2(anchor, this.position).normalize();
    this.velocity.x += _tmp.x * 5; this.velocity.z += _tmp.z * 5;
    this.velocity.y = Math.max(this.velocity.y, 2);
    this.events.push('grapple');
    if (this.stats.dashResetOnTrick) this.dashChargesLeft = this.stats.dashCharges;
  }

  private releaseGrapple(): void {
    if (this.state !== 'grapple') return;
    const k = TUNING.grappleReleaseBoost * this.stats.grappleBoost;
    this.velocity.x *= k; this.velocity.z *= k;
    this.velocity.y = Math.max(this.velocity.y, 3) * k;
    this.grappleAnchor = null;
    this.state = this.grounded ? 'ground' : 'air';
    this.airJumpsLeft = this.stats.airJumps;
    this.events.push('grapple-release');
  }

  private endWallRun(jumped: boolean): void {
    if (this.state !== 'wallrun') return;
    this.state = 'air';
    this.wallCooldown = jumped ? 0.35 : 0.5;
    this.events.push('wallrun-end');
  }
}

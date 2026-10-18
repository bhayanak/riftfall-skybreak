import * as pc from 'playcanvas';
import type { Movement } from './Movement';

type Clip =
  | 'idle' | 'walk' | 'jog' | 'sprint' | 'jump_start' | 'jump_loop' | 'jump_land' | 'land_hard' | 'fall_loop'
  | 'dash' | 'wallrun' | 'slide_start' | 'slide_loop' | 'slide_exit' | 'swing' | 'vault' | 'flip' | 'victory' | 'stumble' | 'knockback';

const LOOPING = new Set<Clip>(['idle', 'walk', 'jog', 'sprint', 'jump_loop', 'fall_loop', 'wallrun', 'slide_loop', 'swing']);

/**
 * Drives the anim component from Movement state. Clips come from player_anims.glb (same rig, bone-name bound).
 * One-shots (jump_start, land, vault, flip, dash) hold for a short time, then locomotion takes over.
 */
export class PlayerAnimation {
  private anim: pc.AnimComponent;
  private current: Clip | null = null;
  private hold = 0;
  private landHoldHard = false;

  constructor(entity: pc.Entity, tracks: Map<string, pc.AnimTrack>) {
    this.anim = entity.addComponent('anim', { activate: true }) as pc.AnimComponent;
    for (const [name, track] of tracks) {
      this.anim.assignAnimation(name, track, undefined, 1, LOOPING.has(name as Clip));
    }
    this.play('idle', 0);
  }

  update(dt: number, m: Movement): void {
    const layer = this.anim.baseLayer;
    if (!layer) return;
    this.hold = Math.max(0, this.hold - dt);

    for (const ev of m.events) {
      switch (ev) {
        case 'jump': this.play('jump_start', 0.05, 0.28); break;
        case 'djump': this.play('flip', 0.05, 0.6); break;
        case 'dash': this.play('dash', 0.04, 0.3); break;
        case 'land': this.play('jump_land', 0.05, 0.22); break;
        case 'land-hard': this.play('land_hard', 0.05, 0.55); break;
        case 'vault': this.play('vault', 0.05, 0.45); break;
        case 'walljump': this.play('jump_start', 0.05, 0.25); break;
      }
    }
    if (this.hold > 0) { this.setSpeed(1); return; }

    const speed = m.speedXZ;
    let next: Clip;
    switch (m.state) {
      case 'wallrun': next = 'wallrun'; break;
      case 'grapple': next = 'swing'; break;
      case 'slide': next = 'slide_loop'; break;
      case 'dash': next = 'dash'; break;
      case 'vault': next = 'vault'; break;
      case 'air': next = m.velocity.y < -9 && m.airTimeSec > 0.6 ? 'fall_loop' : 'jump_loop'; break;
      default: next = speed < 0.4 ? 'idle' : speed < 3.5 ? 'walk' : speed < 7.5 ? 'jog' : 'sprint';
    }
    this.play(next, next === 'idle' ? 0.25 : 0.14);
    // locomotion playback rate follows actual speed so feet don't slide
    this.setSpeed(next === 'sprint' ? pc.math.clamp(speed / 9.5, 0.8, 1.6) : next === 'jog' ? pc.math.clamp(speed / 6, 0.8, 1.4) : 1);
    void this.landHoldHard;
  }

  private play(clip: Clip, blend: number, hold = 0): void {
    const layer = this.anim.baseLayer;
    if (!layer) return;
    if (this.current !== clip) {
      layer.transition(clip, blend);
      this.current = clip;
    } else if (hold > 0) {
      layer.play(clip);   // restart the one-shot
    }
    this.hold = Math.max(this.hold, hold);
  }

  private setSpeed(s: number): void { this.anim.speed = s; }
}

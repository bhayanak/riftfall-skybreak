import * as pc from 'playcanvas';
import type { Input } from '../core/Input';
import type { Assets } from '../core/Assets';
import { Movement, TUNING } from './Movement';
import { PlayerAnimation } from './PlayerAnimation';
import type { CollisionWorld } from '../world/Colliders';
import { emissive, flat } from '../world/Island';
import type { Suit, GearSlot } from '../progression/Market';

/** Quaternius character faces +Z in glTF; the game's forward is -Z. */
const MODEL_YAW = 180;
const HAIRS = ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_Long', 'Hair_Buns', 'Hair_Beard'];

export class Player {
  readonly entity: pc.Entity;
  readonly movement: Movement;
  readonly anim: PlayerAnimation;
  private visual: pc.Entity;
  readonly model: pc.Entity;
  private rope: pc.Entity;
  private lean = 0;
  private head: pc.Entity | null;
  private spine: pc.Entity | null;
  /** gear per slot: root entity (parented to visual) + the bone it follows + its offset from that bone */
  private gear = new Map<GearSlot, { root: pc.Entity; bone: pc.Entity | null; offset: pc.Vec3; style: string }>();
  private capeT = 0;

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
    this.head = this.model.findByName('Head') as pc.Entity | null;
    this.spine = this.model.findByName('spine_03') as pc.Entity | null;
    this.setHair('Hair_SimpleParted');

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
    for (const r of this.model.findComponents('render') as pc.RenderComponent[]) r.enabled = v && !this.hiddenHair.has(r.entity.name);
    for (const g of this.gear.values()) g.root.enabled = v;
  }

  /** Five-zone outfit (materials split by bone at build time) with a cloth or plated finish and optional glow trim. */
  setSuit(s: Suit): void {
    const zone: Record<string, pc.Color> = { MI_Suit_Torso: s.torso, MI_Suit_Sleeves: s.sleeves, MI_Suit_Gloves: s.gloves, MI_Suit_Pants: s.pants, MI_Suit_Boots: s.boots };
    for (const r of this.model.findComponents('render') as pc.RenderComponent[]) {
      for (const mi of r.meshInstances) {
        const m = mi.material as pc.StandardMaterial;
        const col = m?.name && zone[m.name.replace(/\.\d+$/, '')];
        if (!col) continue;
        m.diffuse = col;
        m.useMetalness = true;
        m.metalness = s.metal ? 0.45 : 0;
        m.gloss = s.metal ? 0.75 : 0.42;
        const trim = m.name.includes('Gloves') || m.name.includes('Boots');
        m.emissive = s.glow && trim ? s.glow : pc.Color.BLACK;
        m.emissiveIntensity = s.glow && trim ? 0.35 : 1;
        m.update();
      }
    }
  }

  private hiddenHair = new Set<string>(HAIRS);
  /** Show one hairstyle mesh from the GLB ('' = none). Eyebrows are always on; the beard is gear. */
  setHair(mesh: string): void {
    this.hiddenHair = new Set(HAIRS.filter((h) => h !== mesh && h !== 'Hair_Beard'));
    this.hiddenHair.add('Eyebrows_Female'); this.hiddenHair.add('Eyebrows_Regular');   // the base head already has brows
    if (!this.beardOn) this.hiddenHair.add('Hair_Beard');
    for (const r of this.model.findComponents('render') as pc.RenderComponent[]) r.enabled = this.visible && !this.hiddenHair.has(r.entity.name);
  }
  private beardOn = false;

  /** Equip a gear style into a slot (style 'none' clears it). */
  setGear(slot: GearSlot, style: string, color: pc.Color): void {
    const old = this.gear.get(slot);
    if (old) { old.root.destroy(); this.gear.delete(slot); }
    if (slot === 'face') { this.beardOn = style === 'beard'; this.setHair(this.currentHair()); if (style === 'beard') return; }
    if (style === 'none') return;
    const root = new pc.Entity(`gear-${slot}`);
    this.visual.addChild(root);
    const offset = new pc.Vec3();
    let bone: pc.Entity | null = null;
    const mat = (c: pc.Color, metal = false, glow = 0) => { const m = flat(c, metal ? 0.8 : 0.4); if (metal) { m.metalness = 0.9; } if (glow) { m.emissive = c; m.emissiveIntensity = glow; } m.update(); return m; };
    const box = (parent: pc.Entity, m: pc.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, type: 'box' | 'sphere' | 'cylinder' | 'torus' | 'cone' = 'box') => {
      const e = new pc.Entity();
      e.addComponent('render', { type, material: m });
      e.render!.castShadows = type !== 'torus';
      e.setLocalScale(sx, sy, sz); e.setLocalPosition(x, y, z); e.setLocalEulerAngles(rx, ry, rz);
      parent.addChild(e);
      return e;
    };
    switch (style) {
      case 'cape': {
        bone = this.spine; offset.set(0, 0.2, 0.12);
        const m = mat(color); m.cull = pc.CULLFACE_NONE; m.update();
        // a flattened cone, apex at the shoulders: a tapered sheet that swings back as a whole
        const seg = new pc.Entity('cape-seg');
        root.addChild(seg);
        const sheet = box(seg, m, 0.62, 1.35, 0.07, 0, -0.68, 0.04, 0, 0, 0, 'cone');
        sheet.setLocalEulerAngles(180, 0, 0);   // cone apex is +Y; hang it apex-up
        box(seg, m, 0.5, 0.06, 0.06, 0, 0, 0.02);   // collar
        break;
      }
      case 'wings': {
        bone = this.spine; offset.set(0, 0.15, 0.12);
        const m = emissive(color, 0.6, 0.45, true); m.cull = pc.CULLFACE_NONE; m.update();
        for (const sx of [-1, 1]) {
          const w = box(root, m, 0.7, 0.03, 0.35, sx * 0.45, 0.1, 0.1, 0, 0, sx * -25);
          w.name = sx < 0 ? 'wing-l' : 'wing-r';
          box(w, m, 0.7, 1, 0.6, sx * 0.55, 0, 0.1, 0, 0, sx * -15);
        }
        break;
      }
      case 'jetpack': {
        bone = this.spine; offset.set(0, 0.0, 0.2);
        const m = mat(color, true), dark = mat(new pc.Color(0.12, 0.12, 0.14), true), hot = emissive(new pc.Color(0.4, 0.8, 1), 2.5);
        for (const sx of [-1, 1]) {
          box(root, m, 0.16, 0.42, 0.16, sx * 0.12, 0, 0, 0, 0, 0, 'cylinder');
          box(root, dark, 0.18, 0.08, 0.18, sx * 0.12, -0.24, 0, 0, 0, 0, 'cylinder');
          box(root, hot, 0.09, 0.04, 0.09, sx * 0.12, -0.29, 0, 0, 0, 0, 'cylinder');
        }
        box(root, dark, 0.3, 0.22, 0.1, 0, 0.05, -0.08);
        break;
      }
      case 'halo': {
        bone = this.head; offset.set(0, 0.38, 0);
        box(root, emissive(color, 2), 0.3, 0.3, 0.3, 0, 0, 0, 90, 0, 0, 'torus');
        const l = new pc.Entity(); l.addComponent('light', { type: 'point', color, intensity: 0.6, range: 2.5, castShadows: false }); root.addChild(l);
        break;
      }
      case 'horns': {
        bone = this.head; offset.set(0, 0.2, 0.02);
        const m = mat(color);
        for (const sx of [-1, 1]) box(root, m, 0.07, 0.26, 0.07, sx * 0.1, 0.08, 0, 0, 0, sx * -25, 'cone');
        break;
      }
      case 'crown': {
        bone = this.head; offset.set(0, 0.22, 0);
        const m = mat(color, true);
        box(root, m, 0.28, 0.08, 0.28, 0, 0, 0, 0, 0, 0, 'cylinder');
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; box(root, m, 0.05, 0.1, 0.05, Math.cos(a) * 0.12, 0.08, Math.sin(a) * 0.12, 0, 0, 0, 'cone'); }
        break;
      }
      case 'visor': {
        bone = this.head; offset.set(0, 0.0, -0.11);
        const m = emissive(color, 1.8, 0.75, false);
        box(root, m, 0.24, 0.06, 0.08, 0, 0, 0);
        box(root, mat(new pc.Color(0.1, 0.1, 0.12), true), 0.26, 0.025, 0.14, 0, 0.045, 0.03);
        break;
      }
      case 'goggles': {
        bone = this.head; offset.set(0, 0.0, -0.1);
        const m = mat(color, true), glass = emissive(new pc.Color(0.6, 0.9, 1), 0.8, 0.6, false);
        for (const sx of [-1, 1]) { box(root, m, 0.09, 0.09, 0.05, sx * 0.055, 0, 0, 90, 0, 0, 'torus'); box(root, glass, 0.075, 0.075, 0.075, sx * 0.055, 0, 0, 0, 0, 0, 'sphere'); }
        box(root, mat(new pc.Color(0.25, 0.15, 0.08)), 0.26, 0.03, 0.22, 0, 0, 0.08);
        break;
      }
    }
    this.gear.set(slot, { root, bone, offset, style });
  }

  private currentHair(): string { return HAIRS.find((h) => h !== 'Hair_Beard' && !this.hiddenHair.has(h)) ?? ''; }

  /** Gear follows its bone's world position but stays upright with the body; the cape swings with speed. */
  private updateGear(dt: number): void {
    const m = this.movement;
    this.capeT += dt;
    for (const g of this.gear.values()) {
      if (!g.bone) continue;
      const p = g.bone.getPosition();
      const r = this.visual.getRotation();
      const o = r.transformVector(g.offset, new pc.Vec3());
      g.root.setPosition(p.x + o.x, p.y + o.y, p.z + o.z);
      g.root.setRotation(r);
      if (g.style === 'cape') {
        const seg = g.root.findByName('cape-seg') as pc.Entity | null;
        if (seg) {
          const lift = pc.math.clamp(m.speedXZ / 12, 0, 1) * 55 + (m.grounded ? 0 : 30) + Math.sin(this.capeT * 9) * 4;
          seg.setLocalEulerAngles(-lift, 0, Math.sin(this.capeT * 5) * 3);
        }
      } else if (g.style === 'wings') {
        const spread = m.grounded ? 15 : 55;
        for (const [n, sx] of [['wing-l', -1], ['wing-r', 1]] as const) {
          const w = g.root.findByName(n) as pc.Entity | null;
          if (w) w.setLocalEulerAngles(0, sx * (spread + Math.sin(this.capeT * 6) * 6), sx * -25);
        }
      }
    }
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
    this.updateGear(dt);

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

import * as pc from 'playcanvas';
import type { Assets, WorldModel } from '../core/Assets';
import { BoxCollider, CollisionWorld } from './Colliders';
import type { Biome } from '../graphics/Environment';
import type { Rng } from './Rng';

export interface IslandSpec {
  x: number; top: number; z: number; w: number; d: number;
  /** decoration density 0..1 */
  decor?: number;
  /** keep the centre lane clear (for narrow runways) */
  lane?: boolean;
  ruins?: boolean;
  checkpoint?: number;
}

/** One built island: visual root + its colliders, so the Rift can sink it later (and restore it on respawn). */
export interface Island {
  root: pc.Entity;
  colliders: BoxCollider[];
  occluders: BoxCollider[];
  x: number;
  z: number;
  top: number;
  w: number;
  d: number;
  falling: number; // seconds since the Rift took it (0 = intact)
  /** side-to-side drift (moving platform); x is the rest position */
  motion?: { amp: number; period: number; phase: number; offset: number; delta: number };
  /** gives way shortly after being stepped on; timer < 0 = armed and counting */
  crumble?: { armed: boolean; timer: number };
  /** Titan slam: sinking slowly (m so far); colliders follow so a quick player can still use it */
  sinkY?: number;
}

/** Kit platforms re-exported with the rim pulled flat, so the whole bounding footprint is walkable. */
const PLATFORM_MODELS: { key: WorldModel; w: number; h: number; d: number }[] = [
  { key: 'island_large', w: 7.38, h: 3.63, d: 5.16 },
  { key: 'island_medium', w: 4.81, h: 2.91, d: 4.81 },
];
const TREE_SETS: Record<string, WorldModel[]> = {
  sky: ['tree', 'tree_fruit', 'pine_1', 'pine_3', 'common_tree_2'],
  fire: ['dead_tree_2', 'dead_tree_2', 'rock_medium_1', 'rock_medium_3'],
  void: ['ruin_column_round', 'rock_medium_2', 'ruin_statue_stag'],
};
const SMALL_SETS: Record<string, WorldModel[]> = {
  sky: ['bush', 'grass_1', 'grass_2', 'rock_1', 'rock_2', 'grass_1', 'grass_2'],
  fire: ['rock_1', 'rock_2', 'rock_1', 'ruin_column_short'],
  void: ['rock_2', 'ruin_column_short', 'rock_1'],
};
const RUINS: WorldModel[] = ['ruin_column_round', 'ruin_column_short', 'ruin_wall_broken', 'ruin_wall_overgrown', 'ruin_arch_round', 'ruin_statue_stag', 'ruin_wall_arch_broken'];
/**
 * Per prop: `solid` = collision footprint (w, h, d at scale 1; trunk for trees), `visual` = full mesh bounds used to
 * keep the running lane and the camera clear. Props without `solid` (grass) are walk-through.
 */
const PROPS: Partial<Record<WorldModel, { solid?: [number, number, number]; visual: [number, number, number] }>> = {
  tree: { solid: [1.1, 8.6, 1.1], visual: [5.6, 8.6, 5.6] }, tree_fruit: { solid: [1.1, 8.6, 1.1], visual: [5.6, 8.6, 5.6] },
  pine_1: { solid: [1.0, 7.0, 1.0], visual: [5.0, 7.1, 5.0] }, pine_3: { solid: [1.0, 7.0, 1.0], visual: [4.0, 7.2, 4.0] },
  common_tree_2: { solid: [1.0, 7.5, 1.0], visual: [4.9, 7.4, 4.9] },
  bush: { solid: [3.0, 2.0, 3.0], visual: [3.6, 2.3, 3.6] },
  rock_1: { solid: [1.5, 1.0, 1.4], visual: [1.7, 1.1, 1.5] }, rock_2: { solid: [1.6, 1.9, 1.5], visual: [1.8, 2.0, 1.5] },
  rock_medium_1: { solid: [3.0, 2.2, 2.8], visual: [3.3, 2.3, 3.0] }, rock_medium_2: { solid: [2.8, 1.9, 2.4], visual: [3.1, 2.0, 2.5] },
  rock_medium_3: { solid: [3.2, 2.3, 3.2], visual: [3.5, 2.4, 3.5] }, dead_tree_2: { solid: [0.9, 6.5, 0.9], visual: [6.8, 11.5, 6.4] },
  grass_1: { visual: [0.6, 0.5, 0.5] }, grass_2: { visual: [1.1, 0.7, 0.5] },
  ruin_column_round: { solid: [0.7, 4.0, 0.7], visual: [0.7, 4.0, 0.7] }, ruin_column_short: { solid: [0.5, 1.8, 0.5], visual: [0.5, 1.8, 0.5] },
  ruin_wall_broken: { solid: [2.0, 2.0, 0.4], visual: [2.0, 2.0, 0.4] }, ruin_wall_overgrown: { solid: [2.0, 2.0, 0.4], visual: [2.0, 2.0, 0.4] },
  ruin_arch_round: { solid: [3.1, 3.5, 0.5], visual: [3.1, 3.5, 0.5] }, ruin_statue_stag: { solid: [1.2, 2.4, 1.2], visual: [2.4, 4.6, 1.3] },
  ruin_wall_arch_broken: { solid: [4.0, 4.0, 0.4], visual: [4.0, 4.0, 0.4] }, ruin_torch: { visual: [0.3, 1.2, 0.5] },
};
/** Half-width of the centre lane that stays free of any solid decoration (measured to the prop's visual edge). */
const LANE = 1.8;

/**
 * Builds floating islands from the Quaternius kit: the kit "floating platform" mesh (grass top, tapered rock
 * underside) scaled so its top is the walkable surface; the collider is an exact box under that top.
 * Decoration is solid (prop colliders) and never placed on the centre running lane.
 */
export class IslandBuilder {
  readonly root = new pc.Entity('world');
  readonly islands: Island[] = [];
  private wallMat!: pc.StandardMaterial;
  private tintCache = new Map<string, pc.Material>();
  private biomeTint: pc.Color | null = null;
  private trees: WorldModel[] = TREE_SETS.sky;
  private small: WorldModel[] = SMALL_SETS.sky;
  private crumbleMat!: pc.StandardMaterial;
  private topMat: pc.StandardMaterial | null = null;
  private waterMat!: pc.StandardMaterial;
  private biomeId = 'sky';
  private t = 0;
  /** 0..1 decoration multiplier (mobile profiles place fewer props). */
  quality = 1;
  /** Scenery that moves on its own: clouds drift along +x, far rocks turn slowly. */
  readonly drifting: { e: pc.Entity; vx: number; spin: number }[] = [];
  /** Hanging waterfalls (sheet + splash ring) that shimmer. */
  private falls: pc.Entity[] = [];

  constructor(app: pc.AppBase, private assets: Assets, private world: CollisionWorld, public rng: Rng) {
    app.root.addChild(this.root);
  }

  setBiome(b: Biome): void {
    this.wallMat = flat(b.stone.clone().mulScalar(0.9), 0.2);
    this.crumbleMat = emissive(b.rift, 0.6);
    this.waterMat = emissive(new pc.Color(0.6, 0.85, 1.0), 0.9, 0.42, true);
    this.biomeId = b.id;
    this.tintCache.clear();
    // the kit is authored for a sunny sky; other biomes pull vegetation/rock toward the biome palette
    this.biomeTint = b.id === 'sky' ? null : b.stone;
    this.trees = TREE_SETS[b.id] ?? TREE_SETS.sky;
    this.small = SMALL_SETS[b.id] ?? SMALL_SETS.sky;
    // walkable top: scorched rock with ember glow in the Fire Rift, glassy ice in the Void
    if (b.id === 'fire') {
      this.topMat = flat(new pc.Color(0.16, 0.08, 0.06), 0.35);
      this.topMat.emissive = b.rift.clone().mulScalar(0.12); this.topMat.update();
    } else if (b.id === 'void') {
      this.topMat = flat(new pc.Color(0.52, 0.62, 0.86), 0.85);
      this.topMat.emissive = new pc.Color(0.08, 0.06, 0.16); this.topMat.update();
    } else this.topMat = null;
  }

  /** Swap the kit's grass material on an island body for the biome top. */
  private applyTop(body: pc.Entity): void {
    if (!this.topMat) return;
    for (const r of body.findComponents('render') as pc.RenderComponent[]) {
      for (const mi of r.meshInstances) if (mi.material?.name === 'IslandGrass') mi.material = this.topMat;
    }
  }

  clear(): void {
    for (const c of this.root.children.slice()) c.destroy();
    this.islands.length = 0;
    this.drifting.length = 0;
    this.falls.length = 0;
    this.world.clear();
  }

  island(s: IslandSpec): Island {
    const root = new pc.Entity('island');
    root.setPosition(s.x, s.top, s.z);
    this.root.addChild(root);
    const colliders: BoxCollider[] = [];
    const occluders: BoxCollider[] = [];

    // walkable collider: thick box whose top is the island top
    const slabH = 1.2;
    colliders.push(this.world.add(new BoxCollider(new pc.Vec3(s.x, s.top - slabH * 0.5, s.z), new pc.Vec3(s.w, slabH, s.d))));

    // body: one flat-topped kit platform stretched to the footprint, top flush with the collider; big islands get
    // a second, lower platform underneath for mass. The whole body is a camera occluder.
    const m = s.w * s.d > 30 ? PLATFORM_MODELS[0] : PLATFORM_MODELS[1];
    const body = this.assets.spawn(m.key);
    const bodyH = pc.math.clamp(Math.min(s.w, s.d) * 0.55, 2.2, 7);
    const sy = bodyH / m.h;
    body.setLocalScale(s.w / m.w, sy, s.d / m.d);
    body.setLocalEulerAngles(0, this.rng.int(2) * 180, 0);
    body.setLocalPosition(0, -m.h * sy, 0);
    if (this.biomeTint) this.tint(body, this.biomeTint);
    this.applyTop(body);
    root.addChild(body);
    occluders.push(this.world.addOccluder(new BoxCollider(new pc.Vec3(s.x, s.top - bodyH * 0.5, s.z), new pc.Vec3(s.w, bodyH, s.d))));
    if (s.w * s.d > 60) {
      const under = this.assets.spawn(PLATFORM_MODELS[1].key);
      const us = Math.min(s.w, s.d) * 0.6 / PLATFORM_MODELS[1].w;
      under.setLocalScale(us, us * 1.4, us);
      under.setLocalEulerAngles(0, this.rng.float() * 360, 0);
      under.setLocalPosition((this.rng.float() - 0.5) * s.w * 0.3, -m.h * sy - PLATFORM_MODELS[1].h * us * 1.4 * 0.75, (this.rng.float() - 0.5) * s.d * 0.3);
      if (this.biomeTint) this.tint(under, this.biomeTint);
      root.addChild(under);
      // loose rocks dangling in the island's wake
      for (let i = 0; i < 2; i++) {
        const r = this.assets.spawn(this.rng.pick(['rock_1', 'rock_2'] as const));
        const rs = 1.2 + this.rng.float() * 1.2;
        r.setLocalScale(rs, rs, rs);
        r.setLocalPosition((this.rng.float() - 0.5) * s.w * 0.8, -bodyH - 1.5 - this.rng.float() * 3, (this.rng.float() - 0.5) * s.d * 0.8);
        r.setLocalEulerAngles(this.rng.float() * 40, this.rng.float() * 360, this.rng.float() * 40);
        if (this.biomeTint) this.tint(r, this.biomeTint);
        root.addChild(r);
      }
      // Sky Ruins: some big islands spill a waterfall off one side
      if (this.biomeId === 'sky' && this.rng.chance(0.35)) this.waterfall(root, s, bodyH);
    }

    const isl: Island = { root, colliders, occluders, x: s.x, z: s.z, top: s.top, w: s.w, d: s.d, falling: 0 };
    // decoration
    const density = (s.decor ?? 0.5) * this.quality;
    if (density > 0) this.decorate(root, s, density, isl);
    if (s.ruins && this.quality > 0.4) this.ruins(root, s, isl);

    this.islands.push(isl);
    return isl;
  }

  /** Vertical wall for wall-running; visual box + a few ruin pieces along the top. */
  wall(x: number, yBottom: number, z: number, h: number, len: number, side: 'l' | 'r'): BoxCollider {
    const e = new pc.Entity('wall');
    e.addComponent('render', { type: 'box', material: this.wallMat });
    e.render!.castShadows = true; e.render!.receiveShadows = true;
    e.setLocalScale(1, h, len);
    e.setPosition(x, yBottom + h * 0.5, z);
    this.root.addChild(e);
    // crown
    const pieces = Math.max(1, Math.floor(len / 4));
    for (let i = 0; i < pieces; i++) {
      const p = this.assets.spawn(this.rng.pick(['ruin_wall_broken', 'ruin_wall_overgrown', 'ruin_column_short'] as WorldModel[]));
      p.setPosition(x, yBottom + h, z - len / 2 + (i + 0.5) * (len / pieces));
      p.setEulerAngles(0, side === 'l' ? 90 : -90, 0);
      this.root.addChild(p);
    }
    const c = new BoxCollider(new pc.Vec3(x, yBottom + h * 0.5, z), new pc.Vec3(1, h, len), undefined, 'wall');
    return this.world.add(c);
  }

  /**
   * Slide gate: a stone lintel across the lane with 1.1 m of clearance under it. Standing runners are stopped;
   * sliding runners pass. Tagged 'gate' so Movement can start a slide from a standstill in front of it.
   */
  gate(x: number, top: number, z: number, width: number): BoxCollider {
    const root = new pc.Entity('gate');
    root.setPosition(x, top, z);
    this.root.addChild(root);
    const h = 1.8, clear = 1.1;
    const wall = this.assets.spawn('ruin_wall_broken');
    wall.setLocalScale(width / 1.99, h / 1.95, 1.6);
    wall.setLocalPosition(0, clear, 0);
    if (this.biomeTint) this.tint(wall, this.biomeTint);
    root.addChild(wall);
    for (const sx of [-1, 1]) {
      const leg = this.assets.spawn('ruin_column_short');
      leg.setLocalScale(1, (clear + 0.2) / 1.83, 1);
      leg.setLocalPosition(sx * (width / 2 - 0.35), 0, 0);
      if (this.biomeTint) this.tint(leg, this.biomeTint);
      root.addChild(leg);
    }
    const torch = this.assets.spawn('ruin_torch');
    torch.setLocalPosition(-(width / 2 - 0.35), clear + 0.3, -0.35);
    root.addChild(torch);
    const c = new BoxCollider(new pc.Vec3(x, top + clear + h / 2, z), new pc.Vec3(width, h, 0.5), undefined, 'gate');
    this.world.add(c);
    this.world.addOccluder(new BoxCollider(new pc.Vec3(x, top + clear + h / 2, z), new pc.Vec3(width, h, 0.6)));
    return c;
  }

  private waterfall(root: pc.Entity, s: IslandSpec, bodyH: number): void {
    const side = this.rng.chance(0.5) ? -1 : 1;
    const lz = (this.rng.float() - 0.5) * s.d * 0.5;
    const len = bodyH + 8 + this.rng.float() * 6;
    const sheet = new pc.Entity('waterfall');
    sheet.addComponent('render', { type: 'box', material: this.waterMat });
    sheet.render!.castShadows = false;
    sheet.setLocalScale(0.25, len, 1.2);
    sheet.setLocalPosition(side * (s.w / 2 + 0.05), -len / 2 + 0.1, lz);
    root.addChild(sheet);
    const splash = new pc.Entity('splash');
    splash.addComponent('render', { type: 'torus', material: this.waterMat });
    splash.render!.castShadows = false;
    splash.setLocalScale(1.1, 1.1, 1.1);
    splash.setLocalEulerAngles(90, 0, 0);
    splash.setLocalPosition(side * (s.w / 2 + 0.1), -len + 0.2, lz);
    root.addChild(splash);
    this.falls.push(sheet, splash);
  }

  /** Register a free-floating scenery entity to be animated. */
  drift(e: pc.Entity, vx: number, spin: number): void { this.drifting.push({ e, vx, spin }); }

  /** Narrow stone runway (beam) built from ruin floor tiles over a thin slab collider. */
  beam(x: number, top: number, z: number, len: number, width = 1.6): Island {
    const root = new pc.Entity('beam');
    root.setPosition(x, top, z);
    this.root.addChild(root);
    const tiles = Math.ceil(len / 2);
    for (let i = 0; i < tiles; i++) {
      const t = this.assets.spawn('ruin_floor');
      t.setLocalPosition(0, -0.29, -len / 2 + i * 2 + 1);
      t.setLocalScale(width / 2, 1, 1);
      root.addChild(t);
      if (i % 3 === 1) {
        const c = this.assets.spawn('ruin_column_round');
        c.setLocalPosition(0, -4.3, -len / 2 + i * 2 + 1);
        c.setLocalScale(1.2, 1, 1.2);
        root.addChild(c);
      }
    }
    const col = this.world.add(new BoxCollider(new pc.Vec3(x, top - 0.25, z), new pc.Vec3(width, 0.5, len)));
    const isl: Island = { root, colliders: [col], occluders: [], x, z, top, w: width, d: len, falling: 0 };
    this.islands.push(isl);
    return isl;
  }

  prop(key: WorldModel, x: number, y: number, z: number, yaw = 0, scale = 1, solid = true): pc.Entity {
    const e = this.assets.spawn(key);
    e.setPosition(x, y, z);
    e.setEulerAngles(0, yaw, 0);
    e.setLocalScale(scale, scale, scale);
    this.root.addChild(e);
    if (solid) this.propCollider(key, x, y, z, yaw, scale);
    return e;
  }

  /** Solid footprint collider (if any) plus a camera occluder for the full visual bounds. */
  private propCollider(key: WorldModel, x: number, y: number, z: number, yaw: number, scale: number, isl?: Island): void {
    const p = PROPS[key];
    if (!p) return;
    const rot = new pc.Quat().setFromEulerAngles(0, yaw, 0);
    if (p.solid) {
      const [w, h, d] = p.solid;
      const c = this.world.add(new BoxCollider(new pc.Vec3(x, y + h * scale * 0.5, z), new pc.Vec3(w * scale, h * scale, d * scale), rot, 'prop'));
      isl?.colliders.push(c);
    }
    const [vw, vh, vd] = p.visual;
    if (vh * scale > 1.2) {
      const o = this.world.addOccluder(new BoxCollider(new pc.Vec3(x, y + vh * scale * 0.5, z), new pc.Vec3(vw * scale, vh * scale, vd * scale), rot, 'prop'));
      isl?.occluders.push(o);
    }
  }

  /** Advance "falling" islands taken by the Rift, drifting islands, and armed crumble timers. */
  update(dt: number): void {
    this.t += dt;
    for (const d of this.drifting) {
      const p = d.e.getLocalPosition();
      if (d.vx) d.e.setLocalPosition(p.x + d.vx * dt, p.y + Math.sin(this.t * 0.3 + p.z) * 0.002, p.z);
      if (d.spin) d.e.rotateLocal(0, d.spin * dt, 0);
    }
    if (this.falls.length) {
      const o = 0.36 + Math.sin(this.t * 7) * 0.04 + Math.sin(this.t * 11.3) * 0.03;
      this.waterMat.opacity = o; this.waterMat.update();
    }
    for (const isl of this.islands) {
      if (isl.motion && isl.falling <= 0) {
        const mo = isl.motion;
        const next = Math.sin((this.t / mo.period) * Math.PI * 2 + mo.phase) * mo.amp;
        mo.delta = next - mo.offset;
        mo.offset = next;
        isl.root.setPosition(isl.x + next, isl.top, isl.z);
        for (const c of isl.colliders) c.center.x += mo.delta;
        for (const c of isl.occluders) c.center.x += mo.delta;
      }
      if (isl.crumble?.armed && isl.falling <= 0) {
        isl.crumble.timer -= dt;
        const shake = Math.max(0, 0.9 - isl.crumble.timer) * 0.06;
        isl.root.setEulerAngles(Math.sin(this.t * 40) * shake * 30, 0, Math.cos(this.t * 37) * shake * 30);
        if (isl.crumble.timer <= 0) this.sink(isl);
      }
      if (isl.sinkY !== undefined && isl.falling <= 0) {
        const step = (0.8 + isl.sinkY * 0.5) * dt;
        isl.sinkY += step;
        for (const c of isl.colliders) c.center.y -= step;
        for (const c of isl.occluders) c.center.y -= step;
        isl.root.setPosition(isl.x + (isl.motion?.offset ?? 0), isl.top - isl.sinkY, isl.z);
        isl.root.setEulerAngles(Math.sin(this.t * 2) * isl.sinkY * 2, 0, isl.sinkY * 3);
        if (isl.sinkY > 6) this.sink(isl);
      }
      if (isl.falling <= 0) continue;
      isl.falling += dt;
      const t = isl.falling;
      const p = isl.root.getPosition();
      isl.root.setPosition(p.x, isl.top - 4 * t * t, p.z);
      isl.root.setEulerAngles(t * 12, 0, t * 6);
      if (t > 6) isl.root.enabled = false;
    }
  }

  /** Horizontal carry for something standing on `box` this frame (moving islands), else 0. */
  carry(box: BoxCollider | null): number {
    if (!box) return 0;
    for (const isl of this.islands) if (isl.motion && isl.colliders.includes(box)) return isl.motion.delta;
    return 0;
  }

  setMotion(isl: Island, amp: number, period: number): void {
    isl.motion = { amp, period, phase: this.rng.float() * Math.PI * 2, offset: 0, delta: 0 };
  }

  /** Mark an island as fractured: it gives way ~0.9 s after being stepped on. Tinted so it can be read. */
  markCrumble(isl: Island): void {
    isl.crumble = { armed: false, timer: 0.9 };
    const body = isl.root.children[0] as pc.Entity | undefined;
    if (body) {
      for (const r of body.findComponents('render') as pc.RenderComponent[]) {
        for (const mi of r.meshInstances) {
          if (!mi.material) continue;
          const sm = (mi.material as pc.StandardMaterial).clone();
          sm.emissive = this.crumbleMat.emissive;
          sm.emissiveIntensity = 0.35;
          sm.update();
          mi.material = sm;
        }
      }
    }
  }

  /** Called when the player lands on an island; starts the crumble clock. Returns true if it just armed. */
  stepOn(isl: Island): boolean {
    if (!isl.crumble || isl.crumble.armed) return false;
    isl.crumble.armed = true;
    return true;
  }

  /** Titan slam: start sinking slowly. */
  slam(isl: Island): void {
    if (isl.falling > 0 || isl.sinkY !== undefined) return;
    isl.sinkY = 0;
  }

  sink(isl: Island): void {
    if (isl.falling > 0) return;
    isl.falling = 0.001;
    if (isl.sinkY !== undefined) {
      for (const c of isl.colliders) c.center.y += isl.sinkY;
      for (const c of isl.occluders) c.center.y += isl.sinkY;
      isl.sinkY = undefined;
    }
    for (const c of isl.colliders) {
      const i = this.world.boxes.indexOf(c);
      if (i >= 0) this.world.boxes.splice(i, 1);
    }
    for (const c of isl.occluders) {
      const i = this.world.occluders.indexOf(c);
      if (i >= 0) this.world.occluders.splice(i, 1);
    }
  }

  /** Undo sink(): used when the Rift is pushed back behind a checkpoint on respawn. */
  restore(isl: Island): void {
    if (isl.falling <= 0 && isl.sinkY === undefined) return;
    if (isl.sinkY !== undefined) {
      for (const c of isl.colliders) c.center.y += isl.sinkY;
      for (const c of isl.occluders) c.center.y += isl.sinkY;
      isl.sinkY = undefined;
    }
    isl.falling = 0;
    isl.root.enabled = true;
    isl.root.setPosition(isl.x + (isl.motion?.offset ?? 0), isl.top, isl.z);
    isl.root.setEulerAngles(0, 0, 0);
    if (isl.crumble) { isl.crumble.armed = false; isl.crumble.timer = 0.9; }
    for (const c of isl.colliders) if (!this.world.boxes.includes(c)) this.world.boxes.push(c);
    for (const c of isl.occluders) if (!this.world.occluders.includes(c)) this.world.occluders.push(c);
  }

  // ------------------------------------------------------------------------------------------
  /**
   * Decoration lives on the rim: every solid prop keeps its *visual* bounds outside the centre lane and sits in the
   * outer 40 % of the island. Grass can go anywhere. Islands too narrow for that get grass only.
   */
  private decorate(root: pc.Entity, s: IslandSpec, density: number, isl: Island): void {
    const margin = 0.6;
    const area = s.w * s.d;
    const nTrees = Math.round(area / 45 * density);
    const nSmall = Math.round(area / 9 * density);
    const halfW = s.w / 2 - margin, halfD = s.d / 2 - margin;
    const place = (key: WorldModel, scale: number) => {
      const p = PROPS[key];
      const solid = !!p?.solid;
      const visHalf = ((p?.visual[0] ?? 0.5) * scale) / 2;
      // the prop's near visual edge must clear the lane and it must fit before the island edge
      const lo = Math.max(LANE + visHalf, halfW * 0.6), hi = halfW - visHalf * 0.4;
      if (solid && lo > hi) return;
      for (let tries = 0; tries < 8; tries++) {
        const side = this.rng.chance(0.5) ? -1 : 1;
        const lx = solid ? side * this.rng.range(lo, hi) : (this.rng.float() - 0.5) * 2 * halfW;
        const lz = (this.rng.float() - 0.5) * 2 * halfD;
        const e = this.assets.spawn(key);
        e.setLocalPosition(lx, 0, lz);
        const yaw = this.rng.float() * 360;
        e.setLocalEulerAngles(0, yaw, 0);
        e.setLocalScale(scale, scale, scale);
        if (this.biomeTint) this.tint(e, this.biomeTint);
        root.addChild(e);
        this.propCollider(key, s.x + lx, s.top, s.z + lz, yaw, scale, isl);
        return;
      }
    };
    for (let i = 0; i < nTrees; i++) place(this.rng.pick(this.trees), 0.5 + this.rng.float() * 0.35);
    for (let i = 0; i < nSmall; i++) {
      const key = this.rng.pick(this.small);
      place(key, key === 'bush' ? 0.4 + this.rng.float() * 0.3 : 0.7 + this.rng.float() * 0.5);
    }
  }

  private ruins(root: pc.Entity, s: IslandSpec, isl: Island): void {
    const n = 1 + this.rng.int(3);
    for (let i = 0; i < n; i++) {
      const key = this.rng.pick(RUINS);
      const p = PROPS[key]!;
      const yaw = this.rng.int(4) * 90 + (this.rng.float() - 0.5) * 20;
      // footprint half-extent along x after yaw (walls turned 90° are thin in x)
      const turned = Math.abs(Math.sin(yaw * pc.math.DEG_TO_RAD)) > 0.7;
      const visHalf = (turned ? p.visual[2] : p.visual[0]) / 2;
      const minX = LANE + visHalf, maxX = s.w / 2 - 0.6 - visHalf * 0.4;
      if (minX > maxX) continue;
      const side = this.rng.float() < 0.5 ? -1 : 1;
      const lx = side * this.rng.range(minX, maxX);
      const lz = (this.rng.float() - 0.5) * (s.d - 3);
      const e = this.assets.spawn(key);
      e.setLocalPosition(lx, 0, lz);
      e.setLocalEulerAngles(0, yaw, 0);
      root.addChild(e);
      this.propCollider(key, s.x + lx, s.top, s.z + lz, yaw, 1, isl);
    }
    if (this.rng.float() < 0.5 && s.w > 7) {
      const t = this.assets.spawn('ruin_torch');
      t.setLocalPosition(-s.w * 0.4, 0, -s.d * 0.4);
      root.addChild(t);
    }
  }

  private tint(e: pc.Entity, color: pc.Color): void {
    const key = `${color.r.toFixed(2)},${color.g.toFixed(2)},${color.b.toFixed(2)}`;
    for (const r of e.findComponents('render') as pc.RenderComponent[]) {
      for (const mi of r.meshInstances) {
        if (!mi.material) continue;
        const k = key + ':' + mi.material.id;
        let m = this.tintCache.get(k);
        if (!m) {
          const sm = (mi.material as pc.StandardMaterial).clone();
          sm.diffuse = new pc.Color(sm.diffuse.r * 0.55 + color.r * 0.45, sm.diffuse.g * 0.55 + color.g * 0.45, sm.diffuse.b * 0.55 + color.b * 0.45);
          sm.update();
          m = sm;
          this.tintCache.set(k, m);
        }
        mi.material = m;
      }
    }
  }
}

export function flat(color: pc.Color, gloss = 0.2): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = color;
  m.gloss = gloss;
  m.metalness = 0;
  m.useMetalness = true;
  m.update();
  return m;
}

export function emissive(color: pc.Color, intensity = 2, opacity = 1, additive = false): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(0, 0, 0);
  m.emissive = color;
  m.emissiveIntensity = intensity;
  if (opacity < 1 || additive) {
    m.opacity = opacity;
    m.blendType = additive ? pc.BLEND_ADDITIVE : pc.BLEND_NORMAL;
    m.depthWrite = false;
  }
  m.update();
  return m;
}

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
  x: number;
  z: number;
  top: number;
  falling: number; // seconds since the Rift took it (0 = intact)
}

const PLATFORM_MODELS: { key: WorldModel; w: number; h: number; d: number }[] = [
  { key: 'rock_platform_large', w: 7.38, h: 3.63, d: 5.16 },
  { key: 'rock_platform_medium', w: 4.81, h: 2.91, d: 4.81 },
  { key: 'rock_platforms_1', w: 7.0, h: 3.3, d: 6.0 },
];
const TREES: WorldModel[] = ['tree', 'tree_fruit', 'pine_1', 'pine_3', 'common_tree_2', 'twisted_tree_1'];
const SMALL: WorldModel[] = ['bush', 'grass_1', 'grass_2', 'rock_1', 'rock_2', 'grass_1', 'grass_2'];
const RUINS: WorldModel[] = ['ruin_column_round', 'ruin_column_short', 'ruin_wall_broken', 'ruin_wall_overgrown', 'ruin_arch_round', 'ruin_statue_stag', 'ruin_wall_arch_broken'];

/**
 * Builds floating islands from the Quaternius kit: a flat walkable slab (collider = slab),
 * kit rock-platform meshes scaled to hang underneath, and biome-tinted decoration on top.
 */
export class IslandBuilder {
  readonly root = new pc.Entity('world');
  readonly islands: Island[] = [];
  private slabMat!: pc.StandardMaterial;
  private sideMat!: pc.StandardMaterial;
  private wallMat!: pc.StandardMaterial;
  private tintCache = new Map<string, pc.Material>();
  private biomeTint: pc.Color | null = null;

  constructor(app: pc.AppBase, private assets: Assets, private world: CollisionWorld, public rng: Rng) {
    app.root.addChild(this.root);
  }

  setBiome(b: Biome): void {
    this.slabMat = flat(b.grass, 0.15);
    this.sideMat = flat(b.stone, 0.1);
    this.wallMat = flat(b.stone.clone().mulScalar(0.9), 0.2);
    this.tintCache.clear();
    // the kit is authored for a sunny sky; other biomes pull vegetation/rock toward the biome palette
    this.biomeTint = b.id === 'sky' ? null : b.stone;
  }

  clear(): void {
    for (const c of this.root.children.slice()) c.destroy();
    this.islands.length = 0;
    this.world.clear();
  }

  island(s: IslandSpec): Island {
    const root = new pc.Entity('island');
    root.setPosition(s.x, s.top, s.z);
    this.root.addChild(root);
    const colliders: BoxCollider[] = [];

    // walkable slab (visual slightly inset, collider exact)
    const slabH = 0.9;
    const slab = new pc.Entity('slab');
    slab.addComponent('render', { type: 'box', material: this.slabMat });
    slab.render!.receiveShadows = true; slab.render!.castShadows = true;
    slab.setLocalScale(s.w, slabH, s.d);
    slab.setLocalPosition(0, -slabH * 0.5, 0);
    root.addChild(slab);
    colliders.push(this.world.add(new BoxCollider(new pc.Vec3(s.x, s.top - slabH * 0.5, s.z), new pc.Vec3(s.w, slabH, s.d))));

    // stone rim under the grass (slab sides read as earth)
    const rim = new pc.Entity('rim');
    rim.addComponent('render', { type: 'box', material: this.sideMat });
    rim.render!.castShadows = true;
    rim.setLocalScale(s.w * 0.94, 1.1, s.d * 0.94);
    rim.setLocalPosition(0, -slabH - 0.5, 0);
    root.addChild(rim);

    // rock bodies: kit floating-platform meshes (grass top, tapered rock underside) scaled so their top
    // sits flush with the slab. The slab stays as the exact walkable surface.
    const area = s.w * s.d;
    const n = area < 12 ? 1 : area < 40 ? 2 : area < 120 ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const m = PLATFORM_MODELS[this.rng.int(PLATFORM_MODELS.length)];
      const e = this.assets.spawn(m.key);
      const f = n === 1 ? 1.08 : 0.7;
      const sx = (s.w * f) / m.w, sz = (s.d * f) / m.d;
      const sy = pc.math.clamp(Math.min(s.w, s.d) * 0.5, 2, 7) / m.h;
      const ox = n === 1 ? 0 : (this.rng.float() - 0.5) * s.w * 0.4;
      const oz = n === 1 ? 0 : (this.rng.float() - 0.5) * s.d * 0.4;
      e.setLocalScale(sx, sy, sz);
      e.setLocalEulerAngles(0, this.rng.int(4) * 90, 0);
      e.setLocalPosition(ox, -m.h * sy - 0.15 + (n === 1 ? 0 : -this.rng.float() * 0.6), oz);
      if (this.biomeTint) this.tint(e, this.biomeTint);
      root.addChild(e);
    }

    // decoration
    const density = s.decor ?? 0.5;
    if (density > 0) this.decorate(root, s, density);
    if (s.ruins) this.ruins(root, s);

    const isl: Island = { root, colliders, x: s.x, z: s.z, top: s.top, falling: 0 };
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
    const isl: Island = { root, colliders: [col], x, z, top, falling: 0 };
    this.islands.push(isl);
    return isl;
  }

  prop(key: WorldModel, x: number, y: number, z: number, yaw = 0, scale = 1): pc.Entity {
    const e = this.assets.spawn(key);
    e.setPosition(x, y, z);
    e.setEulerAngles(0, yaw, 0);
    e.setLocalScale(scale, scale, scale);
    this.root.addChild(e);
    return e;
  }

  /** Advance "falling" islands taken by the Rift. */
  update(dt: number): void {
    for (const isl of this.islands) {
      if (isl.falling <= 0) continue;
      isl.falling += dt;
      const t = isl.falling;
      const p = isl.root.getPosition();
      isl.root.setPosition(p.x, isl.top - 4 * t * t, p.z);
      isl.root.setEulerAngles(t * 12, 0, t * 6);
      if (t > 6) isl.root.enabled = false;
    }
  }

  sink(isl: Island): void {
    if (isl.falling > 0) return;
    isl.falling = 0.001;
    for (const c of isl.colliders) {
      const i = this.world.boxes.indexOf(c);
      if (i >= 0) this.world.boxes.splice(i, 1);
    }
  }

  /** Undo sink(): used when the Rift is pushed back behind a checkpoint on respawn. */
  restore(isl: Island): void {
    if (isl.falling <= 0) return;
    isl.falling = 0;
    isl.root.enabled = true;
    isl.root.setPosition(isl.x, isl.top, isl.z);
    isl.root.setEulerAngles(0, 0, 0);
    for (const c of isl.colliders) if (!this.world.boxes.includes(c)) this.world.boxes.push(c);
  }

  // ------------------------------------------------------------------------------------------
  private decorate(root: pc.Entity, s: IslandSpec, density: number): void {
    const margin = 0.9;
    const area = s.w * s.d;
    const nTrees = Math.round(area / 45 * density);
    const nSmall = Math.round(area / 9 * density);
    const place = (key: WorldModel, scale: number, edgeBias: boolean) => {
      for (let tries = 0; tries < 6; tries++) {
        let lx = (this.rng.float() - 0.5) * (s.w - margin * 2);
        let lz = (this.rng.float() - 0.5) * (s.d - margin * 2);
        if (edgeBias) { lx = Math.sign(lx || 1) * Math.max(Math.abs(lx), s.w * 0.28); }
        if (s.lane && Math.abs(lx) < 1.6) continue;
        const e = this.assets.spawn(key);
        e.setLocalPosition(lx, 0, lz);
        e.setLocalEulerAngles(0, this.rng.float() * 360, 0);
        e.setLocalScale(scale, scale, scale);
        if (this.biomeTint) this.tint(e, this.biomeTint);
        root.addChild(e);
        return;
      }
    };
    for (let i = 0; i < nTrees; i++) place(this.rng.pick(TREES), 0.55 + this.rng.float() * 0.5, true);
    for (let i = 0; i < nSmall; i++) place(this.rng.pick(SMALL), 0.8 + this.rng.float() * 0.6, false);
  }

  private ruins(root: pc.Entity, s: IslandSpec): void {
    const n = 1 + this.rng.int(3);
    for (let i = 0; i < n; i++) {
      const key = this.rng.pick(RUINS);
      const e = this.assets.spawn(key);
      const side = this.rng.float() < 0.5 ? -1 : 1;
      e.setLocalPosition(side * (s.w * 0.3 + this.rng.float() * s.w * 0.12), 0, (this.rng.float() - 0.5) * (s.d - 3));
      e.setLocalEulerAngles(0, this.rng.int(4) * 90 + (this.rng.float() - 0.5) * 20, 0);
      root.addChild(e);
    }
    if (this.rng.float() < 0.5) {
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

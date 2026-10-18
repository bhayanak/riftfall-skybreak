import * as pc from 'playcanvas';
import { BoxCollider, CollisionWorld, type SurfaceTag } from './Colliders';

export type ProtoMat = 'light' | 'dark' | 'orange' | 'green' | 'purple' | 'red';

export interface Checkpoint { index: number; spawn: pc.Vec3; }

/**
 * Phase 1 test course: pure boxes with Kenney prototype textures. Every visual box has a matching collider.
 * Layout runs along -Z. Islands are 1 m thick; `y` arguments are the walkable TOP surface height.
 */
export class Greybox {
  readonly root = new pc.Entity('greybox');
  readonly checkpoints: Checkpoint[] = [];
  readonly spawn = new pc.Vec3(0, 0.05, 4);
  readonly goal = new pc.Vec3(0, 3, -80);
  private mats = new Map<ProtoMat, pc.StandardMaterial>();
  private assetsBase: string;

  constructor(private app: pc.AppBase, private world: CollisionWorld, assetsBase: string) {
    this.assetsBase = assetsBase;
    app.root.addChild(this.root);
  }

  async build(): Promise<void> {
    await Promise.all((['light', 'dark', 'orange', 'green', 'purple', 'red'] as ProtoMat[]).map((m) => this.loadMat(m)));

    // -- start island + collision test props ------------------------------------------------
    this.island(0, 0, 0, 14, 14, 'light', 0);
    this.block(4, 1, -2, 2, 2, 2, 'purple');          // pillar
    this.block(-4, 0.25, -3, 3, 0.5, 1, 'purple');    // low step (vault target later)

    // -- hop ---------------------------------------------------------------------------------
    this.island(0, 0, -15.5, 8, 8, 'light', 1);

    // -- stair up ----------------------------------------------------------------------------
    this.island(3, 1.5, -26, 6, 6, 'light', 2);
    this.island(-3, 3.0, -35, 6, 6, 'light', 3);

    // -- long gap (needs dash) ---------------------------------------------------------------
    this.island(0, 3.0, -49, 10, 10, 'light', 4);

    // -- canyon: narrow beam flanked by wall-run walls --------------------------------------
    this.island(0, 3.0, -63, 1.5, 14, 'dark', 5);
    this.block(-3.25, 5.5, -63, 1, 5, 14, 'orange', 'wall');
    this.block(3.25, 5.5, -63, 1, 5, 14, 'orange', 'wall');

    // -- goal island -------------------------------------------------------------------------
    this.island(0, 3.0, -78, 12, 12, 'green', 6);
    this.loadGlb('proto/flag.glb', (e) => {
      e.setLocalScale(2, 2, 2);
      e.setPosition(this.goal);
      this.root.addChild(e);
    });

    // -- a few floating "void" rocks for depth cues (no collision) --------------------------
    for (let i = 0; i < 14; i++) {
      const x = (Math.random() - 0.5) * 120, z = -Math.random() * 110 + 10, y = -8 - Math.random() * 30;
      const s = 2 + Math.random() * 6;
      this.visualOnly(x, y, z, s, s * 0.6, s, 'dark', Math.random() * 360);
    }
  }

  checkpointAt(index: number): Checkpoint | undefined { return this.checkpoints[index]; }

  // ---------------------------------------------------------------------------------------------
  private island(x: number, top: number, z: number, w: number, d: number, mat: ProtoMat, cp: number): void {
    this.block(x, top - 0.5, z, w, 1, d, mat);
    const spawn = new pc.Vec3(x, top + 0.05, z);
    this.checkpoints[cp] = { index: cp, spawn };
    const trig = new BoxCollider(new pc.Vec3(x, top + 1.5, z), new pc.Vec3(w, 3, d), undefined, 'checkpoint');
    trig.data = cp;
    this.world.add(trig);
  }

  private block(x: number, y: number, z: number, w: number, h: number, d: number, mat: ProtoMat, tag: SurfaceTag = 'ground', yawDeg = 0): pc.Entity {
    const e = this.visualOnly(x, y, z, w, h, d, mat, yawDeg);
    const rot = new pc.Quat().setFromEulerAngles(0, yawDeg, 0);
    this.world.add(new BoxCollider(new pc.Vec3(x, y, z), new pc.Vec3(w, h, d), rot, tag));
    return e;
  }

  private visualOnly(x: number, y: number, z: number, w: number, h: number, d: number, mat: ProtoMat, yawDeg = 0): pc.Entity {
    const e = new pc.Entity('box');
    // ~1 texture tile per 2 m on the dominant face; materials are cached per tiling
    const tx = Math.max(1, Math.round(Math.max(w, d) / 2));
    const ty = Math.max(1, Math.round(Math.max(h, Math.min(w, d)) / 2));
    e.addComponent('render', { type: 'box', material: this.tiled(mat, tx, ty) });
    e.render!.castShadows = true;
    e.render!.receiveShadows = true;
    e.setLocalScale(w, h, d);
    e.setPosition(x, y, z);
    e.setEulerAngles(0, yawDeg, 0);
    this.root.addChild(e);
    return e;
  }

  private tiledCache = new Map<string, pc.StandardMaterial>();
  private tiled(name: ProtoMat, tx: number, ty: number): pc.StandardMaterial {
    const key = `${name}:${tx}:${ty}`;
    let m = this.tiledCache.get(key);
    if (!m) {
      m = this.mats.get(name)!.clone() as pc.StandardMaterial;
      m.diffuseMapTiling = new pc.Vec2(tx, ty);
      m.update();
      this.tiledCache.set(key, m);
    }
    return m;
  }

  private loadMat(name: ProtoMat): Promise<void> {
    return new Promise((resolve) => {
      this.app.assets.loadFromUrl(`${this.assetsBase}proto/${name}.png`, 'texture', (err, asset) => {
        const m = new pc.StandardMaterial();
        if (!err && asset) {
          const tex = asset.resource as pc.Texture;
          tex.anisotropy = 8;
          m.diffuseMap = tex;
          m.diffuseMapTiling = new pc.Vec2(1, 1);
        } else {
          m.diffuse = new pc.Color(0.6, 0.6, 0.65);
        }
        m.gloss = 0.3;
        m.update();
        this.mats.set(name, m);
        resolve();
      });
    });
  }

  private loadGlb(rel: string, onReady: (e: pc.Entity) => void): void {
    this.app.assets.loadFromUrl(`${this.assetsBase}${rel}`, 'container', (err, asset) => {
      if (err || !asset) { console.warn('GLB load failed', rel, err); return; }
      const res = asset.resource as pc.ContainerResource;
      onReady(res.instantiateRenderEntity());
    });
  }
}

import * as pc from 'playcanvas';

export type SurfaceTag = 'ground' | 'wall' | 'prop' | 'hazard' | 'checkpoint';

/** Oriented box collider. Rotation only (no scale) so normals transform cleanly. */
export class BoxCollider {
  readonly center = new pc.Vec3();
  readonly half = new pc.Vec3();
  readonly rot = new pc.Quat();
  readonly invRot = new pc.Quat();
  tag: SurfaceTag = 'ground';
  /** Optional payload (e.g. checkpoint index). */
  data = 0;

  constructor(center: pc.Vec3, size: pc.Vec3, rot?: pc.Quat, tag: SurfaceTag = 'ground') {
    this.center.copy(center);
    this.half.set(size.x * 0.5, size.y * 0.5, size.z * 0.5);
    if (rot) this.rot.copy(rot);
    this.invRot.copy(this.rot).invert();
    this.tag = tag;
  }

  /** Loose world-space bounding radius for broad-phase culling. */
  get radius(): number { return this.half.length(); }
}

export interface Contact {
  collider: BoxCollider;
  normal: pc.Vec3;
  depth: number;
}

const _local = new pc.Vec3();
const _closest = new pc.Vec3();
const _d = new pc.Vec3();
const _n = new pc.Vec3();

/**
 * Sphere vs OBB. Returns penetration depth > 0 and writes the world-space push normal into `outNormal`.
 */
export function sphereVsBox(p: pc.Vec3, r: number, box: BoxCollider, outNormal: pc.Vec3): number {
  _local.sub2(p, box.center);
  box.invRot.transformVector(_local, _local);
  const h = box.half;
  _closest.set(
    pc.math.clamp(_local.x, -h.x, h.x),
    pc.math.clamp(_local.y, -h.y, h.y),
    pc.math.clamp(_local.z, -h.z, h.z),
  );
  _d.sub2(_local, _closest);
  const distSq = _d.lengthSq();
  if (distSq > r * r) return 0;

  if (distSq > 1e-10) {
    const dist = Math.sqrt(distSq);
    _n.copy(_d).mulScalar(1 / dist);
    box.rot.transformVector(_n, outNormal);
    return r - dist;
  }
  // Centre is inside the box: push out along the axis of least penetration.
  const px = h.x - Math.abs(_local.x), py = h.y - Math.abs(_local.y), pz = h.z - Math.abs(_local.z);
  if (px <= py && px <= pz) _n.set(Math.sign(_local.x) || 1, 0, 0);
  else if (py <= pz) _n.set(0, Math.sign(_local.y) || 1, 0);
  else _n.set(0, 0, Math.sign(_local.z) || 1);
  const depth = Math.min(px, py, pz) + r;
  box.rot.transformVector(_n, outNormal);
  return depth;
}

export class CollisionWorld {
  readonly boxes: BoxCollider[] = [];
  /** Visual-only volumes (island bodies, tree canopies) the camera boom must not enter. Never block the player. */
  readonly occluders: BoxCollider[] = [];

  add(box: BoxCollider): BoxCollider { this.boxes.push(box); return box; }
  addOccluder(box: BoxCollider): BoxCollider { this.occluders.push(box); return box; }
  clear(): void { this.boxes.length = 0; this.occluders.length = 0; }

  /**
   * Resolve a vertical capsule (feet at `pos`, radius r, height h) against all boxes.
   * Mutates `pos`; returns contacts found (world normals). Iterates to settle multi-contact cases.
   */
  resolveCapsule(pos: pc.Vec3, r: number, h: number, contacts: Contact[], iterations = 3): void {
    contacts.length = 0;
    const samples = [r, h * 0.5, h - r];
    const sp = new pc.Vec3();
    const n = new pc.Vec3();
    const broad = h + r;
    for (let it = 0; it < iterations; it++) {
      let any = false;
      for (const box of this.boxes) {
        if (box.tag === 'checkpoint') continue;
        // broad-phase: sphere around capsule vs box bounding sphere
        const dx = pos.x - box.center.x, dy = pos.y + h * 0.5 - box.center.y, dz = pos.z - box.center.z;
        const rr = broad + box.radius;
        if (dx * dx + dy * dy + dz * dz > rr * rr) continue;

        for (const sy of samples) {
          sp.set(pos.x, pos.y + sy, pos.z);
          const depth = sphereVsBox(sp, r, box, n);
          if (depth > 0) {
            pos.x += n.x * depth; pos.y += n.y * depth; pos.z += n.z * depth;
            if (it === 0 || !contacts.some((c) => c.collider === box)) {
              contacts.push({ collider: box, normal: n.clone(), depth });
            }
            any = true;
          }
        }
      }
      if (!any) break;
    }
  }

  /** Overlap test for trigger-style boxes (checkpoints). */
  firstOverlap(pos: pc.Vec3, r: number, h: number, tag: SurfaceTag): BoxCollider | null {
    const sp = new pc.Vec3(pos.x, pos.y + h * 0.5, pos.z);
    const n = new pc.Vec3();
    for (const box of this.boxes) {
      if (box.tag !== tag) continue;
      if (sphereVsBox(sp, Math.max(r, h * 0.5), box, n) > 0) return box;
    }
    return null;
  }

  /** Downward ray from `from`; returns hit distance or Infinity. Used for ground probing/ledge assist. */
  raycastDown(from: pc.Vec3, maxDist: number): { dist: number; box: BoxCollider } | null {
    return this.raycast(from, pc.Vec3.DOWN, maxDist);
  }

  /** Ray vs all boxes (dir must be unit length). Returns nearest hit within maxDist. */
  raycast(from: pc.Vec3, dirWorld: pc.Vec3, maxDist: number): { dist: number; box: BoxCollider } | null {
    return this.raycastList(this.boxes, from, dirWorld, maxDist, null);
  }

  /** Camera boom ray: colliders plus visual occluders. */
  raycastCamera(from: pc.Vec3, dirWorld: pc.Vec3, maxDist: number): { dist: number; box: BoxCollider } | null {
    const a = this.raycastList(this.boxes, from, dirWorld, maxDist, null);
    const b = this.raycastList(this.occluders, from, dirWorld, a ? a.dist : maxDist, a);
    return b ?? a;
  }

  private raycastList(list: BoxCollider[], from: pc.Vec3, dirWorld: pc.Vec3, maxDist: number, best: { dist: number; box: BoxCollider } | null): { dist: number; box: BoxCollider } | null {
    const local = new pc.Vec3();
    const dir = new pc.Vec3();
    for (const box of list) {
      if (box.tag === 'checkpoint') continue;
      local.sub2(from, box.center);
      box.invRot.transformVector(local, local);
      box.invRot.transformVector(dirWorld, dir);
      const t = slabRay(local, dir, box.half, maxDist);
      if (t !== null && (!best || t < best.dist)) best = { dist: t, box };
    }
    return best;
  }
}

function slabRay(o: pc.Vec3, d: pc.Vec3, h: pc.Vec3, maxT: number): number | null {
  let tmin = 0, tmax = maxT;
  const oa = [o.x, o.y, o.z], da = [d.x, d.y, d.z], ha = [h.x, h.y, h.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(da[i]) < 1e-8) {
      if (Math.abs(oa[i]) > ha[i]) return null;
      continue;
    }
    const inv = 1 / da[i];
    let t1 = (-ha[i] - oa[i]) * inv, t2 = (ha[i] - oa[i]) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

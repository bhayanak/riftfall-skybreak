import * as pc from 'playcanvas';
import type { Assets } from '../core/Assets';
import { BoxCollider, CollisionWorld } from './Colliders';
import { IslandBuilder, emissive, type Island } from './Island';
import { Rng } from './Rng';
import { maxGap, neededMove, type Move } from './Envelope';
import type { Biome } from '../graphics/Environment';

function coinMaterial(): pc.StandardMaterial {
  const m = new pc.StandardMaterial();
  m.diffuse = new pc.Color(1.0, 0.78, 0.25);
  m.emissive = new pc.Color(0.9, 0.6, 0.1);
  m.emissiveIntensity = 0.9;
  m.useMetalness = true;
  m.metalness = 0.9;
  m.gloss = 0.75;
  m.update();
  return m;
}

export interface Anchor { pos: pc.Vec3; entity: pc.Entity; ring: pc.Entity; }
export interface Gem { pos: pc.Vec3; entity: pc.Entity; taken: boolean; }
export interface Checkpoint { index: number; spawn: pc.Vec3; }
/** A one-time on-screen tip that fires when the player passes z. */
export interface HintMarker { z: number; text: string; touch: string; shown: boolean; }

type ChunkName = 'hop' | 'stairs' | 'zigzag' | 'dashgap' | 'pillars' | 'descend' | 'bridge' | 'canyon' | 'canyonGap' | 'wallrun' | 'grapple';

const CHUNK_HINTS: Partial<Record<ChunkName, [string, string]>> = {
  hop: ['HOLD SPACE FOR A FULL JUMP. LANDED SHORT? YOU GRAB THE LEDGE AND PULL UP', 'HOLD JUMP FOR A FULL JUMP. SHORT? YOU GRAB THE LEDGE'],
  zigzag: ['SIDE ISLANDS — JUMP, THEN SPACE AGAIN IN THE AIR IF YOU NEED MORE', 'SIDE ISLANDS — JUMP, THEN JUMP AGAIN IN THE AIR'],
  stairs: ['STEP UP — JUMP AT THE LEDGE, YOU WILL PULL YOURSELF UP', 'STEP UP — JUMP AT THE LEDGE, YOU WILL PULL UP'],
  dashgap: ['BIG GAP AHEAD — JUMP, THEN SHIFT IN THE AIR TO DASH', 'BIG GAP — JUMP, THEN TAP DASH IN THE AIR'],
  canyon: ['WALL-RUN: JUMP TOWARDS A WALL WHILE RUNNING. SPACE AGAIN TO LEAP OFF', 'WALL-RUN: JUMP INTO A WALL WHILE MOVING. JUMP AGAIN TO LEAP OFF'],
  canyonGap: ['NO FLOOR — WALL-RUN ALONG THE SIDE, THEN LEAP TO THE OTHER WALL', 'NO FLOOR — WALL-RUN THE SIDE, JUMP ACROSS'],
  wallrun: ['CHAIN THE WALLS: RUN ONE, LEAP TO THE NEXT', 'CHAIN THE WALLS: RUN ONE, LEAP TO THE NEXT'],
  grapple: ['GRAPPLE: WHEN THE RING GLOWS, PRESS E TO SWING. E AGAIN TO LET GO', 'GRAPPLE: WHEN THE RING GLOWS, TAP GRAPPLE TO SWING'],
  pillars: ['SHORT HOPS — KEEP YOUR SPEED', 'SHORT HOPS — KEEP YOUR SPEED'],
  descend: ['DROP DOWN — JUMP OFF THE EDGE, SPACE AGAIN MID-AIR IF SHORT', 'DROP DOWN — JUMP OFF THE EDGE, JUMP AGAIN IF SHORT'],
};

/** One hop of the route as seen by the validator. */
export interface RouteEdge { from: number; to: number; d: number; h: number; move: Move | 'wall' | 'grapple' | null; }

/** Intended way across for each template, used by the validator as the ceiling a gap may demand. */
const INTENDED: Record<ChunkName, Move | 'wall' | 'grapple'> = {
  hop: 'jump', stairs: 'jump', zigzag: 'jump', dashgap: 'dash', pillars: 'jump', descend: 'jump', bridge: 'run',
  canyon: 'jump', canyonGap: 'wall', wallrun: 'wall', grapple: 'grapple',
};

interface Cursor { x: number; y: number; z: number; }

/**
 * Procedural route: hand-authored chunk templates arranged along -Z, difficulty rising with chunk index.
 * Produces islands/walls (colliders), grapple anchors, gems, checkpoints and the portal.
 */
export class WorldGenerator {
  readonly builder: IslandBuilder;
  readonly anchors: Anchor[] = [];
  readonly gems: Gem[] = [];
  readonly checkpoints: Checkpoint[] = [];
  readonly hints: HintMarker[] = [];
  readonly spawn = new pc.Vec3();
  readonly portalPos = new pc.Vec3();
  portal!: pc.Entity;
  private portalRing!: pc.Entity;
  private portalCore!: pc.Entity;
  private portalCollider!: BoxCollider;
  private rng = new Rng(1);
  private coinMat!: pc.StandardMaterial;
  private anchorMat!: pc.StandardMaterial;
  private anchorHotMat!: pc.StandardMaterial;
  private t = 0;
  /** Which aid the island at builder.islands[i] is reached by, when it is not a plain jump. */
  private via = new Map<Island, 'wall' | 'grapple'>();
  /** Chunk each island belongs to (for the validator's intended-move ceiling). */
  private chunkOf = new Map<Island, ChunkName>();
  lastReport: RouteEdge[] = [];

  constructor(app: pc.AppBase, private assets: Assets, world: CollisionWorld) {
    this.builder = new IslandBuilder(app, assets, world, this.rng);
  }

  generate(seed: number, biome: Biome, difficulty: number, chunkCount = 11, stage = 0): void {
    this.rng = new Rng(seed);
    this.builder.rng = this.rng;
    this.builder.clear();
    this.anchors.length = 0;
    this.gems.length = 0;
    this.checkpoints.length = 0;
    this.hints.length = 0;
    this.via.clear();
    this.chunkOf.clear();
    this.builder.setBiome(biome);
    this.coinMat = coinMaterial();
    this.anchorMat = emissive(biome.rift, 1.2);
    this.anchorHotMat = emissive(new pc.Color(1, 0.95, 0.6), 4);

    const cur: Cursor = { x: 0, y: 0, z: 0 };
    // start island
    this.builder.island({ x: 0, top: 0, z: 0, w: 14, d: 14, decor: 0.5, ruins: true });
    this.builder.prop('ruin_arch_round', 0, 0, 5.5, 0, 1.4, false);
    this.spawn.set(0, 0.05, 4.5);
    this.checkpoints.push({ index: 0, spawn: this.spawn.clone() });
    cur.z = -7;

    const templates = this.templateOrder(chunkCount, difficulty, stage);
    templates.forEach((name, i) => {
      const d = difficulty + i / chunkCount;
      const h = CHUNK_HINTS[name];
      if (h) this.hints.push({ z: cur.z + 4, text: h[0], touch: h[1], shown: false });
      const before = this.builder.islands.length;
      this.chunk(name, cur, d);
      for (let k = before; k < this.builder.islands.length; k++) this.chunkOf.set(this.builder.islands[k], name);
    });

    // portal island
    const pw = 16;
    cur.z -= 5;
    this.builder.island({ x: cur.x, top: cur.y, z: cur.z - pw / 2, w: pw, d: pw, decor: 0.35, ruins: true });
    this.addCheckpoint(cur.x, cur.y, cur.z - 2);
    this.buildPortal(cur.x, cur.y, cur.z - pw / 2 - 2, biome);
    cur.z -= pw;

    // distant scenery islands for parallax (no colliders)
    this.scenery(cur.z, this.lowestTop());
    this.lastReport = this.validate();
  }

  /**
   * Walk consecutive landing surfaces and ask the movement envelope what each gap demands. Anything that needs
   * more than its template intends (or nothing at all) is a generator bug worth logging. Returns every edge.
   */
  validate(): RouteEdge[] {
    const isl = this.builder.islands;
    const out: RouteEdge[] = [];
    for (let i = 0; i + 1 < isl.length; i++) {
      const a = isl[i], b = isl[i + 1];
      const tx = pc.math.clamp(b.x, a.x - a.w / 2, a.x + a.w / 2);
      const lx = pc.math.clamp(tx, b.x - b.w / 2, b.x + b.w / 2);
      const dz = Math.max(0, (a.z - a.d / 2) - (b.z + b.d / 2));
      const d = Math.hypot(lx - tx, dz);
      const h = b.top - a.top;
      const aid = this.via.get(b);
      const move = aid ?? neededMove(d, h);
      out.push({ from: i, to: i + 1, d: +d.toFixed(1), h: +h.toFixed(1), move });
    }
    return out;
  }

  /** Edges that demand more than their chunk intends. Empty means the route is honest. */
  violations(): RouteEdge[] {
    const rank: Record<string, number> = { run: 0, jump: 1, djump: 2, dash: 3, ddash: 4, wall: 5, grapple: 5 };
    const isl = this.builder.islands;
    return this.lastReport.filter((e) => {
      const chunk = this.chunkOf.get(isl[e.to]);
      const ceiling = chunk ? INTENDED[chunk] : 'jump';
      return e.move === null || rank[e.move] > rank[ceiling];
    });
  }

  update(dt: number, playerPos: pc.Vec3, targetAnchor: Anchor | null = null): void {
    if (!this.portalRing) return;   // nothing generated yet
    this.t += dt;
    this.builder.update(dt);
    const spin = this.t * 120;
    for (const g of this.gems) {
      if (g.taken) continue;
      g.entity.setEulerAngles(0, spin + g.pos.x * 40, 0);
      g.entity.setPosition(g.pos.x, g.pos.y + Math.sin(this.t * 2.5 + g.pos.z) * 0.12, g.pos.z);
    }
    for (const a of this.anchors) {
      const hot = a === targetAnchor;
      a.entity.setEulerAngles(0, this.t * 60, 0);
      const s = hot ? 2.0 + Math.sin(this.t * 10) * 0.25 : 1.6;
      a.ring.setLocalScale(s, s, s);
      const mat = hot ? this.anchorHotMat : this.anchorMat;
      if (a.ring.render!.material !== mat) a.ring.render!.material = mat;
    }
    this.portalRing.setEulerAngles(90, 0, this.t * 25);
    this.portalCore.setEulerAngles(90, 0, -this.t * 60);
    const d = Math.max(0, 1 - playerPos.distance(this.portalPos) / 40);
    const s = 1 + Math.sin(this.t * 4) * 0.03 + d * 0.15;
    this.portalCore.setLocalScale(3.2 * s, 0.1, 3.2 * s);
  }

  /** Next unshown hint the player has reached, if any. */
  popHint(playerZ: number): HintMarker | null {
    for (const h of this.hints) if (!h.shown && playerZ < h.z) { h.shown = true; return h; }
    return null;
  }

  /** Gems within radius of pos; marks them taken and hides them. */
  collectGems(pos: pc.Vec3, radius: number): number {
    let n = 0;
    for (const g of this.gems) {
      if (g.taken) continue;
      if (g.pos.distance(pos) < radius) { g.taken = true; g.entity.enabled = false; n++; }
    }
    return n;
  }

  atPortal(pos: pc.Vec3): boolean {
    const c = this.portalCollider;
    return Math.abs(pos.x - c.center.x) < c.half.x && Math.abs(pos.z - c.center.z) < c.half.z && pos.y > c.center.y - c.half.y && pos.y < c.center.y + c.half.y;
  }

  /** Best grapple anchor for a player at pos looking along fwd. */
  findAnchor(pos: pc.Vec3, fwd: pc.Vec3, range: number): Anchor | null {
    let best: Anchor | null = null, bestScore = -Infinity;
    const to = new pc.Vec3();
    for (const a of this.anchors) {
      to.sub2(a.pos, pos);
      const dist = to.length();
      if (dist > range || dist < 2) continue;
      to.mulScalar(1 / dist);
      const dot = to.x * fwd.x + to.z * fwd.z;
      if (dot < 0.35) continue;
      if (a.pos.y < pos.y - 1) continue;
      const score = dot * 2 - dist / range;
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
  }

  /** Islands whose z is behind the Rift wall get taken. */
  riftSweep(riftZ: number): void {
    for (const isl of this.builder.islands) if (isl.falling <= 0 && isl.z > riftZ - 4) this.builder.sink(isl);
  }

  /** After the Rift is pushed back (respawn), bring back every island that is now ahead of it. */
  restoreAhead(riftZ: number): void {
    for (const isl of this.builder.islands) if (isl.falling > 0 && isl.z <= riftZ - 6) this.builder.restore(isl);
  }

  /** Lowest walkable surface in the route (for a kill plane that follows descending chunks). */
  lowestTop(): number {
    let y = 0;
    for (const isl of this.builder.islands) y = Math.min(y, isl.top);
    return y;
  }

  islandUnder(pos: pc.Vec3): Island | null {
    for (const isl of this.builder.islands) {
      for (const c of isl.colliders) {
        if (Math.abs(pos.x - c.center.x) < c.half.x + 0.5 && Math.abs(pos.z - c.center.z) < c.half.z + 0.5 && Math.abs(pos.y - (c.center.y + c.half.y)) < 1) return isl;
      }
    }
    return null;
  }

  // ----------------------------------------------------------------------------- chunk templates
  private chunk(name: ChunkName, cur: Cursor, d: number): void {
    switch (name) {
      case 'hop': return this.hop(cur, d);
      case 'stairs': return this.stairs(cur, d);
      case 'zigzag': return this.zigzag(cur, d);
      case 'dashgap': return this.dashgap(cur, d);
      case 'pillars': return this.pillars(cur, d);
      case 'descend': return this.descend(cur, d);
      case 'bridge': return this.bridge(cur, d);
      case 'canyon': return this.canyon(cur, d);
      case 'canyonGap': return this.canyonGap(cur, d);
      case 'wallrun': return this.wallrun(cur, d);
      case 'grapple': return this.grapple(cur, d);
    }
  }

  private templateOrder(n: number, difficulty: number, stage: number): ChunkName[] {
    // first run teaches one mechanic at a time, in a fixed order
    if (stage === 0) {
      const teach: ChunkName[] = ['hop', 'zigzag', 'dashgap', 'bridge', 'canyon', 'stairs', 'grapple', 'pillars', 'descend', 'dashgap', 'canyon', 'grapple'];
      return teach.slice(0, n);
    }
    const easy: ChunkName[] = ['hop', 'stairs', 'zigzag', 'bridge', 'pillars'];
    const mid: ChunkName[] = ['dashgap', 'canyon', 'grapple', 'descend'];
    const hard: ChunkName[] = ['wallrun', 'grapple', 'dashgap', 'canyonGap'];
    const out: ChunkName[] = ['hop', 'stairs'];
    let last: ChunkName = 'stairs';
    for (let i = 2; i < n; i++) {
      const pool = i < 4 ? [...easy, ...mid] : difficulty + i / n > 1.3 ? [...mid, ...hard, ...hard] : [...easy, ...mid, ...mid, ...hard];
      let pick = this.rng.pick(pool);
      let guard = 0;
      while (pick === last && guard++ < 5) pick = this.rng.pick(pool);
      out.push(pick); last = pick;
    }
    return out;
  }

  private gap(cur: Cursor, len: number): void { cur.z -= len; }

  private addCheckpoint(x: number, y: number, z: number): void {
    this.checkpoints.push({ index: this.checkpoints.length, spawn: new pc.Vec3(x, y + 0.05, z) });
  }

  private gemsLine(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, n: number, arc = 0): void {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * arc;
      this.gem(x0 + (x1 - x0) * t, y + 1.1, z0 + (z1 - z0) * t);
    }
  }

  private gem(x: number, y: number, z: number): void {
    const e = this.assets.spawn('coin');
    e.setLocalScale(0.42, 0.42, 0.42);
    for (const r of e.findComponents('render') as pc.RenderComponent[]) for (const mi of r.meshInstances) mi.material = this.coinMat;
    this.builder.root.addChild(e);
    this.gems.push({ pos: new pc.Vec3(x, y, z), entity: e, taken: false });
  }

  private anchor(x: number, y: number, z: number): void {
    const e = new pc.Entity('anchor');
    const ring = new pc.Entity('ring');
    ring.addComponent('render', { type: 'torus', material: this.anchorMat });
    ring.setLocalScale(1.6, 1.6, 1.6);
    ring.setLocalEulerAngles(90, 0, 0);
    e.addChild(ring);
    const core = new pc.Entity('core');
    core.addComponent('render', { type: 'sphere', material: emissive(new pc.Color(1, 1, 1), 3) });
    core.setLocalScale(0.35, 0.35, 0.35);
    e.addChild(core);
    const glow = new pc.Entity('glow');
    glow.addComponent('light', { type: 'point', color: new pc.Color(1, 0.9, 0.6), intensity: 1.5, range: 8, castShadows: false });
    e.addChild(glow);
    e.setPosition(x, y, z);
    this.builder.root.addChild(e);
    this.anchors.push({ pos: new pc.Vec3(x, y, z), entity: e, ring });
  }

  /** island helper: centre at cursor, advance cursor past it, drop a checkpoint on it */
  private isl(cur: Cursor, w: number, d: number, opts: Partial<Parameters<IslandBuilder['island']>[0]> = {}): Island {
    const z = cur.z - d / 2;
    const isl = this.builder.island({ x: cur.x, top: cur.y, z, w, d, decor: 0.45, ...opts });
    this.addCheckpoint(cur.x, cur.y, z);
    cur.z -= d;
    return isl;
  }

  /** gap that stays inside what `move` can cross for this rise/drop (with a lateral component already decided) */
  private fit(move: Move, want: number, h: number, lateral = 0): number {
    const cap = Math.sqrt(Math.max(1, maxGap(move, h) ** 2 - lateral * lateral));
    return Math.max(1.5, Math.min(want, cap));
  }

  protected hop(cur: Cursor, d: number): void {
    const g = this.fit('jump', 3.5 + Math.min(2.5, d * 1.0), 0);
    this.gemsLine(cur.x, cur.y, cur.z, cur.x, cur.y, cur.z - g, 3, 1.2);
    this.gap(cur, g);
    this.isl(cur, 8 + this.rng.int(3), 8, { ruins: this.rng.chance(0.4) });
  }

  protected stairs(cur: Cursor, d: number): void {
    const steps = 2 + this.rng.int(2);
    const rise = 1.3;
    for (let i = 0; i < steps; i++) {
      const dx = (this.rng.chance(0.5) ? -1 : 1) * (1.0 + this.rng.float() * 1.0);
      const g = this.fit('jump', 3 + Math.min(1.5, d), rise, dx);
      this.gemsLine(cur.x, cur.y, cur.z, cur.x + dx, cur.y + rise, cur.z - g, 2, 0.8);
      cur.x += dx; cur.y += rise; this.gap(cur, g);
      this.isl(cur, 7, 6, { decor: 0.35 });
    }
  }

  protected zigzag(cur: Cursor, d: number): void {
    const dxAbs = 3;
    for (let i = 0; i < 3; i++) {
      const dx = (i % 2 === 0 ? -1 : 1) * dxAbs;
      const g = this.fit('jump', 3.5 + Math.min(2, d), 0, dxAbs);
      this.gemsLine(cur.x, cur.y, cur.z, cur.x + dx, cur.y, cur.z - g, 2, 1);
      cur.x += dx; this.gap(cur, g);
      this.isl(cur, 6, 6, { decor: 0.3 });
    }
    cur.x = 0;
  }

  protected dashgap(cur: Cursor, d: number): void {
    const g = this.fit('dash', 6.5 + Math.min(3, d * 1.5), 0);
    this.gemsLine(cur.x, cur.y, cur.z, cur.x, cur.y, cur.z - g, 4, 1.5);
    this.gap(cur, g);
    this.isl(cur, 9, 8, { ruins: true });
  }

  protected pillars(cur: Cursor, d: number): void {
    const n = 4, pw = 3.4;
    for (let i = 0; i < n; i++) {
      const dx = (this.rng.float() - 0.5) * 2.0;
      const g = this.fit('jump', 2.8 + Math.min(1.5, d), 0, dx);
      this.gap(cur, g);
      cur.x += dx;
      const z = cur.z - pw / 2;
      this.builder.island({ x: cur.x, top: cur.y, z, w: pw, d: pw, decor: 0 });
      if (i % 2 === 1) this.gem(cur.x, cur.y + 1.1, z);
      cur.z -= pw;
    }
    this.addCheckpoint(cur.x, cur.y, cur.z + pw / 2);
    const back = Math.abs(cur.x);
    cur.x = 0;
    this.gap(cur, this.fit('jump', 3.2, 0, back));
    this.isl(cur, 8, 6);
  }

  protected descend(cur: Cursor, _d: number): void {
    const drop = 2.2;
    for (let i = 0; i < 3; i++) {
      const g = this.fit('jump', 5.5, -drop);
      cur.y -= drop;
      this.gemsLine(cur.x, cur.y + drop, cur.z, cur.x, cur.y, cur.z - g, 2, 0.5);
      this.gap(cur, g);
      this.isl(cur, 6, 6, { decor: 0.3 });
    }
  }

  protected bridge(cur: Cursor, _d: number): void {
    const len = 12;
    this.gap(cur, this.fit('run', 2.5, 0));
    this.builder.beam(cur.x, cur.y, cur.z - len / 2, len, 2.2);
    this.gemsLine(cur.x, cur.y, cur.z - 2, cur.x, cur.y, cur.z - len + 2, 4);
    this.addCheckpoint(cur.x, cur.y, cur.z - len / 2);
    cur.z -= len;
    this.gap(cur, this.fit('run', 2.5, 0));
    this.isl(cur, 7, 6, { ruins: true });
  }

  /** narrow beam between two wall-run walls; the beam has a gap you can wall-run across */
  protected canyon(cur: Cursor, d: number): void {
    const len = 16;
    this.gap(cur, this.fit('jump', 3, 0));
    const z0 = cur.z;
    const beamGap = d > 0.8 ? this.fit('jump', 5, 0) : 0;
    if (beamGap > 0) {
      const seg = (len - beamGap) / 2;
      this.builder.beam(cur.x, cur.y, z0 - seg / 2, seg, 1.8);
      this.builder.beam(cur.x, cur.y, z0 - len + seg / 2, seg, 1.8);
    } else {
      this.builder.beam(cur.x, cur.y, z0 - len / 2, len, 1.8);
    }
    this.builder.wall(cur.x - 2.6, cur.y - 1, z0 - len / 2, 6, len, 'l');
    this.builder.wall(cur.x + 2.6, cur.y - 1, z0 - len / 2, 6, len, 'r');
    this.gemsLine(cur.x - 1.9, cur.y + 1.5, z0 - 3, cur.x - 1.9, cur.y + 1.5, z0 - len + 3, 4);
    this.addCheckpoint(cur.x, cur.y, z0 - 2);
    cur.z -= len;
    this.gap(cur, this.fit('jump', 3, 0));
    this.isl(cur, 8, 7, { ruins: true });
  }

  /** canyon with no floor: must wall-run (walls close enough to catch you from the centre line) */
  protected canyonGap(cur: Cursor, _d: number): void {
    const len = 12;
    this.gap(cur, 2);
    const z0 = cur.z;
    this.builder.wall(cur.x - 1.9, cur.y - 2, z0 - len / 2, 7, len, 'l');
    this.builder.wall(cur.x + 1.9, cur.y - 2, z0 - len / 2 + 1, 7, len, 'r');
    this.gemsLine(cur.x - 1.1, cur.y + 1.5, z0 - 2, cur.x - 1.1, cur.y + 1.5, z0 - len + 2, 4);
    cur.z -= len;
    this.gap(cur, 1.5);
    this.via.set(this.isl(cur, 8, 7), 'wall');
  }

  /** two offset walls, no floor between */
  protected wallrun(cur: Cursor, _d: number): void {
    const len = 9;
    this.gap(cur, 2);
    const z0 = cur.z;
    this.builder.wall(cur.x - 1.9, cur.y - 2, z0 - len / 2, 6, len, 'l');
    this.gemsLine(cur.x - 1.1, cur.y + 1.2, z0 - 1, cur.x - 1.1, cur.y + 1.2, z0 - len + 1, 3);
    cur.z -= len + 2;
    this.builder.wall(cur.x + 1.9, cur.y - 2, cur.z - len / 2, 6, len, 'r');
    this.gemsLine(cur.x + 1.1, cur.y + 1.2, cur.z - 1, cur.x + 1.1, cur.y + 1.2, cur.z - len + 1, 3);
    cur.z -= len;
    this.gap(cur, 1.5);
    this.via.set(this.isl(cur, 8, 7, { ruins: true }), 'wall');
  }

  protected grapple(cur: Cursor, d: number): void {
    const g = 13 + Math.min(5, d * 2);
    const z0 = cur.z;
    this.anchor(cur.x, cur.y + 7, z0 - g * 0.5);
    this.gemsLine(cur.x, cur.y, z0, cur.x, cur.y, z0 - g, 5, 3.5);
    this.gap(cur, g);
    this.via.set(this.isl(cur, 9, 8, { ruins: true }), 'grapple');
  }

  // ------------------------------------------------------------------------------------ portal
  private buildPortal(x: number, y: number, z: number, biome: Biome): void {
    this.portalPos.set(x, y + 2.4, z);
    this.portal = new pc.Entity('portal');
    this.portal.setPosition(x, y, z);

    const base = this.assets.spawn('ruin_stairs');
    base.setLocalScale(2.4, 1, 1.6);
    base.setLocalPosition(0, 0, 0.9);
    this.portal.addChild(base);
    for (const sx of [-1, 1]) {
      const c = this.assets.spawn('ruin_column_round');
      c.setLocalPosition(sx * 2.9, 0, 0);
      c.setLocalScale(1.1, 1.3, 1.1);
      this.portal.addChild(c);
    }

    this.portalRing = new pc.Entity('ring');
    this.portalRing.addComponent('render', { type: 'torus', material: emissive(biome.rift, 3) });
    this.portalRing.setLocalScale(4.4, 4.4, 4.4);
    this.portalRing.setLocalPosition(0, 2.4, 0);
    this.portal.addChild(this.portalRing);

    this.portalCore = new pc.Entity('core');
    this.portalCore.addComponent('render', { type: 'cylinder', material: emissive(biome.rift, 1.2, 0.55, true) });
    this.portalCore.setLocalScale(3.2, 0.1, 3.2);
    this.portalCore.setLocalPosition(0, 2.4, 0);
    this.portal.addChild(this.portalCore);

    const glow = new pc.Entity('glow');
    glow.addComponent('light', { type: 'point', color: biome.rift, intensity: 3, range: 14, castShadows: false });
    glow.setLocalPosition(0, 2.6, 1);
    this.portal.addChild(glow);

    this.builder.root.addChild(this.portal);
    this.portalCollider = new BoxCollider(new pc.Vec3(x, y + 2.4, z), new pc.Vec3(4.5, 5, 1.6), undefined, 'checkpoint');
  }

  private scenery(endZ: number, routeLow: number): void {
    const n = 26;
    for (let i = 0; i < n; i++) {
      const side = this.rng.chance(0.5) ? -1 : 1;
      const x = side * this.rng.range(34, 90);
      const z = this.rng.range(endZ - 60, 30);
      // nearby scenery sits well below the route so it never reads as a reachable platform
      const y = Math.abs(x) < 55 ? this.rng.range(routeLow - 35, routeLow - 9) : this.rng.range(routeLow - 35, 14);
      const s = this.rng.range(1.5, 4.5);
      const e = this.assets.spawn(this.rng.pick(['rock_platform_large', 'rock_platform_medium', 'rock_platforms_1', 'rock_platform_tall'] as const));
      e.setPosition(x, y, z);
      e.setLocalScale(s, s * this.rng.range(0.8, 1.4), s);
      e.setEulerAngles(0, this.rng.float() * 360, 0);
      this.builder.root.addChild(e);
      if (this.rng.chance(0.5)) {
        const t = this.assets.spawn(this.rng.pick(['tree', 'pine_1', 'twisted_tree_1'] as const));
        t.setPosition(x, y + 3.63 * s * this.rng.range(0.8, 1.4), z);
        t.setLocalScale(s * 0.6, s * 0.6, s * 0.6);
        this.builder.root.addChild(t);
      }
    }
    // clouds stay out of the route corridor: either far to the side, or well below the lowest surface
    for (let i = 0; i < 18; i++) {
      const c = this.assets.spawn(this.rng.pick(['cloud_1', 'cloud_2', 'cloud_3'] as const));
      const s = this.rng.range(6, 14);
      const aside = this.rng.chance(0.6);
      const x = aside ? (this.rng.chance(0.5) ? -1 : 1) * this.rng.range(40, 140) : this.rng.range(-30, 30);
      const y = aside ? this.rng.range(routeLow - 30, 40) : routeLow - this.rng.range(22, 50);
      c.setPosition(x, y, this.rng.range(endZ - 80, 40));
      c.setLocalScale(s, s * 0.7, s);
      c.setEulerAngles(0, this.rng.float() * 360, 0);
      this.builder.root.addChild(c);
    }
  }
}

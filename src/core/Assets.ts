import * as pc from 'playcanvas';

/** Everything in public/assets we load up-front. Keys are the file stem under assets/world or assets/player. */
export const WORLD_MODELS = [
  'rock_platform_large', 'rock_platform_medium', 'rock_platform_tall', 'rock_platforms_1', 'rock_1', 'rock_2',
  'rock_medium_1', 'rock_medium_2', 'rock_medium_3',
  'tree', 'tree_fruit', 'bush', 'grass_1', 'grass_2', 'pine_1', 'pine_3', 'common_tree_2', 'twisted_tree_1', 'dead_tree_2',
  'cloud_1', 'cloud_2', 'cloud_3',
  'coin', 'gem_blue', 'gem_pink', 'star',
  'ruin_arch_round', 'ruin_arch_gothic', 'ruin_column_round', 'ruin_column_short', 'ruin_wall_broken', 'ruin_wall_overgrown',
  'ruin_wall_arch_broken', 'ruin_floor', 'ruin_stairs', 'ruin_statue_stag', 'ruin_torch', 'ruin_flag', 'ruin_bridge',
] as const;
export type WorldModel = (typeof WORLD_MODELS)[number];

export class Assets {
  private containers = new Map<string, pc.ContainerResource>();
  private textures = new Map<string, pc.Texture>();
  readonly base: string;

  constructor(private app: pc.AppBase, base: string) { this.base = base; }

  async loadAll(onProgress?: (done: number, total: number) => void): Promise<void> {
    const jobs: Promise<unknown>[] = [];
    let done = 0;
    const total = WORLD_MODELS.length + 2;
    const tick = () => { done++; onProgress?.(done, total); };
    for (const m of WORLD_MODELS) jobs.push(this.container(`world/${m}.glb`, m).then(tick));
    jobs.push(this.container('player/superhero_male.glb', 'player').then(tick));
    jobs.push(this.container('player/player_anims.glb', 'player_anims').then(tick));
    await Promise.all(jobs);
  }

  container(rel: string, key = rel): Promise<pc.ContainerResource> {
    const cached = this.containers.get(key);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      this.app.assets.loadFromUrl(`${this.base}${rel}`, 'container', (err, asset) => {
        if (err || !asset) { reject(new Error(`${rel}: ${err}`)); return; }
        const res = asset.resource as pc.ContainerResource;
        this.containers.set(key, res);
        resolve(res);
      });
    });
  }

  texture(rel: string, key = rel): Promise<pc.Texture> {
    const cached = this.textures.get(key);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      this.app.assets.loadFromUrl(`${this.base}${rel}`, 'texture', (err, asset) => {
        if (err || !asset) { reject(new Error(`${rel}: ${err}`)); return; }
        const tex = asset.resource as pc.Texture;
        this.textures.set(key, tex);
        resolve(tex);
      });
    });
  }

  get(key: string): pc.ContainerResource {
    const c = this.containers.get(key);
    if (!c) throw new Error(`asset not loaded: ${key}`);
    return c;
  }

  /** New render-only entity instance of a loaded model (shares meshes/materials). */
  spawn(key: WorldModel | 'player'): pc.Entity {
    const e = this.get(key).instantiateRenderEntity();
    e.name = key;
    return e;
  }

  animTracks(): Map<string, pc.AnimTrack> {
    const out = new Map<string, pc.AnimTrack>();
    for (const a of this.get('player_anims').animations) {
      const track = a.resource as pc.AnimTrack;
      out.set(track.name, track);   // asset names contain '/' and '.', which AnimComponent treats as paths
    }
    return out;
  }
}

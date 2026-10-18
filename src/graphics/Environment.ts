import * as pc from 'playcanvas';
import type { Assets } from '../core/Assets';
import type { DeviceInfo } from '../core/Device';

export type BiomeId = 'sky' | 'fire' | 'void';

export interface Biome {
  id: BiomeId;
  name: string;
  hdr: string;
  skyIntensity: number;
  fog: pc.Color;
  fogStart: number;
  fogEnd: number;
  sun: pc.Color;
  sunIntensity: number;
  sunAngles: pc.Vec3;
  ambient: pc.Color;
  rift: pc.Color;
  grass: pc.Color;
  stone: pc.Color;
  gem: 'gem_blue' | 'gem_pink';
  grade: { saturation: number; contrast: number; tint: pc.Color };
}

export const BIOMES: Record<BiomeId, Biome> = {
  sky: {
    id: 'sky', name: 'SKY RUINS', hdr: 'sky/sky_ruins.hdr', skyIntensity: 1.0,
    fog: new pc.Color(0.70, 0.82, 0.96), fogStart: 60, fogEnd: 260,
    sun: new pc.Color(1, 0.95, 0.85), sunIntensity: 2.2, sunAngles: new pc.Vec3(48, 40, 0),
    ambient: new pc.Color(0.35, 0.42, 0.55), rift: new pc.Color(0.35, 0.75, 1.0),
    grass: new pc.Color(0.36, 0.66, 0.30), stone: new pc.Color(0.62, 0.60, 0.56), gem: 'gem_blue',
    grade: { saturation: 1.12, contrast: 1.04, tint: new pc.Color(1, 1, 1) },
  },
  fire: {
    id: 'fire', name: 'FIRE RIFT', hdr: 'sky/fire_rift.hdr', skyIntensity: 0.9,
    fog: new pc.Color(0.55, 0.22, 0.14), fogStart: 40, fogEnd: 200,
    sun: new pc.Color(1, 0.55, 0.3), sunIntensity: 2.4, sunAngles: new pc.Vec3(28, -60, 0),
    ambient: new pc.Color(0.40, 0.22, 0.18), rift: new pc.Color(1.0, 0.45, 0.15),
    grass: new pc.Color(0.30, 0.18, 0.12), stone: new pc.Color(0.30, 0.22, 0.20), gem: 'gem_pink',
    grade: { saturation: 1.15, contrast: 1.08, tint: new pc.Color(1, 0.94, 0.9) },
  },
  void: {
    id: 'void', name: 'THE VOID', hdr: 'sky/void.hdr', skyIntensity: 1.4,
    fog: new pc.Color(0.12, 0.07, 0.22), fogStart: 35, fogEnd: 180,
    sun: new pc.Color(0.6, 0.55, 1.0), sunIntensity: 1.3, sunAngles: new pc.Vec3(60, 120, 0),
    ambient: new pc.Color(0.22, 0.16, 0.38), rift: new pc.Color(0.75, 0.35, 1.0),
    grass: new pc.Color(0.22, 0.16, 0.42), stone: new pc.Color(0.28, 0.24, 0.40), gem: 'gem_pink',
    grade: { saturation: 1.1, contrast: 1.1, tint: new pc.Color(0.92, 0.9, 1) },
  },
};

/** Sky (HDRI skybox + IBL), sun, fog, post-processing. One instance; call setBiome() per run. */
export class Environment {
  readonly sun: pc.Entity;
  biome: Biome = BIOMES.sky;
  private frame: pc.CameraFrame | null = null;
  private skyCache = new Map<string, { skybox: pc.Texture; atlas: pc.Texture }>();

  constructor(private app: pc.AppBase, private assets: Assets, private device: DeviceInfo) {
    this.sun = new pc.Entity('sun');
    this.sun.addComponent('light', {
      type: 'directional',
      castShadows: device.profile !== 'mobile-low',
      shadowDistance: 60,
      shadowResolution: device.profile === 'desktop' ? 2048 : 1024,
      shadowBias: 0.25,
      normalOffsetBias: 0.08,
      numCascades: device.profile === 'desktop' ? 3 : 1,
      cascadeDistribution: 0.7,
      shadowType: pc.SHADOW_PCF3_32F,
    });
    app.root.addChild(this.sun);
    app.scene.skyboxMip = 0;
    app.scene.fog.type = pc.FOG_LINEAR;
  }

  attachPost(camera: pc.CameraComponent): void {
    if (this.device.profile === 'mobile-low') return;
    const f = new pc.CameraFrame(this.app, camera);
    f.rendering.toneMapping = pc.TONEMAP_ACES;
    f.rendering.samples = this.device.profile === 'desktop' ? 4 : 1;
    f.rendering.sharpness = 0.1;
    f.bloom.intensity = this.device.profile === 'desktop' ? 0.035 : 0.02;
    f.bloom.blurLevel = 16;
    f.vignette.intensity = 0.55;
    f.vignette.inner = 0.55;
    f.vignette.outer = 1.35;
    f.vignette.curvature = 0.6;
    f.grading.enabled = true;
    this.frame = f;
    this.applyGrade();
    f.update();
  }

  async setBiome(id: BiomeId): Promise<void> {
    const b = BIOMES[id];
    this.biome = b;
    const scene = this.app.scene;

    let sky = this.skyCache.get(b.hdr);
    if (!sky) {
      const hdr = await this.assets.texture(b.hdr);
      const skybox = pc.EnvLighting.generateSkyboxCubemap(hdr, 256);
      const lighting = pc.EnvLighting.generateLightingSource(hdr, { size: 128 });
      const atlas = pc.EnvLighting.generatePrefilteredAtlas([lighting]);
      lighting.destroy();
      sky = { skybox, atlas };
      this.skyCache.set(b.hdr, sky);
    }
    scene.skybox = sky.skybox;
    scene.envAtlas = sky.atlas;
    scene.skyboxIntensity = b.skyIntensity;
    scene.ambientLight = b.ambient;
    scene.fog.color = b.fog;
    scene.fog.start = b.fogStart;
    scene.fog.end = b.fogEnd;

    const l = this.sun.light!;
    l.color = b.sun;
    l.intensity = b.sunIntensity;
    this.sun.setEulerAngles(b.sunAngles);
    this.applyGrade();
  }

  private applyGrade(): void {
    if (!this.frame) return;
    this.frame.grading.saturation = this.biome.grade.saturation;
    this.frame.grading.contrast = this.biome.grade.contrast;
    this.frame.grading.tint = this.biome.grade.tint;
    this.frame.update();
  }

  /** Transient FOV-independent "speed" feel: bump bloom + vignette with FLOW. */
  setIntensity(flow01: number): void {
    if (!this.frame) return;
    const desk = this.device.profile === 'desktop';
    this.frame.bloom.intensity = (desk ? 0.035 : 0.02) + flow01 * (desk ? 0.03 : 0.015);
    this.frame.vignette.intensity = 0.55 + flow01 * 0.25;
    this.frame.update();
  }
}

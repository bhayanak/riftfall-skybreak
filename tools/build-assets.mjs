#!/usr/bin/env node
// Builds the shipped asset set in public/assets/ from the raw downloads in assets-source/.
// Phase 1 scope: copy the greybox textures + a couple of Kenney GLBs. Compression (KTX2/meshopt) lands in Phase 3.
import { cpSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'assets-source');
const OUT = join(ROOT, 'public', 'assets');

const KENNEY_TEX = join(SRC, 'kenney', 'prototype-textures', 'PNG');
const KENNEY_KIT = join(SRC, 'kenney', 'prototype-kit', 'Models', 'GLB format');

/** [destination relative to public/assets, source absolute] */
const COPIES = [
  ['proto/light.png',  join(KENNEY_TEX, 'Light',  'texture_07.png')],
  ['proto/dark.png',   join(KENNEY_TEX, 'Dark',   'texture_07.png')],
  ['proto/orange.png', join(KENNEY_TEX, 'Orange', 'texture_01.png')],
  ['proto/green.png',  join(KENNEY_TEX, 'Green',  'texture_07.png')],
  ['proto/purple.png', join(KENNEY_TEX, 'Purple', 'texture_01.png')],
  ['proto/red.png',    join(KENNEY_TEX, 'Red',    'texture_07.png')],
  ['proto/flag.glb',   join(KENNEY_KIT, 'flag.glb')],
  ['proto/coin.glb',   join(KENNEY_KIT, 'coin.glb')],
  // Kenney kit GLBs reference this external texture by relative path
  ['proto/Textures/colormap.png', join(KENNEY_KIT, 'Textures', 'colormap.png')],

  // skies (Poly Haven, CC0) — 1k for now; 2k desktop variant lands with quality profiles
  ['sky/sky_ruins.hdr', join(SRC, 'polyhaven', 'kloofendal_48d_partly_cloudy_puresky_1k.hdr')],
  ['sky/fire_rift.hdr', join(SRC, 'polyhaven', 'the_sky_is_on_fire_1k.hdr')],
  ['sky/void.hdr',      join(SRC, 'polyhaven', 'satara_night_1k.hdr')],

  // sfx (Kenney, CC0)
  ['sfx/jump.ogg',     join(SRC, 'kenney', 'digital-audio', 'Audio', 'phaseJump1.ogg')],
  ['sfx/djump.ogg',    join(SRC, 'kenney', 'digital-audio', 'Audio', 'phaseJump3.ogg')],
  ['sfx/land.ogg',     join(SRC, 'kenney', 'impact-sounds', 'Audio', 'impactSoft_medium_000.ogg')],
  ['sfx/land_hard.ogg',join(SRC, 'kenney', 'impact-sounds', 'Audio', 'impactSoft_heavy_001.ogg')],
  ['sfx/dash.ogg',     join(SRC, 'kenney', 'sci-fi-sounds', 'Audio', 'thrusterFire_000.ogg')],
  ['sfx/wallrun.ogg',  join(SRC, 'kenney', 'impact-sounds', 'Audio', 'footstep_concrete_002.ogg')],
  ['sfx/grapple.ogg',  join(SRC, 'kenney', 'sci-fi-sounds', 'Audio', 'laserRetro_002.ogg')],
  ['sfx/slide.ogg',    join(SRC, 'kenney', 'impact-sounds', 'Audio', 'footstep_grass_003.ogg')],
  ['sfx/pickup.ogg',   join(SRC, 'kenney', 'digital-audio', 'Audio', 'pepSound2.ogg')],
  ['sfx/flow_up.ogg',  join(SRC, 'kenney', 'digital-audio', 'Audio', 'powerUp5.ogg')],
  ['sfx/portal.ogg',   join(SRC, 'kenney', 'sci-fi-sounds', 'Audio', 'forceField_001.ogg')],
  ['sfx/death.ogg',    join(SRC, 'kenney', 'sci-fi-sounds', 'Audio', 'lowFrequency_explosion_000.ogg')],
  ['sfx/ui_select.ogg',join(SRC, 'kenney', 'interface-sounds', 'Audio', 'select_001.ogg')],
  ['sfx/ui_confirm.ogg',join(SRC, 'kenney', 'interface-sounds', 'Audio', 'confirmation_002.ogg')],
  ['sfx/checkpoint.ogg',join(SRC, 'kenney', 'digital-audio', 'Audio', 'highUp.ogg')],
];

let missing = 0, total = 0;
for (const [rel, src] of COPIES) {
  const dst = join(OUT, rel);
  if (!existsSync(src)) { console.warn(`MISSING ${src}  (run tools/fetch-assets.sh kenney)`); missing++; continue; }
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
  total += statSync(dst).size;
  console.log(`copied ${rel}  ${(statSync(dst).size / 1024).toFixed(0)} KB`);
}

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const shipped = existsSync(OUT) ? walk(OUT).reduce((s, f) => s + statSync(f).size, 0) : 0;
console.log(`\npublic/assets total: ${(shipped / 1024 / 1024).toFixed(2)} MB (budget: 20 MB boot bundle)`);
if (missing) process.exit(1);

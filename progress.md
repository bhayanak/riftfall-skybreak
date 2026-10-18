# Riftfall: Skybreak — Progress

Ledger of what has actually been done. Plan lives in [plan.md](plan.md); vision in [Riftfall_Skybreak_Game_Plan.md](Riftfall_Skybreak_Game_Plan.md).
Newest entries at the top of each section. Update this file at the end of every working session.

## Status at a glance

| Area | State |
|---|---|
| Vision doc | ✅ written |
| Execution plan | ✅ `plan.md` (decisions D1–D9, phases 0–6) |
| Asset download tooling | ✅ `tools/fetch-assets.sh` (idempotent, per-vendor stages) |
| Assets — Kenney | ✅ 18/18 packs (171 MB) |
| Assets — Quaternius itch.io | ✅ 6/6 packs (706 MB) |
| Assets — Quaternius Google Drive | ✅ 11/11 packs (~1.85 GB) — downloaded manually by Ajay off-network |
| Assets — Poly Haven HDRIs | ✅ 12/12 files (54 MB) |
| Assets — ambientCG materials | ✅ 26/26 sets @1K-JPG (190 MB) |
| Assets — Mixamo | ✅ 9 clips downloaded (auto-rigged on our mesh) → retargeted into `player_anims.glb` |
| Asset pipeline tooling | ✅ `tools/fetch-assets.sh`, `tools/build-assets.mjs`, `tools/fbx2glb.py`, `tools/build-player-anims.py`, `tools/preview-anims.py`, `tools/export-mixamo-mesh.py`, `tools/inspect-fbx.py` |
| Phase 0 — repo bootstrap | ✅ Vite 7 + TS 5.9 + PlayCanvas 2.23 (`AppBase`, WebGL2), Pages workflow, pushed to `bhayanak/riftfall-skybreak` (author `bhayanak`) |
| Phase 1 — movement prototype | ✅ superseded by v2 — greybox removed |
| Phase 2 — movement slice | ✅ **v2.1**: wall-run (snaps from 1.1 m), grapple (swing + auto-release, gold-ring targeting + key prompt), slide, ledge vault (level geometry only — props block), double jump by default, air dash that keeps height, FLOW x1–x5, procedural chunks (11 templates, fixed teaching order on stage 0), portal → 3-card upgrades (11, each with a "why"), Rift collapse wall, checkpoints, run-over/retry |
| Phase 3 — visual slice | ✅ **v2.1**: Superhero mesh in a navy/teal runner suit (material split by bone in Blender) + 31-clip anim state machine, HDRI skybox + IBL per biome, bloom/vignette/grading, fog, kit islands (grass top flush with collider) + solid trees/rocks/ruins off the centre lane, gold coins, emissive portal, Rift shards, speed trail VFX, 15 Kenney SFX, **procedural adaptive music** (pad / bass / FLOW arp / Rift rumble) |
| Phase 4 — procedural runs | ◑ generator + difficulty ramp + teaching order; no path validator (templates are bounded by construction) |
| Phase 5 — content | ◑ 3 biomes cycle with difficulty; persistent best run (localStorage); no boss |
| Phase 6 — web optimisation / CrazyGames | ⬜ |

Raw asset footprint on disk: **~3 GB** in `assets-source/` (git-ignored). Shipped: `public/assets/` = **11 MB** (3 HDR skies 4.8 MB · world kit 3 MB · character 1.2 MB · anims 2 MB · SFX); engine 311 KB gzip.

## Known issues (v2.1) — next polish pass
- Island silhouettes are still simple (one kit platform scaled); needs a sculpted underside pass per biome.
- Fire / Void biomes reuse the Sky prop set with a tint — no biome-specific dressing yet.
- Music is procedural (Web Audio) — fine for now; a composed track (O2) can replace it layer by layer.
- Mobile: untested on a real phone since v2 (touch layout exists).
- Draw calls ~800 on desktop — fine for now, needs instancing before mobile-low.
- No path validator: chunk templates are bounded by construction (max gap/rise per template), but nothing asserts it.

---

## Asset ledger

Legend: ✅ on disk · ⏳ needs manual download · ⬜ not yet needed

### Quaternius (CC0)
| Pack | Host | Status | Path / note |
|---|---|---|---|
| Universal Animation Library (UAL1) | itch.io | ✅ | `UAL1_Standard.glb` + `_RM` (root motion) · 43 clips · 7.4 MB |
| Universal Animation Library 2 (UAL2) | itch.io | ✅ | `UAL2_Standard.glb` + `_RM` · 43 clips · 7.9 MB · incl. Female Mannequin |
| Universal Base Characters | itch.io | ✅ | `Superhero_{Male,Female}_FullBody.gltf` + 8 hairstyles (rigged to head bone) |
| Sci-Fi Essentials Kit | itch.io | ✅ | 37 glTF |
| Fantasy Props MegaKit | itch.io | ✅ | 94 glTF |
| Stylized Nature MegaKit | itch.io | ✅ | 68 glTF |
| Ultimate Modular Ruins | Google Drive | ✅ | 92 **FBX** (+ .blend) · 106 MB · 1×1 grid system, see its `How-To-Use.txt` |
| Ultimate Stylized Nature | Google Drive | ✅ | 111 glTF · 95 MB |
| Ultimate Platformer | Google Drive | ✅ | 36 glTF / 63 FBX · 465 MB |
| Ultimate Monsters | Google Drive | ✅ | 50 glTF · 259 MB |
| Ultimate Animated Character | Google Drive | ✅ | 52 glTF · 416 MB |
| Ultimate Modular Characters | Google Drive | ✅ | 11 glTF / 72 FBX · 285 MB |
| Ultimate Nature | Google Drive | ✅ | 150 **FBX** · 103 MB |
| Ultimate Modular Sci-Fi | Google Drive | ✅ | 91 **FBX** · 56 MB |
| Modular Platformer | Google Drive | ✅ | 53 **FBX** · 30 MB |
| Animated Monster | Google Drive | ✅ | 4 **FBX** · 7 MB |
| Medieval Dungeon | Google Drive | ✅ | 41 **FBX** · 30 MB |

**FBX-only packs** (Ruins, Nature, Sci-Fi, Modular Platformer, Animated Monster, Medieval Dungeon) need an FBX→GLB conversion step in the pipeline — see plan.md §2.

### Kenney (CC0) — all ✅
`prototype-kit` (145 GLB) · `prototype-textures` · `input-prompts` (1500 glyphs) · `ui-pack` · `ui-pack-sci-fi` · `game-icons` · `kenney-fonts` · `particle-pack` · `smoke-particles` · `nature-kit` (329 GLB) · `platformer-kit` (153 GLB) · `castle-kit` (76 GLB) · `graveyard-kit` (91 GLB) · `space-kit` (153 GLB) · `interface-sounds` · `impact-sounds` · `sci-fi-sounds` · `digital-audio`

### Poly Haven (CC0) — all ✅, `.hdr`
Sky Ruins: `kloofendal_48d_partly_cloudy_puresky` (2k+1k), `qwantani_puresky`, `kloppenheim_06_puresky` ·
Fire Rift: `the_sky_is_on_fire` (2k+1k), `kiara_1_dawn`, `belfast_sunset_puresky` ·
Void: `satara_night` (2k+1k), `moonless_golf`, `rogland_moonlit_night`

### ambientCG (CC0) — all ✅, `*_1K-JPG` (Color / NormalGL / NormalDX / Roughness / AO / Displacement)
Rock: `030 035 051 058 063 064` · Ground: `037 054 068 080` · Grass: `004 005` · `Moss002` ·
Bricks: `085 097` · `PavingStones138` · `Tiles143` · Lava: `001 002 004 005` · Ice: `002 003` · `Onyx006` · Metal: `032 049A`

### Mixamo — ✅ done
- Upload: `Superhero_Male_mesh.zip` (mesh-only OBJ from `tools/export-mixamo-mesh.py`) auto-rigged fine on the 25-bone LOD.
- Clips on disk (`assets-source/mixamo/upload/animations/`, all In-Place, 30 fps): Falling Idle 0.7 s · Front Flip 1.67 s · Hard Landing 2.5 s · Jump Over 2.27 s · Running Dive Roll 2.07 s · Stumble Backwards 3.33 s · Swinging 1.97 s · Victory 4.5 s · Wall Run 0.93 s, plus the rigged mesh (with/without skin).
- Retargeted onto the Quaternius Universal rig by `tools/build-player-anims.py` (rest-pose delta method, hips XZ zeroed). Mid-clip end-effector error vs source ≤ 0.11 (normalised by height) on every clip; contact sheet looked right.

### Generated: `public/assets/player/player_anims.glb` — 2.04 MB, 31 clips, armature only (mesh is loaded separately)
| Source | Clips |
|---|---|
| UAL1 | idle, walk, jog, sprint, jump_start, jump_loop, jump_land, roll, crouch_idle, crouch_fwd, dance, death, hit |
| UAL2 | slide_start, slide_loop, slide_exit, climb_up, dash (Shield_Dash), knockback, djump_start, djump_loop, djump_land |
| Mixamo | fall_loop, flip, land_hard, vault, dive_roll, stumble, swing, victory, wallrun |

Rebuild: `/Applications/Blender.app/Contents/MacOS/Blender -b -P tools/build-player-anims.py -- --check`

---

## Session log

### 2026-10-18 (late) — v2.1: play-test fixes, then next-phase slice
- Play-test feedback (20 min): walked through boulders/trees, player sometimes hidden, blue "coins", dash uncontrollable, no explanation of wall-run/grapple, "+8 % swift" meaningless.
- Fixes: **props are solid** (`'prop'` colliders from `PROP_BOX` footprints, kept off the 1.6 m centre lane; camera boom collides with them); **vault only triggers on level geometry** — it was hopping onto any obstacle ≤ 1.35 m, which read as "passing through"; coins are gold (`coin.glb` + metallic material, magnet radius 1.8); dash 19 m/s × 0.26 s, keeps vertical velocity, steerable, +lift when falling; double jump default; wall-run snaps from 1.1 m and needs a sideways approach; **How-to card** on first run (H/Esc reopens; pauses), per-chunk hints on stages 0–1, grapple target ring glows gold + `E · GRAPPLE` prompt; upgrades rewritten with a "why" line (Swift removed); stage 0 teaches templates in a fixed order; gentler gaps; Rift starts 3 s after first input and ramps slower.
- Next-phase slice: **runner suit** (Blender splits body polys by dominant bone → skin / navy suit / teal gloves+boots, 3 primitives, same normal map); **procedural adaptive music** (`Music.ts`: saw pad on Am–F–C–G, bass pulse, arp fades in with FLOW, brown-noise rumble with Rift proximity, tempo rises with stage/FLOW; shares the Sfx AudioContext); **persistent best run** (`Save.ts`, localStorage) with a stats run-over card and record banners; cumulative distance across stages; `M` mutes (saved).
- Verified headless: prop blocks a run, a jump clears a 1 m bush, jump→dash carries 15 m, how-to card dismisses on Space, music graph attaches after the first key, run-over card shows `NEW DISTANCE RECORD` + save JSON, 0 console errors.
- Repo: pushed to `bhayanak/riftfall-skybreak`; added `actions/configure-pages@v5` with `enablement: true` so the workflow turns Pages on itself.

### 2026-10-18 (night) — v2: "make it a game" + repo identity
- Feedback: greybox was "monotonous and ugly". Pulled Phases 2+3 forward in one push (commit `c984437`): `Assets.ts` registry, `Environment.ts` (HDRI skybox/IBL via `EnvLighting`, `CameraFrame` bloom/vignette/grading, per-biome fog/sun), `Island.ts` (kit-built islands, walls, beams), `WorldGenerator.ts` (seeded 11-template chunk system, gems, grapple anchors, portal, scenery), `Rift.ts` (advancing wall, sinks islands), `Movement.ts` rewrite (wall-run / grapple swing / slide / vault / air jumps / per-run `RunStats`), `PlayerAnimation.ts` (31-clip state machine; **clips must be keyed by `AnimTrack.name`** — asset names contain `.`/`/` which `assignAnimation` treats as paths), `FlowSystem.ts`, `Upgrade.ts` (11 upgrades), `VFX.ts` (pooled emissive sprites), `Sfx.ts` (Web Audio pool), `Overlays.ts` (loading / upgrade cards / run over).
- Blender: `tools/build-world-kit.py` builds `public/assets/player/superhero_male.glb` (hair merged, 1K JPEG) and 38 world GLBs (JPEG, ≤512 px).
- **Death loop fixed**: `runId` guards on all async phase transitions, `killY` derived from the lowest island, respawn restores Rift-swallowed islands ahead (`restoreAhead`) + 1.5 s Rift grace, Rift clock starts on first input. Verified: 3 forced falls → solid respawn each time, Rift catch → overlay → Space restarts cleanly.
- Repo identity: user set `.git/config` to `bhayanak <ajayyadavmca@gmail.com>`; rewrote all prior commits (`git rebase --root --exec 'commit --amend --reset-author'`) + reflog expire + gc — zero `hpe.com` left in history. `.git/config` untouched.
- Gotcha: Vite's static index drops files that vanish momentarily (git stash) → serves `index.html` for the GLB ("Invalid magic number 0x6f64213c"). Restart `vite`.

### 2026-10-18 (evening) — Phase 0 + Phase 1 implemented, animation bundle built
- **Mixamo clips verified** with headless Blender (`tools/inspect-fbx.py`): 9 clips, Mixamo 25-bone rig, all in place. Blender 5.4 alpha installed; note its layered-action API (`action.layers[].strips[].channelbags[].fcurves`, action slots).
- **Phase 0**: `package.json` (Vite 7, TS 5.9, PlayCanvas 2.23.3), `tsconfig.json`, `vite.config.ts` (`VITE_BASE` for Pages), `index.html` (HUD + touch layer + debug `<pre>`), `.github/workflows/deploy.yml`, `tools/build-assets.mjs` (copies Kenney proto textures/GLBs to `public/assets/proto`). Decision: `public/assets/` is the shipped asset root (Vite static), not a top-level `assets/`.
- **Phase 1**:
  - `src/world/Colliders.ts` — OBB colliders, 3-sphere capsule resolution (iterative), tag system (ground/wall/hazard/checkpoint), slab raycast.
  - `src/player/Movement.ts` — kinematic controller: accel/decel curves, gravity 30, jump 10.5 (≈1.84 m), coyote 0.12 s, buffer 0.14 s, variable height (cut ×0.45), dash 24 m/s × 0.17 s with 1 charge refilled on landing, substepping, ground probe, facing lerp, event list (`jump/dash/land/land-hard/fell/respawn`). All tuning in `TUNING`. **Decides O1 = custom kinematic (no Ammo).**
  - `src/graphics/CameraRig.ts` — orbit follow, boom raycast collision, speed FOV (72→88), dash pulse, landing kick (reduced on mobile).
  - `src/world/Greybox.ts` — 7-island course along -Z: start (pillar + low step), 4.5 m hop, two step-ups, 6.7 m dash gap, canyon beam with orange wall-run walls, goal island + Kenney flag. Checkpoint triggers per island. Decorative void rocks.
  - `src/core/Input.ts` (keyboard/pointer-lock mouse/touch-look), `src/ui/TouchControls.ts` (joystick + Jump/Dash/Grapple), `src/ui/Hud.ts`, `src/core/Device.ts` (profile heuristics), `src/core/Game.ts` (AppBase with explicit systems/handlers, WebGL2; `?gpu` opts into WebGPU).
  - **Verified in a headless browser** via scripted key events: run 9 m/s, hop lands on island 1, jump+air-dash clears the 6.7 m gap, pillar push-out works (wall contact flagged), 120 fps / 0 errors; touch layout at 844×390 checked by screenshot. One early "phantom jump" sighting was test-harness state, not reproducible across 5 instrumented runs.
- **Pipeline**: `tools/fbx2glb.py` validated on 6 Ruins FBX (metres, 100 KB each; textures not embedded because that pack is vertex-colour/material only). `tools/build-player-anims.py` built `player_anims.glb` (31 clips). `tools/preview-anims.py` renders contact sheets for eyeballing.
- Local git repo initialised on `main`, 2 commits. **No remote / nothing pushed.**

### 2026-10-18 (later) — Drive packs landed, Mixamo unblocked
- Ajay downloaded all 11 Google-Drive Quaternius packs off-network and placed them under `assets-source/quaternius/<name>/`. Verified: no stray zips, all extracted (~1.85 GB). Six of them are FBX/.blend only → added FBX→GLB step to the pipeline plan.
- Mixamo "unable to map your existing skeleton": root cause is the pre-rigged FBX. Wrote `tools/export-mixamo-mesh.py` (pure Python, no Blender) to emit mesh-only OBJ zips for Male/Female; validated (14,318 tris, all indices in range). Documented Option A (upload zip) / Option B (Y Bot) in `MANUAL-DOWNLOADS.md`.
- Blender is **not installed** on this machine; it is required for animation merging/retargeting and is the simplest FBX→GLB converter → added to Phase 0 prerequisites.
- Account credentials were pasted in chat → not used; recommended rotating the password.

### 2026-10-18 — Plan refinement + asset acquisition
- Probed every site in the vision doc for scriptable downloads:
  - Kenney: direct zip link is in the page HTML → scripted.
  - Poly Haven: `api.polyhaven.com/files/<id>` → direct `.hdr` URLs → scripted.
  - ambientCG: `ambientcg.com/get?file=<Id>_1K-JPG.zip` → scripted.
  - Quaternius: newer packs on itch.io (scripted via csrf → `download_url` → `/file/<upload_id>` → signed URL, no key needed for free packs); older "Ultimate" packs on Google Drive → **Drive is 403'd by Zscaler here**, `gdown` cannot help; listed for manual download.
  - Mixamo: requires Adobe login; manual only.
- Wrote `tools/fetch-assets.sh` (idempotent; stages `kenney|polyhaven|ambientcg|quaternius|all`; uses a throwaway venv at `/tmp/riftfall-venv` with `gdown` + `truststore` so Python trusts the corporate CA like curl does).
- Downloaded 18 Kenney packs, 6 Quaternius itch packs, 12 HDRIs, 26 texture sets (1.1 GB total).
- Inspected the rig: Quaternius Universal = UE-mannequin bone names (65 joints, incl. fingers). UAL1+UAL2 = 86 clips. Enough for MVP without Mixamo → decisions D2–D5.
- Wrote `plan.md` (decisions, asset→feature map, pipeline, phases with exit criteria), `assets-source/MANUAL-DOWNLOADS.md`, `.gitignore`.

---

## Blockers / needs from you
1. **Play v2.1** (`npm run dev` or the Pages URL once the deploy is green) and list what is still bad: collision, dash control, readability of wall-run/grapple, difficulty ramp, music. Everything tunable is in `TUNING` (movement), `CAM` (camera), `BIOMES` (look), chunk templates (`WorldGenerator.ts`), `Music.ts` (volume/tempo).
2. GitHub Pages: the workflow now enables Pages itself. If `https://bhayanak.github.io/riftfall-skybreak/` still 404s after a green run, set Settings → Pages → Source = GitHub Actions once.
3. Music source (O2): keep procedural, or pick a composed track to layer in.

## Next up
Visual polish pass on islands (dedicated island silhouette, kit-matched grass, decor off the lane, camera vs props), then a human feel pass → tune. Push once the remote is sorted so a Pages URL exists for phone testing.

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
| Phase 0 — repo bootstrap | ✅ Vite 7 + TS 5.9 + PlayCanvas 2.23 (`AppBase`, WebGL2), Pages workflow, local git repo (2 commits, no remote yet) |
| Phase 1 — movement prototype | ✅ run / jump (coyote, buffer, variable height) / dash (ground+air, 1 charge) / camera / greybox course / touch controls / debug overlay — **feel pass with a human still pending** |
| Phase 2 — movement slice | ⬜ next: wall-run, grapple, slide/vault, FLOW, chunks, portal/upgrades |
| Phase 3 — visual slice | ⬜ `player_anims.glb` (31 clips) already built — character swap-in is unblocked |
| Phase 4 — procedural runs | ⬜ |
| Phase 5 — content | ⬜ |
| Phase 6 — web optimisation / CrazyGames | ⬜ |

Raw asset footprint on disk: **~3 GB** in `assets-source/` (git-ignored). Shipped so far: `public/assets/` = **2.1 MB** (2.04 MB is the animation bundle; engine is 311 KB gzip).

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
1. **Play it.** `npm run dev` → http://localhost:5173 → click to capture mouse, WASD / Space / Shift, R restart, ` (backquote) debug overlay. The numbers are right; whether it *feels* right is the Phase 1 exit criterion and needs a human. Tell me what's off (too floaty? dash too short? camera too loose?) — everything lives in `TUNING` / `CAM`.
2. **Create the GitHub repo and push** when you want a public test URL (the Pages workflow is ready; it expects branch `main`). Enable Pages → Source: GitHub Actions.
3. ~~Rotate the password pasted in chat~~ — still recommended if not done.
4. Choose music source (O2) by Phase 3.

## Next up
Phase 2 — wall-run (walls are already tagged + placed in the canyon), grapple, slide/vault, FLOW meter, `Chunk.ts` + `WorldGenerator.ts`, portal + upgrade cards. Optionally pull the Superhero mesh + `player_anims.glb` in early (Phase 3 item) since the bundle exists.

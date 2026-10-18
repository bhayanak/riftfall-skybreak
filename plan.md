# Riftfall: Skybreak — Execution Plan

Companion to [Riftfall_Skybreak_Game_Plan.md](Riftfall_Skybreak_Game_Plan.md) (the vision).
This file is the *what-to-do-next* plan; [progress.md](progress.md) is the *what-has-been-done* ledger.

---

## 0. Decisions locked so far

| # | Decision | Why |
|---|---|---|
| D1 | **Engine: PlayCanvas engine (npm `playcanvas`) + TypeScript + Vite**, not the PlayCanvas cloud editor | Git-native, GitHub Actions/Pages deploy, CrazyGames SDK is plain JS; the editor would fight the repo workflow |
| D2 | **One skeleton: Quaternius "Universal" rig** (UE-mannequin bone names) | UAL1 + UAL2 give 86 clips on it for free; Universal Base Characters + Hairstyles ship on the same rig → cosmetics for free |
| D3 | **Mixamo is a gap-filler, not the base** | Mixamo uses a different skeleton; retargeting is a one-off Blender job (see `assets-source/MANUAL-DOWNLOADS.md`). MVP can ship without it |
| D4 | **Dash = `Roll`/`Shield_Dash`, Fall = `Jump_Loop`, Vault = `ClimbUp_1m`, Stumble = `Hit_Knockback`, Victory = `Dance_Loop`** for MVP | Avoids blocking Phase 1–3 on manual Mixamo work |
| D5 | **Wall-run for MVP = `Sprint_Loop` + procedural spine/root lean (~25°)** | Cheap, reads well at speed; replace with a Mixamo clip in Phase 5 if it looks off |
| D6 | **Greybox with Kenney Prototype Kit + Prototype Textures** in Phase 1–2 | Real collision shapes, zero art time |
| D7 | **Raw downloads live in `assets-source/` (git-ignored). Shipped assets live in `public/assets/`** and are always produced by the pipeline | Keeps repo small, keeps the sub-20 MB budget honest; Vite serves `public/` verbatim |
| D8 | Sky = **HDRI 1k (mobile) / 2k (desktop)** as skybox + light probe, clouds as card layers on top | Biggest "wow per KB" available |
| D9 | Textures ship at **≤1K, KTX2/Basis compressed**; sources are 1K JPG from ambientCG | Matches texture budget table in the vision doc |
| D10 | **Physics = custom kinematic capsule vs OBB colliders** (no Ammo) — `src/world/Colliders.ts` + `src/player/Movement.ts` | Parkour needs authored feel; 3-sphere capsule + iterative push-out + substepping is deterministic, tiny, and gives clean wall normals for wall-run. Resolves O1 |
| D11 | **PlayCanvas `AppBase` with explicit systems/handlers, WebGL2 default, WebGPU behind `?gpu`** | Lean bundle (311 KB gzip engine); WebGPU validated later |
| D12 | **Mixamo clips retargeted in headless Blender via rest-pose delta** (`tools/build-player-anims.py`), no Rokoko/ARP | Reproducible from CLI; checked error ≤ 0.11 normalised |

Open decisions (answer when reached):
- ~~O1 Physics~~ → resolved as D10.
- O2 Audio: Kenney SFX packs cover UI/impacts/sci-fi; **music source still unchosen** (needs CC0/CC-BY loop stems for FLOW layers). Decide in Phase 3.
- O3 Cloud rendering: card layers vs. a single panoramic cloud texture. Decide in Phase 3 after HDRI test.

---

## 1. Asset → feature map (what each downloaded pack is actually for)

### Player
| Need | Source (already on disk) | File |
|---|---|---|
| Base body (M/F) | Quaternius Universal Base Characters | `Base Characters/Godot - UE/Superhero_{Male,Female}_FullBody.gltf` |
| Hair/brows cosmetics | same pack | `Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/*.gltf` |
| Core locomotion | UAL1 | `Idle_Loop, Walk_Loop, Jog_Fwd_Loop, Sprint_Loop, Jump_Start, Jump_Loop, Jump_Land, Roll, Crouch_*` |
| Slide / vault / dash / stumble / ninja-jump | UAL2 | `Slide_Start/Loop/Exit, ClimbUp_1m, Shield_Dash, Hit_Knockback, NinjaJump_Start/Idle_Loop/Land` |
| Victory / death | UAL1 | `Dance_Loop, Death01` |
| Wall-run, grapple swing, hard landing, flip, vault, stumble, victory | **Mixamo ✅ retargeted** | in `public/assets/player/player_anims.glb` as `wallrun, swing, land_hard, flip, vault, stumble, victory, fall_loop, dive_roll` |
| Female mannequin (proportion test) | UAL2 | `Female Mannequin/Unreal-Godot/Mannequin_F.glb` |

### World
| Need | Source | Notes |
|---|---|---|
| Greybox platforms, ramps, walls, columns | Kenney Prototype Kit (145 GLB) + Prototype Textures | Phase 1–2 only |
| Floating-island rocks, trees, grass, bushes | Quaternius **Stylized Nature MegaKit** (68 glTF) ✅ | primary Sky Ruins vegetation |
| Ruins, temples, bridges, arches | Quaternius **Ultimate Modular Ruins** (92 FBX, 1×1 grid) ✅ | FBX-only → needs FBX→GLB step; Kenney Castle/Graveyard kits remain as extras |
| Floating-island rocks/trees (alt set) | Quaternius Ultimate Stylized Nature (111 glTF) ✅, Ultimate Nature (150 FBX) ✅ | |
| Crystals, portal parts, Void architecture | Quaternius Sci-Fi Essentials Kit (37 glTF) ✅, Ultimate Modular Sci-Fi (91 FBX) ✅, Kenney Space Kit (153 GLB) ✅ | emissive materials do the heavy lifting |
| Props (lanterns, crates, banners, braziers) | Quaternius Fantasy Props MegaKit (94 glTF) ✅, Medieval Dungeon (41 FBX) ✅ | |
| Platform pieces / moving platforms | Quaternius Ultimate Platformer (36 glTF) ✅, Modular Platformer (53 FBX) ✅, Kenney Platformer Kit (153 GLB) ✅ | |
| Extra low-poly nature | Kenney Nature Kit (329 GLB) ✅ | distant silhouettes only |
| Bosses / distant creatures | Quaternius Ultimate Monsters (50 glTF) ✅, Animated Monster (4 FBX) ✅ | Phase 5 |
| Alt. player bodies / cosmetics | Quaternius Ultimate Animated Character (52 glTF) ✅, Ultimate Modular Characters (11 glTF / 72 FBX) ✅ | same Universal rig |

### Materials (ambientCG, 1K JPG, PBR sets: Color/Normal/Roughness/AO/Displacement)
| Biome | Sets on disk |
|---|---|
| Sky Ruins | `Rock030 Rock035 Rock051 Rock058 Rock063 Rock064` · `Ground037 Ground068 Grass004 Grass005 Moss002` · `Bricks085 Bricks097 PavingStones138 Tiles143` |
| Fire Rift | `Lava001 Lava002 Lava004 Lava005` · `Rock058 Rock063` · `Ground054 Ground080` (ash/sand) · `Metal032 Metal049A` |
| Void | `Onyx006` (crystal-ish) · `Ice002 Ice003` · `Metal049A` · `Tiles143` |

### Skies (Poly Haven, `.hdr`, 2k + 1k mobile fallback for the primary of each biome)
| Biome | Primary | Alternates |
|---|---|---|
| Sky Ruins | `kloofendal_48d_partly_cloudy_puresky` | `qwantani_puresky`, `kloppenheim_06_puresky` |
| Fire Rift | `the_sky_is_on_fire` | `kiara_1_dawn`, `belfast_sunset_puresky` |
| Void | `satara_night` | `moonless_golf`, `rogland_moonlit_night` |

### VFX / UI / Audio (Kenney, all ✅)
| Need | Pack |
|---|---|
| Particle sprites (sparks, smoke, flares, magic) | Particle Pack, Smoke Particles |
| HUD, panels, upgrade cards, buttons | UI Pack, UI Pack Sci-Fi (space expansion) |
| Upgrade/ability icons | Game Icons |
| Touch/keyboard/gamepad glyphs | Input Prompts (1500 glyphs, incl. touch gestures) |
| Fonts | Kenney Fonts |
| SFX: UI, impacts, whooshes, energy | Interface Sounds, Impact Sounds, Sci-Fi Sounds, Digital Audio |

---

## 2. Asset pipeline (to build in Phase 3, prototype in Phase 1)

```
assets-source/<vendor>/...                 raw, git-ignored
        │  tools/build-assets.mjs            (copy/convert → ship)
        │  tools/fbx2glb.py                  (Blender: FBX-only Quaternius packs → GLB, metres)
        │  tools/build-player-anims.py       (Blender: UAL1+UAL2+Mixamo → one armature GLB)
        ▼
public/assets/proto/...                    greybox textures + Kenney GLBs (Phase 1)
public/assets/player/player_anims.glb      ✅ 31 clips, 2.04 MB (armature only)
public/assets/player/superhero_male.glb    TODO Phase 3 (mesh + hair, ≤ 1K textures, KTX2)
public/assets/<biome>/...                  TODO Phase 3+: meshopt + KTX2 via gltf-transform
public/assets/sky/<biome>_{1k,2k}.*        TODO HDR → cubemap
public/assets/manifest.json                TODO sizes + bundle membership (boot | sky | fire | void | cosmetics)
```

Tools:
- `@gltf-transform/cli` — dedupe, prune, resize textures to ≤1K, `meshopt` compress, `etc1s`/`uastc` KTX2 via `toktx`.
- `gltfpack` (meshoptimizer) — fallback single-command compressor.
- **FBX→GLB** (six Quaternius packs are FBX-only: Ruins, Nature, Modular Sci-Fi, Modular Platformer, Animated Monster, Medieval Dungeon): headless Blender batch script `tools/fbx2glb.py` (`blender -b -P …`). Alternative if Blender is unwanted: `npm i -D fbx2gltf` (FBX2glTF binary).
- Blender also for: merging UAL1+UAL2+Mixamo into one `player_anims.glb`, stripping finger tracks, Mixamo retarget. **Blender is not yet installed** → Phase 0 prerequisite.
- `tools/export-mixamo-mesh.py` ✅ — strips the skin from a glTF character so Mixamo's auto-rigger accepts it.

Budget gate (CI fails if exceeded): **boot bundle ≤ 20 MB**, any single GLB ≤ 2 MB, any texture ≤ 1K.

---

## 3. Phases with concrete exit criteria

### Phase 0 — Repo bootstrap  ✅
- [x] Install Blender (5.4 alpha at `/Applications/Blender.app`)
- [x] Vite 7 + TypeScript 5.9 + `playcanvas` 2.23.3 (`@gltf-transform/cli` / `gltfpack` deferred to Phase 3)
- [x] Folder layout (`src/core, player, world, graphics, ui`; `progression/audio/crazygames` created when first used)
- [x] `index.html` fullscreen canvas + HUD + touch layer; `Device.ts` (touch / profile / WebGPU)
- [x] `.github/workflows/deploy.yml` → GitHub Pages (needs the remote repo + Pages enabled)
- [x] `tools/fetch-assets.sh`, `tools/build-assets.mjs`
- [ ] Push to GitHub, confirm the Pages URL loads — **needs you to create the repo**

### Phase 1 — Movement prototype (grey)  ✅ code / ⏳ feel pass
- [x] Kinematic capsule controller: accel/decel, coyote time, jump buffer, variable jump height
- [x] Dash (ground + air, 1 charge refilled on landing), camera follow with speed-FOV + dash pulse + boom collision
- [x] Greybox course: 7 islands, hop / step-up / dash gap / canyon with wall-run walls / goal flag, checkpoints
- [x] Mobile: virtual joystick + Jump/Dash/Grapple buttons, right-half drag look (auto-vault lands with vault in Phase 2)
- [x] Debug overlay (backquote): fps, draw calls, state, velocity, checkpoint
- [ ] **Exit:** 60 s of running/jumping/dashing feels good on desktop *and* a phone — waiting on a human play-test

### Phase 2 — Movement vertical slice
- [ ] Wall-run (surface tagging, stick/detach rules, wall-jump)
- [ ] Grapple (anchor detection cone, rope constraint, swing release boost)
- [ ] Slide / vault, ledge assist
- [ ] FLOW: chain detection, decay, multiplier → HUD
- [ ] `Chunk.ts` + 10 greybox chunks + `WorldGenerator.ts` (connector matching only)
- [ ] Portal trigger → 3-card upgrade UI (Kenney UI Pack) → 6 upgrades wired
- [ ] Rift collapse behind player (kill volume that advances)
- **Exit:** complete grey run: start → 10 chunks → portal → upgrade → next run.

### Phase 3 — Visual vertical slice (Sky Ruins)
- [ ] Player: `Superhero_Male_FullBody` + hair, `player_anims.glb` (UAL1+UAL2 subset, fingers stripped), anim state graph
- [ ] Sky: `kloofendal_48d` HDRI skybox + IBL; 2–3 cloud card layers with parallax; height fog
- [ ] Islands: Stylized Nature MegaKit rocks/trees + Ruins (Quaternius if downloaded, else Castle/Graveyard Kit) re-skinned with ambientCG sets
- [ ] Waterfall (scrolling mesh + mist billboard), portal (ring + emissive + scrolling UV + particles)
- [ ] Player trail + dash/jump/land VFX from Particle Pack; FLOW drives intensity
- [ ] SFX from Kenney packs; placeholder music; decide O2
- [ ] Asset pipeline producing KTX2 + meshopt; `manifest.json`; boot bundle measured
- **Exit:** publicly showable 90-second clip; boot bundle < 20 MB.

### Phase 4 — Procedural runs
- [ ] 30+ chunks (table in vision doc), connector rules, difficulty curve by chunk tags
- [ ] 1 world event (Island Fracture) + Portal Collapse escape
- [ ] 10 upgrades total, run seed + daily seed
- **Exit:** 10 consecutive generated runs with no dead ends / impossible gaps (automated path validator).

### Phase 5 — Content
- [ ] Fire Rift (lava sets, `the_sky_is_on_fire`, ash particles, meteor event)
- [ ] Void (Onyx/Ice sets, `satara_night`, gravity-shift event)
- [ ] First boss: Rift Titan (Ultimate Monsters) — route destruction, not combat
- [ ] Mixamo gap animations retargeted (wall-run, grapple, hard landing)
- [ ] Cosmetics unlocks (hair, colour variants, trail colours), adaptive music layers

### Phase 6 — Web optimisation + CrazyGames
- [ ] CrazyGames HTML5 SDK: init, ad breaks at portal, `happytime()`, save via SDK data module
- [ ] Quality profiles (Mobile Low/High, Desktop) auto-picked by `Device.ts`
- [ ] Lighthouse-style budget report in CI; streaming of Fire/Void/cosmetics bundles
- **Exit:** CrazyGames QA pass; mobile-homepage eligibility checklist green.

---

## 4. Immediate next actions (ordered)

1. **You:** play the greybox (`npm run dev`) and report feel notes; create the GitHub repo + push `main` for a Pages URL.
2. **Me:** Phase 2 — wall-run on the tagged canyon walls, grapple, slide/vault, FLOW, chunk system, portal + upgrade cards.
3. Pull the Superhero mesh + `player_anims.glb` into the game with an anim state graph (early Phase 3) so Phase 2 moves can be previewed with real animation.
4. `tools/fbx2glb.py` full run on Ruins / Stylized Nature when Phase 3 dressing starts (6 files validated, ~1 s each).

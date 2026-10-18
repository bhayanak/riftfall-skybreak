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
| Assets — Mixamo | ⏳ upload fix ready (`assets-source/mixamo/upload/*.zip`); clips still to download — not needed for MVP (D3–D5) |
| Phase 0 — repo bootstrap | ⬜ not started |
| Phase 1 — movement prototype | ⬜ |
| Phase 2 — movement slice | ⬜ |
| Phase 3 — visual slice | ⬜ |
| Phase 4 — procedural runs | ⬜ |
| Phase 5 — content | ⬜ |
| Phase 6 — web optimisation / CrazyGames | ⬜ |

Raw asset footprint on disk: **~3 GB** in `assets-source/` (git-ignored).

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

### Mixamo — ⏳ upload unblocked, clips pending
- First attempt failed: uploading `Superhero_Male_FullBody.fbx` → "unable to map your existing skeleton" (it carries the UE-mannequin rig, which Mixamo can't ingest).
- Fix: `tools/export-mixamo-mesh.py` strips the skin and writes OBJ+MTL+textures zips → `assets-source/mixamo/upload/Superhero_{Male,Female}_mesh.zip` (T-pose, 1.82 m, 8.5k verts). Upload the zip, auto-rig, then download clips. Fallback: use Mixamo's Y Bot (retarget happens in Blender regardless).
- Not required for MVP (D3–D5). Clip shopping list in `assets-source/MANUAL-DOWNLOADS.md` §2.

---

## Session log

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
1. ~~Google Drive blocked~~ — resolved, all 11 packs on disk.
2. **Rotate the Gmail/Adobe password** that was pasted into chat.
3. Mixamo: upload `assets-source/mixamo/upload/Superhero_Male_mesh.zip` (not the FBX) when you next try — or just use Y Bot. Only needed by Phase 3/5.
4. Install **Blender** (free, https://www.blender.org/download/) before Phase 3 — needed for FBX→GLB on the six FBX-only packs and for the animation merge/retarget.
5. Choose music source (O2) by Phase 3.

## Next up
Phase 0 — repo bootstrap (Vite + TypeScript + PlayCanvas engine + GitHub Pages workflow). Nothing blocks it.

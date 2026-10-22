# Riftfall: Skybreak — CrazyGames submission guide

Everything needed to get the game through CrazyGames QA, what the game already does for it, and what only you can do in the Developer Portal. Requirements referenced are from <https://docs.crazygames.com/requirements/> (checked 2026-10-22). CrazyGames launches games in two steps: **Basic Launch** (SDK optional, no ads) and **Full Launch** (SDK mandatory, ads on). The game is built for Full-Launch rules so it passes either.

## 1. Build the upload

```bash
npm ci
npm run build:crazygames      # → riftfall-crazygames.zip (relative paths, base "./")
```

- Upload `riftfall-crazygames.zip` in the Developer Portal → your game → *Files*. `index.html` is at the zip root. Everything is referenced relatively — the normal `npm run build` is for GitHub Pages and uses an absolute `/riftfall-skybreak/` base, which **does not work** on CrazyGames.
- Weight (v0.8.0): the zip is ≈ 8.3 MB compressed / 14.5 MB unpacked, 82 files — PlayCanvas + game JS ≈ 1.5 MB, assets ≈ 12 MB (skies 4.7 MB, player 2.2 MB, world kit 3.4 MB, sfx 0.4 MB). Everything loads before the first `gameplayStart`, so the *initial download size* CrazyGames measures is the same ≈ 14.5 MB: under the 50 MB limit and under the 20 MB bar for the **mobile homepage**. Keep it that way: don't add big textures or music files without lazy-loading them.
- No sitelock is built in, so nothing needs whitelisting.

## 2. Developer Portal settings

| Setting | Value | Why |
|---|---|---|
| Category | Action / Platformer (3D, parkour, roguelite) | — |
| Devices | Desktop **and** Mobile (phone + tablet) | touch layout, joystick and buttons are built in; the SDK's device type forces the touch layout on phones/tablets |
| Orientation (mobile) | Landscape only | the HUD and controls assume landscape; CrazyGames shows the rotate prompt for you |
| Controls | copy the *Controls* block below | — |
| SDK integrated | **Yes — HTML5 SDK v3** | — |
| Progress save | **Yes, using the Data Module** — mandatory, otherwise `data` calls fail and progress is lost | the save (`riftfall.save.v2`) is written through `SDK.data`, which also syncs it to the player's account |
| Ads | Midgame video ads: yes · Rewarded: no · Banners: no | see §4 |
| Multiplayer / account / IAP | No | — |
| Fullscreen button in game | None (the site provides it) | required |
| Privacy policy | Not needed | the game stores only its own save through the SDK, no analytics, no third-party calls |

**Controls text for the portal**

```
Desktop: WASD / arrows run · mouse look (click to capture, Esc or P releases) · Space jump, again in the air for a double jump · Shift air-dash · C or Ctrl slide · E grapple at a gold ring · P / Esc pause · H controls · M sound · R restart stage
Mobile: left thumb anywhere on the lower-left to run · drag the right side to look · JUMP, DASH, SLIDE, GRAPPLE buttons · ❚❚ pause
```

**Covers / media** — follow <https://docs.crazygames.com/requirements/game-covers/>: a 16:9 cover, a square and a portrait variant, 3–5 screenshots from actual gameplay (not the title screen), optionally a 15–30 s video. Use the live Pages build at <https://bhayanak.github.io/riftfall-skybreak/> to capture them.

## 3. What the game already does (and where)

| Requirement | Status | Where |
|---|---|---|
| SDK loaded + `init()` awaited before gameplay; environment checked (`local` / `crazygames` used, `disabled` ignored, so the Pages build is unaffected) | ✅ | `src/platform/Platform.ts` `init()` |
| `loadingStart()` / `loadingStop()` around the asset download | ✅ | `src/core/Game.ts` `boot()` |
| `gameplayStart()` on every start / resume / next stage; `gameplayStop()` on pause, controls card, death, portal, quit | ✅ | `launch()`, `pause()`, `showHelp()`, `onDeath()`, `onPortal()` |
| Land in gameplay in **≤ 1 click** (title → RUN; the first run shows controls as an in-HUD hint for 14 s instead of a blocking card; the Rift waits until you move) | ✅ | `launch()` |
| `happytime()` used sparingly: new furthest stage, escape | ✅ | `endRun()`, `onVictory()` |
| `reportGameCompletedPercentage` on boot (best stage / 20), each clear, 100 on escape | ✅ | `boot()`, `onPortal()`, `onVictory()` |
| `setGameContext` (stage, biome, seed, coins) per stage, cleared on the title | ✅ | `launch()`, `menu()` |
| `settings.muteAudio` honoured and listened to; the site's mute wins over the in-game M toggle | ✅ | `Platform.muteAudio`, `Game.applyMute()` |
| Progress through `SDK.data` (localStorage API shape), localStorage only off-platform | ✅ | `Platform.getItem/setItem`, `Save.attach()` |
| Device type from `SDK.user.systemInfo` → touch layout on phone/tablet | ✅ | `boot()` |
| Midgame ads only at natural breaks, game blocked while pending, audio muted **only while an ad plays**, resumes on `adError`/unfilled, never hangs (8 s guard if no ad starts) | ✅ | `Platform.midgame()`, `Game.adBreak()` |
| No rewarded ads, no banners, no ad buttons without effect (Basic Launch safe) | ✅ | — |
| No external links, no cross-promotion, no store links, no custom fullscreen button, PEGI-12 content | ✅ | — |
| Pointer lock for the first-person-style look, released by Esc/P; losing the lock pauses | ✅ | `src/core/Input.ts` |
| Browser defaults suppressed inside the iframe: wheel scroll, Space/arrow scroll, context menu, text selection / iOS callout | ✅ | `Input.ts`, `src/ui/ui.css` |
| iOS audio resume on `touchend` / `click` after an interruption | ✅ | `src/audio/Sfx.ts` |
| Readable at the smallest desktop iframe (907×510) and DPR 1; safe-area insets for the app | ✅ | `ui.css` uses `clamp()` sizes and `env(safe-area-inset-*)` |
| English only; original name, code, art (Quaternius CC0 / Kenney CC0 / own) | ✅ | — |
| Frame-rate independence | ⚠️ | movement integrates per frame with `dt` clamped to 1/30 s; fine at 60–165 Hz in testing, but do one manual run on a 144 Hz monitor before submitting (jump distance should feel identical) |

## 4. Ad placement (what QA will look at)

- **When**: after the stage-clear card's upgrade pick (before the next stage builds) and when the player picks RUN AGAIN after a death. Never during a run, never on a navigation button (opening the Market or Stats does not request an ad).
- **Pacing**: the SDK decides whether an ad is actually shown (max one per ~3 minutes, none at the very start); the game just asks at every break.
- **Behaviour during an ad**: the loading overlay is up, input is ignored, music and SFX are muted from `adStarted` to `adFinished`, and the next stage starts afterwards. On `adError` / no fill the game continues immediately.
- **Ad blockers**: nothing is gated behind ads, so players with blockers play normally (required).
- **Rewarded ads** are deliberately not integrated. If you add them later, follow the rewarded rules (optional, clearly marked as an ad, same-size "no thanks" button, no chaining, hide when `hasAdblock()`); a sensible place would be "double this run's coins" on the run-over card with a coin-price alternative.

## 5. Test in the portal's QA tool before you press Submit

1. Developer Portal → your game → **Preview** (this is `crazygames.com/preview`, the realistic environment; the SDK reports `crazygames` there).
2. Open the QA panel and tick off, in this order:
   - Load → you should see *loading start* then *loading stop*.
   - Press RUN → *gameplay start* fires once; the first-run controls hint shows; no card blocks the run.
   - P → *gameplay stop*; Space → *gameplay start*.
   - Die → *gameplay stop*; RUN AGAIN → a **midgame ad request**; game stays blocked until the ad finishes; sound returns afterwards; the run restarts.
   - Clear stage 1 (the first stage is ≈ 440 m, under a minute) → *gameplay stop*, pick an upgrade → midgame request → next stage → *gameplay start*; *completed percentage* reports 5.
   - Toggle the site's mute → the game goes silent even if M is "on".
   - Use the site's fullscreen; Esc exits fullscreen and pauses the game cleanly.
   - Reload → coins / records persist (data module).
3. Also run it once in the preview with the device switched to **mobile** (or a real phone through the app): joystick, buttons, landscape prompt, text size.
4. Keep the browser console open: there must be no uncaught errors. SDK lines like `gameplayStart() call throttled` only appear if start/stop are called within one second of each other (e.g. pausing immediately after starting) and are harmless.

## 6. If the last rejection said…

| Reason | Now |
|---|---|
| "SDK not integrated / no gameplay events" | full v3 integration, events listed in §3; verify in the QA tool (§5) |
| "Game does not start in gameplay / too many clicks" | 1 click from the title, no blocking tutorial |
| "Ads interrupt gameplay / audio during ads / game freezes on ad" | ads only at breaks, mute on `adStarted`, guard timer, continues on error |
| "Progress not saved / Data Module not used" | all saves go through `SDK.data`; tick *Progress save → Data Module* in the portal |
| "Game too large / slow to load" | 13.5 MB, loading bar, loading events |
| "Doesn't work in the iframe (scrolls, cursor leaves, context menu)" | pointer lock + Esc, wheel/arrow/space/context-menu suppressed, user-select off |
| "Text unreadable at small sizes" | checked at 907×510; HUD and cards scale with `clamp()` |
| "External link / fullscreen button / cross-promo" | none in the game |
| "Not mobile friendly" | touch layout + SDK device detection; declare landscape-only |
| "Absolute paths" | use `npm run build:crazygames` (relative base) — the Pages build is not uploadable |

Paste the exact rejection text into an issue or here and map it against this table; anything not covered above is a genuine gap.

## 7. Local testing without the portal

- `npm run dev` → <http://localhost:5173/> — on localhost the SDK runs in `local` mode: it logs every event to the console (purple *HTML5 SDK* tags) and shows a fake 5-second ad overlay for midgame requests, which is enough to see the mute / block / resume behaviour.
- `?muteAudio=true` simulates the site's mute switch; `?nocg` skips the SDK entirely; `?useLocalSdk=true` forces local mode on any host.

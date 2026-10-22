# Riftfall: Skybreak

A 3D parkour roguelite in the browser. Sprint across a chain of floating islands while the **Rift** — a wall of collapsing sky — chases you. Jump, double-jump, air-dash, wall-run, grapple and slide your way to the portal at the end of each stage, pick an upgrade, and keep going. **Escape = 20 stages** (Sky Ruins → Fire Rift → the Void, over and over), each longer than the last — a minute of running on stage 1, four on stage 20, about 19 km in all. From stage 4 the **Rift Titan** stalks the route and slams islands out from under you. **From stage 5 the Rift is faster than a plain sprint**: dash, slide and wall-run boosts keep you ahead for a while, but you will need Market powers (Rift Ward, Quick Feet, Afterburner …) to go deep. Escape and you can keep running into endless.

**Play:** <https://bhayanak.github.io/riftfall-skybreak/>

Every run is a new seeded route. `?seed=123` replays a route; `?daily` gives everyone the same route for the day.

## How to play

| Key | Move |
|---|---|
| **W A S D** / mouse | Run / look (click once to capture the mouse) |
| **Space** | Jump — hold for a full jump, press again in the air for a double jump |
| **Shift** | Air dash — press mid-jump to cross big gaps |
| **E** | Grapple — when a ring glows gold, press to swing; press again to let go |
| **Space** near a wall | Wall-run — jump towards a wall while moving; Space again to leap off |
| **C** | Slide — duck under the low stone gates without losing speed (works from a standstill at a gate) |
| **Esc** / **P** | Pause — resume, controls, or quit to the title (coins are kept) |
| **H** · **M** · **R** | Controls card · sound · restart |

Land a little short and you grab the ledge and pull up. Glowing islands give way after you land — keep moving. Tricks build **FLOW**: at x4 and above every coin counts double. Reach the portal before the Rift reaches you.

## Coins, missions, stars, records

- **One coin in the world is one coin.** Coins are **banked at every portal** (and if you die or quit, whatever you had is banked too). Clearing a stage pays a small bonus, escaping pays 150.
- **Missions** — three at a time on the title screen ("slide under 5 gates in one run", "find 3 hidden stars" …). Each pays 30–250 coins; finishing one pulls the next from the list.
- **Stars** — one hidden star per stage, somewhere off the obvious line (side roads, moving islands, far corners). Worth 10 coins, tracked per stage in STATS.
- **Records** — per stage (best time, most coins, clears, star), per run (most stages, distance, coins, fastest escape), lifetime (runs, escapes, time, distance, coins), plus your daily-route best.
- **Market** — 9 suits (five-zone outfits, some plated or glowing), 6 hairstyles, back / head / face gear (capes, glass wings, jetpack, halo, horns, crown, visor, goggles, beard), 7 trails, and 13 permanent **powers with levels** (Quick Feet I–V, Rift Ward I–V, Afterburner, Rift Anchor, Lucky Coin …). Reaching a new biome unlocks its suit for free. When the Rift catches you the summary tells you how fast it ran versus your sprint, and the MARKET is one tap away.

On a phone: put your thumb anywhere on the lower-left to run (a short push is a full sprint), drag the right side to look, and use the on-screen buttons for Jump / Dash / Grapple / Slide. The ❚❚ button top-right pauses.

## Running locally

```bash
npm install
npm run dev               # http://localhost:5173
npm run build             # GitHub Pages build in dist/
npm run build:crazygames  # relative-path build + riftfall-crazygames.zip for the CrazyGames portal
```

The first run drops you straight into stage 1 with the controls shown as a hint; **H** opens the full card any time. On CrazyGames the game talks to the HTML5 SDK v3 (gameplay / loading events, data-module saves, midgame ads between stages, the site's mute switch); anywhere else those calls are no-ops. See [crazygames.md](crazygames.md) for the submission checklist.

Built with [PlayCanvas](https://playcanvas.com/), TypeScript and Vite. Art: Quaternius (CC0), Kenney (CC0), Poly Haven HDRIs (CC0), Mixamo animations. Deployed to GitHub Pages on every push to `main`.

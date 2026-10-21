# Riftfall: Skybreak

A 3D parkour roguelite in the browser. Sprint across a chain of floating islands while the **Rift** — a wall of collapsing sky — chases you. Jump, double-jump, air-dash, wall-run, grapple and slide your way to the portal at the end of each stage, pick an upgrade, and keep going. **Escape = 9 stages** (Sky Ruins → Fire Rift → the Void, three times over, harder each loop). From stage 4 the **Rift Titan** stalks the route and slams islands out from under you. Escape and you can keep running into endless.

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
| **C** | Slide while sprinting |
| **Esc** / **P** | Pause — resume, controls, or quit to the title (coins are kept) |
| **H** · **M** · **R** | Controls card · sound · restart |

Land a little short and you grab the ledge and pull up. Glowing islands give way after you land — keep moving. Coins and tricks build **FLOW**, which multiplies your coins. Reach the portal before the Rift reaches you.

## Coins, records and stats

- Coins you pick up are **banked at every portal** (and if you die or quit, whatever you had is banked too). The HUD shows this run's total and the stage timer; the title screen shows your wallet.
- **Per stage:** best time and most coins, shown when you clear it and in **STATS**.
- **Per run:** most stages, longest distance, most coins, fastest escape.
- **Lifetime:** runs, escapes, time played, total distance, coins earned.
- Spend coins in the **Wardrobe**: suits and trails (cosmetic) and powers (small permanent perks). Reaching a new biome also unlocks its suit for free.

On a phone: put your thumb anywhere on the lower-left to run (a short push is a full sprint), drag the right side to look, and use the on-screen buttons for Jump / Dash / Grapple / Slide. The ❚❚ button top-right pauses.

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Built with [PlayCanvas](https://playcanvas.com/), TypeScript and Vite. Art: Quaternius (CC0), Kenney (CC0), Poly Haven HDRIs (CC0), Mixamo animations. Deployed to GitHub Pages on every push to `main`.

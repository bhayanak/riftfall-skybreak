# Riftfall: Skybreak

A 3D parkour roguelite in the browser. Sprint across a chain of floating islands while the **Rift** — a wall of collapsing sky — chases you. Jump, double-jump, air-dash, wall-run, grapple and slide your way to the portal at the end of each stage, pick an upgrade, and keep going into the Fire Rift, the Void and beyond. From stage 4 the **Rift Titan** stalks the route and slams islands out from under you.

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
| **H** / **Esc** | Controls card · **M** sound · **R** restart |

Land a little short and you grab the ledge and pull up. Glowing islands give way after you land — keep moving. Coins and tricks build **FLOW**, which multiplies your energy. Reach the portal before the Rift reaches you.

On a phone: left thumb to move, drag the right side to look, on-screen buttons for Jump / Dash / Grapple.

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

Built with [PlayCanvas](https://playcanvas.com/), TypeScript and Vite. Art: Quaternius (CC0), Kenney (CC0), Poly Haven HDRIs (CC0), Mixamo animations. Deployed to GitHub Pages on every push to `main`.

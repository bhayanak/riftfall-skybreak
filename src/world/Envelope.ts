import { TUNING } from '../player/Movement';

/**
 * Analytic movement envelope derived from TUNING: how far each move can carry the player, feet-to-feet,
 * when landing `h` metres above (+) or below (-) the takeoff. The generator sizes every gap against this and
 * the route validator flags anything that slips through. Includes the air mantle (you may arrive a bit below
 * the ledge) and assumes an imperfect jump hold (players tap).
 */
export type Move = 'run' | 'jump' | 'djump' | 'dash' | 'ddash';
export const MOVES: Move[] = ['run', 'jump', 'djump', 'dash', 'ddash'];
const T = TUNING;
const HOLD = 0.8;    // fraction of full jump velocity a real player gets (early release)
const MANTLE = 0.65; // fraction of the mantle height we are willing to rely on

/** Time to come down to relative height h after launching with vertical speed v0; null if it never gets that high. */
function flightTime(v0: number, h: number): number | null {
  const g = T.gravity;
  const disc = v0 * v0 - 2 * g * h;
  if (disc < 0) return null;
  return (v0 + Math.sqrt(disc)) / g;
}

export function reach(move: Move, h: number): number {
  const vh = T.runSpeed, g = T.gravity;
  const hEff = h - T.mantleHeight * MANTLE;
  const v1 = T.jumpVelocity * HOLD, t1 = v1 / g, h1 = (v1 * v1) / (2 * g);
  const v2 = T.jumpVelocity * 0.95 * HOLD, t2 = v2 / g, h2 = (v2 * v2) / (2 * g);
  const dashD = T.dashSpeed * T.dashDuration, after = T.dashSpeed * T.dashEndSpeedKeep;
  switch (move) {
    case 'run': { const t = flightTime(0, hEff); return t === null ? 0 : vh * t; }
    case 'jump': { const t = flightTime(v1, hEff); return t === null ? 0 : vh * t; }
    case 'djump': { const t = flightTime(v2, hEff - h1); return t === null ? 0 : vh * (t1 + t); }
    case 'dash': { const t = flightTime(0, hEff - h1); return t === null ? 0 : vh * t1 + dashD + after * t; }
    case 'ddash': { const t = flightTime(0, hEff - h1 - h2); return t === null ? 0 : vh * (t1 + t2) + dashD + after * t; }
  }
}

/** Largest gap `move` crosses with `slack` (0..1) kept in hand. */
export function maxGap(move: Move, h: number, slack = 0.8): number { return reach(move, h) * slack; }

/** Cheapest move that crosses horizontal distance d with rise h, or null if nothing does. */
export function neededMove(d: number, h: number, slack = 0.8): Move | null {
  for (const m of MOVES) if (maxGap(m, h, slack) >= d) return m;
  return null;
}

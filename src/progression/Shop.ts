import * as pc from 'playcanvas';
import type { RunStats } from '../player/Movement';

/**
 * Wardrobe + powers. Coins are the run's ENERGY banked at the end of every run. Suits and trails are cosmetic;
 * powers are small permanent starting perks. Some suits are also granted free for reaching a stage.
 */
export type ItemKind = 'suit' | 'trail' | 'power';

export interface ShopItem {
  id: string;
  kind: ItemKind;
  name: string;
  desc: string;
  price: number;
  /** granted for free once the best stage reached is >= this */
  unlockStage?: number;
  icon?: string;
  suit?: { suit: pc.Color; accent: pc.Color };
  /** null = use the biome colour */
  trail?: pc.Color | null;
  apply?: (s: RunStats) => void;
}

const c = (r: number, g: number, b: number) => new pc.Color(r, g, b);

export const SHOP: ShopItem[] = [
  // suits
  { id: 'suit.skyrunner', kind: 'suit', name: 'SKYRUNNER', desc: 'Standard issue.', price: 0, suit: { suit: c(0.055, 0.075, 0.16), accent: c(0.10, 0.62, 0.66) } },
  { id: 'suit.ember', kind: 'suit', name: 'EMBER', desc: 'Free on reaching the Fire Rift.', price: 400, unlockStage: 1, suit: { suit: c(0.16, 0.05, 0.05), accent: c(0.95, 0.55, 0.15) } },
  { id: 'suit.void', kind: 'suit', name: 'VOIDWALKER', desc: 'Free on reaching the Void.', price: 800, unlockStage: 2, suit: { suit: c(0.09, 0.05, 0.16), accent: c(0.75, 0.35, 1.0) } },
  { id: 'suit.titan', kind: 'suit', name: 'TITANSLAYER', desc: 'Free on meeting the Rift Titan.', price: 1500, unlockStage: 3, suit: { suit: c(0.85, 0.85, 0.88), accent: c(1.0, 0.8, 0.3) } },
  { id: 'suit.aurora', kind: 'suit', name: 'AURORA', desc: 'Teal and rose.', price: 600, suit: { suit: c(0.06, 0.22, 0.26), accent: c(1.0, 0.45, 0.65) } },
  { id: 'suit.obsidian', kind: 'suit', name: 'OBSIDIAN', desc: 'Black glass, red seams.', price: 900, suit: { suit: c(0.03, 0.03, 0.04), accent: c(0.9, 0.12, 0.12) } },
  { id: 'suit.golden', kind: 'suit', name: 'GOLDEN', desc: 'For those who never stop.', price: 2500, suit: { suit: c(0.95, 0.75, 0.25), accent: c(1.0, 1.0, 0.95) } },
  // trails
  { id: 'trail.biome', kind: 'trail', name: 'RIFT LIGHT', desc: 'Your trail takes the colour of the Rift.', price: 0, trail: null },
  { id: 'trail.gold', kind: 'trail', name: 'GOLD DUST', desc: 'A warm gold trail.', price: 300, trail: c(1.0, 0.8, 0.3) },
  { id: 'trail.emerald', kind: 'trail', name: 'EMERALD', desc: 'A green streak.', price: 300, trail: c(0.3, 1.0, 0.5) },
  { id: 'trail.white', kind: 'trail', name: 'STARLIGHT', desc: 'Pure white sparks.', price: 500, trail: c(1.0, 1.0, 1.0) },
  { id: 'trail.violet', kind: 'trail', name: 'VIOLET', desc: 'Deep purple embers.', price: 500, trail: c(0.7, 0.3, 1.0) },
  // powers (permanent, applied at the start of every run)
  { id: 'power.quickfeet', kind: 'power', name: 'QUICK FEET', desc: 'Run 6% faster.', price: 500, icon: '⇶', apply: (s) => { s.speedMult *= 1.06; } },
  { id: 'power.longarms', kind: 'power', name: 'LONG ARMS', desc: 'Grapple rings catch from 4 m further.', price: 400, icon: '⚓', apply: (s) => { s.grappleRange += 4; } },
  { id: 'power.magnet', kind: 'power', name: 'MAGNET CORE', desc: 'Coins fly to you from further away.', price: 400, icon: '◎', apply: (s) => { s.magnetRadius += 1.2; } },
  { id: 'power.feather', kind: 'power', name: 'FEATHERFALL', desc: 'Jump 5% higher, more time to leave an edge.', price: 700, icon: '✧', apply: (s) => { s.jumpMult *= 1.05; s.coyoteBonus += 0.08; } },
  { id: 'power.ward', kind: 'power', name: 'RIFT WARD', desc: 'The Rift chases 10% slower.', price: 900, icon: '⌛', apply: (s) => { s.riftSlow *= 0.9; } },
  { id: 'power.secondwind', kind: 'power', name: 'SECOND WIND', desc: 'Start every run with a Rift Shield.', price: 1200, icon: '⬡', apply: (s) => { s.riftShield += 1; } },
];

export const byId = (id: string): ShopItem | undefined => SHOP.find((i) => i.id === id);

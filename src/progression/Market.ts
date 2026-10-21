import * as pc from 'playcanvas';
import type { RunStats } from '../player/Movement';

/**
 * The Market. One coin picked up in the world is one coin here. Suits / hair / gear / trails are cosmetic;
 * powers are permanent and come in levels with rising prices. Some suits are also granted for reaching a stage.
 */
export type ItemKind = 'suit' | 'hair' | 'gear' | 'trail' | 'power';
export type GearSlot = 'back' | 'head' | 'face';

/** Five-zone outfit colours (body split by bone at build time) + surface finish. */
export interface Suit { torso: pc.Color; sleeves: pc.Color; gloves: pc.Color; pants: pc.Color; boots: pc.Color; metal?: boolean; glow?: pc.Color }

export interface MarketItem {
  id: string;
  kind: ItemKind;
  name: string;
  desc: string;
  /** price for level 1 (cosmetics have one level) */
  price: number;
  /** powers: price per further level; length = max level - 1 */
  levelPrices?: number[];
  /** granted for free once the best stage reached is >= this */
  unlockStage?: number;
  icon?: string;
  suit?: Suit;
  /** mesh name inside the player GLB ('' = bald) */
  hair?: string;
  gear?: { slot: GearSlot; style: string; color: pc.Color };
  /** null = use the biome colour; 'rainbow' cycles */
  trail?: pc.Color | null | 'rainbow';
  /** powers: apply `level` to the run stats */
  apply?: (s: RunStats, level: number) => void;
}

const c = (r: number, g: number, b: number) => new pc.Color(r, g, b);
const suit = (torso: pc.Color, sleeves: pc.Color, gloves: pc.Color, pants: pc.Color, boots: pc.Color, extra: Partial<Suit> = {}): Suit => ({ torso, sleeves, gloves, pants, boots, ...extra });

export const MARKET: MarketItem[] = [
  // ---- suits -------------------------------------------------------------------------------------------------
  { id: 'suit.skyrunner', kind: 'suit', name: 'SKYRUNNER', desc: 'Standard issue: navy jacket, teal gloves and boots.', price: 0,
    suit: suit(c(0.055, 0.075, 0.16), c(0.07, 0.10, 0.20), c(0.10, 0.62, 0.66), c(0.04, 0.05, 0.11), c(0.08, 0.45, 0.50)) },
  { id: 'suit.ember', kind: 'suit', name: 'EMBER', desc: 'Scorched leather. Free on reaching the Fire Rift.', price: 250, unlockStage: 1,
    suit: suit(c(0.18, 0.06, 0.05), c(0.26, 0.08, 0.05), c(0.95, 0.55, 0.15), c(0.10, 0.04, 0.03), c(0.30, 0.12, 0.05), { glow: c(1, 0.4, 0.1) }) },
  { id: 'suit.void', kind: 'suit', name: 'VOIDWALKER', desc: 'Deep violet with glowing seams. Free on reaching the Void.', price: 400, unlockStage: 2,
    suit: suit(c(0.09, 0.05, 0.16), c(0.12, 0.06, 0.22), c(0.75, 0.35, 1.0), c(0.06, 0.03, 0.12), c(0.45, 0.2, 0.7), { glow: c(0.7, 0.3, 1) }) },
  { id: 'suit.titan', kind: 'suit', name: 'TITANSLAYER', desc: 'White plate and gold trim. Free on meeting the Titan.', price: 700, unlockStage: 3,
    suit: suit(c(0.85, 0.85, 0.88), c(0.75, 0.75, 0.80), c(1.0, 0.8, 0.3), c(0.70, 0.70, 0.75), c(0.95, 0.75, 0.25), { metal: true }) },
  { id: 'suit.aurora', kind: 'suit', name: 'AURORA', desc: 'Teal jacket, rose gloves, dark trousers.', price: 350,
    suit: suit(c(0.06, 0.22, 0.26), c(0.08, 0.30, 0.34), c(1.0, 0.45, 0.65), c(0.05, 0.07, 0.10), c(0.9, 0.35, 0.55)) },
  { id: 'suit.arctic', kind: 'suit', name: 'ARCTIC', desc: 'White parka, ice-blue gloves, grey trousers.', price: 450,
    suit: suit(c(0.92, 0.94, 0.97), c(0.85, 0.88, 0.95), c(0.55, 0.80, 1.0), c(0.35, 0.38, 0.45), c(0.20, 0.22, 0.30)) },
  { id: 'suit.obsidian', kind: 'suit', name: 'OBSIDIAN', desc: 'Black glass armour with red seams.', price: 600,
    suit: suit(c(0.03, 0.03, 0.04), c(0.05, 0.05, 0.06), c(0.9, 0.12, 0.12), c(0.03, 0.03, 0.04), c(0.6, 0.08, 0.08), { metal: true, glow: c(1, 0.1, 0.1) }) },
  { id: 'suit.knight', kind: 'suit', name: 'CRIMSON KNIGHT', desc: 'Red plate, steel gauntlets and greaves.', price: 900,
    suit: suit(c(0.55, 0.06, 0.08), c(0.45, 0.05, 0.07), c(0.70, 0.72, 0.78), c(0.25, 0.04, 0.05), c(0.60, 0.62, 0.68), { metal: true }) },
  { id: 'suit.golden', kind: 'suit', name: 'GOLDEN', desc: 'For those who never stop.', price: 1500,
    suit: suit(c(0.95, 0.75, 0.25), c(0.90, 0.68, 0.20), c(1.0, 0.95, 0.80), c(0.80, 0.60, 0.18), c(1.0, 0.95, 0.80), { metal: true, glow: c(1, 0.8, 0.3) }) },
  // ---- hair ------------------------------------------------------------------------------------------------------
  { id: 'hair.parted', kind: 'hair', name: 'PARTED', desc: 'Neat side parting.', price: 0, hair: 'Hair_SimpleParted' },
  { id: 'hair.none', kind: 'hair', name: 'SHAVED', desc: 'Nothing to catch the wind.', price: 0, hair: '' },
  { id: 'hair.buzzed', kind: 'hair', name: 'BUZZED', desc: 'Close crop.', price: 60, hair: 'Hair_Buzzed' },
  { id: 'hair.buzzedf', kind: 'hair', name: 'UNDERCUT', desc: 'Short on the sides.', price: 80, hair: 'Hair_BuzzedFemale' },
  { id: 'hair.long', kind: 'hair', name: 'LONG', desc: 'Streams behind you at speed.', price: 140, hair: 'Hair_Long' },
  { id: 'hair.buns', kind: 'hair', name: 'BUNS', desc: 'Twin buns.', price: 140, hair: 'Hair_Buns' },
  // ---- gear ----------------------------------------------------------------------------------------------------
  { id: 'gear.none.back', kind: 'gear', name: 'NO BACK GEAR', desc: 'Travel light.', price: 0, gear: { slot: 'back', style: 'none', color: c(0, 0, 0) } },
  { id: 'gear.cape.red', kind: 'gear', name: 'SCARLET CAPE', desc: 'Flows behind you as you run.', price: 300, gear: { slot: 'back', style: 'cape', color: c(0.75, 0.08, 0.10) } },
  { id: 'gear.cape.night', kind: 'gear', name: 'NIGHT CAPE', desc: 'Black, lined with gold.', price: 450, gear: { slot: 'back', style: 'cape', color: c(0.05, 0.05, 0.08) } },
  { id: 'gear.cape.sky', kind: 'gear', name: 'SKY CAPE', desc: 'Pale blue, like the Rift light.', price: 450, gear: { slot: 'back', style: 'cape', color: c(0.5, 0.8, 1.0) } },
  { id: 'gear.wings', kind: 'gear', name: 'GLASS WINGS', desc: 'Translucent wings that spread in the air.', price: 900, gear: { slot: 'back', style: 'wings', color: c(0.6, 0.9, 1.0) } },
  { id: 'gear.jetpack', kind: 'gear', name: 'JETPACK', desc: 'Twin thrusters. Purely decorative, sadly.', price: 700, gear: { slot: 'back', style: 'jetpack', color: c(0.5, 0.52, 0.58) } },
  { id: 'gear.none.head', kind: 'gear', name: 'NO HEADWEAR', desc: '', price: 0, gear: { slot: 'head', style: 'none', color: c(0, 0, 0) } },
  { id: 'gear.halo', kind: 'gear', name: 'HALO', desc: 'A ring of light above your head.', price: 400, gear: { slot: 'head', style: 'halo', color: c(1.0, 0.9, 0.5) } },
  { id: 'gear.horns', kind: 'gear', name: 'HORNS', desc: 'Two dark horns.', price: 350, gear: { slot: 'head', style: 'horns', color: c(0.12, 0.08, 0.08) } },
  { id: 'gear.crown', kind: 'gear', name: 'CROWN', desc: 'For the ruler of the sky.', price: 800, gear: { slot: 'head', style: 'crown', color: c(1.0, 0.8, 0.25) } },
  { id: 'gear.none.face', kind: 'gear', name: 'NO FACEWEAR', desc: '', price: 0, gear: { slot: 'face', style: 'none', color: c(0, 0, 0) } },
  { id: 'gear.visor', kind: 'gear', name: 'VISOR', desc: 'A glowing HUD visor.', price: 250, gear: { slot: 'face', style: 'visor', color: c(0.3, 0.9, 1.0) } },
  { id: 'gear.goggles', kind: 'gear', name: 'GOGGLES', desc: 'Brass aviator goggles.', price: 200, gear: { slot: 'face', style: 'goggles', color: c(0.7, 0.5, 0.2) } },
  { id: 'gear.beard', kind: 'gear', name: 'BEARD', desc: 'Full beard.', price: 100, gear: { slot: 'face', style: 'beard', color: c(0, 0, 0) } },
  // ---- trails ----------------------------------------------------------------------------------------------------
  { id: 'trail.biome', kind: 'trail', name: 'RIFT LIGHT', desc: 'Your trail takes the colour of the Rift.', price: 0, trail: null },
  { id: 'trail.gold', kind: 'trail', name: 'GOLD DUST', desc: 'A warm gold trail.', price: 100, trail: c(1.0, 0.8, 0.3) },
  { id: 'trail.emerald', kind: 'trail', name: 'EMERALD', desc: 'A green streak.', price: 100, trail: c(0.3, 1.0, 0.5) },
  { id: 'trail.crimson', kind: 'trail', name: 'CRIMSON', desc: 'Blood-red sparks.', price: 160, trail: c(1.0, 0.2, 0.2) },
  { id: 'trail.white', kind: 'trail', name: 'STARLIGHT', desc: 'Pure white sparks.', price: 180, trail: c(1.0, 1.0, 1.0) },
  { id: 'trail.violet', kind: 'trail', name: 'VIOLET', desc: 'Deep purple embers.', price: 180, trail: c(0.7, 0.3, 1.0) },
  { id: 'trail.rainbow', kind: 'trail', name: 'PRISM', desc: 'Cycles through every colour.', price: 400, trail: 'rainbow' },
  // ---- powers (permanent, levelled) ----------------------------------------------------------------------------
  { id: 'power.quickfeet', kind: 'power', name: 'QUICK FEET', desc: '+3% run speed per level.', price: 150, levelPrices: [300, 500], icon: '⇶', apply: (s, l) => { s.speedMult *= 1 + 0.03 * l; } },
  { id: 'power.longarms', kind: 'power', name: 'LONG ARMS', desc: 'Grapple rings catch from 3 m further per level.', price: 120, levelPrices: [260], icon: '⚓', apply: (s, l) => { s.grappleRange += 3 * l; } },
  { id: 'power.magnet', kind: 'power', name: 'MAGNET CORE', desc: 'Coins fly to you from 0.8 m further per level.', price: 100, levelPrices: [200, 350], icon: '◎', apply: (s, l) => { s.magnetRadius += 0.8 * l; } },
  { id: 'power.feather', kind: 'power', name: 'FEATHERFALL', desc: 'Jump 4% higher and leave edges later, per level.', price: 200, levelPrices: [400], icon: '✧', apply: (s, l) => { s.jumpMult *= 1 + 0.04 * l; s.coyoteBonus += 0.05 * l; } },
  { id: 'power.ward', kind: 'power', name: 'RIFT WARD', desc: 'The Rift chases 6% slower per level.', price: 250, levelPrices: [450, 700], icon: '⌛', apply: (s, l) => { s.riftSlow *= Math.pow(0.94, l); } },
  { id: 'power.wallgrip', kind: 'power', name: 'WALL GRIP', desc: 'Wall-run 0.4 s longer per level.', price: 150, levelPrices: [300], icon: '▐', apply: (s, l) => { s.wallRunTime += 0.4 * l; } },
  { id: 'power.flowkeep', kind: 'power', name: 'FLOW KEEPER', desc: 'FLOW drains 15% slower per level.', price: 180, levelPrices: [360], icon: '∞', apply: (s, l) => { s.flowDecayMult *= 1 + 0.15 * l; } },
  { id: 'power.softland', kind: 'power', name: 'SOFT LANDING', desc: 'Falling costs 2 fewer coins per level.', price: 120, levelPrices: [240], icon: '⤓', apply: (s, l) => { s.fallPenalty = Math.max(1, s.fallPenalty - 2 * l); } },
  { id: 'power.lucky', kind: 'power', name: 'LUCKY COIN', desc: '10% chance per level that a coin counts double.', price: 200, levelPrices: [400, 650], icon: '✦', apply: (s, l) => { s.luck += 0.1 * l; } },
  { id: 'power.twincore', kind: 'power', name: 'TWIN CORE', desc: 'Start every run with two dashes.', price: 800, icon: '»»', apply: (s) => { s.dashCharges += 1; } },
  { id: 'power.secondwind', kind: 'power', name: 'SECOND WIND', desc: 'Start every run with a Rift Shield.', price: 600, icon: '⬡', apply: (s) => { s.riftShield += 1; } },
];

export const byId = (id: string): MarketItem | undefined => MARKET.find((i) => i.id === id);
export const maxLevel = (it: MarketItem): number => 1 + (it.levelPrices?.length ?? 0);
/** Price of the next level given the current one (0 = not owned); null at max. */
export const nextPrice = (it: MarketItem, level: number): number | null => level === 0 ? it.price : level < maxLevel(it) ? it.levelPrices![level - 1] : null;

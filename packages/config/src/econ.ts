import { BUILDINGS, BUILDING_BY_ID, SHELTER_IDS } from "./buildings.js";
import { HERO_BY_ID, HERO_POWER_BASE, HERO_POWER_GROWTH } from "./heroes.js";
import { TECH_BY_ID } from "./techs.js";
import type { Bonuses, BuildingDef, ResourceBag, ResourceKey } from "./types.js";

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/* ---------------- Economy constants (handoff §5/§7) ---------------- */
export const ECON = {
  /** warmth/sentiment target while the Rig is fueled (Energy > 0) */
  WARMTH_TARGET_FUELED: 38,
  WARMTH_TARGET_UNFUELED: 0,
  /** warmth tween factor: warmth += (target-warmth) * min(1, dt*RATE) */
  WARMTH_TWEEN_RATE: 0.4,
  /** Energy burned per second per Rig level */
  ENERGY_BURN_PER_RIG: 1.2,
  /** crew growth toward popCap, per second */
  POP_GROWTH_RATE: 0.4,
  /** global production multiplier — punchier early game (fun tuning) */
  PROD_MULT: 2.2,
  /** $NIVAR trickle per Alpha Lab (explorers) level per second, × token bonus */
  CRYSTAL_TRICKLE_PER_LAB: 0.14,
  /** active-play boost: tap-to-boost multiplier + duration/cooldown (ms) */
  BOOST_MULT: 2,
  BOOST_DURATION_MS: 15000,
  BOOST_COOLDOWN_MS: 45000,
  /** offline accrual cap for the welcome-back popup (8h) */
  OFFLINE_CAP_MS: 8 * 3600 * 1000,
  /** idle accrual hard cap (server rejects/clamps dt beyond this) — 12h */
  ACCRUAL_CAP_MS: 12 * 3600 * 1000,
  /** speed-up: $NIVAR price = ceil(remainingMs / MS_PER_GEM), min 1 */
  SPEEDUP_MS_PER_GEM: 30000,
  /** raid cooldown after any attempt */
  RAID_COOLDOWN_MS: 20000,
  /** first-clear loot multiplier */
  FIRST_CLEAR_MULT: 1.5,
  /** Daily Airdrop */
  AIRDROP_AMOUNT: 250,
  AIRDROP_COOLDOWN_MS: 180000,
  /** Genesis Pack one-time grant */
  GENESIS_CRYSTAL: 1000,
  /** Rig overclock $NIVAR drop = newLevel * THIS */
  OVERCLOCK_REWARD_PER_LEVEL: 40,
} as const;

/* ---------------- Warmth / sentiment ---------------- */
export const warmthMult = (warmth: number): number => 0.4 + 0.6 * (warmth / 100);

export const energyBurnPerSec = (furnace: number): number => ECON.ENERGY_BURN_PER_RIG * furnace;

export const warmthTarget = (energy: number): number =>
  energy > 0 ? ECON.WARMTH_TARGET_FUELED : ECON.WARMTH_TARGET_UNFUELED;

/** Sentiment emoji/value/label from warmth (matches prototype `tempLabel`). */
export function tempLabel(warmth: number): [string, number, string] {
  const w = warmth;
  if (w < 25) return ["😱", Math.round(w), "Extreme Fear"];
  if (w < 42) return ["😨", Math.round(w), "Fear"];
  if (w < 55) return ["😐", Math.round(w), "Neutral"];
  if (w < 75) return ["🙂", Math.round(w), "Greed"];
  return ["🤑", Math.round(w), "Extreme Greed"];
}

/* ---------------- Bonus aggregation ---------------- */
export function bonuses(research: Record<string, number>, squad: string[]): Bonuses {
  const b: Bonuses = { prodAll: 1, food: 1, wood: 1, coal: 1, iron: 1, token: 1, build: 1, raid: 1, crew: 1 };
  for (const id in research) {
    const t = TECH_BY_ID[id];
    if (t) b[t.k] += t.v * research[id];
  }
  for (const id of squad) {
    const h = HERO_BY_ID[id];
    if (h?.buff) b[h.buff.k] += h.buff.v;
  }
  return b;
}

/* ---------------- Production ---------------- */
export function prodPerSec(building: BuildingDef, level: number, warmth: number, b: Bonuses): number {
  if (!building.res || building.res === "pop") return 0;
  const res = building.res as ResourceKey;
  return building.base * level * warmthMult(warmth) * b.prodAll * (b[res as keyof Bonuses] ?? 1) * ECON.PROD_MULT;
}

/* ---------------- Hero / squad power ---------------- */
export function heroPower(heroId: string, level: number): number {
  const h = HERO_BY_ID[heroId];
  if (!h) return 0;
  const base = HERO_POWER_BASE[h.rarity];
  return Math.round(base * (1 + (level - 1) * HERO_POWER_GROWTH));
}

export function squadPower(squad: string[], heroLevels: Record<string, number>): number {
  return squad.reduce((a, id) => a + heroPower(id, heroLevels[id] ?? 1), 0);
}

/* ---------------- Net Worth (calcPower) ---------------- */
export interface PowerInput {
  furnace: number;
  buildingLevels: Record<string, number>;
  pop: number;
  squadPower: number;
  research: Record<string, number>;
}
export function calcPower(input: PowerInput): number {
  let p = input.furnace * 150;
  for (const b of BUILDINGS) {
    const lv = input.buildingLevels[b.id] ?? b.lv;
    p += Math.round(Math.pow(lv, 1.6) * 40);
  }
  p += Math.floor(input.pop) * 4;
  p += Math.round(input.squadPower * 0.5);
  let rsum = 0;
  for (const k in input.research) rsum += input.research[k];
  p += rsum * 120;
  return p;
}

/* ---------------- Crew capacity ---------------- */
export interface PopCapInput {
  buildingLevels: Record<string, number>;
  furnace: number;
  crewBonus: number;
}
export function shelterPopCap(input: PopCapInput): number {
  let shelterSum = 0;
  for (const id of SHELTER_IDS) {
    shelterSum += (input.buildingLevels[id] ?? BUILDING_BY_ID[id].lv) * 4;
  }
  const clinic = input.buildingLevels["clinic"] ?? BUILDING_BY_ID["clinic"].lv;
  return Math.round((10 + shelterSum + input.furnace * 2 + clinic * 3) * input.crewBonus);
}

/* ---------------- Costs ---------------- */
/** Upgrade cost for a facility producing `res`, currently at `level`. */
export function upCost(res: string | null, level: number): ResourceBag {
  const L = level;
  const main = (res && res !== "pop" ? res : "wood") as ResourceKey;
  const c: ResourceBag = {
    food: Math.round(480 * Math.pow(L, 1.55)),
    wood: Math.round(480 * Math.pow(L, 1.55)),
  };
  c[main] = Math.round(700 * Math.pow(L, 1.55));
  if (L >= 2) c.coal = (c.coal ?? 0) + Math.round(240 * Math.pow(L, 1.5));
  if (L >= 3) c.iron = (c.iron ?? 0) + Math.round(180 * Math.pow(L, 1.5));
  return c;
}

export function furnaceCost(furnace: number): ResourceBag {
  const L = furnace;
  return {
    wood: Math.round(2200 * Math.pow(L, 1.6)),
    food: Math.round(2200 * Math.pow(L, 1.6)),
    coal: Math.round(1200 * Math.pow(L, 1.6)),
    iron: Math.round(900 * Math.pow(L, 1.6)),
  };
}

/** Research cost = base × 1.6^level. */
export function scaleCost(base: ResourceBag, level: number): ResourceBag {
  const c: ResourceBag = {};
  for (const k in base) {
    const key = k as ResourceKey;
    c[key] = Math.round((base[key] ?? 0) * Math.pow(1.6, level));
  }
  return c;
}

/* ---------------- Build timing ---------------- */
export const buildSecsUpgrade = (targetLevel: number, buildBonus: number): number =>
  clamp(targetLevel * 3, 5, 32) / buildBonus;

export const buildSecsFurnace = (furnace: number, buildBonus: number): number =>
  clamp((furnace + 2) * 6, 15, 70) / buildBonus;

export const maxBLevel = (furnace: number): number => furnace;

export const speedupPrice = (remainingMs: number): number =>
  Math.max(1, Math.ceil(remainingMs / ECON.SPEEDUP_MS_PER_GEM));

export const overclockReward = (newFurnaceLevel: number): number =>
  newFurnaceLevel * ECON.OVERCLOCK_REWARD_PER_LEVEL;

/* ---------------- Affordability ---------------- */
export function canPay(resources: Record<string, number>, cost: ResourceBag): boolean {
  return Object.keys(cost).every((k) => (resources[k] ?? 0) >= (cost[k as ResourceKey] ?? 0));
}

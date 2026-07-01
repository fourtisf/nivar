import type { ResourceBag, StageDef } from "./types.js";
import { ECON } from "./econ.js";

/** Bear-market MONSTERS. Beat one and it levels up (stronger + better loot). */
export const STAGES: StageDef[] = [
  { id: "s1", name: "FUD Goblin", e: "👺", power: 240, rew: { crystal: 60, coal: 2500, iron: 1200 } },
  { id: "s2", name: "Bear Brute", e: "🐻", power: 620, rew: { crystal: 90, wood: 3000, food: 3000 } },
  { id: "s3", name: "Rug Golem", e: "👹", power: 1500, rew: { crystal: 140, iron: 4000, coal: 5000 } },
  { id: "s4", name: "Whale Kraken", e: "🐙", power: 3400, rew: { crystal: 220, wood: 8000, iron: 6000 } },
  { id: "s5", name: "Liquidation Reaper", e: "🧟", power: 7200, rew: { crystal: 360, coal: 18000, food: 14000 } },
  { id: "s6", name: "Capitulation Titan", e: "🐲", power: 15000, rew: { crystal: 600, iron: 24000, wood: 24000 } },
];

export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
);

/** Stage order — monsters unlock strictly in sequence. */
export const STAGE_ORDER: string[] = STAGES.map((s) => s.id);

/** Enemy power scales per monster level (endless progression). */
export const MONSTER_POWER_SCALE = 1.35;
/** Loot scales per monster level. */
export const MONSTER_REWARD_SCALE = 1.25;

/** Effective enemy power at a given monster level (level ≥ 1). */
export const monsterPower = (basePower: number, level: number): number =>
  Math.round(basePower * Math.pow(MONSTER_POWER_SCALE, level - 1));

/** Effective loot at a given monster level; `first` adds the first-clear ×1.5. */
export function monsterReward(rew: ResourceBag, level: number, first: boolean): ResourceBag {
  const mult = Math.pow(MONSTER_REWARD_SCALE, level - 1) * (first ? ECON.FIRST_CLEAR_MULT : 1);
  const out: ResourceBag = {};
  for (const k in rew) {
    const key = k as keyof ResourceBag;
    out[key] = Math.round((rew[key] ?? 0) * mult);
  }
  return out;
}

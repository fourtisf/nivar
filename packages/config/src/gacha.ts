import { HEROES_POOL } from "./heroes.js";
import type { Rarity } from "./types.js";

/**
 * Gacha rates, verbatim from nivar.html. Thresholds are cumulative over a
 * roll in [0,100): r<2 → legendary, r<12 → epic, r<40 → rare, else common
 * (i.e. legendary 2 / epic 10 / rare 28 / common 60).
 */
export const GACHA_RATES: Record<Rarity, number> = {
  legendary: 2,
  epic: 10,
  rare: 28,
  common: 60,
};

/** Summon prices in $NIVAR. */
export const SUMMON_COST = { 1: 100, 10: 900 } as const;
export const summonCost = (count: 1 | 10): number => (count === 10 ? 900 : 100);

/** Map a roll in [0,100) to a rarity (cumulative thresholds 2/12/40). */
export function rarityFromRoll(r: number): Rarity {
  return r < 2 ? "legendary" : r < 12 ? "epic" : r < 40 ? "rare" : "common";
}

/** Heroes available at each rarity. */
export const POOL_BY_RARITY: Record<Rarity, string[]> = {
  common: HEROES_POOL.filter((h) => h.rarity === "common").map((h) => h.id),
  rare: HEROES_POOL.filter((h) => h.rarity === "rare").map((h) => h.id),
  epic: HEROES_POOL.filter((h) => h.rarity === "epic").map((h) => h.id),
  legendary: HEROES_POOL.filter((h) => h.rarity === "legendary").map((h) => h.id),
};

/**
 * Resolve a hero id from two uniform randoms in [0,1):
 *  - `rarityRoll` chooses the rarity band
 *  - `pickRoll` chooses a hero within that band
 *
 * Splitting the RNG into explicit inputs lets the server drive rolls from a
 * provably-fair (commit-reveal) seed while keeping the math identical to the
 * client. The client passes `Math.random()` for both for visual parity.
 */
export function rollHeroId(rarityRoll: number, pickRoll: number): { heroId: string; rarity: Rarity } {
  const rarity = rarityFromRoll(rarityRoll * 100);
  const pool = POOL_BY_RARITY[rarity];
  const heroId = pool[Math.floor(pickRoll * pool.length)] ?? pool[0];
  return { heroId, rarity };
}

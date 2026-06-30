import { BUILDINGS } from "./buildings.js";

/** Fresh-base resource + rig defaults (prototype `S` initial values + boot). */
export const INITIAL_BASE = {
  food: 24500,
  wood: 23500,
  coal: 8200,
  iron: 4100,
  crystal: 1258,
  warmth: 38,
  furnace: 3,
  pop: 8,
  popCap: 12,
} as const;

/** Heroes a new player starts with (prototype boot grants Degen + Miner). */
export const INITIAL_HEROES: Record<string, { level: number; shards: number }> = {
  degen: { level: 1, shards: 0 },
  miner: { level: 1, shards: 0 },
};

/** Initial equipped squad. */
export const INITIAL_SQUAD: string[] = ["degen", "miner"];

/** buildingId → starting level, from the building defs. */
export const INITIAL_BUILDING_LEVELS: Record<string, number> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b.lv]),
);

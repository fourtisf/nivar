import * as CFG from "@nivar/config";

/**
 * Authoritative per-user game state. This is the server's source of truth —
 * the client renders a copy but never writes it. Mirrors the prototype's `S`
 * plus the persistent counters that back quests/dailies/shop.
 */
export interface GameState {
  userId: string;
  // resources
  food: number;
  wood: number;
  coal: number;
  iron: number;
  crystal: number; // $NIVAR (off-chain balance, backed by the ledger)
  // rig / population / sentiment
  warmth: number;
  pop: number;
  popCap: number;
  furnace: number; // rig level
  // facilities: key -> level
  buildings: Record<string, number>;
  // heroes: heroId -> { level, shards }
  heroes: Record<string, { level: number; shards: number }>;
  squad: string[]; // up to 5 equipped hero ids (order = slot)
  research: Record<string, number>; // techId -> level
  clears: Record<string, { cleared: boolean; cooldownUntil: number }>;
  // active build job
  job: { target: string; kind: "upgrade" | "furnace"; endsAt: number; total: number } | null;
  lastTickAt: number;
  // lifetime quest counters
  stats: { summons: number; raidWins: number; upgrades: number };
  claimed: string[]; // "cat:id"
  // daily counters (reset per UTC day)
  daily: {
    date: string;
    summons: number;
    raidWins: number;
    upgrades: number;
    airdrop: boolean;
    chestClaimed: number[];
  };
  // shop flags
  genesisClaimed: boolean;
  airdropAt: number; // ms timestamp when the next airdrop becomes claimable
  // provably-fair gacha seed (server-only — never serialized to the client)
  gacha: { serverSeed: string; serverSeedHash: string; nonce: number; clientSeed: string } | null;
}

export const RESOURCE_KEYS = CFG.RESOURCE_KEYS;

/** UTC yyyy-mm-dd for daily resets. */
export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Build a fresh authoritative state for a new user, from config defaults. */
export function freshState(userId: string, now: number): GameState {
  return {
    userId,
    food: CFG.INITIAL_BASE.food,
    wood: CFG.INITIAL_BASE.wood,
    coal: CFG.INITIAL_BASE.coal,
    iron: CFG.INITIAL_BASE.iron,
    crystal: CFG.INITIAL_BASE.crystal,
    warmth: CFG.INITIAL_BASE.warmth,
    pop: CFG.INITIAL_BASE.pop,
    popCap: CFG.INITIAL_BASE.popCap,
    furnace: CFG.INITIAL_BASE.furnace,
    buildings: { ...CFG.INITIAL_BUILDING_LEVELS },
    heroes: structuredCloneHeroes(CFG.INITIAL_HEROES),
    squad: [...CFG.INITIAL_SQUAD],
    research: {},
    clears: {},
    job: null,
    lastTickAt: now,
    stats: { summons: 0, raidWins: 0, upgrades: 0 },
    claimed: [],
    daily: { date: utcDay(now), summons: 0, raidWins: 0, upgrades: 0, airdrop: false, chestClaimed: [] },
    genesisClaimed: false,
    airdropAt: 0,
    gacha: null,
  };
}

function structuredCloneHeroes(src: Record<string, { level: number; shards: number }>) {
  const out: Record<string, { level: number; shards: number }> = {};
  for (const id in src) out[id] = { level: src[id].level, shards: src[id].shards };
  return out;
}

/* ---------------- derived helpers (delegate to @nivar/config) ---------------- */
export const bonuses = (s: GameState) => CFG.bonuses(s.research, s.squad);

export const heroLevels = (s: GameState): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const id in s.heroes) m[id] = s.heroes[id].level;
  return m;
};

export const squadPower = (s: GameState) => CFG.squadPower(s.squad, heroLevels(s));

export const calcPower = (s: GameState) =>
  CFG.calcPower({ furnace: s.furnace, buildingLevels: s.buildings, pop: s.pop, squadPower: squadPower(s), research: s.research });

export const shelterPopCap = (s: GameState) =>
  CFG.shelterPopCap({ buildingLevels: s.buildings, furnace: s.furnace, crewBonus: bonuses(s).crew });

export const buildingLevel = (s: GameState, key: string): number =>
  s.buildings[key] ?? CFG.BUILDING_BY_ID[key]?.lv ?? 0;

export const researchLv = (s: GameState): number =>
  Object.values(s.research).reduce((a, b) => a + b, 0);

export const clearedCount = (s: GameState): number =>
  Object.values(s.clears).filter((c) => c.cleared).length;

export const hasLegendary = (s: GameState): boolean =>
  Object.keys(s.heroes).some((id) => CFG.HERO(id)?.rarity === "legendary");

/** The state slice returned to the client after every mutation/read. */
export function serialize(s: GameState) {
  return {
    resources: { food: s.food, wood: s.wood, coal: s.coal, iron: s.iron, crystal: s.crystal },
    warmth: s.warmth,
    pop: s.pop,
    popCap: s.popCap,
    furnace: s.furnace,
    buildings: s.buildings,
    heroes: s.heroes,
    squad: s.squad,
    research: s.research,
    clears: s.clears,
    job: s.job,
    power: calcPower(s),
    squadPower: squadPower(s),
    stats: s.stats,
    claimed: s.claimed,
    daily: s.daily,
    genesisClaimed: s.genesisClaimed,
    airdropAt: s.airdropAt,
    lastTickAt: s.lastTickAt,
    serverTime: s.lastTickAt,
  };
}

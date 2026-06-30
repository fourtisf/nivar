/* ============================================================
   NIVAR shared types. All gameplay data is keyed by the original
   prototype's internal resource keys (food/wood/coal/iron/crystal),
   which are reskinned for display (Ramen/Bandwidth/Energy/Compute/$NIVAR).
   Keeping the internal keys is intentional — it guarantees zero drift
   against nivar.html.
   ============================================================ */

/** Producible / spendable resources. `crystal` is the premium currency ($NIVAR / 💎). */
export type ResourceKey = "food" | "wood" | "coal" | "iron" | "crystal";

/** A partial bag of resource amounts (e.g. a cost or a reward). */
export type ResourceBag = Partial<Record<ResourceKey, number>>;

export type Rarity = "common" | "rare" | "epic" | "legendary";

export type BuildingType =
  | "cookhouse"
  | "explorers"
  | "mine"
  | "hunters"
  | "shelter"
  | "sawmill"
  | "clinic";

/**
 * What a building produces. A real ResourceKey for producers, `"pop"` for
 * shelters (crew capacity), or `null` for pure-support facilities.
 */
export type BuildingRes = ResourceKey | "pop" | null;

export interface BuildingDef {
  id: string;
  name: string;
  type: BuildingType;
  /** iso grid coords */
  gx: number;
  gy: number;
  res: BuildingRes;
  /** base production per level per second (before warmth + bonuses) */
  base: number;
  /** initial level on a fresh base */
  lv: number;
  glow: string;
  oreCol?: string;
}

export interface FurnaceDef {
  id: "furnace";
  name: string;
  gx: number;
  gy: number;
}

/** Aggregated multiplier bag (research + equipped hero buffs). */
export interface Bonuses {
  prodAll: number;
  food: number;
  wood: number;
  coal: number;
  iron: number;
  token: number;
  build: number;
  raid: number;
  crew: number;
}

/** Keys a buff/tech can target inside {@link Bonuses}. */
export type BonusKey = keyof Bonuses;

export interface HeroBuff {
  k: BonusKey;
  v: number;
}

export interface HeroDef {
  id: string;
  name: string;
  e: string;
  rarity: Rarity;
  role: string;
  buff: HeroBuff;
  blurb: string;
}

export interface StageDef {
  id: string;
  name: string;
  e: string;
  power: number;
  rew: ResourceBag;
}

export interface TechDef {
  id: string;
  name: string;
  e: string;
  /** which {@link Bonuses} key this tech feeds */
  k: BonusKey;
  /** per-level magnitude */
  v: number;
  max: number;
  cost: ResourceBag;
}

/** Reward shape used by quests; `crystalBig` is a flat +2000 $NIVAR flag. */
export type QuestReward = ResourceBag & { crystalBig?: number };

export type QuestCategory = "main" | "daily" | "miles";

/**
 * Identifies the runtime counter a quest tracks. Decoupled from the engine so
 * the same definitions evaluate identically on client and server.
 */
export type QuestMetric =
  | "upgrades"
  | "summons"
  | "raidWins"
  | "squad"
  | "furnace"
  | "power"
  | "researchLv"
  | "stageDone"
  | "airdrop"
  | "dailyUpgrades"
  | "dailySummons"
  | "dailyRaidWins"
  | "legendary"
  | "cleared";

export interface QuestDef {
  id: string;
  e: string;
  t: string;
  metric: QuestMetric;
  /** metric parameter, e.g. the stage id for `stageDone` */
  param?: string;
  tgt: number;
  rew: QuestReward;
  /** daily-activity points awarded toward chests (daily quests only) */
  pts?: number;
}

export interface ChestDef {
  /** daily points required */
  p: number;
  /** $NIVAR reward */
  rew: number;
}

/** Snapshot of the counters quests evaluate against. */
export interface QuestSnapshot {
  upgrades: number;
  summons: number;
  raidWins: number;
  squadSize: number;
  furnace: number;
  power: number;
  researchLv: number;
  clearedStages: Set<string> | string[];
  clearedCount: number;
  hasLegendary: boolean;
  airdrop: boolean;
  dailyUpgrades: number;
  dailySummons: number;
  dailyRaidWins: number;
}

/** Result of a single gacha roll. */
export interface PullResult {
  heroId: string;
  rarity: Rarity;
  isNew: boolean;
}

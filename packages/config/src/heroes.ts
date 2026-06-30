import type { HeroDef, Rarity } from "./types.js";

/** CT-archetype hero pool, verbatim from nivar.html (`HEROES_POOL`). */
export const HEROES_POOL: HeroDef[] = [
  { id: "whale", name: "The Whale", e: "🐋", rarity: "legendary", role: "Liquidity", buff: { k: "token", v: 0.25 }, blurb: "Moves markets. +25% $NIVAR income." },
  { id: "vc", name: "The VC", e: "💼", rarity: "epic", role: "Funding", buff: { k: "prodAll", v: 0.15 }, blurb: "Deploys capital. +15% all production." },
  { id: "dev", name: "The Dev", e: "👨‍💻", rarity: "epic", role: "Builder", buff: { k: "build", v: 0.25 }, blurb: "Ships code. +25% build speed." },
  { id: "kol", name: "The KOL", e: "📢", rarity: "epic", role: "Hype", buff: { k: "crew", v: 0.2 }, blurb: "Rallies the timeline. +20% crew cap." },
  { id: "degen", name: "The Degen", e: "🎰", rarity: "rare", role: "Raider", buff: { k: "raid", v: 0.3 }, blurb: "Aped in. +30% raid power." },
  { id: "maxi", name: "The Maxi", e: "💎", rarity: "rare", role: "Hodler", buff: { k: "token", v: 0.12 }, blurb: "Diamond hands. +12% $NIVAR income." },
  { id: "quant", name: "The Quant", e: "🤖", rarity: "rare", role: "Compute", buff: { k: "iron", v: 0.18 }, blurb: "Runs the models. +18% Compute." },
  { id: "miner", name: "The Miner", e: "⛏️", rarity: "common", role: "Energy", buff: { k: "coal", v: 0.15 }, blurb: "Keeps rigs fed. +15% Energy." },
  { id: "anon", name: "The Anon", e: "🥷", rarity: "common", role: "Scout", buff: { k: "raid", v: 0.12 }, blurb: "Faceless edge. +12% raid power." },
  { id: "shiller", name: "The Shiller", e: "🤡", rarity: "common", role: "Marketing", buff: { k: "food", v: 0.15 }, blurb: "Never stops posting. +15% Ramen." },
];

export const HERO_BY_ID: Record<string, HeroDef> = Object.fromEntries(
  HEROES_POOL.map((h) => [h.id, h]),
);

export const HERO = (id: string): HeroDef | undefined => HERO_BY_ID[id];

/** Base power per rarity (level 1). */
export const HERO_POWER_BASE: Record<Rarity, number> = {
  common: 60,
  rare: 160,
  epic: 420,
  legendary: 950,
};

/** Per-level power growth (×(1 + (lvl-1)*GROWTH)). */
export const HERO_POWER_GROWTH = 0.3;

/** Shard cost to level a hero from `level` → `level+1`. */
export const heroLevelUpShardCost = (level: number): number => level * 3;

import type { ChestDef, QuestDef, QuestSnapshot } from "./types.js";

/** Campaign / daily / milestone quests, verbatim from nivar.html (`QUESTS`). */
export const QUESTS: Record<"main" | "daily" | "miles", QuestDef[]> = {
  main: [
    { id: "m1", e: "🏗️", t: "Upgrade any facility", metric: "upgrades", tgt: 1, rew: { crystal: 80 } },
    { id: "m2", e: "🦸", t: "Summon your first hero", metric: "summons", tgt: 1, rew: { crystal: 100 } },
    { id: "m3", e: "⚔️", t: "Win your first raid", metric: "raidWins", tgt: 1, rew: { crystal: 100, coal: 3000 } },
    { id: "m4", e: "👥", t: "Field a 5-hero squad", metric: "squad", tgt: 5, rew: { crystal: 150 } },
    { id: "m5", e: "⛏️", t: "Overclock the Rig to Lv 5", metric: "furnace", tgt: 5, rew: { crystal: 150 } },
    { id: "m6", e: "💰", t: "Reach 15K Net Worth", metric: "power", tgt: 15000, rew: { crystal: 200 } },
    { id: "m7", e: "🔬", t: "Research any tech to Lv 2", metric: "researchLv", tgt: 2, rew: { crystal: 150 } },
    { id: "m8", e: "🪤", t: "Clear the Rug Pull raid", metric: "stageDone", param: "s3", tgt: 1, rew: { crystal: 250, iron: 6000 } },
    { id: "m9", e: "🏗️", t: "Upgrade facilities 8 times", metric: "upgrades", tgt: 8, rew: { crystal: 200 } },
    { id: "m10", e: "⛏️", t: "Overclock the Rig to Lv 7", metric: "furnace", tgt: 7, rew: { crystal: 320 } },
    { id: "m11", e: "💰", t: "Reach 150K Net Worth", metric: "power", tgt: 150000, rew: { crystal: 450 } },
    { id: "m12", e: "💀", t: "Clear The Capitulation", metric: "stageDone", param: "s6", tgt: 1, rew: { crystal: 600, crystalBig: 1 } },
  ],
  daily: [
    { id: "d1", e: "🪂", t: "Claim the Daily Airdrop", metric: "airdrop", tgt: 1, pts: 20, rew: { crystal: 30 } },
    { id: "d2", e: "🏗️", t: "Upgrade a facility", metric: "dailyUpgrades", tgt: 1, pts: 20, rew: { crystal: 40 } },
    { id: "d3", e: "🦸", t: "Summon a hero", metric: "dailySummons", tgt: 1, pts: 20, rew: { crystal: 40 } },
    { id: "d4", e: "⚔️", t: "Win 3 raids", metric: "dailyRaidWins", tgt: 3, pts: 40, rew: { crystal: 70 } },
  ],
  miles: [
    { id: "a1", e: "🦸", t: "Summon 10 heroes", metric: "summons", tgt: 10, rew: { crystal: 200 } },
    { id: "a2", e: "🐋", t: "Own a Legendary hero", metric: "legendary", tgt: 1, rew: { crystal: 300 } },
    { id: "a3", e: "⚔️", t: "Win 25 raids", metric: "raidWins", tgt: 25, rew: { crystal: 300 } },
    { id: "a4", e: "🏆", t: "Clear all 6 raids", metric: "cleared", tgt: 6, rew: { crystal: 500 } },
    { id: "a5", e: "⛏️", t: "Reach Rig Lv 10", metric: "furnace", tgt: 10, rew: { crystal: 400 } },
    { id: "a6", e: "💰", t: "Reach 1M Net Worth", metric: "power", tgt: 1000000, rew: { crystal: 1000 } },
  ],
};

/** Daily-activity chests (fill bar via daily quest points). */
export const CHESTS: ChestDef[] = [
  { p: 40, rew: 100 },
  { p: 70, rew: 150 },
  { p: 100, rew: 300 },
];

/** Flat $NIVAR granted when a reward includes `crystalBig`. */
export const CRYSTAL_BIG_AMOUNT = 2000;

/** Current progress value of a quest against a snapshot. */
export function questProgress(q: QuestDef, s: QuestSnapshot): number {
  switch (q.metric) {
    case "upgrades": return s.upgrades;
    case "summons": return s.summons;
    case "raidWins": return s.raidWins;
    case "squad": return s.squadSize;
    case "furnace": return s.furnace;
    case "power": return s.power;
    case "researchLv": return s.researchLv;
    case "stageDone": {
      const set = Array.isArray(s.clearedStages) ? new Set(s.clearedStages) : s.clearedStages;
      return q.param && set.has(q.param) ? 1 : 0;
    }
    case "airdrop": return s.airdrop ? 1 : 0;
    case "dailyUpgrades": return s.dailyUpgrades;
    case "dailySummons": return s.dailySummons;
    case "dailyRaidWins": return s.dailyRaidWins;
    case "legendary": return s.hasLegendary ? 1 : 0;
    case "cleared": return s.clearedCount;
    default: return 0;
  }
}

export const questDone = (q: QuestDef, s: QuestSnapshot): boolean => questProgress(q, s) >= q.tgt;

/** Sum of daily-activity points from completed daily quests. */
export function dailyPoints(s: QuestSnapshot): number {
  return QUESTS.daily.reduce((a, q) => a + (questDone(q, s) ? q.pts ?? 0 : 0), 0);
}

export const QUEST_BY_KEY: Record<string, QuestDef> = Object.fromEntries(
  (["main", "daily", "miles"] as const).flatMap((cat) =>
    QUESTS[cat].map((q) => [`${cat}:${q.id}`, q]),
  ),
);

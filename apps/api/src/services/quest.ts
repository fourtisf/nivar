import * as CFG from "@nivar/config";
import { GameState, calcPower, clearedCount, hasLegendary, researchLv } from "../state.js";
import { Errors } from "../lib/errors.js";
import { grantReward, LedgerDraft, nivarLedger } from "./economy.js";

/** Build the snapshot quests/chests are evaluated against (server-side). */
export function snapshot(s: GameState): CFG.QuestSnapshot {
  return {
    upgrades: s.stats.upgrades,
    summons: s.stats.summons,
    raidWins: s.stats.raidWins,
    squadSize: s.squad.length,
    furnace: s.furnace,
    power: calcPower(s),
    researchLv: researchLv(s),
    clearedStages: Object.keys(s.clears).filter((id) => s.clears[id].cleared),
    clearedCount: clearedCount(s),
    hasLegendary: hasLegendary(s),
    airdrop: s.daily.airdrop,
    dailyUpgrades: s.daily.upgrades,
    dailySummons: s.daily.summons,
    dailyRaidWins: s.daily.raidWins,
  };
}

export function claimQuest(s: GameState, cat: CFG.QuestCategory, id: string): LedgerDraft[] {
  const list = CFG.QUESTS[cat];
  if (!list) throw Errors.badRequest("unknown category");
  const q = list.find((x) => x.id === id);
  if (!q) throw Errors.badRequest("unknown quest");
  const key = `${cat}:${id}`;
  const snap = snapshot(s);
  if (!(CFG.questDone(q, snap) && !s.claimed.includes(key))) throw Errors.questNotClaimable();
  s.claimed.push(key);
  return grantReward(s, q.rew, "quest_claim", key);
}

export function claimChest(s: GameState, index: number): LedgerDraft[] {
  const chest = CFG.CHESTS[index];
  if (!chest) throw Errors.badRequest("unknown chest");
  const dp = CFG.dailyPoints(snapshot(s));
  if (!(dp >= chest.p && !s.daily.chestClaimed.includes(index))) throw Errors.chestNotReady();
  s.daily.chestClaimed.push(index);
  s.crystal += chest.rew;
  return [nivarLedger(chest.rew, "daily_chest", `chest${index}`)];
}

import * as CFG from "@nivar/config";
import { GameState, bonuses, squadPower } from "../state.js";
import { Errors } from "../lib/errors.js";
import { addRes, LedgerDraft, nivarLedger } from "./economy.js";

export interface RaidResult {
  win: boolean;
  eff: number;
  first: boolean;
  monsterLevel: number;
  enemyPower: number;
  rewards: CFG.ResourceBag;
  ledger: LedgerDraft[];
}

/**
 * squadPower×raidBonus vs the monster's scaled power. Enforces sequential
 * unlock + cooldown. Each monster has a level: beating it grants scaled loot
 * (first-clear ×1.5) and levels the monster up (endless progression). The
 * client never sends power/outcome — only the stage id.
 */
export function raid(s: GameState, now: number, stageId: string): RaidResult {
  const st = CFG.STAGE_BY_ID[stageId];
  if (!st) throw Errors.unknownStage();

  // sequential unlock: stage i needs stage i-1 cleared
  const idx = CFG.STAGE_ORDER.indexOf(stageId);
  if (idx > 0) {
    const prev = CFG.STAGE_ORDER[idx - 1];
    if (!s.clears[prev]?.cleared) throw Errors.stageLocked();
  }

  const cl = s.clears[stageId];
  if (cl?.cooldownUntil && now < cl.cooldownUntil) throw Errors.onCooldown();

  const monsterLevel = cl?.monsterLevel ?? 1;
  const enemyPower = CFG.monsterPower(st.power, monsterLevel);
  const eff = Math.round(squadPower(s) * bonuses(s).raid);
  const win = eff >= enemyPower;
  if (!win) return { win: false, eff, first: false, monsterLevel, enemyPower, rewards: {}, ledger: [] };

  const first = !cl?.cleared;
  const rewards = CFG.monsterReward(st.rew, monsterLevel, first);
  const ledger: LedgerDraft[] = [];
  for (const k in rewards) {
    const key = k as CFG.ResourceKey;
    const amt = rewards[key] ?? 0;
    addRes(s, key, amt);
    if (key === "crystal") ledger.push(nivarLedger(amt, "raid_reward", stageId));
  }
  // monster levels up (stronger next time)
  s.clears[stageId] = { cleared: true, cooldownUntil: now + CFG.ECON.RAID_COOLDOWN_MS, monsterLevel: monsterLevel + 1 };
  s.stats.raidWins++;
  s.daily.raidWins++;
  return { win: true, eff, first, monsterLevel, enemyPower, rewards, ledger };
}

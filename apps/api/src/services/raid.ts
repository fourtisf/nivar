import * as CFG from "@nivar/config";
import { GameState, bonuses, squadPower } from "../state.js";
import { Errors } from "../lib/errors.js";
import { addRes, LedgerDraft, nivarLedger } from "./economy.js";

export interface RaidResult {
  win: boolean;
  eff: number;
  first: boolean;
  rewards: CFG.ResourceBag;
  ledger: LedgerDraft[];
}

/**
 * Compute squadPower×raidBonus vs stage power. Enforces sequential unlock +
 * cooldown, grants loot (first-clear ×1.5), and sets the cooldown on a win
 * (handoff §6). The client never sends power/outcome — only the stage id.
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

  const eff = Math.round(squadPower(s) * bonuses(s).raid);
  const win = eff >= st.power;
  if (!win) return { win: false, eff, first: false, rewards: {}, ledger: [] };

  const first = !cl?.cleared;
  const mult = first ? CFG.ECON.FIRST_CLEAR_MULT : 1;
  const rewards: CFG.ResourceBag = {};
  const ledger: LedgerDraft[] = [];
  for (const k in st.rew) {
    const key = k as CFG.ResourceKey;
    const amt = Math.round((st.rew[key] ?? 0) * mult);
    rewards[key] = amt;
    addRes(s, key, amt);
    if (key === "crystal") ledger.push(nivarLedger(amt, "raid_reward", stageId));
  }
  s.clears[stageId] = { cleared: true, cooldownUntil: now + CFG.ECON.RAID_COOLDOWN_MS };
  s.stats.raidWins++;
  s.daily.raidWins++;
  return { win: true, eff, first, rewards, ledger };
}

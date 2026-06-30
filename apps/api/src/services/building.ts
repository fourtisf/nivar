import * as CFG from "@nivar/config";
import { GameState, bonuses, buildingLevel, shelterPopCap } from "../state.js";
import { Errors } from "../lib/errors.js";
import { LedgerDraft, nivarLedger, pay, requirePay } from "./economy.js";

/** Finish the active job if it's due. Returns ledger drafts (overclock $NIVAR). */
export function finishDueJob(s: GameState, now: number): LedgerDraft[] {
  if (!s.job || now < s.job.endsAt) return [];
  const ledger: LedgerDraft[] = [];
  const target = s.job.target;
  if (target === "furnace") {
    s.furnace++;
    const reward = CFG.overclockReward(s.furnace);
    s.crystal += reward;
    ledger.push(nivarLedger(reward, "overclock_reward"));
  } else {
    s.buildings[target] = buildingLevel(s, target) + 1;
    s.stats.upgrades++;
    s.daily.upgrades++;
  }
  s.job = null;
  s.popCap = shelterPopCap(s);
  return ledger;
}

/** Start a facility upgrade. Validates cost + rig cap; sets the job. */
export function upgradeBuilding(s: GameState, now: number, key: string): LedgerDraft[] {
  const def = CFG.BUILDING_BY_ID[key];
  if (!def) throw Errors.unknownBuilding();
  if (s.job) throw Errors.builderBusy();
  const lv = buildingLevel(s, key);
  if (lv >= CFG.maxBLevel(s.furnace)) throw Errors.maxForRig();
  const cost = CFG.upCost(def.res, lv);
  requirePay(s, cost);
  pay(s, cost);
  const ms = CFG.buildSecsUpgrade(lv + 1, bonuses(s).build) * 1000;
  s.job = { target: key, kind: "upgrade", endsAt: now + ms, total: ms };
  return [];
}

/** Start a Rig overclock. */
export function overclock(s: GameState, now: number): LedgerDraft[] {
  if (s.job) throw Errors.builderBusy();
  const cost = CFG.furnaceCost(s.furnace);
  requirePay(s, cost);
  pay(s, cost);
  const ms = CFG.buildSecsFurnace(s.furnace, bonuses(s).build) * 1000;
  s.job = { target: "furnace", kind: "furnace", endsAt: now + ms, total: ms };
  return [];
}

/** Pay $NIVAR to finish the current job immediately. */
export function speedup(s: GameState, now: number): LedgerDraft[] {
  if (!s.job) throw Errors.noJob();
  const rem = Math.max(0, s.job.endsAt - now);
  const price = CFG.speedupPrice(rem);
  if (s.crystal < price) throw Errors.insufficientNivar();
  s.crystal -= price;
  const ledger: LedgerDraft[] = [nivarLedger(-price, "speedup", s.job.target)];
  s.job.endsAt = now;
  ledger.push(...finishDueJob(s, now));
  return ledger;
}

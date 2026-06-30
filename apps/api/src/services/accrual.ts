import * as CFG from "@nivar/config";
import { GameState, bonuses, buildingLevel, shelterPopCap, utcDay } from "../state.js";
import { addRes, LedgerDraft, nivarLedger } from "./economy.js";
import { finishDueJob } from "./building.js";

/**
 * Idle accrual (handoff §7). Run on every read and before every mutation,
 * inside the per-user lock. Advances production/warmth/energy/pop from
 * `lastTickAt` to `now` (capped), rolls the daily counters at the UTC
 * boundary, and finishes any due build job. The resulting state is canonical.
 */
export function runAccrual(s: GameState, now: number): LedgerDraft[] {
  const ledger: LedgerDraft[] = [];

  // Daily reset (UTC). Lifetime counters are untouched.
  const day = utcDay(now);
  if (s.daily.date !== day) {
    s.daily = { date: day, summons: 0, raidWins: 0, upgrades: 0, airdrop: false, chestClaimed: [] };
  }

  const dtMs = Math.max(0, Math.min(now - s.lastTickAt, CFG.ECON.ACCRUAL_CAP_MS));
  const dt = dtMs / 1000;
  if (dt > 0) {
    // warmth/sentiment tweens toward target (fueled → 38, unfueled → 0)
    const target = CFG.warmthTarget(s.coal);
    s.warmth += (target - s.warmth) * Math.min(1, dt * CFG.ECON.WARMTH_TWEEN_RATE);
    // Energy burn
    if (s.coal > 0) s.coal = Math.max(0, s.coal - CFG.energyBurnPerSec(s.furnace) * dt);
    // Production (uses post-tween warmth, matching the prototype tick order)
    const B = bonuses(s);
    for (const def of CFG.BUILDINGS) {
      if (def.res && def.res !== "pop") {
        addRes(s, def.res, CFG.prodPerSec(def, buildingLevel(s, def.id), s.warmth, B) * dt);
      }
    }
    // $NIVAR trickle from the Alpha Lab (explorers). Ledger it so the audit
    // log reconciles with the balance (one row per accrual; production may
    // batch/threshold these). Keeps the double-entry invariant (§6/§12).
    const trickle = CFG.ECON.CRYSTAL_TRICKLE_PER_LAB * buildingLevel(s, "explorers") * dt * B.token;
    if (trickle > 0) {
      s.crystal += trickle;
      ledger.push(nivarLedger(trickle, "idle_yield"));
    }
    // Crew growth toward capacity
    s.popCap = shelterPopCap(s);
    if (s.pop < s.popCap) s.pop = Math.min(s.popCap, s.pop + dt * CFG.ECON.POP_GROWTH_RATE);
  }

  // Finish a due job (single builder ⇒ at most one).
  ledger.push(...finishDueJob(s, now));

  s.popCap = shelterPopCap(s);
  s.lastTickAt = now;
  return ledger;
}

import * as CFG from "@nivar/config";
import type { GameState } from "../state.js";
import { Errors } from "../lib/errors.js";

/** A pending ledger row (double-entry audit). Persisted after the mutation. */
export interface LedgerDraft {
  delta: number;
  currency: string; // NIVAR | food | wood | coal | iron
  reason: string;
  refId?: string;
}

export const nivarLedger = (delta: number, reason: string, refId?: string): LedgerDraft => ({
  delta,
  currency: "NIVAR",
  reason,
  refId,
});

/** Spend a resource cost from state. Caller must have checked affordability. */
export function pay(s: GameState, cost: CFG.ResourceBag): void {
  for (const k in cost) {
    const key = k as CFG.ResourceKey;
    (s as unknown as Record<string, number>)[key] -= cost[key] ?? 0;
  }
}

/** Add a resource amount to state (used by rewards/grants). */
export function addRes(s: GameState, key: string, amount: number): void {
  (s as unknown as Record<string, number>)[key] += amount;
}

/** Assert affordability or throw the standard error. */
export function requirePay(s: GameState, cost: CFG.ResourceBag): void {
  if (!CFG.canPay(s as unknown as Record<string, number>, cost)) throw Errors.insufficient();
}

/**
 * Apply a reward bag (resources + the `crystalBig` flag) and emit ledger rows
 * for $NIVAR movements. Returns the ledger drafts to persist.
 */
export function grantReward(s: GameState, rew: CFG.QuestReward, reason: string, refId?: string): LedgerDraft[] {
  const ledger: LedgerDraft[] = [];
  for (const k in rew) {
    if (k === "crystalBig") {
      const amt = CFG.CRYSTAL_BIG_AMOUNT * (rew.crystalBig ?? 0);
      s.crystal += amt;
      ledger.push(nivarLedger(amt, reason, refId));
    } else {
      const key = k as CFG.ResourceKey;
      const amt = (rew as Record<string, number>)[key] ?? 0;
      addRes(s, key, amt);
      if (key === "crystal") ledger.push(nivarLedger(amt, reason, refId));
    }
  }
  return ledger;
}

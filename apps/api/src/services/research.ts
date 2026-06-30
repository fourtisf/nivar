import * as CFG from "@nivar/config";
import { GameState } from "../state.js";
import { Errors } from "../lib/errors.js";
import { pay, requirePay } from "./economy.js";

/** Buy the next level of a tech. Cost scales ×1.6^level (handoff §5). */
export function research(s: GameState, techId: string): void {
  const t = CFG.TECH_BY_ID[techId];
  if (!t) throw Errors.unknownTech();
  const lv = s.research[techId] ?? 0;
  if (lv >= t.max) throw Errors.techMaxed();
  const cost = CFG.scaleCost(t.cost, lv);
  requirePay(s, cost);
  pay(s, cost);
  s.research[techId] = lv + 1;
}

import type { StageDef } from "./types.js";

/** Bear-market raid stages, verbatim from nivar.html (`STAGES`). */
export const STAGES: StageDef[] = [
  { id: "s1", name: "Liquidation Cascade", e: "📉", power: 450, rew: { crystal: 60, coal: 2500, iron: 1200 } },
  { id: "s2", name: "FUD Storm", e: "🌪️", power: 1400, rew: { crystal: 90, wood: 3000, food: 3000 } },
  { id: "s3", name: "Rug Pull", e: "🪤", power: 3000, rew: { crystal: 140, iron: 4000, coal: 5000 } },
  { id: "s4", name: "Whale Dump", e: "🐋", power: 6500, rew: { crystal: 220, wood: 8000, iron: 6000 } },
  { id: "s5", name: "Exit Liquidity", e: "🚪", power: 14000, rew: { crystal: 360, coal: 18000, food: 14000 } },
  { id: "s6", name: "The Capitulation", e: "💀", power: 30000, rew: { crystal: 600, iron: 24000, wood: 24000 } },
];

export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
);

/** Stage order — raids unlock strictly in sequence. */
export const STAGE_ORDER: string[] = STAGES.map((s) => s.id);

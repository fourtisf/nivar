import type { TechDef } from "./types.js";

/** Research techs, verbatim from nivar.html (`TECHS`). Cost scales ×1.6^level. */
export const TECHS: TechDef[] = [
  { id: "overclock", name: "Overclock Rigs", e: "⚡", k: "coal", v: 0.12, max: 5, cost: { wood: 2000, iron: 1200 } },
  { id: "cooling", name: "Liquid Cooling", e: "🖥️", k: "iron", v: 0.12, max: 5, cost: { coal: 2200, wood: 1400 } },
  { id: "cdn", name: "Global CDN", e: "📡", k: "wood", v: 0.12, max: 5, cost: { iron: 1800, coal: 1600 } },
  { id: "staking", name: "Staking Vault", e: "💎", k: "token", v: 0.1, max: 5, cost: { coal: 3000, iron: 2000 } },
  { id: "automation", name: "CI/CD Automation", e: "🔧", k: "build", v: 0.15, max: 4, cost: { wood: 2600, coal: 2600 } },
  { id: "leverage", name: "Smart Leverage", e: "⚔️", k: "raid", v: 0.15, max: 4, cost: { iron: 3000, crystal: 120 } },
];

export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(
  TECHS.map((t) => [t.id, t]),
);

/** Display label for the value a tech feeds. */
export const techLabel = (k: string): string =>
  ({
    coal: "Energy",
    iron: "Compute",
    wood: "Bandwidth",
    food: "Ramen",
    token: "$NIVAR",
    build: "build time",
    raid: "raid power",
  } as Record<string, string>)[k] ?? k;

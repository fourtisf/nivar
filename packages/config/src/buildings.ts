import type { BuildingDef, FurnaceDef } from "./types.js";

/**
 * Facilities. Values lifted verbatim from nivar.html (`BUILDINGS`). `lv` is the
 * level on a brand-new base. `base` is per-level production (resource/sec)
 * before warmth + bonuses. Internal keys are reskinned at the display layer.
 */
export const BUILDINGS: BuildingDef[] = [
  { id: "cookhouse", name: "Mess Hall", type: "cookhouse", gx: 6, gy: 3, res: "food", base: 5, lv: 2, glow: "#ffb24d" },
  { id: "explorers", name: "Alpha Lab", type: "explorers", gx: 5, gy: 2, res: null, base: 0, lv: 1, glow: "#7CFFB0" },
  { id: "ironmine", name: "GPU Foundry", type: "mine", gx: 2, gy: 3, res: "iron", base: 3, lv: 2, oreCol: "#7CFFB0", glow: "#7CFFB0" },
  { id: "hunters", name: "Ramen Shop", type: "hunters", gx: 3, gy: 4, res: "food", base: 6, lv: 3, glow: "#ff8a3d" },
  { id: "mine", name: "Power Plant", type: "mine", gx: 2, gy: 6, res: "coal", base: 6, lv: 3, oreCol: "#ffd24d", glow: "#ffd24d" },
  { id: "shelter1", name: "Bunker 1", type: "shelter", gx: 7, gy: 5, res: "pop", base: 0, lv: 2, glow: "#9fc4e8" },
  { id: "sawmill", name: "Server Farm", type: "sawmill", gx: 4, gy: 7, res: "wood", base: 5, lv: 3, glow: "#56e0ff" },
  { id: "shelter2", name: "Bunker 2", type: "shelter", gx: 8, gy: 6, res: "pop", base: 0, lv: 2, glow: "#9fc4e8" },
  { id: "clinic", name: "Cope Clinic", type: "clinic", gx: 6, gy: 8, res: null, base: 0, lv: 1, glow: "#ff6b6b" },
  { id: "shelter3", name: "Bunker 3", type: "shelter", gx: 8, gy: 8, res: "pop", base: 0, lv: 1, glow: "#9fc4e8" },
];

export const FURNACE: FurnaceDef = { id: "furnace", name: "The Rig", gx: 5, gy: 5 };

/** Decorative tree positions (render-only, kept here so layout never drifts). */
export const TREES: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [7, 2], [8, 2], [0, 4], [0, 5],
  [9, 5], [1, 7], [9, 6], [9, 7], [3, 9], [4, 9], [7, 9], [1, 9], [0, 8], [8, 4],
  [6, 1], [9, 3], [10, 5], [0, 6],
];

/** Building id → def lookup. */
export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((b) => [b.id, b]),
);

/** Ids of shelter facilities (drive crew capacity). */
export const SHELTER_IDS: string[] = BUILDINGS.filter((b) => b.type === "shelter").map((b) => b.id);

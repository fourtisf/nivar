import type { ResourceKey } from "./types.js";

/** All resource keys in canonical order. */
export const RESOURCE_KEYS: ResourceKey[] = ["food", "wood", "coal", "iron", "crystal"];

/** Display icons (reskin) — kept here so labels never drift from balance. */
export const RICON: Record<ResourceKey, string> = {
  food: "🍜",
  wood: "📡",
  coal: "⚡",
  iron: "🖥️",
  crystal: "💎",
};

/** Display names (reskin). */
export const RNAME: Record<ResourceKey, string> = {
  food: "Ramen",
  wood: "Bandwidth",
  coal: "Energy",
  iron: "Compute",
  crystal: "$NIVAR",
};

/** Rarity colors. */
export const RCOL: Record<string, string> = {
  common: "#9fb6cc",
  rare: "#5aa0e0",
  epic: "#b06bff",
  legendary: "#ffb24d",
};

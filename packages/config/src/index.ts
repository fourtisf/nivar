/**
 * @nivar/config — the single source of truth for NIVAR gameplay balance and
 * formulas. DOM-free and side-effect-free; imported by both the web engine
 * (for rendering/labels) and the api (for authoritative validation). Every
 * gameplay constant lives here — there are no magic numbers anywhere else.
 */
export * from "./types.js";
export * from "./resources.js";
export * from "./buildings.js";
export * from "./heroes.js";
export * from "./stages.js";
export * from "./techs.js";
export * from "./quests.js";
export * from "./gacha.js";
export * from "./econ.js";
export * from "./initial.js";

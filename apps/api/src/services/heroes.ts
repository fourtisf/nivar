import * as CFG from "@nivar/config";
import { GameState } from "../state.js";
import { Errors } from "../lib/errors.js";

export function equip(s: GameState, heroId: string): void {
  if (!s.heroes[heroId]) throw Errors.notOwned();
  if (s.squad.includes(heroId)) throw Errors.alreadyEquipped();
  if (s.squad.length >= 5) throw Errors.squadFull();
  s.squad.push(heroId);
}

export function unequip(s: GameState, heroId: string): void {
  if (!s.squad.includes(heroId)) throw Errors.notEquipped();
  s.squad = s.squad.filter((x) => x !== heroId);
}

export function levelUp(s: GameState, heroId: string): void {
  const o = s.heroes[heroId];
  if (!o) throw Errors.notOwned();
  const cost = CFG.heroLevelUpShardCost(o.level);
  if (o.shards < cost) throw Errors.notEnoughShards();
  o.shards -= cost;
  o.level += 1;
}

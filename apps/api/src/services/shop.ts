import * as CFG from "@nivar/config";
import { GameState } from "../state.js";
import { Errors } from "../lib/errors.js";
import { LedgerDraft, nivarLedger } from "./economy.js";

/** Free Daily Airdrop on a cooldown (handoff §11). Ledger grant. */
export function airdrop(s: GameState, now: number): LedgerDraft[] {
  if (now < s.airdropAt) throw Errors.airdropSoon();
  s.crystal += CFG.ECON.AIRDROP_AMOUNT;
  s.daily.airdrop = true;
  s.airdropAt = now + CFG.ECON.AIRDROP_COOLDOWN_MS;
  return [nivarLedger(CFG.ECON.AIRDROP_AMOUNT, "airdrop")];
}

/** One-time Genesis Pack: $NIVAR + a guaranteed Epic hero. */
export function genesis(s: GameState): { ledger: LedgerDraft[]; hero: string } {
  if (s.genesisClaimed) throw Errors.genesisClaimed();
  s.genesisClaimed = true;
  s.crystal += CFG.ECON.GENESIS_CRYSTAL;
  const ledger = [nivarLedger(CFG.ECON.GENESIS_CRYSTAL, "genesis")];

  const unowned = CFG.HEROES_POOL.filter((h) => h.rarity === "epic" && !s.heroes[h.id]);
  const pool = unowned.length ? unowned : CFG.HEROES_POOL.filter((h) => h.rarity === "epic");
  const h = pool[Math.floor(Math.random() * pool.length)];
  if (!s.heroes[h.id]) {
    s.heroes[h.id] = { level: 1, shards: 0 };
    if (s.squad.length < 5) s.squad.push(h.id);
  } else {
    s.heroes[h.id].shards += 3;
  }
  return { ledger, hero: h.id };
}

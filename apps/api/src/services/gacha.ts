import { createHash, createHmac, randomBytes } from "node:crypto";
import * as CFG from "@nivar/config";
import { GameState } from "../state.js";
import { Errors } from "../lib/errors.js";
import { LedgerDraft, nivarLedger } from "./economy.js";

export interface PullRecord {
  heroId: string;
  rarity: CFG.Rarity;
  isNew: boolean;
  // audit
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  rarityRoll: number;
  pickRoll: number;
}

export interface SummonResult {
  pulls: { heroId: string; rarity: CFG.Rarity; isNew: boolean }[];
  ledger: LedgerDraft[];
  rolls: PullRecord[];
}

/** Lazily create a committed server seed for provably-fair rolls. */
function ensureSeed(s: GameState, clientSeed?: string) {
  if (!s.gacha) {
    const serverSeed = randomBytes(32).toString("hex");
    s.gacha = {
      serverSeed,
      serverSeedHash: createHash("sha256").update(serverSeed).digest("hex"),
      nonce: 0,
      clientSeed: clientSeed || randomBytes(8).toString("hex"),
    };
  } else if (clientSeed) {
    s.gacha.clientSeed = clientSeed;
  }
  return s.gacha;
}

/** Derive two uniform floats in [0,1) from (serverSeed, clientSeed, nonce). */
function rollFloats(serverSeed: string, clientSeed: string, nonce: number): [number, number] {
  const h = createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}`).digest();
  const a = h.readUInt32BE(0) / 0x100000000;
  const b = h.readUInt32BE(4) / 0x100000000;
  return [a, b];
}

/**
 * Server-authoritative summon (handoff §10). Deducts $NIVAR before rolling,
 * enforces rates from config, turns dupes into shards, and logs every roll so
 * a pull can be audited later. RNG is server-only and provably fair.
 */
export function summon(s: GameState, count: 1 | 10, clientSeed?: string): SummonResult {
  const cost = CFG.summonCost(count);
  if (s.crystal < cost) throw Errors.insufficientNivar();

  const seed = ensureSeed(s, clientSeed);
  s.crystal -= cost;
  const ledger: LedgerDraft[] = [nivarLedger(-cost, "summon", `x${count}`)];
  s.stats.summons += count;
  s.daily.summons += count;

  const pulls: { heroId: string; rarity: CFG.Rarity; isNew: boolean }[] = [];
  const rolls: PullRecord[] = [];
  for (let i = 0; i < count; i++) {
    const nonce = ++seed.nonce;
    const [rarityRoll, pickRoll] = rollFloats(seed.serverSeed, seed.clientSeed, nonce);
    const { heroId, rarity } = CFG.rollHeroId(rarityRoll, pickRoll);
    let isNew = false;
    const owned = s.heroes[heroId];
    if (!owned) {
      s.heroes[heroId] = { level: 1, shards: 0 };
      isNew = true;
      if (s.squad.length < 5) s.squad.push(heroId);
    } else {
      owned.shards += 1;
    }
    pulls.push({ heroId, rarity, isNew });
    rolls.push({ heroId, rarity, isNew, serverSeedHash: seed.serverSeedHash, clientSeed: seed.clientSeed, nonce, rarityRoll, pickRoll });
  }
  return { pulls, ledger, rolls };
}

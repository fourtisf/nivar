import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { serialize } from "./state.js";
import { InMemoryStore, Store } from "./store.js";
import { withLock } from "./lib/lock.js";
import { ApiError, Errors } from "./lib/errors.js";
import { issueNonce, login, verifyToken } from "./auth.js";
import { runAccrual } from "./services/accrual.js";
import { overclock, speedup, upgradeBuilding } from "./services/building.js";
import { summon } from "./services/gacha.js";
import { equip, levelUp, unequip } from "./services/heroes.js";
import { raid } from "./services/raid.js";
import { research } from "./services/research.js";
import { claimChest, claimQuest } from "./services/quest.js";
import { airdrop, genesis } from "./services/shop.js";
import type { LedgerDraft } from "./services/economy.js";
import type { PullRecord } from "./services/gacha.js";
import type { GameState } from "./state.js";

interface MutationOut {
  result?: Record<string, unknown>;
  ledger?: LedgerDraft[];
  rolls?: PullRecord[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const ENABLE_FIAT = process.env.NIVAR_ENABLE_FIAT === "1";

export function buildServer(store: Store = new InMemoryStore()) {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      reply.status(err.status).send({ error: { code: err.code, message: err.message } });
      return;
    }
    app.log.error(err);
    reply.status(500).send({ error: { code: "internal", message: "Internal error" } });
  });

  const userIdOf = (req: FastifyRequest): string => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) throw Errors.unauthorized();
    const payload = verifyToken(auth.slice(7));
    if (!payload) throw Errors.unauthorized();
    return payload.sub;
  };

  /** lock → accrue → mutate → persist → serialize. The heart of §6/§7. */
  async function runGame(
    req: FastifyRequest,
    fn: (s: GameState, now: number) => MutationOut | void,
    opts: { idempotent?: boolean } = {},
  ) {
    const userId = userIdOf(req);
    const now = Date.now();
    const idemKey = opts.idempotent ? str(req.headers["idempotency-key"]) : "";
    return withLock(userId, async () => {
      if (idemKey) {
        const cached = await store.getIdem(userId, idemKey);
        if (cached !== undefined) return cached;
      }
      const s = await store.getState(userId, now);
      const accrualLedger = runAccrual(s, now);
      let out: MutationOut;
      try {
        out = fn(s, now) ?? {};
      } catch (e) {
        // Idle accrual already advanced the state legitimately; commit it + its
        // ledger so the audit log stays reconciled, then surface the error. The
        // mutation itself did not apply — services validate before mutating.
        await store.saveState(s);
        if (accrualLedger.length) await store.appendLedger(userId, accrualLedger);
        throw e;
      }
      await store.saveState(s);
      const ledger = [...accrualLedger, ...(out.ledger ?? [])];
      if (ledger.length) await store.appendLedger(userId, ledger);
      if (out.rolls?.length) await store.recordRolls(userId, out.rolls);
      const response = { ok: true, ...(out.result ?? {}), state: serialize(s) };
      if (idemKey) await store.putIdem(userId, idemKey, req.url, response);
      return response;
    });
  }

  const body = (req: FastifyRequest) => (req.body ?? {}) as Record<string, unknown>;

  /* ---------------- health ---------------- */
  app.get("/health", async () => ({ ok: true, service: "nivar-api" }));

  /* ---------------- auth (SIWS) ---------------- */
  app.post("/auth/siws/nonce", async (req) => {
    const wallet = str(body(req).wallet);
    if (!wallet) throw Errors.badRequest("wallet required");
    return issueNonce(store, wallet);
  });

  app.post("/auth/siws", async (req) => {
    const b = body(req);
    const wallet = str(b.wallet), nonce = str(b.nonce), signature = str(b.signature);
    if (!wallet || !nonce || !signature) throw Errors.badRequest("wallet, nonce, signature required");
    return login(store, { wallet, nonce, signature });
  });

  /* ---------------- state ---------------- */
  app.get("/state", async (req) => runGame(req, () => ({})));

  /* ---------------- base / rig ---------------- */
  app.post("/building/upgrade", async (req) =>
    runGame(req, (s, now) => ({ ledger: upgradeBuilding(s, now, str(body(req).key)) })),
  );
  app.post("/rig/overclock", async (req) => runGame(req, (s, now) => ({ ledger: overclock(s, now) })));
  app.post("/build/speedup", async (req) => runGame(req, (s, now) => ({ ledger: speedup(s, now) })));

  /* ---------------- heroes / gacha ---------------- */
  app.post("/summon", async (req) =>
    runGame(
      req,
      (s) => {
        const count = body(req).count === 10 ? 10 : 1;
        const r = summon(s, count as 1 | 10, str(body(req).clientSeed) || undefined);
        return { result: { pulls: r.pulls }, ledger: r.ledger, rolls: r.rolls };
      },
      { idempotent: true },
    ),
  );
  app.post("/hero/equip", async (req) => runGame(req, (s) => void equip(s, str(body(req).heroId))));
  app.post("/hero/unequip", async (req) => runGame(req, (s) => void unequip(s, str(body(req).heroId))));
  app.post("/hero/levelup", async (req) => runGame(req, (s) => void levelUp(s, str(body(req).heroId))));

  /* ---------------- raids / research ---------------- */
  app.post("/raid", async (req) =>
    runGame(
      req,
      (s, now) => {
        const r = raid(s, now, str(body(req).stageId));
        return { result: { win: r.win, eff: r.eff, first: r.first, monsterLevel: r.monsterLevel, enemyPower: r.enemyPower, rewards: r.rewards }, ledger: r.ledger };
      },
      { idempotent: true },
    ),
  );
  app.post("/research", async (req) => runGame(req, (s) => ({ ledger: research(s, str(body(req).techId)) })));

  /* ---------------- quests ---------------- */
  app.post("/quest/claim", async (req) =>
    runGame(
      req,
      (s) => ({ ledger: claimQuest(s, str(body(req).cat) as never, str(body(req).id)) }),
      { idempotent: true },
    ),
  );
  app.post("/quest/chest", async (req) =>
    runGame(req, (s) => ({ ledger: claimChest(s, Number(body(req).index)) })),
  );

  /* ---------------- shop ---------------- */
  app.post("/shop/airdrop", async (req) => runGame(req, (s, now) => ({ ledger: airdrop(s, now) })));
  app.post("/shop/genesis", async (req) =>
    runGame(req, (s) => {
      const r = genesis(s);
      return { result: { hero: r.hero }, ledger: r.ledger };
    }),
  );

  /* ---------------- flagged / on-chain (scaffold) ---------------- */
  // Wallet bundles stay behind a feature flag until the token is live (§11).
  app.post("/shop/buy", async (_req, reply) => {
    if (!ENABLE_FIAT) return reply.status(501).send({ error: { code: "feature_off", message: "Fiat/on-ramp not enabled" } });
    return reply.status(501).send({ error: { code: "not_implemented", message: "Wire to payment provider" } });
  });
  // Treasury-signed SPL transfer to the user wallet (§11). Requires Helius +
  // treasury key; implement against the ledger + idempotency before enabling.
  app.post("/wallet/claim", async (_req, reply) =>
    reply.status(501).send({ error: { code: "not_implemented", message: "Treasury claim not configured" } }),
  );
  // Helius deposit/confirm webhook → credit ledger (§11). Ack for now.
  app.post("/webhooks/helius", async (_req, reply) => reply.status(200).send({ ok: true }));

  return app;
}

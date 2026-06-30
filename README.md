# NIVAR — Survive the Winter ❄️

Crypto-winter survival GameFi on Solana. Single-player base-builder + idle economy:
auto-producing facilities, a 10-hero CT-archetype gacha, bear-market raids, research,
quests/dailies, and the premium **$NIVAR** currency.

> **Non-negotiable rule:** the frontend must look and behave **exactly** like the
> approved prototype, [`prototype/nivar.html`](prototype/nivar.html). It is the single
> source of truth for visuals **and** balance. We are *porting* it, not redesigning it.
> The full brief is in [`docs/NIVAR_HANDOFF.md`](docs/NIVAR_HANDOFF.md).

## Monorepo layout

```
nivar/
  apps/
    web/                 # Next.js 14 — the ported prototype (canvas + DOM)
      app/               # App Router (layout, page)
      components/Game/    # Game.client.tsx, game.css (verbatim <style>), engine.ts (ported <script>)
      lib/api.ts         # typed client for the api (for milestones 2+)
    api/                 # Fastify — server-authoritative game logic
      src/services/      # accrual, building, gacha, raid, research, quest, shop, economy
      src/auth.ts        # Sign-In With Solana + JWT (HS256)
      src/store.ts       # persistence port (in-memory now, Prisma in prod)
      src/server.ts      # REST routes (§9), idempotency, per-user lock
      src/smoke.ts       # end-to-end test of the authoritative loop
  packages/
    config/              # @nivar/config — SINGLE SOURCE OF TRUTH (balance + formulas)
    prisma/              # schema.prisma (§8) + client wrapper
  prototype/nivar.html   # the approved prototype (the spec)
  docs/NIVAR_HANDOFF.md  # production build brief
```

`@nivar/config` is imported by **both** web (rendering/labels) and api (validation).
Every gameplay constant + formula lives there — **no magic numbers anywhere else**, so
the client and server compute identical numbers and can never drift.

## Milestone status

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Port prototype → Next.js client component, **exact visual parity**, in-memory | ✅ done & verified |
| 2 | Auth (SIWS) + User/Base bootstrap + `GET /state` + idle accrual (§7) | ✅ server-side built & tested |
| 3 | Building upgrade / rig overclock / build speed-up → server | ✅ server-side built & tested |
| 4 | Heroes + **server gacha** (provably-fair, §10) + equip/level | ✅ server-side built & tested |
| 5 | Raids + Research | ✅ server-side built & tested |
| 6 | Quests + Dailies + UTC reset | ✅ server-side built & tested |
| 7 | `$NIVAR` off-chain ledger + Shop (airdrop/genesis live, bundles flagged) | ✅ server-side built & tested |
| 8 | Wallet connect + claim-to-wallet via treasury | 🟡 scaffolded (501 until Helius + treasury wired) |
| 9 | Hardening: Prisma store, Redis locks, rate-limit, deploy | 🟡 ports in place (in-memory impls), Prisma schema ready |

**What "built & tested" means here:** the authoritative game logic for milestones 2–7
is implemented in `apps/api` against `@nivar/config` and verified end-to-end by
`apps/api/src/smoke.ts` (30 checks, no DB/network needed). The **web frontend still runs
the in-memory engine** (Milestone 1, to preserve exact parity); wiring it to the api via
`apps/web/lib/api.ts` is the remaining integration work for milestones 2–7. Persistence
(Prisma) and distributed locks (Redis) are behind the `Store`/`withLock` ports — the
in-memory implementations run today, the production ones drop in without touching services.

## Quick start

```bash
npm install                 # workspaces (use --ignore-scripts if Prisma's engine CDN is blocked)
npm run build:config        # compile @nivar/config to dist

# Web (Milestone 1 — exact parity, in-memory):
npm run dev:web             # http://localhost:3000

# API (server-authoritative loop):
npm run dev:api             # http://localhost:4000
NIVAR_DEV_AUTH=1 npm run smoke --workspace @nivar/api   # 30-check end-to-end test
```

Prisma (production persistence) needs a Postgres `DATABASE_URL` and the engine binaries:

```bash
npm run prisma:generate
npm run migrate:dev --workspace @nivar/prisma
```

## Parity verification

Milestone 1 was diffed against the prototype by rendering both at a 480×940 mobile
viewport and screenshotting the base scene, Heroes and Shop pages — pixel-for-pixel
identical (HUD values, isometric layout, building labels, coach tutorial, toasts, the
hero grid, summon prices). Re-check after any engine change:

```bash
npm run build:web && npm run start --workspace @nivar/web   # then compare to prototype/nivar.html
```

## Deploy

VPS deploy (PM2 + Nginx, domain `nivar.fun`) is documented step-by-step in
[`deploy/README.md`](deploy/README.md), with `deploy/deploy.sh`,
`deploy/ecosystem.config.cjs` (PM2) and `deploy/nginx/nivar.fun.conf`. The **web app**
is the playable game and deploys standalone (no DB); the api is optional preview infra
until it's wired to the frontend + given a Prisma store.

## Architecture notes

- **Server-authoritative (anti-cheat).** The client renders; the server owns every state
  mutation. Resources/$NIVAR/power/levels/clears are validated against `@nivar/config`.
  Mutations run inside a per-user lock after idle accrual; rewardful routes
  (`summon`, `raid`, `quest/claim`) accept an `Idempotency-Key`.
- **Provably-fair gacha.** A committed server seed + client seed + per-pull nonce derive
  each roll via HMAC-SHA256; every roll is logged (`GachaRoll`) so a pull is auditable.
- **Double-entry-ish ledger.** Every discrete `$NIVAR` movement (summon, raid reward,
  quest claim, airdrop, genesis, overclock, speed-up) is recorded with a reason + refId.
- **Off-chain first.** Gameplay runs on `Base.crystal` backed by the ledger; claim-to-wallet
  and deposits (Helius webhooks) are the on-chain edges (milestone 8).
```

# NIVAR — Production Build Handoff (Claude Code)

**For:** Michael (@MichaelCoinsult) · **From:** ALFA (product/design)
**Attached spec file:** `nivar.html` (the approved prototype — this is the single source of truth for visuals AND balance)
**Brand:** NIVAR · domain `nivar.fun` · token `$NIVAR` (SPL, Solana)

---

## 0. NON-NEGOTIABLE RULE — read this first

**The frontend must look and behave EXACTLY like `nivar.html`. Pixel-for-pixel.**

Do **NOT** redesign, "improve", restyle, swap the canvas for a library, change fonts, colors, spacing, animations, or layout. Do **NOT** rebuild the UI in a component library. You are **porting** the prototype, not reimagining it.

The workflow is:
1. Take `nivar.html` verbatim.
2. Move its `<style>` and `<script>` into the Next.js app **unchanged**.
3. Replace ONLY the in-memory state object `S` (and the mutation functions) with **server-backed, authoritative** state + Solana/$NIVAR wiring.
4. Everything visual — the isometric canvas renderer, the HUD, the bottom-sheet, the full-screen Quests/Heroes/Raids/Research/Shop pages, the coach/tutorial, the modals, the toasts — stays **byte-for-byte identical**.

If at any point the rendered output differs from the prototype, that's a bug. Diff against `nivar.html` before shipping each milestone.

---

## 1. What we're building

NIVAR is a crypto-winter survival GameFi title on Solana. Single-player base-builder + idle economy, with:
- **Base / iso town** — facilities that auto-produce 4 resources (Energy ⚡ / Compute 🖥️ / Bandwidth 📡 / Ramen 🍜) + the central **Rig** that burns Energy to stay online.
- **Heroes + gacha** — 10 CT-archetype heroes, rarity tiers, summon (×1 / ×10), shards, equip a 5-hero squad with passive buffs.
- **Raids** — 6 bear-market stages, squad-power vs enemy-power, loot + cooldowns + first-clear bonus.
- **Research** — 6 techs, global multipliers.
- **Quests** — Campaign (12) / Daily (4 + 3 chests) / Goals (6), with claim-for-reward.
- **$NIVAR** — premium currency (the in-game 💎), on-chain SPL token, wallet connect, claim/spend.

MVP is **single-player** (no PvP/alliances). Art stays emoji + procedural canvas (no studio sprites yet).

---

## 2. Stack (match the existing Fourtis stack)

- **Frontend:** Next.js 14 (App Router) + TypeScript. The prototype canvas+DOM lives inside ONE client component (`"use client"`). Keep raw HTML/CSS/canvas — no MUI/Chakra/shadcn for the game surface.
- **Backend:** Fastify (TypeScript) — REST + WebSocket.
- **DB:** PostgreSQL via **Prisma**.
- **Cache / realtime:** **Redis** — sessions, rate-limits, idle-accrual locks, daily counters, leaderboard later.
- **Chain:** Solana + **Helius** (RPC + webhooks). `@solana/wallet-adapter` (Phantom/Solflare). `$NIVAR` SPL token + treasury wallet.
- **Infra:** Hostinger VPS, **PM2**, **Nginx** (same as our other products).

---

## 3. Repo structure (suggested)

```
nivar/
  apps/
    web/                 # Next.js 14
      app/
        page.tsx         # mounts <Game/>
      components/Game/
        Game.client.tsx  # the ported prototype (canvas + DOM)
        game.css         # the prototype <style>, unchanged
        engine/          # iso renderer, ported 1:1 from prototype <script>
      lib/api.ts         # typed client for Fastify endpoints
      lib/wallet.ts      # wallet adapter + SIWS
    api/                 # Fastify
      src/routes/*.ts
      src/services/*.ts  # production, gacha, raid, quest, economy
      src/sim/accrual.ts # idle accrual (mirrors prototype tick)
  packages/
    config/              # SHARED source of truth (see §5)
      buildings.ts heroes.ts stages.ts techs.ts quests.ts econ.ts
    prisma/
      schema.prisma
```

`packages/config` is imported by **both** web (for rendering/labels) and api (for validation). One source, zero drift.

---

## 4. Frontend port rules (EXACT parity)

1. Copy the entire `<style>` block into `game.css` — **do not touch it**.
2. Copy the entire `<script>` into the engine/component. Keep these IDENTICAL (they define look + balance):
   - Iso constants: `HW, HH, OX, OY, OW, OH, GRID`, `isoOff`, DPR handling.
   - Renderer: `renderScene, drawTerrain, drawTree, drawBuilding, drawFurnaceBody, drawLive`, overlay positioning, the offscreen `scene` cache + blit, the drag-to-pan camera + clamps.
   - Data: `RICON, RNAME, RCOL, BUILDINGS, FURNACE, TREES, HEROES_POOL, STAGES, TECHS, QUESTS, CHESTS, PAL`.
   - UI builders: HUD render, `openBuilding/openFurnace/openHero`, `renderHeroes/renderRaids/renderResearch/renderShop/renderQuests`, summon/combat modals, coach/tutorial, toasts, `juiceClaim`, level-up FX.
3. Replace ONLY:
   - The literal initial values in `S` → hydrate from `GET /state`.
   - Each mutation (`startUpgrade, startFurnace, speedUp, finishJob, pull, equip/levelup, raid, research, claimQuest, claimChest, airdrop, genesis`) → call the matching endpoint, then apply the **authoritative** state returned by the server and re-render. Keep optimistic UI minimal/none for anything economic.
4. The render loop (`frame`) stays; it just reads server-synced state. Idle numbers should tick smoothly client-side between syncs using the **same** formula, but the server value is canonical on every sync.

---

## 5. Shared config = single source of truth (§ critical for "exact")

Lift every gameplay constant out of the prototype JS into `packages/config` **without changing values**:
- Building defs (id, type, gx/gy, res, base, lv, glow/oreCol), `upCost`, `furnaceCost`, `buildSecs`, `maxBLevel`.
- Hero pool + rarities + buffs, pull rates (`legendary 2 / epic 10 / rare 28 / common 60`), `heroPower` table `{common:60, rare:160, epic:420, legendary:950}` × `(1+(lvl-1)*0.3)`, level-up shard cost `lvl*3`.
- Stages (power + rewards), raid cooldown 20s, first-clear ×1.5.
- Techs (k, v, max, cost), cost scaling `×1.6^level`.
- Quests (main/daily/miles targets + rewards), chests `[40→100, 70→150, 100→300]`.
- Economy: `warmthMult = 0.4 + 0.6*(warmth/100)`, bear-market target warmth `38`, Energy burn `1.2*rigLevel/s`, Net Worth formula, `bonuses()` aggregation.

Both client and server import these. **No magic numbers anywhere else.**

---

## 6. Server-authoritative systems (anti-cheat)

The client renders; the **server owns all state mutations**. Never trust a client-sent resource/balance/power value.

| System | Server owns |
|---|---|
| Idle production | Accrual from `lastTickAt` (see §7). Client deltas ignored. |
| Rig / warmth / Energy burn | Warmth tween toward target, Energy decay, sentiment derived. |
| Building upgrade | Validate cost + `level ≤ rigLevel`, set `jobEndsAt`, finish server-side. |
| Rig overclock | Validate cost, set job, on finish bump level + grant $NIVAR + recalc popCap. |
| Build speed-up | Validate $NIVAR price = `ceil(remaining/30s)`, clear job. |
| **Gacha** | **Server-side provably-fair RNG**, enforce rates + cost, dupes→shards. Return pulls. |
| Hero equip/level | Validate squad ≤ 5, shard cost. |
| Raids | Compute `squadPower * raidBonus` vs `stage.power`, enforce cooldown + unlock order, grant rewards, first-clear ×1.5. |
| Research | Validate scaled cost, apply level, recompute multipliers. |
| Quests | Track counters server-side, compute claimable, grant on claim, daily reset cron (UTC). |
| $NIVAR balance | Double-entry ledger; every change recorded + auditable. |

---

## 7. Idle accrual algorithm (mirror the prototype tick)

On every `/state` read and every mutation:
```
now = Date.now()
dt  = min(now - base.lastTickAt, CAP)        // CAP e.g. 12h
m   = warmthMult(base.warmth)
B   = bonuses(research, squad)
for each producing building:
    resources[res] += base*lv * m * dt/1000 * B.prodAll * (B[res]||1)
resources.crystal += 0.06 * alphaLabLevel * dt/1000 * B.token   // $NIVAR trickle
warmth tween toward (energy>0 ? 38 : 0); energy -= 1.2*rigLevel * dt/1000 (floor 0)
popCap = shelterPopCap(); pop -> popCap (rate 0.4/s)
finish any job whose endsAt <= now
base.lastTickAt = now
```
Use the **exact** multipliers from `packages/config` so on-screen numbers match the prototype feel. Wrap accrual in a Redis lock per user to avoid double-credit on concurrent requests.

---

## 8. Prisma schema (starting point)

```prisma
model User {
  id        String   @id @default(cuid())
  wallet    String   @unique
  createdAt DateTime @default(now())
  base      Base?
  heroes    Hero[]
  buildings Building[]
  research  Research[]
  clears    StageClear[]
  ledger    LedgerEntry[]
  quest     QuestState?
  daily     DailyState[]
}

model Base {
  userId     String   @id
  user       User     @relation(fields: [userId], references: [id])
  rigLevel   Int      @default(3)
  warmth     Float    @default(38)
  pop        Float    @default(8)
  popCap     Int      @default(12)
  food       Float    @default(24500)
  wood       Float    @default(23500)
  coal       Float    @default(8200)
  iron       Float    @default(4100)
  crystal    Float    @default(1258)   // $NIVAR (off-chain balance)
  lastTickAt DateTime @default(now())
  jobTarget  String?                    // building key or "furnace"
  jobEndsAt  DateTime?
}

model Building { // one row per facility key per user
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id])
  key    String  // cookhouse, ironmine, mine, sawmill, hunters, shelter1..3, clinic, explorers
  level  Int
  @@unique([userId, key])
}

model Hero {
  id       String @id @default(cuid())
  userId   String
  user     User   @relation(fields: [userId], references: [id])
  heroId   String // whale, dev, kol, degen, ...
  level    Int    @default(1)
  shards   Int    @default(0)
  slot     Int?   // 0..4 if equipped, null if benched
  @@unique([userId, heroId])
}

model Research { id String @id @default(cuid()) userId String techId String level Int @default(0) @@unique([userId, techId]) }
model StageClear { id String @id @default(cuid()) userId String stageId String cleared Boolean @default(false) cooldownUntil DateTime? @@unique([userId, stageId]) }

model QuestState {
  userId   String @id
  summons  Int    @default(0)
  raidWins Int    @default(0)
  upgrades Int    @default(0)
  claimed  String[] // ["main:m1", ...]
}

model DailyState {
  id           String   @id @default(cuid())
  userId       String
  date         String   // UTC yyyy-mm-dd
  summons      Int      @default(0)
  raidWins     Int      @default(0)
  upgrades     Int      @default(0)
  airdrop      Boolean  @default(false)
  chestClaimed Int[]    // [0,1,2]
  @@unique([userId, date])
}

model LedgerEntry {
  id        String   @id @default(cuid())
  userId    String
  delta     Float    // +/- $NIVAR (or resource)
  currency  String   // NIVAR | food | wood | coal | iron
  reason    String   // summon, raid_reward, quest_claim, airdrop, wallet_claim, ...
  refId     String?
  createdAt DateTime @default(now())
}
```

---

## 9. Fastify API (REST; all mutating routes return the authoritative state slice)

```
POST /auth/siws            # Sign-In With Solana: verify signed nonce -> JWT
GET  /state                # full hydrated state (runs accrual first)
POST /building/upgrade     { key }
POST /rig/overclock
POST /build/speedup        { target }      # target = key | "furnace"
POST /summon               { count: 1|10 } # -> { pulls:[{heroId,isNew}], state }
POST /hero/equip           { heroId }
POST /hero/unequip         { heroId }
POST /hero/levelup         { heroId }
POST /raid                 { stageId }      # -> { win, eff, rewards, state }
POST /research             { techId }
POST /quest/claim          { cat, id }
POST /quest/chest          { index }
POST /shop/airdrop
POST /shop/genesis
POST /shop/buy             { sku }          # behind feature flag until token live
POST /wallet/claim         { amount }       # treasury-signed transfer to user wallet
POST /webhooks/helius                       # deposit/confirm callbacks
```
Add **idempotency keys** on `summon`, `raid`, `quest/claim`, `wallet/claim`. Rate-limit per user/IP via Redis.

---

## 10. Gacha fairness (important — it's the money loop)

- RNG is **server-side only**. Use a commit-reveal / provably-fair scheme: server stores `serverSeed` (hashed, published), combines with `userSeed` + nonce per pull; log the result so a pull can be audited later.
- Enforce rates from config (`leg 2 / epic 10 / rare 28 / common 60`). Deduct `$NIVAR` (×1 = 100, ×10 = 900) **before** rolling, inside a transaction. Dupes → `+1 shard`.
- Return the pulled heroes; the client plays the **existing** reveal animation (don't change it).

---

## 11. $NIVAR / wallet / Solana

- `$NIVAR` = the premium 💎 currency. In-game balance is the off-chain `Base.crystal`, backed by the ledger.
- **Wallet connect:** `@solana/wallet-adapter` + SIWS (signed nonce → JWT). No seed phrases ever touch us.
- **Off-chain ↔ on-chain:**
  - MVP: gameplay runs on the off-chain ledger (fast, no gas per action).
  - **Claim to wallet:** `POST /wallet/claim` → treasury wallet signs an SPL transfer of `$NIVAR` to the user (via Helius), debit ledger, idempotent.
  - **Deposit / buy:** Helius webhook confirms inbound transfer → credit ledger. Fiat/on-ramp later.
- Prototype stubs to wire: **Genesis Pack** (one-time grant), **Daily Airdrop** (free daily $NIVAR), **wallet bundles** (currently toast "connect wallet — coming in production"). Keep bundles behind a feature flag until the token is live; airdrop + genesis can ship as ledger grants immediately.
- **Security:** client never sets balances; all token ops server-signed; treasury key in env/secrets (not in repo); idempotency + audit on every claim.

---

## 12. Security / anti-cheat checklist

- Server is the only writer of resources, $NIVAR, power, levels, clears.
- Validate every cost/precondition server-side against `packages/config`.
- Redis per-user lock around accrual + economic mutations.
- Idempotency keys on rewardful endpoints.
- Rate-limit summon/raid/claim.
- Ledger every currency delta (reason + refId) for support + audit.
- Cap idle accrual window; reject absurd `dt`.

---

## 13. Build order (milestones — diff against `nivar.html` each step)

1. **Port** prototype into Next.js client component. **Visual parity check** vs `nivar.html` (must be identical). Still in-memory.
2. Auth (SIWS) + User/Base bootstrap + `GET /state` hydration + idle accrual (§7).
3. Wire building upgrade / rig overclock / build speed-up to server.
4. Heroes + **server gacha** (§10) + equip/level.
5. Raids + Research.
6. Quests + Dailies + UTC cron reset.
7. `$NIVAR` off-chain ledger + Shop flows (airdrop/genesis live, bundles flagged).
8. Wallet connect + claim-to-wallet via treasury (token launch).
9. Hardening: rate-limit, idempotency, anti-cheat audit, PM2/Nginx deploy, monitoring.

---

## 14. Out of scope (MVP — do NOT build yet)

Multiplayer / PvP / alliances, real isometric sprite art, world map beyond the base, leaderboards beyond a simple Net Worth board, native mobile apps. Keep it single-player + on-chain economy first.

---

## 15. Attachment

`nivar.html` — the approved prototype. **This file is the spec.** When in doubt about how anything should look or what a number should be, open it and match it exactly.

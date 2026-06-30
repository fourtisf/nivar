/* End-to-end smoke test of the server-authoritative loop (no DB/network).
   Run: NIVAR_DEV_AUTH=1 npm run smoke --workspace @nivar/api  */
process.env.NIVAR_DEV_AUTH = "1";

import assert from "node:assert";
import { buildServer } from "./server.js";
import { devSignature } from "./auth.js";

const app = buildServer();
const WALLET = "TestWa11etPubkey1111111111111111111111111111";
let token = "";
let pass = 0;
const ok = (label: string, cond: boolean) => {
  assert(cond, `FAIL: ${label}`);
  pass++;
  console.log(`  ✓ ${label}`);
};

const auth = () => ({ authorization: `Bearer ${token}` });
async function req(method: "GET" | "POST", url: string, payload?: unknown, headers: Record<string, string> = {}) {
  const res = await app.inject({ method, url, headers: { ...auth(), ...headers }, payload: payload as object });
  return { status: res.statusCode, json: res.json() as any };
}

async function main() {
  console.log("\nNIVAR api smoke test\n");

  // --- auth (SIWS, dev verifier) ---
  const nonceRes = await app.inject({ method: "POST", url: "/auth/siws/nonce", payload: { wallet: WALLET } });
  const { nonce } = nonceRes.json() as any;
  ok("nonce issued", typeof nonce === "string" && nonce.length > 0);
  const loginRes = await app.inject({
    method: "POST",
    url: "/auth/siws",
    payload: { wallet: WALLET, nonce, signature: devSignature(WALLET, nonce) },
  });
  token = (loginRes.json() as any).token;
  ok("login returns JWT", typeof token === "string" && token.split(".").length === 3);

  // unauth request is rejected
  const noAuth = await app.inject({ method: "GET", url: "/state" });
  ok("GET /state requires auth", noAuth.statusCode === 401);

  // --- initial state ---
  let st = (await req("GET", "/state")).json.state;
  ok("initial crystal = 1258", st.resources.crystal === 1258);
  ok("initial rig level = 3", st.furnace === 3);
  ok("starts with Degen+Miner squad", st.squad.length === 2 && st.squad.includes("degen") && st.squad.includes("miner"));
  ok("initial net worth = 1892", st.power === 1892);
  ok("initial squad power = 220", st.squadPower === 220);
  ok("popCap recomputed to 39", st.popCap === 39);

  // --- building upgrade + speed-up (finishes the job server-side) ---
  const up = await req("POST", "/building/upgrade", { key: "cookhouse" });
  ok("upgrade starts a job", up.json.state.job?.target === "cookhouse");
  const beforeLv = st.buildings.cookhouse;
  const su = await req("POST", "/build/speedup");
  ok("speed-up finishes job (job cleared)", su.json.state.job === null);
  ok("cookhouse leveled up", su.json.state.buildings.cookhouse === beforeLv + 1);
  ok("upgrade counter incremented", su.json.state.stats.upgrades === 1);

  // --- gacha summon (deducts $NIVAR, returns pulls) ---
  st = (await req("GET", "/state")).json.state;
  const crystalBefore = st.resources.crystal;
  const sum = await req("POST", "/summon", { count: 1 });
  ok("summon returns a pull", Array.isArray(sum.json.pulls) && sum.json.pulls.length === 1);
  ok("summon charged 100 $NIVAR", Math.round(crystalBefore - sum.json.state.resources.crystal) === 100);
  ok("summon counter incremented", sum.json.state.stats.summons === 1);

  // --- idempotency: same key must not double-charge ---
  const idemHeaders = { "idempotency-key": "fixed-key-123" };
  const a = await req("POST", "/summon", { count: 1 }, idemHeaders);
  const b = await req("POST", "/summon", { count: 1 }, idemHeaders);
  ok("idempotent summon returns identical response", JSON.stringify(a.json.pulls) === JSON.stringify(b.json.pulls));
  ok("idempotent summon charged once", a.json.state.resources.crystal === b.json.state.resources.crystal);

  // --- raid: outcome is computed server-side (win iff eff >= stage power) ---
  const r1 = await req("POST", "/raid", { stageId: "s1" });
  ok("raid s1 outcome consistent with server power", typeof r1.json.eff === "number" && r1.json.win === r1.json.eff >= 450);
  const rLocked = await req("POST", "/raid", { stageId: "s3" });
  ok("raid s3 locked (sequential unlock)", rLocked.status === 400 && rLocked.json.error.code === "stage_locked");

  // --- research ---
  const before = (await req("GET", "/state")).json.state.resources.wood;
  const res = await req("POST", "/research", { techId: "overclock" });
  ok("research applied to level 1", res.json.state.research.overclock === 1);
  ok("research spent resources", res.json.state.resources.wood < before);

  // --- quest claim (m1: upgrade any facility — already done) ---
  const q = await req("POST", "/quest/claim", { cat: "main", id: "m1" });
  ok("quest m1 claimable & granted +80 $NIVAR", q.json.state.claimed.includes("main:m1"));
  const qAgain = await req("POST", "/quest/claim", { cat: "main", id: "m1" });
  ok("quest m1 not double-claimable", qAgain.status === 400 && qAgain.json.error.code === "quest_not_claimable");

  // --- shop: airdrop + genesis ---
  const air1 = await req("POST", "/shop/airdrop");
  ok("airdrop grants +250 $NIVAR", air1.json.ok === true);
  const air2 = await req("POST", "/shop/airdrop");
  ok("airdrop on cooldown", air2.status === 400 && air2.json.error.code === "airdrop_soon");
  const gen = await req("POST", "/shop/genesis");
  ok("genesis hero is a guaranteed epic", ["vc", "dev", "kol"].includes(gen.json.hero));
  ok("genesis hero is owned afterward", gen.json.state.heroes[gen.json.hero] !== undefined);
  const gen2 = await req("POST", "/shop/genesis");
  ok("genesis one-time only", gen2.status === 400 && gen2.json.error.code === "genesis_claimed");

  // --- flagged endpoints honestly report not-ready ---
  const claim = await req("POST", "/wallet/claim", { amount: 10 });
  ok("wallet/claim returns 501 (treasury not configured)", claim.status === 501);

  console.log(`\n${pass} checks passed ✓\n`);
  await app.close();
}

main().catch((e) => {
  console.error("\n" + e.message + "\n");
  process.exit(1);
});

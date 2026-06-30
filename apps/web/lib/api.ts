/**
 * Typed client for the NIVAR Fastify api. This is the seam for milestones 2+:
 * the engine currently runs in-memory (Milestone 1, exact parity). To go
 * server-authoritative, hydrate `S` from `getState()` and replace each engine
 * mutation (startUpgrade, pull, raid, claimQuest, …) with the matching call
 * here, then apply the returned authoritative `state`. The renderer does not
 * change.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface ServerState {
  resources: { food: number; wood: number; coal: number; iron: number; crystal: number };
  warmth: number;
  pop: number;
  popCap: number;
  furnace: number;
  buildings: Record<string, number>;
  heroes: Record<string, { level: number; shards: number }>;
  squad: string[];
  research: Record<string, number>;
  clears: Record<string, { cleared: boolean; cooldownUntil: number }>;
  job: { target: string; kind: "upgrade" | "furnace"; endsAt: number; total: number } | null;
  power: number;
  squadPower: number;
  stats: { summons: number; raidWins: number; upgrades: number };
  claimed: string[];
  daily: { date: string; summons: number; raidWins: number; upgrades: number; airdrop: boolean; chestClaimed: number[] };
  genesisClaimed: boolean;
  airdropAt: number;
  lastTickAt: number;
  serverTime: number;
}

export interface ApiEnvelope<T = unknown> {
  ok: boolean;
  state: ServerState;
  // route-specific extras (pulls, win/eff/rewards, hero, …)
  [k: string]: T | unknown;
}

let token: string | null = null;
export const setToken = (t: string | null) => (token = t);

async function call<T = ApiEnvelope>(path: string, opts: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "request failed"), { code: json?.error?.code, status: res.status });
  return json as T;
}

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const api = {
  // auth
  nonce: (wallet: string) => call<{ nonce: string; message: string }>("/auth/siws/nonce", { body: { wallet } }),
  login: (wallet: string, nonce: string, signature: string) => call<{ token: string; userId: string }>("/auth/siws", { body: { wallet, nonce, signature } }),
  // state
  state: () => call<ApiEnvelope>("/state", { method: "GET" }),
  // base / rig
  upgrade: (key: string) => call("/building/upgrade", { body: { key } }),
  overclock: () => call("/rig/overclock"),
  speedup: () => call("/build/speedup"),
  // heroes / gacha
  summon: (count: 1 | 10, clientSeed?: string) => call("/summon", { body: { count, clientSeed }, idempotencyKey: newKey() }),
  equip: (heroId: string) => call("/hero/equip", { body: { heroId } }),
  unequip: (heroId: string) => call("/hero/unequip", { body: { heroId } }),
  levelup: (heroId: string) => call("/hero/levelup", { body: { heroId } }),
  // raids / research
  raid: (stageId: string) => call("/raid", { body: { stageId }, idempotencyKey: newKey() }),
  research: (techId: string) => call("/research", { body: { techId } }),
  // quests
  claimQuest: (cat: string, id: string) => call("/quest/claim", { body: { cat, id }, idempotencyKey: newKey() }),
  claimChest: (index: number) => call("/quest/chest", { body: { index } }),
  // shop
  airdrop: () => call("/shop/airdrop"),
  genesis: () => call("/shop/genesis"),
};

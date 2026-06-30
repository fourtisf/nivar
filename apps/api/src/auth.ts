import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError, Errors } from "./lib/errors.js";
import type { Store } from "./store.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const NONCE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_S = 7 * 24 * 3600;

/* ---------------- JWT (HS256, dependency-free) ---------------- */
const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

export function signToken(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_S;
  const body = b64url(JSON.stringify({ ...payload, exp }));
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyToken(token: string): { sub: string; wallet: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, b, s] = parts;
  const expected = createHmac("sha256", JWT_SECRET).update(`${h}.${b}`).digest("base64url");
  if (!safeEq(s, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(b, "base64url").toString());
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return { sub: payload.sub, wallet: payload.wallet };
  } catch {
    return null;
  }
}

/* ---------------- Sign-In With Solana ---------------- */
export function siwsMessage(nonce: string): string {
  return `nivar.fun wants you to Sign-In With Solana.\n\nNonce: ${nonce}`;
}

/**
 * Verifies that `signature` is a valid signing of the SIWS message by `wallet`.
 *
 * Production MUST inject a real ed25519 verifier (nacl.sign.detached.verify of
 * the message bytes against the base58 wallet pubkey). To keep this package
 * dependency-free and runnable in CI, the default dev verifier accepts a
 * deterministic test signature when NIVAR_DEV_AUTH=1 (never in production).
 */
export type SignatureVerifier = (args: { wallet: string; message: string; signature: string }) => boolean;

export const devSignature = (wallet: string, nonce: string): string =>
  createHash("sha256").update(`${wallet}:${nonce}`).digest("hex");

const defaultVerifier: SignatureVerifier = ({ wallet, message, signature }) => {
  if (process.env.NIVAR_DEV_AUTH === "1") {
    const nonce = message.split("Nonce: ")[1]?.trim() ?? "";
    return safeEq(signature, devSignature(wallet, nonce));
  }
  throw new Error("No SIWS signature verifier configured (inject an ed25519 verifier in production).");
};

let verifier: SignatureVerifier = defaultVerifier;
export const setSignatureVerifier = (v: SignatureVerifier) => (verifier = v);

export async function issueNonce(store: Store, wallet: string): Promise<{ nonce: string; message: string }> {
  const nonce = randomBytes(16).toString("hex");
  await store.putNonce(wallet, nonce, Date.now() + NONCE_TTL_MS);
  return { nonce, message: siwsMessage(nonce) };
}

export async function login(
  store: Store,
  args: { wallet: string; nonce: string; signature: string },
): Promise<{ token: string; userId: string }> {
  const claim = await store.consumeNonce(args.nonce);
  if (!claim || claim.wallet !== args.wallet) throw new ApiError("invalid_nonce", "Invalid or expired nonce", 401);
  const ok = verifier({ wallet: args.wallet, message: siwsMessage(args.nonce), signature: args.signature });
  if (!ok) throw Errors.unauthorized();
  const userId = await store.userIdForWallet(args.wallet);
  const token = signToken({ sub: userId, wallet: args.wallet });
  return { token, userId };
}

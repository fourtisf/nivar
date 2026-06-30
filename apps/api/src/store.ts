import { createHash } from "node:crypto";
import { freshState, GameState } from "./state.js";
import type { LedgerDraft } from "./services/economy.js";
import type { PullRecord } from "./services/gacha.js";

/**
 * Persistence port. The game services are pure functions over {@link GameState};
 * this is the only seam that touches storage. The in-memory implementation
 * makes the api fully runnable/testable here. A Prisma-backed implementation
 * (schema in packages/prisma) drops in for production with no service changes:
 * `getState` hydrates Base+Building+Hero+… into a GameState, `saveState`
 * writes the diff back, and `appendLedger`/`recordRolls` insert audit rows.
 */
export interface Store {
  getState(userId: string, now: number): Promise<GameState>;
  saveState(state: GameState): Promise<void>;
  appendLedger(userId: string, entries: LedgerDraft[]): Promise<void>;
  recordRolls(userId: string, rolls: PullRecord[]): Promise<void>;
  // idempotency
  getIdem(userId: string, key: string): Promise<unknown | undefined>;
  putIdem(userId: string, key: string, route: string, response: unknown): Promise<void>;
  // SIWS nonces
  putNonce(wallet: string, nonce: string, expiresAt: number): Promise<void>;
  consumeNonce(nonce: string): Promise<{ wallet: string } | null>;
  // user bootstrap by wallet
  userIdForWallet(wallet: string): Promise<string>;
}

export class InMemoryStore implements Store {
  private states = new Map<string, GameState>();
  private ledger = new Map<string, LedgerDraft[]>();
  private rolls = new Map<string, PullRecord[]>();
  private idem = new Map<string, unknown>();
  private nonces = new Map<string, { wallet: string; expiresAt: number; used: boolean }>();
  private wallets = new Map<string, string>();

  async getState(userId: string, now: number): Promise<GameState> {
    let s = this.states.get(userId);
    if (!s) {
      s = freshState(userId, now);
      this.states.set(userId, s);
    }
    return s;
  }

  async saveState(state: GameState): Promise<void> {
    this.states.set(state.userId, state);
  }

  async appendLedger(userId: string, entries: LedgerDraft[]): Promise<void> {
    if (!entries.length) return;
    const arr = this.ledger.get(userId) ?? [];
    arr.push(...entries);
    this.ledger.set(userId, arr);
  }

  async recordRolls(userId: string, rolls: PullRecord[]): Promise<void> {
    if (!rolls.length) return;
    const arr = this.rolls.get(userId) ?? [];
    arr.push(...rolls);
    this.rolls.set(userId, arr);
  }

  /** Test/debug: sum of all $NIVAR ledger deltas for a user. */
  nivarLedgerSum(userId: string): number {
    return (this.ledger.get(userId) ?? []).filter((e) => e.currency === "NIVAR").reduce((a, e) => a + e.delta, 0);
  }

  async getIdem(userId: string, key: string): Promise<unknown | undefined> {
    return this.idem.get(`${userId}:${key}`);
  }

  async putIdem(userId: string, key: string, _route: string, response: unknown): Promise<void> {
    this.idem.set(`${userId}:${key}`, response);
  }

  async putNonce(wallet: string, nonce: string, expiresAt: number): Promise<void> {
    this.nonces.set(nonce, { wallet, expiresAt, used: false });
  }

  async consumeNonce(nonce: string): Promise<{ wallet: string } | null> {
    const n = this.nonces.get(nonce);
    if (!n || n.used || Date.now() > n.expiresAt) return null;
    n.used = true;
    return { wallet: n.wallet };
  }

  async userIdForWallet(wallet: string): Promise<string> {
    let id = this.wallets.get(wallet);
    if (!id) {
      // Derive a collision-resistant id from the FULL wallet (never a prefix —
      // truncation would let distinct wallets share a userId / account).
      id = `user_${createHash("sha256").update(wallet).digest("hex").slice(0, 32)}`;
      this.wallets.set(wallet, id);
    }
    return id;
  }
}

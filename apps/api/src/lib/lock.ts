/**
 * Per-user serialization lock. Wraps idle-accrual + economic mutations so
 * concurrent requests for the same user can't double-credit (handoff §6/§7).
 * In-memory promise-chaining here; swap for a Redis lock (e.g. redlock) in
 * production so it holds across multiple api instances.
 */
const chains = new Map<string, Promise<unknown>>();

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn); // run regardless of prior outcome
  // keep the chain alive but don't leak rejections
  chains.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

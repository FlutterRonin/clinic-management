// Tiny in-memory rate limiter for the self-serve signup (v3 spec §3.2). Deliberately
// simple: a process-local sliding window keyed by IP. At this scale a paranoid
// distributed limiter is overkill — if the app is ever scaled horizontally this
// swaps for Vercel KV (documented in BACKLOG.md). Cheap, honest, good enough.

type Hit = { count: number; resetAt: number }

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const buckets = new Map<string, Hit>()

/**
 * Record an attempt for `key` and report whether it is allowed. Returns the
 * remaining allowance so callers can surface a friendly message. `now` is
 * injectable for deterministic tests.
 */
export function rateLimit(
  key: string,
  max: number,
  now: number = Date.now(),
): { allowed: boolean; remaining: number } {
  const existing = buckets.get(key)
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: max - 1 }
  }
  if (existing.count >= max) {
    return { allowed: false, remaining: 0 }
  }
  existing.count += 1
  return { allowed: true, remaining: max - existing.count }
}

/** Test helper — drop all recorded windows. */
export function resetRateLimit(): void {
  buckets.clear()
}

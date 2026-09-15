const WINDOW_MS = 30 * 60 * 1000
const LIMIT = 20

type Bucket = number[]

const buckets = new Map<string, Bucket>()

function prune(timestamps: Bucket, now: number): Bucket {
  return timestamps.filter((ts) => now - ts < WINDOW_MS)
}

export type RateLimitResult =
  | { ok: true; remaining: number; limit: number; resetAt: number }
  | {
      ok: false
      remaining: 0
      limit: number
      resetAt: number
      retryAfterSeconds: number
    }

export function checkRateLimit(clientKey: string, now = Date.now()): RateLimitResult {
  const pruned = prune(buckets.get(clientKey) ?? [], now)
  buckets.set(clientKey, pruned)

  const oldest = pruned[0]
  const resetAt = oldest !== undefined ? oldest + WINDOW_MS : now + WINDOW_MS

  if (pruned.length >= LIMIT) {
    return {
      ok: false,
      remaining: 0,
      limit: LIMIT,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    }
  }

  return {
    ok: true,
    remaining: LIMIT - pruned.length,
    limit: LIMIT,
    resetAt,
  }
}

export function consumeRateLimit(
  clientKey: string,
  now = Date.now(),
): RateLimitResult {
  const check = checkRateLimit(clientKey, now)
  if (!check.ok) return check

  const pruned = prune(buckets.get(clientKey) ?? [], now)
  pruned.push(now)
  buckets.set(clientKey, pruned)

  const oldest = pruned[0]!
  return {
    ok: true,
    remaining: LIMIT - pruned.length,
    limit: LIMIT,
    resetAt: oldest + WINDOW_MS,
  }
}

export function peekRateLimit(
  clientKey: string,
  now = Date.now(),
): { remaining: number; limit: number; resetAt: number } {
  const check = checkRateLimit(clientKey, now)
  return {
    remaining: check.remaining,
    limit: check.limit,
    resetAt: check.resetAt,
  }
}

export const RATE_LIMIT = { limit: LIMIT, windowMs: WINDOW_MS }

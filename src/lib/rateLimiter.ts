/**
 * Rate Limiter — Simple in-memory rate limiting for API routes.
 *
 * Uses a sliding window counter per IP address.
 * Designed for Next.js API routes / Route Handlers.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60000, max: 10 });
 *   // In your route handler:
 *   const ip = req.headers.get('x-forwarded-for') || 'unknown';
 *   if (!limiter.check(ip)) return new Response('Too many requests', { status: 429 });
 */

interface RateLimiterConfig {
  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;
  /** Maximum requests per window (default: 30) */
  max?: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

export function createRateLimiter(config: RateLimiterConfig = {}) {
  const { windowMs = 60_000, max = 30 } = config;
  const store = new Map<string, WindowEntry>();

  // Periodic cleanup to prevent memory leaks
  const CLEANUP_INTERVAL = Math.max(windowMs * 2, 120_000);
  let lastCleanup = Date.now();

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }

  return {
    /**
     * Check if a request is allowed.
     * Returns true if within rate limit, false if exceeded.
     */
    check(identifier: string): boolean {
      cleanup();
      const now = Date.now();
      const entry = store.get(identifier);

      if (!entry || entry.resetAt <= now) {
        store.set(identifier, { count: 1, resetAt: now + windowMs });
        return true;
      }

      entry.count += 1;
      return entry.count <= max;
    },

    /**
     * Get remaining requests for an identifier.
     */
    remaining(identifier: string): number {
      const entry = store.get(identifier);
      if (!entry || entry.resetAt <= Date.now()) return max;
      return Math.max(0, max - entry.count);
    },

    /**
     * Get rate limit headers for a response.
     */
    headers(identifier: string): Record<string, string> {
      const entry = store.get(identifier);
      const remaining = this.remaining(identifier);
      const resetAt = entry?.resetAt ?? Date.now() + windowMs;

      return {
        'X-RateLimit-Limit': String(max),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      };
    },
  };
}

// ─── Pre-configured limiters for common use cases ─────────

/** Standard API limiter: 30 req/min */
export const apiLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/** AI/LLM route limiter: 10 req/min (expensive calls) */
export const aiLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/** Auth route limiter: 5 req/min (brute force protection) */
export const authLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

/**
 * Helper to extract client IP from Next.js request headers.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

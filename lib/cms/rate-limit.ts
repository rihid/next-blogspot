export type RateLimiter = {
  check(key: string): boolean;
};

export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

const MAX_TRACKED_KEYS = 1000;

/** Fixed-window limiter, in-memory per server instance. */
export function createFixedWindowLimiter(options: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key: string): boolean {
      const now = Date.now();

      if (hits.size > MAX_TRACKED_KEYS) {
        for (const [trackedKey, entry] of hits) {
          if (entry.resetAt <= now) hits.delete(trackedKey);
        }
      }

      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + options.windowMs });
        return true;
      }

      if (entry.count >= options.limit) return false;

      entry.count += 1;
      return true;
    },
  };
}

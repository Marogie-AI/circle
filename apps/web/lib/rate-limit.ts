import { Ratelimit } from "@upstash/ratelimit";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { logError, logWarn } from "@/lib/log";
import { redis } from "@/lib/redis";

const limiters = new Map<string, Ratelimit>();

function redisLimiter(max: number, windowSeconds: number) {
  if (!redis) return null;

  const id = `${max}:${windowSeconds}`;
  const existing = limiters.get(id);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis,
    // Preserve the established fixed-window behavior while moving the atomic counter
    // off Postgres. The algorithm is one Redis script, not a read followed by a write.
    limiter: Ratelimit.fixedWindow(max, `${windowSeconds} s`),
    prefix: `circle:${process.env.VERCEL_ENV ?? "dev"}:ratelimit:${id}`,
    analytics: false,
    // Do not hold a content mutation for Upstash's five-second default during an
    // outage. A timeout drops into the durable Postgres fallback below.
    timeout: 1_000,
  });
  limiters.set(id, limiter);
  return limiter;
}

/**
 * Fixed-window rate limiting, one atomic statement.
 *
 * The insert and the increment are the same statement, so two concurrent requests cannot
 * both read a stale count and both decide they are under the limit. The window reset is
 * folded into the same CASE rather than done as a separate DELETE, which would open the
 * same race from the other side.
 *
 * ponytail: fixed window, so a caller can get up to 2x `max` across a window boundary
 * (max at the end of one, max at the start of the next). That is fine for "stop someone
 * hammering the API" and wrong for billing. Switch to a sliding window only if the
 * boundary burst ever actually matters.
 *
 * Key on the user id, never the IP: every caller here is authenticated, and behind
 * Vercel the IP is a proxy's anyway.
 */
async function allowWithPostgres(key: string, max: number, windowSeconds: number) {
  const { rows } = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.reset_at < now() THEN 1
        ELSE rate_limits.count + 1
      END,
      reset_at = CASE
        WHEN rate_limits.reset_at < now()
          THEN now() + make_interval(secs => ${windowSeconds})
        ELSE rate_limits.reset_at
      END
    RETURNING count
  `);

  // Best-effort GC on roughly 1 in 100 calls. A Vercel Cron for this would be more
  // machinery than the row count justifies — expired rows are tiny and harmless.
  if (Math.random() < 0.01) {
    await db
      .execute(sql`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 hour'`)
      .catch(() => {
        // GC failing must never fail the request it rode in on.
      });
  }

  return Number(rows[0]?.count ?? 0) <= max;
}

/**
 * Shared application limiter.
 *
 * Production uses Upstash so these high-frequency counters do not consume a database
 * connection or add writes to the primary data store. Local development has no Redis
 * requirement, and a configured Redis outage must not disable abuse protection, so the
 * original atomic Postgres statement remains the fallback in both cases.
 */
export async function allow(key: string, max: number, windowSeconds: number) {
  const limiter = redisLimiter(max, windowSeconds);
  if (limiter) {
    try {
      const result = await limiter.limit(key);
      if (result.reason !== "timeout") return result.success;
      logWarn("ratelimit.redis_timeout", { scope: key.split(":", 1)[0] });
    } catch (error) {
      logError("ratelimit.redis_failed", error, {
        scope: key.split(":", 1)[0],
      });
    }
  }

  return allowWithPostgres(key, max, windowSeconds);
}

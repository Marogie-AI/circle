import { sql } from "drizzle-orm";
import { db } from "@/db";

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
export async function allow(key: string, max: number, windowSeconds: number) {
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

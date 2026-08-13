import { Redis } from "@upstash/redis";

/**
 * Redis is optional everywhere except production.
 *
 * Keeping the unconfigured state as `null` is deliberate: local development and the
 * test suite should take the exact same database path as a Redis outage, without fake
 * credentials or a second local service. Consumers must therefore treat this as an
 * optimization, never as the source of truth.
 *
 * Automatic deserialization stays off because Upstash's JSON parsing cannot restore
 * values such as Date and Map. The cache layer owns that boundary with superjson.
 */
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv({ automaticDeserialization: false })
    : null;

import superjson from "superjson";
import { logError } from "@/lib/log";
import { redis } from "@/lib/redis";

type CacheEntry = {
  key: string;
  ttl: number;
  fn: () => Promise<unknown>;
};

const jitteredTtl = (ttlSeconds: number) =>
  Math.round(ttlSeconds * (0.9 + Math.random() * 0.2));

/**
 * Version and deployment scope live in every key so a schema change or a preview
 * deployment cannot read a value written by incompatible code. Bump `c1` when the
 * serialized shape changes in a way callers cannot tolerate.
 */
export function k(...parts: (string | number)[]) {
  return ["c1", process.env.VERCEL_ENV ?? "dev", ...parts].join(":");
}

/**
 * Start a write without putting cache latency on the request that already paid for the
 * database read. Both serialization and the Redis call are contained here: a value the
 * cache cannot represent is still a perfectly valid database result.
 */
function writeInBackground(key: string, ttlSeconds: number, value: unknown) {
  if (!redis) return;

  try {
    const write = redis.set(key, superjson.stringify(value), {
      ex: jitteredTtl(ttlSeconds),
    });
    void write.catch((error) => {
      logError("cache.set_failed", error, { key });
    });
  } catch (error) {
    logError("cache.set_failed", error, { key });
  }
}

/**
 * Cache-aside with exactly one Redis command on the hit path.
 *
 * Do not add EXISTS before GET, or retries after a failed GET. Both spend another
 * billable command while the database fallback already gives the request a correct
 * answer. A write happens only after Redis positively reports a miss; a read failure or
 * corrupt hit falls through without guessing whether the key exists.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  if (!redis) return fn();

  let raw: string | null;
  try {
    raw = await redis.get<string>(key);
  } catch (error) {
    logError("cache.get_failed", error, { key });
    return fn();
  }

  if (raw !== null) {
    try {
      return superjson.parse<T>(raw);
    } catch (error) {
      logError("cache.parse_failed", error, { key });
      return fn();
    }
  }

  const value = await fn();
  writeInBackground(key, ttlSeconds, value);
  return value;
}

/**
 * Batch cache-aside. MGET preserves input order, so one command replaces what would
 * otherwise be N independently billed GETs. Only genuine misses are queued for write;
 * every miss keeps its own TTL, but all SETs share one pipeline execution/HTTP round
 * trip.
 */
export async function cachedMany(entries: CacheEntry[]): Promise<unknown[]> {
  if (entries.length === 0) return [];
  if (!redis) return Promise.all(entries.map((entry) => entry.fn()));

  let cachedValues: (string | null)[];
  try {
    cachedValues = await redis.mget<(string | null)[]>(...entries.map((entry) => entry.key));
  } catch (error) {
    logError("cache.mget_failed", error, { keyCount: entries.length });
    return Promise.all(entries.map((entry) => entry.fn()));
  }

  const values: unknown[] = new Array(entries.length);
  const fallbackIndexes: number[] = [];
  const missIndexes = new Set<number>();

  for (let index = 0; index < entries.length; index++) {
    const raw = cachedValues[index] ?? null;
    if (raw === null) {
      fallbackIndexes.push(index);
      missIndexes.add(index);
      continue;
    }

    try {
      values[index] = superjson.parse(raw);
    } catch (error) {
      logError("cache.parse_failed", error, { key: entries[index].key });
      fallbackIndexes.push(index);
    }
  }

  const fallbackValues = await Promise.all(
    fallbackIndexes.map((index) => entries[index].fn()),
  );
  for (let index = 0; index < fallbackIndexes.length; index++) {
    values[fallbackIndexes[index]] = fallbackValues[index];
  }

  if (missIndexes.size > 0) {
    try {
      // Serialize everything before constructing the pipeline. If one value cannot be
      // represented, abandon the optional write as a unit instead of sending a partial
      // batch and making cache state depend on iteration order.
      const writes = [...missIndexes].map((index) => ({
        key: entries[index].key,
        ttl: entries[index].ttl,
        value: superjson.stringify(values[index]),
      }));
      const pipeline = redis.pipeline();
      for (const write of writes) {
        pipeline.set(write.key, write.value, { ex: jitteredTtl(write.ttl) });
      }
      void pipeline.exec().catch((error) => {
        logError("cache.pipeline_failed", error, { keyCount: writes.length });
      });
    } catch (error) {
      logError("cache.pipeline_failed", error, { keyCount: missIndexes.size });
    }
  }

  return values;
}

/**
 * Invalidate related keys with one variadic DEL. Empty invalidations deliberately make
 * no request, and failures are advisory because stale data is bounded by its TTL.
 */
export async function invalidate(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;

  try {
    await redis.del(...keys);
  } catch (error) {
    logError("cache.invalidate_failed", error, { keyCount: keys.length });
  }
}

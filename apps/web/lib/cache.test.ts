import assert from "node:assert/strict";
import { test } from "bun:test";
import superjson from "superjson";

// Cache configuration is captured when lib/redis.ts is first evaluated. Make this unit
// test deterministic even if the developer running it has production credentials in the
// shell; restoring them afterward avoids leaking our setup into unrelated tests.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
const { cached, cachedMany, invalidate, k } = await import("@/lib/cache");
if (redisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
else process.env.UPSTASH_REDIS_REST_URL = redisUrl;
if (redisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
else process.env.UPSTASH_REDIS_REST_TOKEN = redisToken;

test("superjson round-trips cache values that JSON cannot represent", () => {
  const value = {
    createdAt: new Date("2026-08-13T10:15:30.000Z"),
    counts: new Map([
      ["posts", 3],
      ["members", 8],
    ]),
  };

  const restored = superjson.parse<typeof value>(superjson.stringify(value));

  assert.ok(restored.createdAt instanceof Date);
  assert.equal(restored.createdAt.toISOString(), value.createdAt.toISOString());
  assert.ok(restored.counts instanceof Map);
  assert.deepEqual([...restored.counts], [...value.counts]);
});

test("cached falls through to the database function when Redis is unconfigured", async () => {
  let calls = 0;

  const result = await cached("unused", 60, async () => {
    calls += 1;
    return { source: "database" };
  });

  assert.deepEqual(result, { source: "database" });
  assert.equal(calls, 1);
});

test("cachedMany runs unconfigured fallbacks in parallel and preserves entry order", async () => {
  let releaseFirst: (() => void) | undefined;
  const firstCanFinish = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const result = await cachedMany([
    {
      key: "first",
      ttl: 60,
      fn: async () => {
        await firstCanFinish;
        return "first result";
      },
    },
    {
      key: "second",
      ttl: 60,
      fn: async () => {
        releaseFirst?.();
        return "second result";
      },
    },
  ]);

  assert.deepEqual(result, ["first result", "second result"]);
});

test("invalidate is a no-op when Redis is unconfigured", async () => {
  await assert.doesNotReject(() => invalidate("one", "two"));
});

test("k scopes compact keys by version and environment", () => {
  const vercelEnv = process.env.VERCEL_ENV;
  delete process.env.VERCEL_ENV;

  try {
    assert.equal(k("u", "abc", "chrome"), "c1:dev:u:abc:chrome");
    assert.equal(k("g", 42, "members"), "c1:dev:g:42:members");
  } finally {
    if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = vercelEnv;
  }
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groups, memberships, posts, user } from "@/db/schema";
import { getFeedPage } from "@/lib/queries/feed";

/**
 * The keyset cursor compares with lt/gt, and that comparison has to flip with the sort
 * direction. Get it wrong and pagination silently repeats or skips whole pages — no
 * error, just missing posts. So both directions get walked end to end here.
 */
test("paging returns every post exactly once, in both sort directions", async () => {
  const suffix = randomUUID();
  const userId = `feed-${suffix}`;
  const otherId = `feed-other-${suffix}`;
  const groupId = randomUUID();
  const postIds = Array.from({ length: 7 }, () => randomUUID());

  try {
    await db.insert(user).values([
      { id: userId, name: "Feeder", email: `feed-${suffix}@example.test` },
      { id: otherId, name: "Other", email: `feed-other-${suffix}@example.test` },
    ]);
    await db.insert(groups).values({
      id: groupId,
      name: "Feed group",
      slug: `feed-group-${suffix}`,
      createdBy: userId,
    });
    await db.insert(memberships).values({ groupId, userId, role: "owner" });

    // Distinct timestamps, plus two sharing one instant so the id tiebreak is exercised.
    const base = new Date("2026-01-01T00:00:00.000Z");
    await db.insert(posts).values(
      postIds.map((id, index) => ({
        id,
        groupId,
        authorId: index === 0 ? otherId : userId,
        title: `Post ${index}`,
        body: `Body ${index}`,
        tags: index % 2 === 0 ? ["even"] : ["odd"],
        createdAt: new Date(base.getTime() + Math.floor(index / 2) * 60_000),
      })),
    );

    for (const sort of ["new", "old"] as const) {
      const seen: string[] = [];
      let cursor: string | null = null;

      // limit 2 over 7 posts: four pages, so the cursor is crossed repeatedly.
      for (let page = 0; page < 10; page++) {
        const result = await getFeedPage({ groupId, sort, cursor, limit: 2 });
        seen.push(...result.items.map((item) => item.id));
        if (!result.hasMore) break;
        cursor = result.nextCursor;
        assert.ok(cursor, `${sort}: hasMore was true but nextCursor was null`);
      }

      assert.equal(
        seen.length,
        postIds.length,
        `${sort}: expected every post once, got ${seen.length}`,
      );
      assert.equal(
        new Set(seen).size,
        postIds.length,
        `${sort}: a post was returned on more than one page`,
      );
    }

    // Sanity: the two directions are actual mirrors of each other.
    const newest = await getFeedPage({ groupId, sort: "new", limit: 50 });
    const oldest = await getFeedPage({ groupId, sort: "old", limit: 50 });
    assert.deepEqual(
      oldest.items.map((item) => item.id),
      [...newest.items.map((item) => item.id)].reverse(),
    );

    // Filters narrow rather than leak.
    const byAuthor = await getFeedPage({ groupId, authorId: otherId, limit: 50 });
    assert.equal(byAuthor.items.length, 1);
    assert.equal(byAuthor.items[0].id, postIds[0]);

    const byTag = await getFeedPage({ groupId, tag: "odd", limit: 50 });
    assert.equal(byTag.items.length, 3);

    const both = await getFeedPage({
      groupId,
      tag: "even",
      authorId: otherId,
      limit: 50,
    });
    assert.equal(both.items.length, 1, "tag and author must combine, not replace");
  } finally {
    await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(memberships).where(eq(memberships.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(user).where(inArray(user.id, [userId, otherId]));
  }
});

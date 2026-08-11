import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  collections,
  groups,
  memberships,
  posts,
  savedPosts,
  user,
} from "@/db/schema";
import { listCollections, listSavedPosts } from "@/lib/queries/saved";

test("collections: counts are per-user, and saved filters by collection", async () => {
  const suffix = randomUUID();
  const userId = `col-${suffix}`;
  const groupId = randomUUID();
  const postA = randomUUID();
  const postB = randomUUID();
  const collectionId = randomUUID();

  try {
    await db.insert(user).values({
      id: userId,
      name: "Collector",
      email: `col-${suffix}@example.test`,
    });
    await db.insert(groups).values({
      id: groupId,
      name: "Col group",
      slug: `col-group-${suffix}`,
      createdBy: userId,
    });
    await db.insert(memberships).values({ groupId, userId, role: "owner" });
    await db.insert(posts).values([
      { id: postA, groupId, authorId: userId, title: "A", body: "b" },
      { id: postB, groupId, authorId: userId, title: "B", body: "b" },
    ]);
    await db.insert(collections).values({ id: collectionId, userId, name: "Reading" });
    // Save both; file only A into the collection.
    await db.insert(savedPosts).values([
      { userId, postId: postA, collectionId },
      { userId, postId: postB },
    ]);

    const cols = await listCollections(userId);
    assert.equal(cols.length, 1);
    assert.equal(cols[0].name, "Reading");
    assert.equal(cols[0].count, 1, "only A is filed in the collection");

    const all = await listSavedPosts(userId);
    assert.equal(all.length, 2, "unfiltered shows every saved post");

    const filed = await listSavedPosts(userId, collectionId);
    assert.deepEqual(
      filed.map((p) => p.id),
      [postA],
      "filtering by collection returns only its posts",
    );
    assert.equal(filed[0].collectionId, collectionId);
  } finally {
    await db.delete(savedPosts).where(eq(savedPosts.userId, userId));
    await db.delete(collections).where(eq(collections.userId, userId));
    await db.delete(posts).where(inArray(posts.id, [postA, postB]));
    await db.delete(memberships).where(eq(memberships.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(user).where(eq(user.id, userId));
  }
});

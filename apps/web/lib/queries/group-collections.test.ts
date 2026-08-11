import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  collectionPosts,
  collections,
  groups,
  memberships,
  posts,
  user,
} from "@/db/schema";
import {
  getGroupCollection,
  listCollectionPosts,
  listGroupCollections,
} from "@/lib/queries/group-collections";

test("group collections: scoped to the group, count and items correct", async () => {
  const suffix = randomUUID();
  const userId = `gc-${suffix}`;
  const groupId = randomUUID();
  const otherGroupId = randomUUID();
  const postA = randomUUID();
  const postB = randomUUID();
  const collectionId = randomUUID();
  const otherCollectionId = randomUUID();

  try {
    await db.insert(user).values({ id: userId, name: "Curator", email: `gc-${suffix}@example.test` });
    await db.insert(groups).values([
      { id: groupId, name: "G", slug: `gc-${suffix}`, createdBy: userId },
      { id: otherGroupId, name: "Other", slug: `gc-other-${suffix}`, createdBy: userId },
    ]);
    await db.insert(memberships).values({ groupId, userId, role: "owner" });
    await db.insert(posts).values([
      { id: postA, groupId, authorId: userId, title: "A", body: "b" },
      { id: postB, groupId, authorId: userId, title: "B", body: "b" },
    ]);
    await db.insert(collections).values([
      { id: collectionId, userId, groupId, name: "Best" },
      { id: otherCollectionId, userId, groupId: otherGroupId, name: "Elsewhere" },
    ]);
    // File only A into the group's collection.
    await db.insert(collectionPosts).values({ collectionId, postId: postA, addedBy: userId });

    const cols = await listGroupCollections(groupId);
    assert.deepEqual(cols.map((c) => c.name), ["Best"], "only this group's collections");
    assert.equal(cols[0].count, 1);

    // A collection from another group must not resolve against this group.
    assert.ok(await getGroupCollection(collectionId, groupId));
    assert.equal(await getGroupCollection(otherCollectionId, groupId), undefined);

    const items = await listCollectionPosts(collectionId);
    assert.deepEqual(items.map((p) => p.id), [postA]);
  } finally {
    await db.delete(collectionPosts).where(eq(collectionPosts.collectionId, collectionId));
    await db.delete(collections).where(inArray(collections.id, [collectionId, otherCollectionId]));
    await db.delete(posts).where(inArray(posts.id, [postA, postB]));
    await db.delete(memberships).where(eq(memberships.groupId, groupId));
    await db.delete(groups).where(inArray(groups.id, [groupId, otherGroupId]));
    await db.delete(user).where(eq(user.id, userId));
  }
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  collectionPostAnnotations,
  collectionPosts,
  collections,
  groups,
  memberships,
  posts,
  user,
} from "@/db/schema";
import {
  getGroupCollection,
  listCollectionPostAnnotations,
  listCollectionPosts,
  listGroupCollections,
} from "@/lib/queries/group-collections";

test("group collections: scoped to the group, count and items correct", async () => {
  const suffix = randomUUID();
  const userId = `gc-${suffix}`;
  const contributorId = `gc-contributor-${suffix}`;
  const groupId = randomUUID();
  const otherGroupId = randomUUID();
  const postA = randomUUID();
  const postB = randomUUID();
  const otherPost = randomUUID();
  const collectionId = randomUUID();
  const otherCollectionId = randomUUID();
  const older = new Date("2026-08-01T12:00:00.000Z");
  const newer = new Date("2026-08-01T13:00:00.000Z");

  try {
    await db.insert(user).values([
      { id: userId, name: "Curator", email: `gc-${suffix}@example.test` },
      {
        id: contributorId,
        name: "Contributor",
        email: `gc-contributor-${suffix}@example.test`,
      },
    ]);
    await db.insert(groups).values([
      { id: groupId, name: "G", slug: `gc-${suffix}`, createdBy: userId },
      { id: otherGroupId, name: "Other", slug: `gc-other-${suffix}`, createdBy: userId },
    ]);
    await db.insert(memberships).values([
      { groupId, userId, role: "owner" },
      { groupId, userId: contributorId, role: "member" },
    ]);
    await db.insert(posts).values([
      { id: postA, groupId, authorId: userId, title: "A", body: "b" },
      { id: postB, groupId, authorId: userId, title: "B", body: "b" },
      { id: otherPost, groupId: otherGroupId, authorId: userId, title: "C", body: "b" },
    ]);
    await db.insert(collections).values([
      { id: collectionId, userId, groupId, name: "Best" },
      { id: otherCollectionId, userId, groupId: otherGroupId, name: "Elsewhere" },
    ]);
    // File A into each collection, and only A into the group's collection.
    await db.insert(collectionPosts).values([
      { collectionId, postId: postA, addedBy: userId },
      { collectionId: otherCollectionId, postId: otherPost, addedBy: userId },
    ]);
    await db.insert(collectionPostAnnotations).values([
      {
        collectionId,
        postId: postA,
        authorId: userId,
        body: "Worth keeping.",
        createdAt: older,
        updatedAt: older,
      },
      {
        collectionId,
        postId: postA,
        authorId: contributorId,
        body: "Useful for our next project.",
        createdAt: newer,
        updatedAt: newer,
      },
      {
        collectionId: otherCollectionId,
        postId: otherPost,
        authorId: userId,
        body: "Must not leak into the first collection.",
      },
    ]);

    const cols = await listGroupCollections(groupId);
    assert.deepEqual(cols.map((c) => c.name), ["Best"], "only this group's collections");
    assert.equal(cols[0].count, 1);

    // A collection from another group must not resolve against this group.
    assert.ok(await getGroupCollection(collectionId, groupId));
    assert.equal(await getGroupCollection(otherCollectionId, groupId), undefined);

    const items = await listCollectionPosts(collectionId);
    assert.deepEqual(items.map((p) => p.id), [postA]);

    const annotations = await listCollectionPostAnnotations(collectionId);
    assert.deepEqual(
      annotations.map((annotation) => annotation.authorId),
      [contributorId, userId],
      "only this collection's annotations, newest updates first",
    );
    assert.equal(annotations[0].authorName, "Contributor");

    let invalidAnnotationWasRejected = false;
    try {
      await db.insert(collectionPostAnnotations).values({
        collectionId,
        postId: postB,
        authorId: userId,
        body: "This post is not in the collection.",
      });
    } catch {
      invalidAnnotationWasRejected = true;
    }
    assert.equal(invalidAnnotationWasRejected, true, "annotations require a real collection item");
  } finally {
    await db
      .delete(collectionPostAnnotations)
      .where(inArray(collectionPostAnnotations.collectionId, [collectionId, otherCollectionId]));
    await db.delete(collectionPosts).where(eq(collectionPosts.collectionId, collectionId));
    await db.delete(collectionPosts).where(eq(collectionPosts.collectionId, otherCollectionId));
    await db.delete(collections).where(inArray(collections.id, [collectionId, otherCollectionId]));
    await db.delete(posts).where(inArray(posts.id, [postA, postB, otherPost]));
    await db.delete(memberships).where(eq(memberships.groupId, groupId));
    await db.delete(groups).where(inArray(groups.id, [groupId, otherGroupId]));
    await db.delete(user).where(inArray(user.id, [userId, contributorId]));
  }
});

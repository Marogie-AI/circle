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
import { listSavedPosts } from "@/lib/queries/saved";

test("read-later: state filters, and collection+state intersect", async () => {
  const suffix = randomUUID();
  const userId = `rl-${suffix}`;
  const groupId = randomUUID();
  const unreadPost = randomUUID();
  const readPost = randomUUID();
  const archivedPost = randomUUID();
  const collectionId = randomUUID();
  const now = new Date();

  try {
    await db.insert(user).values({ id: userId, name: "Reader", email: `rl-${suffix}@example.test` });
    await db.insert(groups).values({ id: groupId, name: "G", slug: `rl-${suffix}`, createdBy: userId });
    await db.insert(memberships).values({ groupId, userId, role: "owner" });
    await db.insert(posts).values([
      { id: unreadPost, groupId, authorId: userId, title: "Unread", body: "b" },
      { id: readPost, groupId, authorId: userId, title: "Read", body: "b" },
      { id: archivedPost, groupId, authorId: userId, title: "Archived", body: "b" },
    ]);
    await db.insert(collections).values({ id: collectionId, userId, name: "Later" });
    await db.insert(savedPosts).values([
      { userId, postId: unreadPost },
      { userId, postId: readPost, readAt: now, collectionId },
      { userId, postId: archivedPost, archivedAt: now },
    ]);

    const ids = (state: "unread" | "read" | "archived" | "all") =>
      listSavedPosts(userId, undefined, state).then((r) => r.map((p) => p.id).sort());

    assert.deepEqual(await ids("unread"), [unreadPost]);
    assert.deepEqual(await ids("read"), [readPost]);
    assert.deepEqual(await ids("archived"), [archivedPost]);
    assert.deepEqual(
      await ids("all"),
      [unreadPost, readPost, archivedPost].sort(),
    );

    // collection + state must intersect: the collection holds only the read post.
    const inCollectionRead = await listSavedPosts(userId, collectionId, "read");
    assert.deepEqual(inCollectionRead.map((p) => p.id), [readPost]);
    const inCollectionUnread = await listSavedPosts(userId, collectionId, "unread");
    assert.equal(inCollectionUnread.length, 0);
  } finally {
    await db.delete(savedPosts).where(eq(savedPosts.userId, userId));
    await db.delete(collections).where(eq(collections.userId, userId));
    await db.delete(posts).where(inArray(posts.id, [unreadPost, readPost, archivedPost]));
    await db.delete(memberships).where(eq(memberships.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(user).where(eq(user.id, userId));
  }
});

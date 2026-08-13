import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { comments, groups, memberships, posts, user } from "@/db/schema";
import { listReplies, listRootComments } from "@/lib/queries/comments";

/**
 * The comment cursor pages one level at a time (roots, then a comment's direct children),
 * newest first. Same trap as the feed: the keyset must mirror the ORDER BY or paging
 * silently repeats or skips. Walk both levels end to end, and confirm reply counts and the
 * root/reply split are correct.
 */
test("root and reply paging returns each comment once; counts are direct-only", async () => {
  const suffix = randomUUID();
  const userId = `cmt-${suffix}`;
  const groupId = randomUUID();
  const postId = randomUUID();
  const rootIds = Array.from({ length: 5 }, () => randomUUID());
  const replyIds = Array.from({ length: 3 }, () => randomUUID());
  const grandchildId = randomUUID();
  const allIds = [...rootIds, ...replyIds, grandchildId];

  try {
    await db
      .insert(user)
      .values({ id: userId, name: "Cmt", email: `cmt-${suffix}@example.test` });
    await db.insert(groups).values({
      id: groupId,
      name: "Cmt group",
      slug: `cmt-group-${suffix}`,
      createdBy: userId,
    });
    await db.insert(memberships).values({ groupId, userId, role: "owner" });
    await db.insert(posts).values({
      id: postId,
      groupId,
      authorId: userId,
      title: "P",
      body: "B",
      status: "published",
    });

    const base = new Date("2026-02-01T00:00:00.000Z");
    // 5 roots (two share an instant → id tiebreak), 3 direct replies to root[0],
    // 1 grandchild under reply[0] (must NOT count toward root[0]'s direct replies).
    await db.insert(comments).values([
      ...rootIds.map((id, i) => ({
        id,
        postId,
        authorId: userId,
        body: `root ${i}`,
        parentId: null,
        createdAt: new Date(base.getTime() + Math.floor(i / 2) * 60_000),
      })),
      ...replyIds.map((id, i) => ({
        id,
        postId,
        authorId: userId,
        body: `reply ${i}`,
        parentId: rootIds[0],
        createdAt: new Date(base.getTime() + 600_000 + i * 60_000),
      })),
      {
        id: grandchildId,
        postId,
        authorId: userId,
        body: "grandchild",
        parentId: replyIds[0],
        createdAt: new Date(base.getTime() + 900_000),
      },
    ]);

    // Roots: page size 2 over 5 → three pages, cursor crossed repeatedly.
    const seenRoots: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10; page++) {
      const result = await listRootComments(postId, cursor, userId, 2);
      seenRoots.push(...result.items.map((c) => c.id));
      if (!result.hasMore) break;
      cursor = result.nextCursor;
      assert.ok(cursor, "roots: hasMore but nextCursor null");
    }
    assert.equal(seenRoots.length, rootIds.length, "every root once");
    assert.equal(new Set(seenRoots).size, rootIds.length, "no root repeated");

    // Newest first: the last-created root comes back first.
    const firstRootPage = await listRootComments(postId, null, userId, 50);
    assert.equal(firstRootPage.items[0].id, rootIds[4], "roots are newest-first");

    // Direct reply count is children-only: root[0] has 3 direct replies, the grandchild
    // does not count; reply[0] has 1 (the grandchild); other roots have 0.
    const root0 = firstRootPage.items.find((c) => c.id === rootIds[0]);
    assert.equal(root0?.replyCount, 3, "root[0] direct replies");
    assert.equal(
      firstRootPage.items.find((c) => c.id === rootIds[1])?.replyCount,
      0,
      "childless root reports 0",
    );

    // Replies of root[0]: page size 2 over 3 → cursor crossed.
    const seenReplies: string[] = [];
    cursor = null;
    for (let page = 0; page < 10; page++) {
      const result = await listReplies(postId, rootIds[0], cursor, userId, 2);
      seenReplies.push(...result.items.map((c) => c.id));
      if (!result.hasMore) break;
      cursor = result.nextCursor;
      assert.ok(cursor, "replies: hasMore but nextCursor null");
    }
    assert.equal(seenReplies.length, replyIds.length, "every reply once");
    assert.equal(new Set(seenReplies).size, replyIds.length, "no reply repeated");

    // A reply that itself has a child reports it.
    const replyPage = await listReplies(postId, rootIds[0], null, userId, 50);
    assert.equal(
      replyPage.items.find((c) => c.id === replyIds[0])?.replyCount,
      1,
      "reply[0] has one grandchild",
    );
  } finally {
    await db.delete(comments).where(inArray(comments.id, allIds));
    await db.delete(posts).where(eq(posts.id, postId));
    await db.delete(memberships).where(eq(memberships.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(user).where(eq(user.id, userId));
  }
});

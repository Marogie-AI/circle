import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groups, memberships, posts, user } from "@/db/schema";
import { getDrafts, getFeedPage, getPinnedPosts } from "@/lib/queries/feed";

/**
 * Drafts must never leak into the feed, pinned posts must surface in the strip, and a
 * member must only ever see their OWN drafts. These are the leak-safety invariants for
 * the drafts + pinned features.
 */
test("feed hides drafts; pinned + drafts queries are scoped correctly", async () => {
  const suffix = randomUUID();
  const authorId = `fs-author-${suffix}`;
  const otherId = `fs-other-${suffix}`;
  const groupId = randomUUID();
  const publishedId = randomUUID();
  const pinnedId = randomUUID();
  const draftId = randomUUID();
  const postIds = [publishedId, pinnedId, draftId];

  try {
    await db.insert(user).values([
      { id: authorId, name: "Author", email: `fs-a-${suffix}@example.test` },
      { id: otherId, name: "Other", email: `fs-o-${suffix}@example.test` },
    ]);
    await db.insert(groups).values({
      id: groupId,
      name: "Status group",
      slug: `fs-group-${suffix}`,
      createdBy: authorId,
    });
    await db.insert(memberships).values([
      { groupId, userId: authorId, role: "owner" },
      { groupId, userId: otherId, role: "member" },
    ]);

    await db.insert(posts).values([
      { id: publishedId, groupId, authorId, title: "Published", body: "b", status: "published" },
      {
        id: pinnedId,
        groupId,
        authorId,
        title: "Pinned",
        body: "b",
        status: "published",
        pinnedAt: new Date(),
      },
      { id: draftId, groupId, authorId, title: "Draft", body: "b", status: "draft" },
    ]);

    const feed = await getFeedPage({ groupId, limit: 50 });
    const feedIds = new Set(feed.items.map((item) => item.id));
    assert.ok(feedIds.has(publishedId), "published post must show in feed");
    assert.ok(feedIds.has(pinnedId), "pinned published post must show in feed");
    assert.ok(!feedIds.has(draftId), "draft must NOT show in feed");

    const pinned = await getPinnedPosts(groupId);
    assert.deepEqual(
      pinned.map((p) => p.id),
      [pinnedId],
      "only the pinned published post is returned",
    );

    const authorDrafts = await getDrafts(groupId, authorId);
    assert.deepEqual(authorDrafts.map((d) => d.id), [draftId]);

    const otherDrafts = await getDrafts(groupId, otherId);
    assert.equal(otherDrafts.length, 0, "a member never sees another member's drafts");
  } finally {
    await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(memberships).where(eq(memberships.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(user).where(inArray(user.id, [authorId, otherId]));
  }
});

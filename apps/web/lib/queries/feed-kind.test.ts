import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groups, memberships, posts, user } from "@/db/schema";
import { getFeedPage } from "@/lib/queries/feed";

/**
 * The kind filter narrows the feed, and it has to compose with the other filters rather
 * than replace them — a category plus an author must AND, not OR. The card also needs
 * `kind` and `url` to come back on every row, or every video renders as a plain card.
 */
test("kind filter narrows the feed, composes with author, and selects card fields", async () => {
  const suffix = randomUUID();
  const authorId = `fk-author-${suffix}`;
  const otherId = `fk-other-${suffix}`;
  const groupId = randomUUID();
  const videoId = randomUUID();
  const otherVideoId = randomUUID();
  const articleId = randomUUID();
  const noteId = randomUUID();
  const postIds = [videoId, otherVideoId, articleId, noteId];
  const watchUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  try {
    await db.insert(user).values([
      { id: authorId, name: "Author", email: `fk-a-${suffix}@example.test` },
      { id: otherId, name: "Other", email: `fk-o-${suffix}@example.test` },
    ]);
    await db.insert(groups).values({
      id: groupId,
      name: "Kind group",
      slug: `fk-group-${suffix}`,
      createdBy: authorId,
    });
    await db.insert(memberships).values([
      { groupId, userId: authorId, role: "owner" },
      { groupId, userId: otherId, role: "member" },
    ]);

    await db.insert(posts).values([
      { id: videoId, groupId, authorId, title: "A video", body: "b", kind: "video", url: watchUrl },
      { id: otherVideoId, groupId, authorId: otherId, title: "Their video", body: "b", kind: "video" },
      { id: articleId, groupId, authorId, title: "An article", body: "b", kind: "article" },
      // No kind given: the column default has to classify it as a note.
      { id: noteId, groupId, authorId, title: "A note", body: "b" },
    ]);

    const all = await getFeedPage({ groupId, limit: 50 });
    assert.equal(all.items.length, 4, "no filter returns every published post");

    const videos = await getFeedPage({ groupId, kind: "video", limit: 50 });
    assert.deepEqual(
      new Set(videos.items.map((item) => item.id)),
      new Set([videoId, otherVideoId]),
    );

    const notes = await getFeedPage({ groupId, kind: "note", limit: 50 });
    assert.deepEqual(
      notes.items.map((item) => item.id),
      [noteId],
      "a post inserted without a kind defaults to note",
    );

    // Two filters must intersect. If they OR'd, this would also return otherVideoId.
    const mine = await getFeedPage({ groupId, kind: "video", authorId, limit: 50 });
    assert.deepEqual(mine.items.map((item) => item.id), [videoId]);

    const [row] = mine.items;
    assert.equal(row.kind, "video", "the card needs kind to pick its icon and chip");
    assert.equal(row.url, watchUrl, "the card needs url to derive the video thumbnail");
  } finally {
    await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(memberships).where(eq(memberships.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(user).where(inArray(user.id, [authorId, otherId]));
  }
});

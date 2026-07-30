import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  groups,
  memberships,
  posts,
  savedPosts,
  user,
} from "@/db/schema";
import { listSavedPosts } from "@/lib/queries/saved";
import { searchGroupPosts } from "@/lib/queries/search";

test("a saved post disappears once the membership is gone", async () => {
  const suffix = randomUUID();
  const userId = `saved-${suffix}`;
  const groupId = randomUUID();
  const postId = randomUUID();

  try {
    await db.insert(user).values({
      id: userId,
      name: "Saver",
      email: `saved-${suffix}@example.test`,
    });
    await db.insert(groups).values({
      id: groupId,
      name: "Saved group",
      slug: `saved-group-${suffix}`,
      createdBy: userId,
    });
    await db.insert(memberships).values({ groupId, userId, role: "member" });
    await db.insert(posts).values({
      id: postId,
      groupId,
      authorId: userId,
      title: "Kept for later",
      body: "Something worth finding again.",
    });
    await db.insert(savedPosts).values({ userId, postId });

    const whileMember = await listSavedPosts(userId);
    assert.equal(whileMember.length, 1);
    assert.equal(whileMember[0].id, postId);

    // Leaving the group must hide it, even though the saved_posts row still exists.
    await db.delete(memberships).where(eq(memberships.groupId, groupId));

    const stillSaved = await db
      .select({ postId: savedPosts.postId })
      .from(savedPosts)
      .where(eq(savedPosts.userId, userId));
    assert.equal(stillSaved.length, 1, "the bookmark row itself should survive");

    const afterLeaving = await listSavedPosts(userId);
    assert.equal(
      afterLeaving.length,
      0,
      "a bookmark must not keep content visible after membership ends",
    );
  } finally {
    await db.delete(savedPosts).where(eq(savedPosts.userId, userId));
    await db.delete(posts).where(eq(posts.id, postId));
    await db.delete(memberships).where(eq(memberships.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(user).where(inArray(user.id, [userId]));
  }
});

test("search stays inside its group and survives junk input", async () => {
  const suffix = randomUUID();
  const userId = `search-${suffix}`;
  const mineId = randomUUID();
  const theirsId = randomUUID();
  const minePost = randomUUID();
  const theirPost = randomUUID();

  try {
    await db.insert(user).values({
      id: userId,
      name: "Searcher",
      email: `search-${suffix}@example.test`,
    });
    await db.insert(groups).values([
      { id: mineId, name: "Mine", slug: `mine-${suffix}`, createdBy: userId },
      { id: theirsId, name: "Theirs", slug: `theirs-${suffix}`, createdBy: userId },
    ]);
    await db.insert(posts).values([
      {
        id: minePost,
        groupId: mineId,
        authorId: userId,
        title: "Kubernetes autoscaling notes",
        body: "Notes about horizontal pod autoscaling behaviour.",
      },
      {
        id: theirPost,
        groupId: theirsId,
        authorId: userId,
        title: "Kubernetes autoscaling secrets",
        body: "Private to the other group entirely.",
      },
    ]);

    const hits = await searchGroupPosts({ groupId: mineId, query: "autoscaling" });
    assert.equal(hits.length, 1, "should match only this group's post");
    assert.equal(hits[0].id, minePost);
    assert.ok(!hits.some((h) => h.id === theirPost), "must never cross a group");

    // Matches the body, not just the title.
    const byBody = await searchGroupPosts({ groupId: mineId, query: "horizontal pod" });
    assert.equal(byBody.length, 1);

    // Punctuation that to_tsquery would choke on must return empty, not throw.
    for (const junk of ["'''", "&& || !!", " -- ", "((("]) {
      const junkHits = await searchGroupPosts({ groupId: mineId, query: junk });
      assert.equal(junkHits.length, 0, `junk query ${JSON.stringify(junk)} returned rows`);
    }
  } finally {
    await db.delete(posts).where(inArray(posts.id, [minePost, theirPost]));
    await db.delete(groups).where(inArray(groups.id, [mineId, theirsId]));
    await db.delete(user).where(eq(user.id, userId));
  }
});

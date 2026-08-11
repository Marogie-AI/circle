import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groups, posts, user } from "@/db/schema";
import { listTagFacets } from "@/lib/queries/groups";

/**
 * A draft's tags must NOT leak into the group's public tag-facet sidebar. Only published
 * posts contribute tags. This is the draft-tag-leak invariant fixed in the review commit.
 */
test("listTagFacets counts only published posts' tags; draft tags never leak", async () => {
  const suffix = randomUUID();
  const authorId = `tf-author-${suffix}`;
  const groupId = randomUUID();
  const publishedId = randomUUID();
  const draftId = randomUUID();
  const postIds = [publishedId, draftId];

  try {
    await db.insert(user).values({
      id: authorId,
      name: "Author",
      email: `tf-a-${suffix}@example.test`,
    });
    await db.insert(groups).values({
      id: groupId,
      name: "Tag group",
      slug: `tf-group-${suffix}`,
      createdBy: authorId,
    });

    await db.insert(posts).values([
      {
        id: publishedId,
        groupId,
        authorId,
        title: "Published",
        body: "b",
        status: "published",
        tags: ["shared", "public-only"],
      },
      {
        id: draftId,
        groupId,
        authorId,
        title: "Draft",
        body: "b",
        status: "draft",
        tags: ["shared", "draft-only"],
      },
    ]);

    const facets = await listTagFacets(groupId);
    const byTag = new Map(facets.map((f) => [f.tag, f.count]));

    assert.ok(
      !byTag.has("draft-only"),
      "a tag that exists only on a draft must NOT appear",
    );
    assert.equal(byTag.get("public-only"), 1, "published-only tag is counted once");
    assert.equal(
      byTag.get("shared"),
      1,
      "shared tag counts the published post only, not the draft",
    );
  } finally {
    await db.delete(posts).where(inArray(posts.id, postIds));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(user).where(eq(user.id, authorId));
  }
});

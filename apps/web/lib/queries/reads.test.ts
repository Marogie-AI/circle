import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groupReads, groups, memberships, posts, user } from "@/db/schema";
import { markGroupSeen, unreadCounts } from "@/lib/queries/reads";

/**
 * These pin the SEMANTICS of unread, not its speed. The query was rewritten from a
 * LEFT JOIN + GROUP BY into a CROSS JOIN LATERAL to remove a full table scan, and a
 * rewrite that returns different numbers would be worse than the slow version.
 */
test("unread counts survive the lateral rewrite", async () => {
  const suffix = randomUUID();
  const me = `unread-me-${suffix}`;
  const them = `unread-them-${suffix}`;
  const freshGroup = randomUUID();  // never opened
  const seenGroup = randomUUID();   // opened, then new posts arrive
  const quietGroup = randomUUID();  // opened, nothing new

  try {
    await db.insert(user).values([
      { id: me, name: "Me", email: `me-${suffix}@example.test` },
      { id: them, name: "Them", email: `them-${suffix}@example.test` },
    ]);
    await db.insert(groups).values([
      { id: freshGroup, name: "Fresh", slug: `fresh-${suffix}`, createdBy: me },
      { id: seenGroup, name: "Seen", slug: `seen-${suffix}`, createdBy: me },
      { id: quietGroup, name: "Quiet", slug: `quiet-${suffix}`, createdBy: me },
    ]);
    await db.insert(memberships).values([
      { groupId: freshGroup, userId: me, role: "member" },
      { groupId: seenGroup, userId: me, role: "member" },
      { groupId: quietGroup, userId: me, role: "member" },
    ]);

    const t = (offsetMs: number) => new Date(Date.now() + offsetMs);

    await db.insert(posts).values([
      // never-opened group: two by them, one by me
      { groupId: freshGroup, authorId: them, title: "A", body: "x", createdAt: t(-60_000) },
      { groupId: freshGroup, authorId: them, title: "B", body: "x", createdAt: t(-50_000) },
      { groupId: freshGroup, authorId: me,   title: "Mine", body: "x", createdAt: t(-40_000) },
      // quiet group: one old post by them, and we will mark it seen afterwards
      { groupId: quietGroup, authorId: them, title: "Old", body: "x", createdAt: t(-90_000) },
    ]);

    let counts = await unreadCounts(me);

    // 1. a group never opened counts every post that is not yours
    assert.equal(counts.get(freshGroup), 2, "never-opened group should count others' posts");

    // 2. your own posts are never unread to you (3 posts exist, only 2 counted above)

    // 3. a group with no posts at all is present with 0, not missing
    assert.equal(counts.get(seenGroup), 0, "empty group must be present with 0");

    // mark the quiet group read, then confirm the boundary
    await markGroupSeen(quietGroup, me);
    counts = await unreadCounts(me);
    assert.equal(counts.get(quietGroup), 0, "posts older than lastSeenAt must not count");

    // 4. a post AFTER lastSeenAt counts again
    await db.insert(posts).values({
      groupId: quietGroup,
      authorId: them,
      title: "Arrived after you looked",
      body: "x",
      createdAt: t(60_000),
    });
    counts = await unreadCounts(me);
    assert.equal(counts.get(quietGroup), 1, "a post after lastSeenAt must count");

    // 5. EVERY membership appears as a key, even at 0. This holds only because the
    //    lateral is a bare count(*) that always yields one row. Adding a GROUP BY inside
    //    it makes zero-unread groups disappear from the map, which empties the sidebar —
    //    mutation-verified: that change fails the "present with 0" assertion above.
    for (const [label, id] of [
      ["fresh", freshGroup],
      ["seen", seenGroup],
      ["quiet", quietGroup],
    ] as const) {
      assert.ok(counts.has(id), `${label} group must be present in the map even at 0`);
    }
    assert.equal(counts.size, 3);
  } finally {
    await db.delete(posts).where(
      inArray(posts.groupId, [freshGroup, seenGroup, quietGroup]),
    );
    await db.delete(groupReads).where(
      inArray(groupReads.groupId, [freshGroup, seenGroup, quietGroup]),
    );
    await db.delete(memberships).where(
      inArray(memberships.groupId, [freshGroup, seenGroup, quietGroup]),
    );
    await db.delete(groups).where(
      inArray(groups.id, [freshGroup, seenGroup, quietGroup]),
    );
    await db.delete(user).where(inArray(user.id, [me, them]));
  }
});

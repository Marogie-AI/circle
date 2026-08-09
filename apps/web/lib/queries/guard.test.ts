import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groups, memberships, posts, user } from "@/db/schema";
import { findMembership } from "@/lib/queries/membership";

test("membership lookup prevents cross-group access and writes", async () => {
  const suffix = randomUUID();
  const userAId = `guard-a-${suffix}`;
  const userBId = `guard-b-${suffix}`;
  const groupId = randomUUID();
  const postId = randomUUID();
  const slug = `guard-group-${suffix}`;

  try {
    await db.insert(user).values([
      {
        id: userAId,
        name: "Guard User A",
        email: `guard-a-${suffix}@example.test`,
      },
      {
        id: userBId,
        name: "Guard User B",
        email: `guard-b-${suffix}@example.test`,
      },
    ]);
    await db.insert(groups).values({
      id: groupId,
      name: "A's private group",
      slug,
      createdBy: userAId,
    });
    await db.insert(memberships).values({
      groupId,
      userId: userAId,
      role: "owner",
    });

    const membershipForA = await findMembership(slug, userAId);
    assert.ok(membershipForA);
    assert.equal(membershipForA.group.id, groupId);
    assert.equal(membershipForA.role, "owner");

    const membershipForB = await findMembership(slug, userBId);
    let crossGroupWriteConstructed = false;
    if (membershipForB) {
      crossGroupWriteConstructed = true;
      await db.insert(posts).values({
        id: postId,
        groupId: membershipForB.group.id,
        authorId: userBId,
        title: "Unauthorized post",
        body: "This insert must remain unreachable.",
      });
    }

    assert.equal(membershipForB, undefined);
    assert.equal(
      crossGroupWriteConstructed,
      false,
      "a non-member must never receive a group id for a write",
    );
  } finally {
    await db.delete(posts).where(eq(posts.id, postId));
    await db.delete(memberships).where(eq(memberships.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(user).where(inArray(user.id, [userAId, userBId]));
  }
});

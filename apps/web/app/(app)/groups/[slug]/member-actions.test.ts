import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groups, memberships, user } from "@/db/schema";

/**
 * The owner gate is only reachable through a request, so the session and the Next request
 * APIs are stubbed and everything below them — the membership join, the role comparison,
 * the last-owner lock — runs for real against the database. Stubbing the guard itself
 * would test nothing: the failure this pins is an owner-only action reachable by a member.
 */
let currentUserId = "";
mock.module("next/headers", () => ({ headers: async () => new Headers() }));
mock.module("next/cache", () => ({ revalidatePath: () => {} }));
mock.module("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: currentUserId } }) } },
}));

const { setMemberRole } = await import("@/app/(app)/groups/[slug]/member-actions");

test("a member cannot change roles in a group they do not own", async () => {
  const suffix = randomUUID();
  const ownerId = `owner-${suffix}`;
  const memberId = `member-${suffix}`;
  const groupId = randomUUID();
  const slug = `owner-gate-${suffix}`;

  try {
    await db.insert(user).values([
      { id: ownerId, name: "Owner", email: `owner-${suffix}@example.test` },
      { id: memberId, name: "Member", email: `member-${suffix}@example.test` },
    ]);
    await db
      .insert(groups)
      .values({ id: groupId, name: "Owner gate", slug, createdBy: ownerId });
    await db.insert(memberships).values([
      { groupId, userId: ownerId, role: "owner" },
      { groupId, userId: memberId, role: "member" },
    ]);

    currentUserId = memberId;
    await assert.rejects(
      () => setMemberRole(slug, memberId, "owner"),
      /Only an owner can manage members/,
    );

    const [afterAttempt] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(eq(memberships.userId, memberId));
    assert.equal(afterAttempt.role, "member", "the rejected call must not have written");

    // The same call from the owner proves the gate admits as well as rejects — a guard
    // that always throws would pass the assertion above.
    currentUserId = ownerId;
    await setMemberRole(slug, memberId, "owner");
    const [afterOwner] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(eq(memberships.userId, memberId));
    assert.equal(afterOwner.role, "owner");
  } finally {
    await db.delete(memberships).where(eq(memberships.groupId, groupId));
    await db.delete(groups).where(eq(groups.id, groupId));
    await db.delete(user).where(inArray(user.id, [ownerId, memberId]));
  }
});

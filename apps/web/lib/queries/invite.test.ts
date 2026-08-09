import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "bun:test";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { groups, invites, memberships, user } from "@/db/schema";
import { acceptInvite, findValidInvite } from "@/lib/queries/invite";

test("invite validity, idempotent acceptance, and scoped revocation", async () => {
  const suffix = randomUUID();
  const ownerId = `invite-owner-${suffix}`;
  const newMemberId = `invite-member-${suffix}`;
  const groupId = randomUUID();
  const otherGroupId = randomUUID();
  const freshToken = `fresh-${suffix}`;
  const expiredToken = `expired-${suffix}`;
  const revokedToken = `revoked-${suffix}`;

  try {
    await db.insert(user).values([
      {
        id: ownerId,
        name: "Invite Owner",
        email: `invite-owner-${suffix}@example.test`,
      },
      {
        id: newMemberId,
        name: "Invite Member",
        email: `invite-member-${suffix}@example.test`,
      },
    ]);
    await db.insert(groups).values([
      {
        id: groupId,
        name: "Invite group",
        slug: `invite-group-${suffix}`,
        createdBy: ownerId,
      },
      {
        id: otherGroupId,
        name: "Other group",
        slug: `other-invite-group-${suffix}`,
        createdBy: ownerId,
      },
    ]);
    await db.insert(invites).values([
      {
        token: freshToken,
        groupId,
        createdBy: ownerId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      {
        token: expiredToken,
        groupId,
        createdBy: ownerId,
        expiresAt: new Date(Date.now() - 60 * 1000),
      },
      {
        token: revokedToken,
        groupId,
        createdBy: ownerId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: new Date(),
      },
    ]);

    const freshInvite = await findValidInvite(freshToken);
    assert.ok(freshInvite);
    assert.equal(freshInvite.groupId, groupId);
    assert.equal(await findValidInvite(expiredToken), undefined);
    assert.equal(await findValidInvite(revokedToken), undefined);

    await acceptInvite(freshInvite.groupId, newMemberId);
    await acceptInvite(freshInvite.groupId, newMemberId);

    const [membershipTotal] = await db
      .select({ count: count() })
      .from(memberships)
      .where(
        and(
          eq(memberships.groupId, groupId),
          eq(memberships.userId, newMemberId),
        ),
      );
    assert.equal(membershipTotal.count, 1);

    const wrongGroupUpdate = await db
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invites.token, freshToken),
          eq(invites.groupId, otherGroupId),
        ),
      )
      .returning({ token: invites.token });
    assert.equal(wrongGroupUpdate.length, 0);

    const rightGroupUpdate = await db
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(invites.token, freshToken), eq(invites.groupId, groupId)),
      )
      .returning({ token: invites.token });
    assert.equal(rightGroupUpdate.length, 1);
  } finally {
    await db.delete(invites).where(eq(invites.groupId, groupId));
    await db
      .delete(memberships)
      .where(inArray(memberships.groupId, [groupId, otherGroupId]));
    await db
      .delete(groups)
      .where(inArray(groups.id, [groupId, otherGroupId]));
    await db.delete(user).where(inArray(user.id, [ownerId, newMemberId]));
  }
});

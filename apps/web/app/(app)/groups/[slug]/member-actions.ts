"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { groups, memberships } from "@/db/schema";
import { requireOwner } from "@/lib/guard";
import {
  invalidateGroupContent,
  invalidateGroupMembership,
} from "@/lib/cache-keys";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The last-owner invariant is enforced here, not in the UI: authz and the guard both
 * re-derive from the session, so a forged form post cannot demote/remove the sole owner
 * and leave the group ownerless. We only touch the passed userId AFTER confirming the
 * caller is an owner of the group the slug resolves to.
 */

const ownedGroup = async (slug: string) =>
  (await requireOwner(slug, "Only an owner can manage members.")).group;

/**
 * Lock this group's owner rows FOR UPDATE and reject if `userId` is the last one. Because
 * concurrent demote/remove calls serialize on the same locked rows, two owners can't both
 * observe the other as remaining and leave the group ownerless.
 */
async function assertNotLastOwner(tx: Tx, groupId: string, userId: string) {
  const owners = await tx
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.groupId, groupId), eq(memberships.role, "owner")))
    .for("update");

  const targetIsOwner = owners.some((o) => o.userId === userId);
  if (targetIsOwner && owners.length === 1) {
    throw new Error("This group must keep at least one owner.");
  }
}

export async function setMemberRole(
  slug: string,
  userId: string,
  role: "owner" | "member",
) {
  const group = await ownedGroup(slug);

  await db.transaction(async (tx) => {
    if (role === "member") {
      await assertNotLastOwner(tx, group.id, userId);
    }
    await tx
      .update(memberships)
      .set({ role })
      .where(
        and(eq(memberships.groupId, group.id), eq(memberships.userId, userId)),
      );
  });

  await invalidateGroupMembership(group.id, [userId]);
  revalidatePath(`/groups/${slug}/settings`);
}

export async function removeMember(slug: string, userId: string) {
  const group = await ownedGroup(slug);

  await db.transaction(async (tx) => {
    await assertNotLastOwner(tx, group.id, userId);
    await tx
      .delete(memberships)
      .where(
        and(eq(memberships.groupId, group.id), eq(memberships.userId, userId)),
      );
  });

  await invalidateGroupMembership(group.id, [userId]);
  revalidatePath(`/groups/${slug}/settings`);
}

export async function deleteGroup(slug: string) {
  const group = await ownedGroup(slug);

  const memberRows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.groupId, group.id));

  // groups cascades to memberships, invites, posts, etc.
  await db.delete(groups).where(eq(groups.id, group.id));

  await Promise.all([
    invalidateGroupMembership(
      group.id,
      memberRows.map((member) => member.userId),
    ),
    invalidateGroupContent(group.id),
  ]);

  redirect("/groups");
}

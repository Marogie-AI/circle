"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { groups, memberships } from "@/db/schema";
import { requireMember } from "@/lib/guard";

/**
 * The last-owner invariant is enforced here, not in the UI: authz and the guard both
 * re-derive from the session, so a forged form post cannot demote/remove the sole owner
 * and leave the group ownerless. We only touch the passed userId AFTER confirming the
 * caller is an owner of the group the slug resolves to.
 */

async function requireOwner(slug: string) {
  const { group, role } = await requireMember(slug);
  if (role !== "owner") {
    throw new Error("Only an owner can manage members.");
  }
  return group;
}

async function isSoleOwner(groupId: string, userId: string) {
  // Is `userId` an owner, and are there no OTHER owners? Cheap: count other owners.
  const [target] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.groupId, groupId), eq(memberships.userId, userId)))
    .limit(1);
  if (target?.role !== "owner") return false;

  const [{ others }] = await db
    .select({ others: count() })
    .from(memberships)
    .where(
      and(
        eq(memberships.groupId, groupId),
        eq(memberships.role, "owner"),
        ne(memberships.userId, userId),
      ),
    );
  return others === 0;
}

export async function setMemberRole(
  slug: string,
  userId: string,
  role: "owner" | "member",
) {
  const group = await requireOwner(slug);

  if (role === "member" && (await isSoleOwner(group.id, userId))) {
    throw new Error("This group must keep at least one owner.");
  }

  await db
    .update(memberships)
    .set({ role })
    .where(
      and(eq(memberships.groupId, group.id), eq(memberships.userId, userId)),
    );

  revalidatePath(`/groups/${slug}/settings`);
}

export async function removeMember(slug: string, userId: string) {
  const group = await requireOwner(slug);

  if (await isSoleOwner(group.id, userId)) {
    throw new Error("This group must keep at least one owner.");
  }

  await db
    .delete(memberships)
    .where(
      and(eq(memberships.groupId, group.id), eq(memberships.userId, userId)),
    );

  revalidatePath(`/groups/${slug}/settings`);
}

export async function deleteGroup(slug: string) {
  const group = await requireOwner(slug);

  // groups cascades to memberships, invites, posts, etc.
  await db.delete(groups).where(eq(groups.id, group.id));

  redirect("/groups");
}

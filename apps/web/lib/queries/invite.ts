import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { groups, invites, memberships } from "@/db/schema";
import { invalidateGroupMembership } from "@/lib/cache-keys";

export async function findValidInvite(token: string) {
  const [invite] = await db
    .select({
      token: invites.token,
      groupId: invites.groupId,
      group: groups,
    })
    .from(invites)
    .innerJoin(groups, eq(groups.id, invites.groupId))
    .where(
      and(
        eq(invites.token, token),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return invite;
}

export async function acceptInvite(groupId: string, userId: string) {
  await db
    .insert(memberships)
    .values({ groupId, userId, role: "member" })
    .onConflictDoNothing();
  await invalidateGroupMembership(groupId, [userId]);
}

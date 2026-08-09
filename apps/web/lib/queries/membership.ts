import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groups, memberships } from "@/db/schema";

export async function findMembership(slug: string, userId: string) {
  const [membership] = await db
    .select({
      group: groups,
      role: memberships.role,
    })
    .from(groups)
    .innerJoin(memberships, eq(memberships.groupId, groups.id))
    .where(
      and(eq(groups.slug, slug), eq(memberships.userId, userId)),
    )
    .limit(1);

  return membership;
}

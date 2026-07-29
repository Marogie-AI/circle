import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, memberships, posts } from "@/db/schema";

/** Groups the user belongs to, newest membership first. Served by memberships_user_id_idx. */
export async function listGroupsForUser(userId: string) {
  return db
    .select({
      id: groups.id,
      name: groups.name,
      slug: groups.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(groups, eq(groups.id, memberships.groupId))
    .where(eq(memberships.userId, userId))
    .orderBy(desc(memberships.joinedAt));
}

export type UserGroup = Awaited<ReturnType<typeof listGroupsForUser>>[number];

/** Member count for a group. Cheap: covered by the memberships primary key. */
export async function countMembers(groupId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memberships)
    .where(eq(memberships.groupId, groupId));
  return row?.count ?? 0;
}

/**
 * Tag facets for one group's sidebar, most used first.
 *
 * ponytail: unnest+GROUP BY scans this group's posts (index-scoped by group_id, so it
 * never touches another group's rows). Fine for a friends group; if a single group ever
 * reaches six figures of posts, replace with a `group_tags(group_id, tag, count)` table
 * maintained on post insert/update — same shape, no query change at the call site.
 */
export async function listTagFacets(groupId: string, limit = 12) {
  const result = await db.execute<{ tag: string; count: number }>(sql`
    SELECT unnest(${posts.tags}) AS tag, count(*)::int AS count
    FROM ${posts}
    WHERE ${posts.groupId} = ${groupId}
    GROUP BY 1
    ORDER BY count DESC, tag ASC
    LIMIT ${limit}
  `);
  return result.rows;
}

import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groups, memberships, posts, user } from "@/db/schema";
import { cached } from "@/lib/cache";
import { keys } from "@/lib/cache-keys";

/**
 * How many groups the sidebar shows, and therefore how many the unread query counts.
 *
 * MUST stay the single source for both. unreadCounts() does one index scan per group, so
 * an unbounded list is what turns that query from 0.9 ms into 400 ms for a pathological
 * membership count — and a sidebar listing hundreds of groups is useless anyway.
 * lib/queries/reads.ts imports this so the two can never disagree about which groups
 * are in play.
 */
export const SIDEBAR_GROUP_LIMIT = 50;

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
    .orderBy(desc(memberships.joinedAt))
    .limit(SIDEBAR_GROUP_LIMIT);
}

export type UserGroup = Awaited<ReturnType<typeof listGroupsForUser>>[number];

/**
 * Members of one group, join order. Feeds the author filter on the group page.
 * Covered by the memberships primary key (group_id, user_id).
 */
export async function listGroupMembers(groupId: string) {
  return cached(keys.groupMembers(groupId), 5 * 60, async () =>
    db
      .select({ id: user.id, name: user.name })
      .from(memberships)
      .innerJoin(user, eq(user.id, memberships.userId))
      .where(eq(memberships.groupId, groupId))
      .orderBy(asc(memberships.joinedAt))
      .limit(200),
  );
}

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
  const load = async () => {
    const result = await db.execute<{ tag: string; count: number }>(sql`
      SELECT unnest(${posts.tags}) AS tag, count(*)::int AS count
      FROM ${posts}
      WHERE ${posts.groupId} = ${groupId} AND ${posts.status} = 'published'
      GROUP BY 1
      ORDER BY count DESC, tag ASC
      LIMIT ${limit}
    `);
    return result.rows;
  };

  // The key intentionally represents the one product query. Tests and future admin
  // callers can request another limit without poisoning that shared value.
  return limit === 12 ? cached(keys.groupTags(groupId), 2 * 60, load) : load();
}

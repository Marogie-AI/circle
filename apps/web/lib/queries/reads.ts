import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupReads } from "@/db/schema";
import { SIDEBAR_GROUP_LIMIT } from "@/lib/queries/groups";

/**
 * Unread counts for every group the user belongs to, in one query.
 *
 * CROSS JOIN LATERAL, not a plain LEFT JOIN onto posts. That distinction is the whole
 * performance story here:
 *
 *   LEFT JOIN posts ... GROUP BY  ->  Seq Scan on posts (100,014 rows), 46-112 ms
 *   CROSS JOIN LATERAL (count)    ->  one index range scan per group, sub-millisecond
 *
 * With the join form the planner cannot push group_id into an index — it hash-joins the
 * entire posts table and aggregates afterwards, so the cost grows with TOTAL posts in
 * the product rather than with anything about this user. The lateral makes the count a
 * correlated subquery per membership row, which uses
 * posts(group_id, created_at desc, id desc) — the index the feed already relies on.
 *
 * What DOES matter for correctness is that the lateral subquery always yields exactly one
 * row: a bare count(*) with no GROUP BY does, so every group the user belongs to appears
 * in the result — including with 0. Add a GROUP BY in there, or rewrite it to select rows
 * instead of a count, and zero-unread groups would silently disappear from the map, which
 * empties the sidebar. (CROSS vs INNER ... ON true is only style; both keep the 0 rows.)
 */
export async function unreadCounts(userId: string): Promise<Map<string, number>> {
  const result = await db.execute<{ groupId: string; unread: number }>(sql`
    SELECT m.group_id AS "groupId", u.unread
    FROM (
      -- bounded to the same groups the sidebar renders: one index scan per group means
      -- an unbounded membership list is what makes the lateral expensive (400 ms at 1000
      -- groups vs 6.9 ms at 50)
      SELECT group_id, user_id
      FROM memberships
      WHERE user_id = ${userId}
      ORDER BY joined_at DESC
      LIMIT ${SIDEBAR_GROUP_LIMIT}
    ) m
    LEFT JOIN group_reads r
      ON r.group_id = m.group_id AND r.user_id = m.user_id
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS unread
      FROM posts p
      WHERE p.group_id = m.group_id
        AND p.created_at > coalesce(r.last_seen_at, 'epoch'::timestamp)
        AND p.status = 'published'
        -- your own posts are never "unread" to you
        AND p.author_id <> m.user_id
    ) u
  `);

  return new Map(result.rows.map((row) => [row.groupId, row.unread]));
}

/** When the user last opened this group, or null if never. */
export async function getLastSeen(groupId: string, userId: string) {
  const [row] = await db
    .select({ lastSeenAt: groupReads.lastSeenAt })
    .from(groupReads)
    .where(and(eq(groupReads.groupId, groupId), eq(groupReads.userId, userId)))
    .limit(1);
  return row?.lastSeenAt ?? null;
}

export async function markGroupSeen(groupId: string, userId: string) {
  await db
    .insert(groupReads)
    .values({ groupId, userId, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: [groupReads.groupId, groupReads.userId],
      set: { lastSeenAt: new Date() },
    });
}

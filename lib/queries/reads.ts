import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupReads } from "@/db/schema";

/**
 * Unread counts for every group the user belongs to, in ONE query.
 *
 * A group never seen before counts all its posts. The per-group count is a range scan
 * on posts(group_id, created_at desc, id desc) — the same index the feed already uses,
 * so this adds an index lookup per group rather than a table scan.
 */
export async function unreadCounts(userId: string): Promise<Map<string, number>> {
  const result = await db.execute<{ groupId: string; unread: number }>(sql`
    SELECT m.group_id AS "groupId",
           count(p.id)::int AS unread
    FROM memberships m
    LEFT JOIN group_reads r
      ON r.group_id = m.group_id AND r.user_id = m.user_id
    LEFT JOIN posts p
      ON p.group_id = m.group_id
     AND p.created_at > coalesce(r.last_seen_at, 'epoch'::timestamp)
     -- your own posts are never "unread" to you
     AND p.author_id <> m.user_id
    WHERE m.user_id = ${userId}
    GROUP BY m.group_id
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

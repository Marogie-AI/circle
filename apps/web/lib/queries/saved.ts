import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { collections, savedPosts } from "@/db/schema";

export type SavedPost = {
  id: string;
  title: string;
  tags: string[];
  createdAt: Date;
  savedAt: Date;
  authorName: string;
  groupSlug: string;
  groupName: string;
  ogImage: string | null;
  ogSite: string | null;
  collectionId: string | null;
  readAt: Date | null;
  archivedAt: Date | null;
};

export const SAVED_STATES = ["unread", "read", "archived", "all"] as const;
export type SavedState = (typeof SAVED_STATES)[number];

/** Never trust the URL — anything unknown falls back to the default queue view. */
export function parseSavedState(value: string | null | undefined): SavedState {
  return SAVED_STATES.includes(value as SavedState)
    ? (value as SavedState)
    : "unread";
}

/** A user's collections with how many saved posts are filed in each. */
export async function listCollections(userId: string) {
  return db
    .select({
      id: collections.id,
      name: collections.name,
      count: sql<number>`count(${savedPosts.postId})::int`,
    })
    .from(collections)
    .leftJoin(
      savedPosts,
      and(
        eq(savedPosts.collectionId, collections.id),
        eq(savedPosts.userId, userId),
      ),
    )
    .where(and(eq(collections.userId, userId), isNull(collections.groupId)))
    .groupBy(collections.id, collections.name, collections.createdAt)
    .orderBy(desc(collections.createdAt));
}

/**
 * The caller's saved posts, newest save first.
 *
 * SECURITY: this joins memberships, not just saved_posts -> posts. A saved_posts row
 * outlives the membership that made the post visible, so joining only to posts would
 * keep showing content from a group the user has left or been removed from. The
 * membership join is the authorization check, and lib/queries/saved.test.ts pins it.
 */
export async function listSavedPosts(
  userId: string,
  collectionId?: string,
  state: SavedState = "unread",
): Promise<SavedPost[]> {
  const statePredicate =
    state === "unread"
      ? sql`AND s.archived_at IS NULL AND s.read_at IS NULL`
      : state === "read"
        ? sql`AND s.archived_at IS NULL AND s.read_at IS NOT NULL`
        : state === "archived"
          ? sql`AND s.archived_at IS NOT NULL`
          : sql``;

  const result = await db.execute<SavedPost>(sql`
    SELECT p.id,
           p.title,
           p.tags,
           p.created_at   AS "createdAt",
           s.created_at   AS "savedAt",
           u.name         AS "authorName",
           g.slug         AS "groupSlug",
           g.name         AS "groupName",
           p.og_image     AS "ogImage",
           p.og_site      AS "ogSite",
           s.collection_id AS "collectionId",
           s.read_at       AS "readAt",
           s.archived_at   AS "archivedAt"
    FROM saved_posts s
    JOIN posts p       ON p.id = s.post_id
    JOIN groups g      ON g.id = p.group_id
    JOIN "user" u      ON u.id = p.author_id
    JOIN memberships m ON m.group_id = p.group_id AND m.user_id = ${userId}
    LEFT JOIN collections c ON c.id = s.collection_id
    WHERE s.user_id = ${userId}
      AND p.status = 'published'
      AND (s.collection_id IS NULL OR (c.user_id = ${userId} AND c.group_id IS NULL))
      ${collectionId ? sql`AND s.collection_id = ${collectionId}` : sql``}
      ${statePredicate}
    ORDER BY s.created_at DESC
    LIMIT 200
  `);

  // db.execute returns driver rows verbatim — Drizzle's column mapping does not run on
  // raw SQL, so these timestamps arrive as strings even though the row type says Date.
  // Coerce here, once, rather than making every caller remember to.
  return result.rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt),
    savedAt: new Date(row.savedAt),
    readAt: row.readAt ? new Date(row.readAt) : null,
    archivedAt: row.archivedAt ? new Date(row.archivedAt) : null,
  }));
}

/** Unread, non-archived saved count — membership-joined, for a possible sidebar badge. */
export async function countUnreadSavedPosts(userId: string) {
  const result = await db.execute<{ count: number }>(sql`
    SELECT count(*)::int AS "count"
    FROM saved_posts s
    JOIN posts p       ON p.id = s.post_id
    JOIN memberships m ON m.group_id = p.group_id AND m.user_id = ${userId}
    LEFT JOIN collections c ON c.id = s.collection_id
    WHERE s.user_id = ${userId}
      AND p.status = 'published'
      AND (s.collection_id IS NULL OR (c.user_id = ${userId} AND c.group_id IS NULL))
      AND s.archived_at IS NULL
      AND s.read_at IS NULL
  `);
  return result.rows[0]?.count ?? 0;
}

/** Which of these post ids the user has saved — one query for a whole feed page. */
export async function savedIdsFor(userId: string, postIds: string[]) {
  if (postIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ postId: savedPosts.postId })
    .from(savedPosts)
    .where(and(eq(savedPosts.userId, userId), inArray(savedPosts.postId, postIds)));
  return new Set(rows.map((row) => row.postId));
}

export async function isSaved(userId: string, postId: string) {
  const [row] = await db
    .select({ postId: savedPosts.postId })
    .from(savedPosts)
    .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)))
    .limit(1);
  return Boolean(row);
}

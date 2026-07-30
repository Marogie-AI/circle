import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { savedPosts } from "@/db/schema";

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
};

/**
 * The caller's saved posts, newest save first.
 *
 * SECURITY: this joins memberships, not just saved_posts -> posts. A saved_posts row
 * outlives the membership that made the post visible, so joining only to posts would
 * keep showing content from a group the user has left or been removed from. The
 * membership join is the authorization check, and lib/queries/saved.test.ts pins it.
 */
export async function listSavedPosts(userId: string): Promise<SavedPost[]> {
  const result = await db.execute<SavedPost>(sql`
    SELECT p.id,
           p.title,
           p.tags,
           p.created_at AS "createdAt",
           s.created_at AS "savedAt",
           u.name       AS "authorName",
           g.slug       AS "groupSlug",
           g.name       AS "groupName",
           p.og_image   AS "ogImage",
           p.og_site    AS "ogSite"
    FROM saved_posts s
    JOIN posts p       ON p.id = s.post_id
    JOIN groups g      ON g.id = p.group_id
    JOIN "user" u      ON u.id = p.author_id
    JOIN memberships m ON m.group_id = p.group_id AND m.user_id = ${userId}
    WHERE s.user_id = ${userId}
    ORDER BY s.created_at DESC
    LIMIT 200
  `);
  return result.rows;
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

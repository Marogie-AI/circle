import { sql } from "drizzle-orm";
import { db } from "@/db";

export type SearchHit = {
  id: string;
  groupId: string;
  groupSlug: string;
  groupName: string;
  title: string;
  snippet: string;
  tags: string[];
  createdAt: Date;
  authorName: string;
};

/**
 * Full-text search over a group's posts.
 *
 * websearch_to_tsquery, NOT to_tsquery: it takes human input ("postgres -index",
 * quotes, stray punctuation) and never throws, where to_tsquery raises a syntax error
 * on anything unbalanced — i.e. on ordinary typing.
 *
 * groupId is ALWAYS AND-ed in, so a search can never surface another group's posts.
 */
export async function searchGroupPosts({
  groupId,
  query,
  limit = 30,
}: {
  groupId: string;
  query: string;
  limit?: number;
}): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const result = await db.execute<SearchHit>(sql`
    SELECT p.id,
           p.group_id           AS "groupId",
           g.slug               AS "groupSlug",
           g.name               AS "groupName",
           p.title,
           ts_headline('english', p.body, websearch_to_tsquery('english', ${trimmed}),
                       'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MaxWords=24,MinWords=8')
                                AS snippet,
           p.tags,
           p.created_at         AS "createdAt",
           u.name               AS "authorName"
    FROM posts p
    JOIN groups g ON g.id = p.group_id
    JOIN "user" u ON u.id = p.author_id
    WHERE p.group_id = ${groupId}
      AND p.search_vector @@ websearch_to_tsquery('english', ${trimmed})
    ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('english', ${trimmed})) DESC,
             p.created_at DESC,
             p.id DESC
    LIMIT ${limit}
  `);

  return result.rows;
}

/** Cross-group search for the command palette: only groups the caller belongs to. */
export async function searchMyPosts({
  userId,
  query,
  limit = 8,
}: {
  userId: string;
  query: string;
  limit?: number;
}): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const result = await db.execute<SearchHit>(sql`
    SELECT p.id,
           p.group_id   AS "groupId",
           g.slug       AS "groupSlug",
           g.name       AS "groupName",
           p.title,
           ''           AS snippet,
           p.tags,
           p.created_at AS "createdAt",
           u.name       AS "authorName"
    FROM posts p
    JOIN groups g ON g.id = p.group_id
    JOIN "user" u ON u.id = p.author_id
    -- the membership join IS the authorization: no row, no result
    JOIN memberships m ON m.group_id = p.group_id AND m.user_id = ${userId}
    WHERE p.search_vector @@ websearch_to_tsquery('english', ${trimmed})
    ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('english', ${trimmed})) DESC,
             p.created_at DESC
    LIMIT ${limit}
  `);

  return result.rows;
}

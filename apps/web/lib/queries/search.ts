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
 * Search over a group's posts: full-text OR a literal title match.
 *
 * websearch_to_tsquery, NOT to_tsquery: it takes human input ("postgres -index",
 * quotes, stray punctuation) and never throws, where to_tsquery raises a syntax error
 * on anything unbalanced — i.e. on ordinary typing.
 *
 * The ILIKE arm exists because full-text alone loses two very ordinary searches:
 * stopwords ("the un" reduces to nothing, since `the` is dropped) and partial words
 * (`un` is not the lexeme `unreasonable`, so it never matches). Typing half a title
 * and getting "No results" reads as a broken search box.
 *
 * That ILIKE arm used to make this query unindexable, and it was worse than "scans the
 * group's titles": a leading wildcard cannot use a btree, and ONE unindexable arm of an
 * OR forces a sequential scan of the whole predicate — so posts_search_idx, though
 * perfectly good, was never reached at all. Measured on a 50k-post group: 122 ms of
 * parallel seq scan for a term with no matches, against 0.6 ms for the tsquery arm alone.
 *
 * posts_title_trgm_idx (migration 0005) fixes it without touching this query: the planner
 * can now BitmapOr the two GIN indexes together. Same case, 0.25 ms.
 *
 * Keep both arms AND both indexes. Dropping either arm loses real searches; dropping the
 * trigram index silently restores the seq scan, and nothing here will look different.
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
      AND p.status = 'published'
      AND (
        p.search_vector @@ websearch_to_tsquery('english', ${trimmed})
        OR p.title ILIKE ${`%${trimmed}%`}
      )
    ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('english', ${trimmed})) DESC,
             p.created_at DESC,
             p.id DESC
    LIMIT ${limit}
  `);

  // Raw SQL: Drizzle does not map columns, so created_at arrives as a string.
  return result.rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt) }));
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
    -- Same OR-ILIKE arm as searchGroupPosts: the palette is type-ahead, so partial
    -- words are the norm, and full-text alone would show nothing until you finish one.
    WHERE p.status = 'published'
      AND (
        p.search_vector @@ websearch_to_tsquery('english', ${trimmed})
        OR p.title ILIKE ${`%${trimmed}%`}
      )
    ORDER BY ts_rank(p.search_vector, websearch_to_tsquery('english', ${trimmed})) DESC,
             p.created_at DESC
    LIMIT ${limit}
  `);

  // Raw SQL: Drizzle does not map columns, so created_at arrives as a string.
  return result.rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt) }));
}

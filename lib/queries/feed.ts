import {
  and,
  arrayContains,
  desc,
  eq,
  lt,
  sql,
  or,
} from "drizzle-orm";
import { db } from "@/db";
import {
  comments,
  posts,
  reactions,
  user,
} from "@/db/schema";

export type FeedCursor = {
  createdAt: Date;
  id: string;
};

export function encodeFeedCursor(cursor: FeedCursor) {
  return `${cursor.createdAt.toISOString()}_${cursor.id}`;
}

export function parseFeedCursor(value: string | null | undefined) {
  if (!value) return null;

  const separator = value.indexOf("_");
  if (separator === -1) return null;

  const datePart = value.slice(0, separator);
  const id = value.slice(separator + 1);
  const createdAt = new Date(datePart);
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    Number.isNaN(createdAt.getTime()) ||
    createdAt.toISOString() !== datePart ||
    !uuidPattern.test(id)
  ) {
    return null;
  }

  return { createdAt, id };
}

type GetFeedPageOptions = {
  groupId: string;
  tag?: string | null;
  cursor?: string | null;
  limit?: number;
};

export async function getFeedPage({
  groupId,
  tag,
  cursor,
  limit = 30,
}: GetFeedPageOptions) {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const parsedCursor = parseFeedCursor(cursor);
  const cursorPredicate = parsedCursor
    ? or(
        lt(posts.createdAt, parsedCursor.createdAt),
        and(
          eq(posts.createdAt, parsedCursor.createdAt),
          lt(posts.id, parsedCursor.id),
        ),
      )
    : undefined;

  // Counts as correlated subqueries rather than two follow-up queries. Each count query
  // measured only 0.08 ms, so this is not about CPU — it is about round-trips: three
  // sequential trips became one, which is what actually costs on a networked database.
  // Bounded by the LIMIT below, so at most safeLimit+1 index lookups per side.
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      tags: posts.tags,
      createdAt: posts.createdAt,
      authorName: user.name,
      ogImage: posts.ogImage,
      commentCount: sql<number>`(
        SELECT count(*)::int FROM ${comments} WHERE ${comments.postId} = ${posts.id}
      )`.as("comment_count"),
      reactionCount: sql<number>`(
        SELECT count(*)::int FROM ${reactions} WHERE ${reactions.postId} = ${posts.id}
      )`.as("reaction_count"),
    })
    .from(posts)
    .innerJoin(user, eq(user.id, posts.authorId))
    .where(
      and(
        eq(posts.groupId, groupId),
        tag ? arrayContains(posts.tags, [tag]) : undefined,
        cursorPredicate,
      ),
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(safeLimit + 1);

  const hasMore = rows.length > safeLimit;
  const items = rows.slice(0, safeLimit);
  const last = items.at(-1);

  return {
    items,
    hasMore,
    nextCursor:
      hasMore && last
        ? encodeFeedCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}

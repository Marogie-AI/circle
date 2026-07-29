import {
  and,
  arrayContains,
  count,
  desc,
  eq,
  inArray,
  lt,
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

  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      tags: posts.tags,
      createdAt: posts.createdAt,
      authorName: user.name,
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
  const pageRows = rows.slice(0, safeLimit);
  const postIds = pageRows.map((post) => post.id);
  const [commentTotals, reactionTotals] = postIds.length
    ? await Promise.all([
        db
          .select({ postId: comments.postId, count: count() })
          .from(comments)
          .where(inArray(comments.postId, postIds))
          .groupBy(comments.postId),
        db
          .select({ postId: reactions.postId, count: count() })
          .from(reactions)
          .where(inArray(reactions.postId, postIds))
          .groupBy(reactions.postId),
      ])
    : [[], []];
  const commentsByPost = new Map(
    commentTotals.map((total) => [total.postId, total.count]),
  );
  const reactionsByPost = new Map(
    reactionTotals.map((total) => [total.postId, total.count]),
  );
  const items = pageRows.map((post) => ({
    ...post,
    commentCount: commentsByPost.get(post.id) ?? 0,
    reactionCount: reactionsByPost.get(post.id) ?? 0,
  }));
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

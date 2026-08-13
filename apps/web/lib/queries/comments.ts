import {
  and,
  countDistinct,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { commentReactions, comments, user as users } from "@/db/schema";
import {
  encodeFeedCursor,
  type FeedCursor,
  parseFeedCursor,
} from "@/lib/queries/feed";
import { LIKE_EMOJI } from "@/lib/post";

/**
 * One node in a comment thread, fully hydrated for render: base fields plus the viewer's
 * like state, the like count, and the number of *direct* replies (drives "View N replies").
 * The tree itself is never fetched whole — a page is one flat, indexed keyset query, and a
 * comment's children are loaded lazily when the viewer expands it.
 */
export type ThreadComment = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
  parentId: string | null;
  likeCount: number;
  liked: boolean;
  replyCount: number;
};

export type CommentPage = {
  items: ThreadComment[];
  nextCursor: string | null;
  hasMore: boolean;
};

/** Roots default to a larger page than nested replies (replies are opened deliberately). */
export const ROOT_PAGE_SIZE = 20;
export const REPLY_PAGE_SIZE = 10;

/**
 * Counts and viewer-like state for a bounded set of just-loaded comment ids. Scoped to those
 * ids (never the whole post) so the batch stays O(page) as a thread grows: three grouped
 * queries, one round-trip each. Returns lookups keyed by comment id.
 */
async function batchCommentMeta(commentIds: string[], viewerId: string) {
  if (commentIds.length === 0) {
    return { likeCount: new Map(), liked: new Set(), replyCount: new Map() } as const;
  }

  const [likeRows, mineRows, replyRows] = await Promise.all([
    // One like per member per comment — countDistinct on the user, matching post reactions.
    db
      .select({
        commentId: commentReactions.commentId,
        n: countDistinct(commentReactions.userId),
      })
      .from(commentReactions)
      .where(inArray(commentReactions.commentId, commentIds))
      .groupBy(commentReactions.commentId),
    db
      .select({ commentId: commentReactions.commentId })
      .from(commentReactions)
      .where(
        and(
          inArray(commentReactions.commentId, commentIds),
          eq(commentReactions.userId, viewerId),
        ),
      ),
    // Direct-child counts: how many replies each loaded comment has.
    db
      .select({ parentId: comments.parentId, n: sql<number>`count(*)::int` })
      .from(comments)
      .where(inArray(comments.parentId, commentIds))
      .groupBy(comments.parentId),
  ]);

  const likeCount = new Map(likeRows.map((r) => [r.commentId, Number(r.n)]));
  const liked = new Set(mineRows.map((r) => r.commentId));
  const replyCount = new Map(
    replyRows.map((r) => [r.parentId as string, Number(r.n)]),
  );
  return { likeCount, liked, replyCount } as const;
}

/** Hydrate base rows with meta into ThreadComments. */
function hydrate(
  rows: {
    id: string;
    body: string;
    createdAt: Date;
    authorId: string;
    authorName: string | null;
    parentId: string | null;
  }[],
  meta: Awaited<ReturnType<typeof batchCommentMeta>>,
): ThreadComment[] {
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    authorId: r.authorId,
    authorName: r.authorName ?? "Unknown",
    parentId: r.parentId,
    likeCount: meta.likeCount.get(r.id) ?? 0,
    liked: meta.liked.has(r.id),
    replyCount: meta.replyCount.get(r.id) ?? 0,
  }));
}

/**
 * A keyset page of comments at one level, **newest first**. `parentId === null` selects
 * roots; otherwise a specific comment's direct children. Newest-first means a just-posted
 * comment lands at the top of page one, so the client can optimistically prepend it with no
 * ordering games. The keyset predicate MUST mirror the ORDER BY (createdAt desc, id desc) or
 * paging silently repeats or skips — same rule as the feed.
 */
async function listLevel(
  postId: string,
  parentId: string | null,
  cursor: string | null | undefined,
  viewerId: string,
  limit: number,
): Promise<CommentPage> {
  const parsed = parseFeedCursor(cursor);
  const cursorPredicate = parsed
    ? or(
        lt(comments.createdAt, parsed.createdAt),
        and(eq(comments.createdAt, parsed.createdAt), lt(comments.id, parsed.id)),
      )
    : undefined;

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      authorId: comments.authorId,
      authorName: users.name,
      parentId: comments.parentId,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(
      and(
        eq(comments.postId, postId),
        parentId === null
          ? isNull(comments.parentId)
          : eq(comments.parentId, parentId),
        cursorPredicate,
      ),
    )
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const meta = await batchCommentMeta(
    slice.map((r) => r.id),
    viewerId,
  );
  const items = hydrate(slice, meta);
  const last = items.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeFeedCursor({ createdAt: last.createdAt, id: last.id } as FeedCursor)
      : null;
  return { items, nextCursor, hasMore };
}

export function listRootComments(
  postId: string,
  cursor: string | null | undefined,
  viewerId: string,
  limit = ROOT_PAGE_SIZE,
) {
  return listLevel(postId, null, cursor, viewerId, limit);
}

export function listReplies(
  postId: string,
  parentId: string,
  cursor: string | null | undefined,
  viewerId: string,
  limit = REPLY_PAGE_SIZE,
) {
  return listLevel(postId, parentId, cursor, viewerId, limit);
}

// LIKE_EMOJI re-exported so callers building optimistic UI share the one glyph.
export { LIKE_EMOJI };

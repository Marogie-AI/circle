"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addComment,
  deleteComment,
  loadReplies,
  toggleCommentReaction,
} from "@/app/(app)/groups/[slug]/actions";
import { Avatar } from "@/components/avatar";
import { ChevronDownIcon, ReactionIcon } from "@/components/icons";
import { MentionText } from "@/components/mention-text";
import { PostActionsMenu } from "@/components/post-actions-menu";
import { ReplyComposer } from "@/components/reply-composer";
import { LIKE_EMOJI } from "@/lib/post";
import type { Mentionable } from "@/lib/mentions";
import type { CommentPage, ThreadComment } from "@/lib/queries/comments";

function fullDate(date: Date) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type Props = {
  slug: string;
  postId: string;
  comment: ThreadComment;
  members: Mentionable[];
  viewerId: string;
  isOwner: boolean;
  depth: number;
  /** Called after this node is deleted so the parent drops it and fixes its count. */
  onRemoved?: () => void;
  /** Auto-load and expand on mount — set on descendants so expanding a root opens the
   *  whole thread in one click instead of level by level. */
  autoOpen?: boolean;
};

/**
 * One comment plus its lazily-loaded reply subtree, rendered as a threaded rail: the avatar
 * sits in a left column with a connector line running down past its replies. Recursion is in
 * the component tree, not in data fetching — a node fetches its direct children only when
 * expanded, one keyset page at a time, so an arbitrarily deep thread never loads more than
 * the viewer opens.
 */
export function CommentThread({
  slug,
  postId,
  comment,
  members,
  viewerId,
  isOwner,
  depth,
  onRemoved,
  autoOpen,
}: Props) {
  const [replyCount, setReplyCount] = useState(comment.replyCount);
  const [children, setChildren] = useState<ThreadComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const [deleted, setDeleted] = useState(false);
  // Like state is owned here, not derived from props: the comment data is client-held
  // (loaded per page), so the server action's revalidate can't feed a fresh `liked` back in.
  // An optimistic hook seeded from a never-changing prop would just snap back — the bug.
  const [liked, setLiked] = useState(comment.liked);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [pending, startTransition] = useTransition();
  const [, startLike] = useTransition();

  const canManage = isOwner || comment.authorId === viewerId;

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    startLike(async () => {
      try {
        await toggleCommentReaction(slug, postId, comment.id, LIKE_EMOJI);
      } catch {
        // Roll the optimistic change back if the write failed.
        setLiked(!next);
        setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)));
      }
    });
  };

  const appendPage = (page: CommentPage) => {
    setChildren((prev) => {
      const seen = new Set(prev.map((c) => c.id));
      return [...prev, ...page.items.filter((c) => !seen.has(c.id))];
    });
    setCursor(page.nextCursor);
    setHasMore(page.hasMore);
    setExpanded(true);
  };

  const loadMore = () =>
    startTransition(async () => {
      appendPage(await loadReplies(slug, postId, comment.id, cursor));
    });

  // Descendants of a freshly-expanded node open themselves, so one click on an ancestor
  // cascades the whole subtree open instead of level-by-level. Runs once when autoOpen flips
  // true (on mount for descendants); the other values are read, not depended on.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-once trigger
  useEffect(() => {
    if (autoOpen && replyCount > 0 && !expanded && children.length === 0) loadMore();
  }, [autoOpen]);

  // View / collapse toggle. Re-expanding an already-loaded thread is free (no refetch); the
  // first open fetches page one.
  const toggleReplies = () => {
    if (expanded) {
      setExpanded(false);
    } else if (children.length > 0) {
      setExpanded(true);
    } else {
      loadMore();
    }
  };

  const onReplied = (created: ThreadComment) => {
    setReplyCount((n) => n + 1);
    if (expanded) setChildren((prev) => [created, ...prev]);
  };

  const replyWord = (n: number) => (n === 1 ? "reply" : "replies");
  const showChildren = expanded && children.length > 0;

  if (deleted) return null;

  return (
    <div className="pt-3">
      <div className="flex gap-2">
        {/* Left rail: avatar, then a connector line down past the replies so each reply
            visibly hangs off the comment it belongs to. */}
        <div className="flex flex-col items-center">
          <Avatar name={comment.authorName} size="xs" />
          {showChildren ? (
            <span className="mt-1 w-px flex-1 rounded-full bg-muted/25" />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 pb-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-xs text-faint">
              <span className="font-semibold text-ink">{comment.authorName}</span>{" "}
              · {fullDate(comment.createdAt)}
            </p>
            {canManage ? (
              <PostActionsMenu
                deleteLabel="Delete comment"
                confirmText="Delete this comment? Its replies go with it."
                onDelete={async () => {
                  await deleteComment(slug, postId, comment.id);
                  setDeleted(true);
                  onRemoved?.();
                }}
              />
            ) : null}
          </div>

          <MentionText
            text={comment.body}
            members={members}
            className="mt-0.5 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-ink"
          />

          <div className="mt-1 flex items-center gap-3 text-xs font-medium text-faint">
            <button
              type="button"
              onClick={toggleLike}
              aria-pressed={liked}
              aria-label={liked ? "Remove your like" : "Like this comment"}
              className={`flex items-center gap-1 transition hover:text-ink ${liked ? "text-ink" : ""}`}
            >
              <ReactionIcon size={15} fill={liked ? "currentColor" : "none"} />
              {likeCount > 0 ? (
                <span className="tabular-nums">{likeCount}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="transition hover:text-ink"
            >
              Reply
            </button>
            {replyCount > 0 ? (
              <button
                type="button"
                onClick={toggleReplies}
                disabled={pending}
                className="flex items-center gap-0.5 transition hover:text-ink disabled:opacity-60"
              >
                <ChevronDownIcon
                  size={13}
                  className={`transition ${expanded ? "rotate-180" : ""}`}
                />
                {pending
                  ? "Loading…"
                  : expanded
                    ? "Collapse"
                    : `${replyCount} ${replyWord(replyCount)}`}
              </button>
            ) : null}
          </div>

          <ReplyComposer
            open={replying}
            onOpenChange={setReplying}
            action={async (formData) => {
              const created = await addComment(slug, postId, formData);
              onReplied(created);
            }}
            members={members}
            commentId={comment.id}
            authorName={comment.authorName}
          />

          {showChildren ? (
            <div className="mt-1">
              {children.map((child) => (
                <CommentThread
                  key={child.id}
                  slug={slug}
                  postId={postId}
                  comment={child}
                  members={members}
                  viewerId={viewerId}
                  isOwner={isOwner}
                  depth={depth + 1}
                  autoOpen
                  onRemoved={() => {
                    setChildren((prev) => prev.filter((c) => c.id !== child.id));
                    setReplyCount((n) => Math.max(0, n - 1));
                  }}
                />
              ))}
              {hasMore ? (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={pending}
                  className="mt-1 text-xs font-medium text-faint transition hover:text-ink disabled:opacity-60"
                >
                  {pending ? "Loading…" : "Load more replies"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

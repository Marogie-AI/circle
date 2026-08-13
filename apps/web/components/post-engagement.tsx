"use client";

import { useEffect, useState } from "react";
import { CommentSection } from "@/components/comment-section";
import { PostActionBar } from "@/components/post-action-bar";
import type { Mentionable } from "@/lib/mentions";
import type { CommentPage } from "@/lib/queries/comments";

// One global preference across posts. Read after mount (never during render) so the SSR and
// client HTML match, same as the sidebar's collapse state.
const COMMENTS_OPEN_KEY = "circle:comments-open";

/**
 * Ties the post's action bar to its comment section: the comment button in the bar toggles
 * the section open/closed. Client-owned so the toggle is instant and the comment list keeps
 * its own state; the first page of comments is SSR-seeded via `initial`.
 */
export function PostEngagement({
  slug,
  postId,
  likes,
  liked,
  totalComments,
  shareUrl,
  onToggleLike,
  initial,
  members,
  viewerId,
  isOwner,
}: {
  slug: string;
  postId: string;
  likes: number;
  liked: boolean;
  totalComments: number;
  shareUrl: string;
  onToggleLike: () => Promise<void>;
  initial: CommentPage;
  members: Mentionable[];
  viewerId: string;
  isOwner: boolean;
}) {
  // Stable default for SSR; corrected from localStorage after mount.
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    try {
      setShowComments(localStorage.getItem(COMMENTS_OPEN_KEY) === "true");
    } catch {
      // Private mode or blocked storage: stay closed, nothing to recover.
    }
  }, []);

  const toggleComments = () =>
    setShowComments((v) => {
      const next = !v;
      try {
        localStorage.setItem(COMMENTS_OPEN_KEY, String(next));
      } catch {
        // Preference just won't survive a reload.
      }
      return next;
    });

  return (
    <>
      <section aria-label="Post actions" className="mt-10 pt-4">
        <PostActionBar
          likes={likes}
          liked={liked}
          comments={totalComments}
          shareUrl={shareUrl}
          onToggleLike={onToggleLike}
          commentsOpen={showComments}
          onToggleComments={toggleComments}
        />
      </section>

      {showComments ? (
        <CommentSection
          slug={slug}
          postId={postId}
          initial={initial}
          totalComments={totalComments}
          members={members}
          viewerId={viewerId}
          isOwner={isOwner}
        />
      ) : null}
    </>
  );
}

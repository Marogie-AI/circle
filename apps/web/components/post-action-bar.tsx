"use client";

import { useOptimistic, useTransition } from "react";
import { CopyButton } from "@/components/copy-button";
import { ReactionIcon } from "@/components/icons";

type LikeState = { likes: number; liked: boolean };

/**
 * One optimistic like, shared by the post bar and every comment.
 *
 * A hook rather than two components with their own copies: the post bar needs the same
 * state for BOTH its button and its summary line, so the state has to live above the
 * button. Two independent useOptimistic blocks would let the summary lag behind the
 * glyph until the server replied.
 *
 * Optimistic because waiting on a round-trip plus revalidatePath before the count moved
 * was the most-felt lag in the app.
 */
function useLike(likes: number, liked: boolean, onToggle: () => Promise<void>) {
  const [, startTransition] = useTransition();
  const [state, apply] = useOptimistic({ likes, liked }, (current: LikeState) => ({
    liked: !current.liked,
    likes: Math.max(0, current.likes + (current.liked ? -1 : 1)),
  }));

  return {
    state,
    toggle: () =>
      startTransition(async () => {
        apply(null);
        await onToggle();
      }),
  };
}

/** The glyph and its count. Presentational — the caller owns the state. */
function LikeGlyph({
  state,
  label,
  size,
  onClick,
}: {
  state: LikeState;
  label: string;
  size: "sm" | "lg";
  onClick: () => void;
}) {
  const large = size === "lg";
  return (
    <button
      type="button"
      aria-pressed={state.liked}
      aria-label={state.liked ? "Remove your like" : `Like this ${label}`}
      onClick={onClick}
      className={`flex items-center rounded-full transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 ${
        large
          ? `gap-2 px-2.5 py-1.5 text-sm ${state.liked ? "text-ink" : "text-muted"}`
          : `gap-1.5 px-2 py-1 text-xs ${state.liked ? "text-ink" : "text-faint"}`
      }`}
    >
      {/* Filled when liked. Stroke colour alone is nearly invisible in a zero-chroma
          palette — the same trap the save button hit. */}
      <ReactionIcon
        size={large ? 19 : 15}
        fill={state.liked ? "currentColor" : "none"}
      />
      {state.likes > 0 ? (
        <span className={`tabular-nums ${large ? "text-sm" : "font-medium"}`}>
          {state.likes}
        </span>
      ) : null}
    </button>
  );
}

/** The row under a post: like, copy link, then a summary of counts and the date. */
export function PostActionBar({
  likes,
  liked,
  comments,
  dateLabel,
  shareUrl,
  onToggleLike,
}: {
  likes: number;
  liked: boolean;
  comments: number;
  /** Rendered as-is; the server formats it so the markup matches on hydration. */
  dateLabel: string;
  /** Root-relative path to this post; CopyButton resolves it against the origin. */
  shareUrl: string;
  onToggleLike: () => Promise<void>;
}) {
  // One state, two readers: the glyph below and the summary line under it.
  const { state, toggle } = useLike(likes, liked, onToggleLike);

  return (
    <div>
      <div className="flex items-center gap-1">
        <LikeGlyph state={state} label="post" size="lg" onClick={toggle} />

        {/* No comment button: the comments sit directly below this bar, and the summary
            line already carries the reply count. */}
        <CopyButton
          value={shareUrl}
          variant="icon"
          ariaLabel="Copy a link to this post"
          className="flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm text-muted transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-4 border-y border-hairline py-2.5 text-sm text-muted">
        <p className="min-w-0 truncate">
          {state.likes} {state.likes === 1 ? "Like" : "Likes"} · {comments}{" "}
          {comments === 1 ? "Reply" : "Replies"}
        </p>
        <p className="shrink-0">{dateLabel}</p>
      </div>
    </div>
  );
}

/** The bare like control, for comments. Same behaviour, no summary line. */
export function LikeButton({
  likes,
  liked,
  label,
  onToggle,
}: {
  likes: number;
  liked: boolean;
  /** What is being liked, for the accessible name: "Like this comment". */
  label: string;
  onToggle: () => Promise<void>;
}) {
  const { state, toggle } = useLike(likes, liked, onToggle);
  return <LikeGlyph state={state} label={label} size="sm" onClick={toggle} />;
}

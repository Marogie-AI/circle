"use client";

import { useOptimistic, useTransition } from "react";
import { CopyIcon, ReactionIcon, TickIcon } from "@/components/icons";
import { useState } from "react";

/**
 * The row under a post: like, comment count, copy link, then a summary line.
 *
 * One like rather than six emoji. Optimistic for the same reason the old reaction bar
 * was — waiting on a round-trip plus revalidatePath before the count moved was the
 * most-felt lag in the app.
 */
export function PostActionBar({
  likes,
  liked,
  comments,
  dateLabel,
  onToggleLike,
}: {
  likes: number;
  liked: boolean;
  comments: number;
  /** Rendered as-is; the server formats it so the markup matches on hydration. */
  dateLabel: string;
  onToggleLike: () => Promise<void>;
}) {
  const [, startTransition] = useTransition();
  const [state, apply] = useOptimistic(
    { likes, liked },
    (current) => ({
      liked: !current.liked,
      likes: Math.max(0, current.likes + (current.liked ? -1 : 1)),
    }),
  );

  const action =
    "flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm text-muted transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2";

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-pressed={state.liked}
          aria-label={state.liked ? "Remove your like" : "Like this post"}
          onClick={() =>
            startTransition(async () => {
              apply(null);
              await onToggleLike();
            })
          }
          className={`${action} ${state.liked ? "text-ink" : ""}`}
        >
          {/* Filled when liked. Stroke colour alone is nearly invisible in a
              zero-chroma palette — the same trap the save button hit. */}
          <ReactionIcon
            size={19}
            fill={state.liked ? "currentColor" : "none"}
          />
          {state.likes > 0 ? (
            <span className="tabular-nums text-sm">{state.likes}</span>
          ) : null}
        </button>

        {/* No comment button: the comments sit directly below this bar, and the summary
            line already carries the reply count. */}
        <CopyLink className={action} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-4 border-y border-hairline py-2.5 text-sm text-muted">
        <p className="min-w-0 truncate">
          {state.likes} {state.likes === 1 ? "Like" : "Likes"} ·{" "}
          {comments} {comments === 1 ? "Reply" : "Replies"}
        </p>
        <p className="shrink-0">{dateLabel}</p>
      </div>
    </div>
  );
}

/**
 * The bare like control, for comments. Same optimistic behaviour as the post bar without
 * the summary line — a comment does not need its own date rule.
 */
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
  const [, startTransition] = useTransition();
  const [state, apply] = useOptimistic({ likes, liked }, (current) => ({
    liked: !current.liked,
    likes: Math.max(0, current.likes + (current.liked ? -1 : 1)),
  }));

  return (
    <button
      type="button"
      aria-pressed={state.liked}
      aria-label={state.liked ? `Remove your like` : `Like this ${label}`}
      onClick={() =>
        startTransition(async () => {
          apply(null);
          await onToggle();
        })
      }
      className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 ${
        state.liked ? "text-ink" : "text-faint"
      }`}
    >
      <ReactionIcon size={15} fill={state.liked ? "currentColor" : "none"} />
      {state.likes > 0 ? (
        <span className="tabular-nums font-medium">{state.likes}</span>
      ) : null}
    </button>
  );
}

/**
 * Copies the current post's URL. Reads location at click time rather than taking a prop,
 * so it cannot disagree with the address bar after a client navigation.
 */
function CopyLink({ className }: { className: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label="Copy a link to this post"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard can be blocked by permissions; say nothing rather than throw.
        }
      }}
    >
      {copied ? (
        <TickIcon size={18} className="text-emerald-600" />
      ) : (
        <CopyIcon size={18} />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </span>
    </button>
  );
}

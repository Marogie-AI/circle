"use client";

import { useOptimistic, useTransition } from "react";
import { BookmarkIcon } from "@/components/icons";

/** Bookmark toggle. Optimistic for the same reason as reactions: it should feel instant. */
export function SaveButton({
  saved,
  onToggle,
  variant = "icon",
}: {
  saved: boolean;
  onToggle: () => Promise<void>;
  variant?: "icon" | "labelled";
}) {
  const [, startTransition] = useTransition();
  const [isSaved, toggle] = useOptimistic(saved, (current) => !current);

  return (
    <button
      type="button"
      aria-pressed={isSaved}
      aria-label={isSaved ? "Remove from saved" : "Save for later"}
      title={isSaved ? "Saved" : "Save for later"}
      onClick={() =>
        startTransition(async () => {
          toggle(null);
          await onToggle();
        })
      }
      className={
        variant === "labelled"
          ? `inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 ${
              isSaved
                ? "border-inverse bg-inverse text-inverse-ink"
                : "border-line bg-surface text-ink hover:bg-hover"
            }`
          : `rounded-lg p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 ${
              isSaved
                ? "text-ink"
                : "text-faint hover:bg-hover hover:text-ink"
            }`
      }
    >
      <BookmarkIcon size={variant === "labelled" ? 16 : 17} />
      {variant === "labelled" ? (isSaved ? "Saved" : "Save") : null}
    </button>
  );
}

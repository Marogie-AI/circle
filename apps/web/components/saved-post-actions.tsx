"use client";

import { useTransition } from "react";
import {
  archiveSavedPost,
  markSavedRead,
  markSavedUnread,
  unarchiveSavedPost,
} from "@/app/(app)/saved/actions";

const btn =
  "rounded-lg px-2 py-1 text-xs font-medium text-muted transition hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse disabled:opacity-50";

/** Per-row read-later controls on the Saved queue. */
export function SavedPostActions({
  postId,
  read,
  archived,
}: {
  postId: string;
  read: boolean;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (archived) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => unarchiveSavedPost(postId))}
        className={btn}
      >
        Unarchive
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            read ? markSavedUnread(postId) : markSavedRead(postId),
          )
        }
        className={btn}
      >
        {read ? "Mark unread" : "Mark read"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => archiveSavedPost(postId))}
        className={btn}
      >
        Archive
      </button>
    </div>
  );
}

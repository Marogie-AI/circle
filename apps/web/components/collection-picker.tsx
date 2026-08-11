"use client";

import { useTransition } from "react";
import { setSavedCollection } from "@/app/(app)/saved/actions";

/** Small dropdown to file a saved post into one of the user's collections (or unfile). */
export function CollectionPicker({
  postId,
  current,
  collections,
}: {
  postId: string;
  current: string | null;
  collections: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label="Move to collection"
      value={current ?? ""}
      disabled={pending}
      onChange={(event) =>
        startTransition(() => setSavedCollection(postId, event.target.value))
      }
      className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-muted outline-none transition hover:text-ink focus:border-inverse focus:ring-2 focus:ring-inverse/10 disabled:opacity-50"
    >
      <option value="">Unfiled</option>
      {collections.map((collection) => (
        <option key={collection.id} value={collection.id}>
          {collection.name}
        </option>
      ))}
    </select>
  );
}

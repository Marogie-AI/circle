"use client";

import { useRef, useState, useTransition } from "react";
import { addToCollection } from "@/app/(app)/groups/[slug]/collection-actions";

/** Dropdown on a post to add it to one of the group's shared collections. */
export function AddToCollection({
  slug,
  postId,
  collections,
}: {
  slug: string;
  postId: string;
  collections: { id: string; name: string }[];
}) {
  const ref = useRef<HTMLSelectElement>(null);
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<string | null>(null);

  if (collections.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        ref={ref}
        aria-label="Add to collection"
        defaultValue=""
        disabled={pending}
        onChange={(event) => {
          const value = event.target.value;
          if (!value) return;
          const name = collections.find((c) => c.id === value)?.name ?? null;
          startTransition(async () => {
            await addToCollection(slug, value, postId);
            if (ref.current) ref.current.value = "";
            setAdded(name);
          });
        }}
        className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-muted outline-none transition hover:text-ink focus:border-inverse focus:ring-2 focus:ring-inverse/10 disabled:opacity-50"
      >
        <option value="">Add to collection…</option>
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </select>
      {added ? (
        <span className="whitespace-nowrap text-xs font-medium text-emerald-600">
          ✓ Added to {added}
        </span>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addToCollection } from "@/app/(app)/groups/[slug]/collection-actions";
import {
  BookmarkIcon,
  ChevronDownIcon,
  TickIcon,
} from "@/components/icons";

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
  const ref = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (collections.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink outline-none transition hover:bg-hover focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {selected ? <TickIcon size={16} className="text-emerald-600" /> : <BookmarkIcon size={16} />}
        <span>{pending ? "Adding…" : selected ?? "Add to collection"}</span>
        <ChevronDownIcon size={16} className="text-muted" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Add to collection"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-56 overflow-hidden rounded-xl border border-line bg-elevated p-1.5 shadow-lg"
        >
          <p className="px-2.5 pb-1 pt-1 text-xs font-medium text-faint">Add to collection</p>
          {collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                startTransition(async () => {
                  await addToCollection(slug, collection.id, postId);
                  setSelected(collection.name);
                });
              }}
              className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-ink transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
            >
              {collection.name}
            </button>
          ))}
        </div>
      ) : null}
      {selected ? <span className="sr-only" aria-live="polite">Added to {selected}</span> : null}
    </div>
  );
}

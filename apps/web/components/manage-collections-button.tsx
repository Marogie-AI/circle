"use client";

import Link from "next/link";
import { useState } from "react";
import {
  createGroupCollection,
  deleteGroupCollection,
} from "@/app/(app)/groups/[slug]/collection-actions";
import { BookmarkIcon, ClearIcon } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";

type Collection = { id: string; name: string; count: number };

/**
 * Header button that opens a modal to manage a group's shared collections — create,
 * open, delete. Keeps the feed body clean.
 */
export function ManageCollectionsButton({
  slug,
  collections,
}: {
  slug: string;
  collections: Collection[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
      >
        <BookmarkIcon size={16} />
        <span className="hidden sm:inline">Collections</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/40"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-elevated p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-ink">Collections</h2>
                <p className="mt-0.5 text-sm text-muted">Shared with everyone in this group.</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-muted transition hover:bg-hover hover:text-ink"
              >
                <ClearIcon size={18} />
              </button>
            </div>

            <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
              {collections.length ? (
                collections.map((collection) => (
                  <li key={collection.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link
                      href={`/groups/${slug}/collections/${collection.id}`}
                      className="min-w-0 flex-1 truncate font-medium text-ink hover:underline"
                    >
                      {collection.name}
                      <span className="ml-1.5 tabular-nums text-muted">{collection.count}</span>
                    </Link>
                    <form action={deleteGroupCollection.bind(null, slug, collection.id)}>
                      <SubmitButton
                        pendingLabel="…"
                        className="rounded-lg px-2 py-1 text-sm text-muted transition hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse"
                      >
                        Delete
                      </SubmitButton>
                    </form>
                  </li>
                ))
              ) : (
                <li className="py-3 text-sm text-muted">No collections yet.</li>
              )}
            </ul>

            <form action={createGroupCollection.bind(null, slug)} className="mt-4 flex items-center gap-2">
              <input
                name="name"
                required
                maxLength={50}
                placeholder="New collection"
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition placeholder:text-faint focus:border-inverse focus:ring-2 focus:ring-inverse/10"
              />
              <SubmitButton
                pendingLabel="Adding…"
                className="shrink-0 rounded-lg bg-inverse px-3 py-2 text-sm font-medium text-inverse-ink transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse focus-visible:ring-offset-2"
              >
                Create
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

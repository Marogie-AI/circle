"use client";

import { useRouter } from "next/navigation";

/** Filter the read-later queue by state, preserving the active collection. */
export function SavedStateFilter({
  activeState,
  collectionId,
}: {
  activeState: string;
  collectionId?: string;
}) {
  const router = useRouter();

  return (
    <select
      aria-label="Filter by state"
      value={activeState}
      onChange={(event) => {
        const params = new URLSearchParams();
        if (event.target.value !== "unread") params.set("state", event.target.value);
        if (collectionId) params.set("c", collectionId);
        const qs = params.toString();
        router.push(qs ? `/saved?${qs}` : "/saved");
      }}
      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none transition focus:border-inverse focus:ring-2 focus:ring-inverse/10"
    >
      <option value="unread">Unread</option>
      <option value="read">Read</option>
      <option value="archived">Archived</option>
      <option value="all">All</option>
    </select>
  );
}

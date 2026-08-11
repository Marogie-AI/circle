"use client";

import { useRouter } from "next/navigation";

/** Dropdown to filter the saved list by collection. Navigates to /saved?c=<id>. */
export function CollectionFilter({
  collections,
  activeId,
  activeState,
}: {
  collections: { id: string; name: string; count: number }[];
  activeId?: string;
  activeState?: string;
}) {
  const router = useRouter();

  return (
    <select
      aria-label="Filter by collection"
      value={activeId ?? ""}
      onChange={(event) => {
        const params = new URLSearchParams();
        if (event.target.value) params.set("c", event.target.value);
        if (activeState && activeState !== "unread") params.set("state", activeState);
        const qs = params.toString();
        router.push(qs ? `/saved?${qs}` : "/saved");
      }}
      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none transition focus:border-inverse focus:ring-2 focus:ring-inverse/10"
    >
      <option value="">All saved</option>
      {collections.map((collection) => (
        <option key={collection.id} value={collection.id}>
          {collection.name} ({collection.count})
        </option>
      ))}
    </select>
  );
}

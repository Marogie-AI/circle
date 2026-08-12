"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { feedUrl } from "@/lib/feed-url";
import { KIND_LABELS, POST_KINDS, parsePostKind } from "@/lib/kind";

/**
 * Author and sort controls for the group feed. Client-side only so a <select> can
 * navigate on change — everything it changes still lives in the URL, so the page
 * stays a server component and the state survives a refresh or a shared link.
 */
export function FeedFilters({
  slug,
  members,
  tags,
}: {
  slug: string;
  members: { id: string; name: string }[];
  tags: { tag: string; count: number }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const author = searchParams.get("author") ?? "";
  const sort = searchParams.get("sort") === "old" ? "old" : "new";
  const tag = searchParams.get("tag") ?? "";
  const kind = parsePostKind(searchParams.get("kind")) ?? "";

  function apply(key: "author" | "sort" | "tag" | "kind", value: string) {
    // resetCursor: any filter change invalidates the keyset cursor — page 2 of the old
    // ordering is meaningless under the new one.
    router.push(feedUrl(slug, searchParams, key, value, { resetCursor: true }));
  }

  return (
    // The two selects are one cluster; the form's own gap separates them from search.
    <div className="flex flex-wrap items-center gap-2">
      <Select
        label="Filter by type"
        value={kind}
        onChange={(value) => apply("kind", value)}
      >
        <option value="">All types</option>
        {POST_KINDS.map((option) => (
          <option key={option} value={option}>
            {KIND_LABELS[option]}
          </option>
        ))}
      </Select>

      <Select
        label="Filter by tag"
        value={tag}
        onChange={(value) => apply("tag", value)}
      >
        <option value="">All tags</option>
        {tags.map(({ tag: name, count }) => (
          <option key={name} value={name}>
            #{name} ({count})
          </option>
        ))}
      </Select>

      <Select
        label="Filter by author"
        value={author}
        onChange={(value) => apply("author", value)}
      >
        <option value="">All authors</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </Select>

      <Select
        label="Sort order"
        value={sort}
        onChange={(value) => apply("sort", value)}
      >
        <option value="new">Newest first</option>
        <option value="old">Oldest first</option>
      </Select>
    </div>
  );
}

/**
 * A real <select> — keyboard and mobile pickers keep working — with the OS chevron
 * suppressed. appearance-none is the point: the native arrow reserves a wide gutter
 * that cannot be narrowed or resized, which is what made these look badly spaced.
 */
function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none rounded-lg border border-line bg-surface py-2 pl-3 pr-8 text-sm text-ink outline-none transition hover:bg-hover focus:border-inverse focus:ring-2 focus:ring-inverse/10"
      >
        {children}
      </select>
      <ChevronDownIcon
        size={18}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  );
}

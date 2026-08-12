"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CardsViewIcon, TableViewIcon } from "@/components/icons";
import { feedUrl } from "@/lib/feed-url";
import {
  DEFAULT_FEED_VIEW,
  FEED_VIEWS,
  FEED_VIEW_LABELS,
  parseFeedView,
} from "@/lib/feed-view";

const ICONS = {
  cards: CardsViewIcon,
  table: TableViewIcon,
} as const;

/**
 * Cards or table, as a segmented control. Two options with a visual difference are worth
 * showing side by side rather than hiding one behind a <select> — you pick a layout by
 * recognising it, not by reading its name.
 *
 * Writes to the URL like FeedFilters does, so the page stays a server component.
 */
export function ViewToggle({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = parseFeedView(searchParams.get("view"));

  function apply(view: string) {
    router.push(
      feedUrl(
        slug,
        searchParams,
        "view",
        // The default writes no param, which keeps shared URLs clean.
        view === DEFAULT_FEED_VIEW ? "" : view,
        // Layout does not change the ordering, so the keyset cursor stays valid —
        // unlike the filters, this deliberately keeps `before`.
        { resetCursor: false },
      ),
    );
  }

  return (
    // A real <fieldset>, not role="group": same semantics, no ARIA needed. Biome's
    // useSemanticElements flags the role, and it is right.
    <fieldset className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
      <legend className="sr-only">Layout</legend>
      {FEED_VIEWS.map((view) => {
        const Icon = ICONS[view];
        const selected = active === view;
        return (
          <button
            key={view}
            type="button"
            aria-pressed={selected}
            aria-label={`${FEED_VIEW_LABELS[view]} view`}
            title={`${FEED_VIEW_LABELS[view]} view`}
            onClick={() => apply(view)}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse ${
              selected
                ? "bg-inverse text-inverse-ink"
                : "text-muted hover:bg-hover hover:text-ink"
            }`}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </fieldset>
  );
}

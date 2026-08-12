import { PageHeaderSkeleton, Skeleton } from "@/components/skeleton";

/**
 * Mirrors the feed page: same pt-9, same padding, and the same card grid — a 16:9 media
 * box over a chip, a two-line title and a metadata line — so nothing moves when the real
 * cards replace it. It used to mirror a table; the feed is a grid now.
 *
 * No eyebrow, because the header no longer has one.
 */
export default function GroupFeedLoading() {
  return (
    <main className="min-h-full w-full px-6 pb-10 pt-9 sm:px-10 sm:pb-12">
      <PageHeaderSkeleton eyebrow={false} />

      {/* Search, plus the type, tag, author and sort controls. */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Skeleton className="h-9 w-full sm:max-w-sm" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="hidden h-9 w-28 sm:block" />
          <Skeleton className="hidden h-9 w-28 sm:block" />
          <Skeleton className="hidden h-9 w-32 sm:block" />
          <Skeleton className="hidden h-9 w-32 lg:block" />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
          >
            {/* rounded-none: the card's own overflow-hidden already clips the corners. */}
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="flex flex-col gap-2 px-4 pb-3 pt-3">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
